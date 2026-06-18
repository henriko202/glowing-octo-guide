import type { DatabaseWriter } from './_generated/server'
import { internalMutation, internalQuery, mutation, query } from './_generated/server'
import { v } from 'convex/values'
import type { Doc, Id } from './_generated/dataModel'
import { internal } from './_generated/api'
import { requireAuth } from './lib/auth'
import { tierToRank } from './lib/planLimits'
import { restampUserPostsTierRank } from './lib/feedRank'
import { isApifyPostSyncEnabled, isApifyProfileScrapeEnabled } from './lib/apify'

// SECURITY: Every admin endpoint MUST call this.
// Accepts the user doc already resolved by requireAuth — never re-fetches from client ID.
export function assertAdmin(user: Doc<'users'>): void {
  if (!user.isAdmin) {
    throw new Error('Forbidden: admin access required')
  }
}

// Pure guardrail: an admin may not ban their own account. (Banning OTHER admins
// is intentionally allowed — self-ban being blocked guarantees at least one admin
// always remains.)
export function assertNotSelfBan(adminId: string, targetId: string): void {
  if (adminId === targetId) throw new Error("You can't ban yourself")
}

// Returns global app settings (creates default if missing)
async function getOrCreateSettings(db: DatabaseWriter): Promise<Doc<'appSettings'>> {
  const existing = await db.query('appSettings').first()
  if (existing) return existing
  const id = await db.insert('appSettings', {
    apifySyncEnabled: false
  })
  const created = await db.get(id)
  if (!created) throw new Error('Failed to create settings')
  return created
}

export const checkIsAdmin = query({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, { sessionToken }) => {
    if (!sessionToken) return false
    try {
      const user = await requireAuth(ctx, sessionToken)
      return user.isAdmin === true
    } catch {
      return false
    }
  }
})

export const getSettings = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    const user = await requireAuth(ctx, sessionToken)
    assertAdmin(user)
    const settings = await ctx.db.query('appSettings').first()
    return (
      settings ?? {
        apifySyncEnabled: false,
        apifyEnabled: true,
        apifyProfileScrapeEnabled: false,
        lastApifySyncAt: undefined,
        lastApifySyncError: undefined,
        lastProfileScrapeAt: undefined,
        lastProfileScrapeError: undefined
      }
    )
  }
})

export const toggleApifySync = mutation({
  args: { sessionToken: v.string(), enabled: v.boolean() },
  handler: async (ctx, { sessionToken, enabled }) => {
    const user = await requireAuth(ctx, sessionToken)
    assertAdmin(user)
    const settings = await getOrCreateSettings(ctx.db)
    await ctx.db.patch(settings._id, { apifySyncEnabled: enabled })
  }
})

export const toggleApifyEnabled = mutation({
  args: { sessionToken: v.string(), enabled: v.boolean() },
  handler: async (ctx, { sessionToken, enabled }) => {
    const user = await requireAuth(ctx, sessionToken)
    assertAdmin(user)
    const settings = await getOrCreateSettings(ctx.db)
    await ctx.db.patch(settings._id, { apifyEnabled: enabled })
  }
})

export const toggleApifyProfileScrape = mutation({
  args: { sessionToken: v.string(), enabled: v.boolean() },
  handler: async (ctx, { sessionToken, enabled }) => {
    const user = await requireAuth(ctx, sessionToken)
    assertAdmin(user)
    const settings = await getOrCreateSettings(ctx.db)
    await ctx.db.patch(settings._id, { apifyProfileScrapeEnabled: enabled })
  }
})

// ─── Manual Apify sync triggers (admin-initiated, flag-gated) ────────────────
// Each respects the same toggles the crons honor: a trigger runs only when its feature flag
// (+ the master switch) is on. The UI also gates these, but THIS server check is the real
// control — a stale client or a direct API call still can't run a disabled integration.
// All four schedule the (slow, paid) job and return immediately so the request never blocks.

export const syncAllPosts = mutation({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    const user = await requireAuth(ctx, sessionToken)
    assertAdmin(user)
    const settings = await ctx.db.query('appSettings').first()
    if (!isApifyPostSyncEnabled(settings)) {
      throw new Error('Post sync is disabled — enable it in Settings first.')
    }
    await ctx.scheduler.runAfter(0, internal.jobs.syncPosts.syncAllPosts, {})
  }
})

export const syncUserPosts = mutation({
  args: { sessionToken: v.string(), userId: v.id('users') },
  handler: async (ctx, { sessionToken, userId }) => {
    const admin = await requireAuth(ctx, sessionToken)
    assertAdmin(admin)
    const settings = await ctx.db.query('appSettings').first()
    // syncUserPostsViaApify does NOT self-check the flag (the fan-out checks before calling),
    // so for the per-user trigger this wrapper is the only server gate.
    if (!isApifyPostSyncEnabled(settings)) {
      throw new Error('Post sync is disabled — enable it in Settings first.')
    }
    const target = await ctx.db.get(userId)
    if (!target) throw new Error('User not found')
    if (!target.linkedinPublicIdentifier) throw new Error('User has no LinkedIn URL on file.')
    await ctx.scheduler.runAfter(0, internal.jobs.syncPostsApify.syncUserPostsViaApify, { userId })
  }
})

export const syncAllProfiles = mutation({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    const user = await requireAuth(ctx, sessionToken)
    assertAdmin(user)
    const settings = await ctx.db.query('appSettings').first()
    if (!isApifyProfileScrapeEnabled(settings)) {
      throw new Error('Profile scrape is disabled — enable it in Settings first.')
    }
    await ctx.scheduler.runAfter(0, internal.jobs.scrapeProfileApify.scrapeAllProfilesViaApify, {})
  }
})

export const syncUserProfile = mutation({
  args: { sessionToken: v.string(), userId: v.id('users') },
  handler: async (ctx, { sessionToken, userId }) => {
    const admin = await requireAuth(ctx, sessionToken)
    assertAdmin(admin)
    const settings = await ctx.db.query('appSettings').first()
    if (!isApifyProfileScrapeEnabled(settings)) {
      throw new Error('Profile scrape is disabled — enable it in Settings first.')
    }
    const target = await ctx.db.get(userId)
    if (!target) throw new Error('User not found')
    if (!target.linkedinPublicIdentifier) throw new Error('User has no LinkedIn URL on file.')
    await ctx.scheduler.runAfter(0, internal.jobs.scrapeProfileApify.scrapeUserProfile, { userId })
  }
})

// Exported for testing.
export function validateLimitArgs(interactionsPerPost: number, postsPerWeek: number): void {
  if (interactionsPerPost < 1 || postsPerWeek < 1) {
    throw new Error('interactionsPerPost and postsPerWeek must each be >= 1')
  }
}

// Returns all planLimits rows, enriched with userName for contact per-user overrides.
export const listPlanLimits = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    const user = await requireAuth(ctx, sessionToken)
    assertAdmin(user)
    // Bounded: 4 tier defaults + one row per contact-tier custom override. 500 is a safe ceiling.
    const rows = await ctx.db.query('planLimits').take(500)
    return await Promise.all(
      rows.map(async row => {
        let userName: string | undefined
        if (row.userId) {
          const u = await ctx.db.get(row.userId)
          userName = u?.name
        }
        return { ...row, userName }
      })
    )
  }
})

// Upserts a per-user plan limit override for a contact-tier user.
export const setContactUserLimit = mutation({
  args: {
    sessionToken: v.string(),
    userId: v.id('users'),
    interactionsPerPost: v.number(),
    postsPerWeek: v.number()
  },
  handler: async (ctx, { sessionToken, userId, interactionsPerPost, postsPerWeek }) => {
    const admin = await requireAuth(ctx, sessionToken)
    assertAdmin(admin)
    validateLimitArgs(interactionsPerPost, postsPerWeek)

    const targetUser = await ctx.db.get(userId)
    if (!targetUser) throw new Error('User not found')
    if (targetUser.tier !== 'contact') throw new Error('User is not on the contact tier')

    const existing = await ctx.db
      .query('planLimits')
      .withIndex('by_user', q => q.eq('userId', userId))
      .unique()

    if (existing) {
      await ctx.db.patch(existing._id, { interactionsPerPost, postsPerWeek })
    } else {
      await ctx.db.insert('planLimits', {
        tier: 'contact',
        userId,
        interactionsPerPost,
        postsPerWeek
      })
    }
  }
})

// Deletes a contact-tier per-user limit override (reverts user to tier default).
export const removeContactUserLimit = mutation({
  args: {
    sessionToken: v.string(),
    userId: v.id('users')
  },
  handler: async (ctx, { sessionToken, userId }) => {
    const admin = await requireAuth(ctx, sessionToken)
    assertAdmin(admin)

    const existing = await ctx.db
      .query('planLimits')
      .withIndex('by_user', q => q.eq('userId', userId))
      .unique()

    if (existing) {
      await ctx.db.delete(existing._id)
    }
    // No-op if no override exists
  }
})

// Updates the default limits for a tier's default row (the row without userId).
// Filters JS-side to isolate the default row and avoid touching per-user overrides
// that share the same tier value in the by_tier index.
export const updateTierDefault = mutation({
  args: {
    sessionToken: v.string(),
    tier: v.union(v.literal('starter'), v.literal('growth'), v.literal('pro'), v.literal('contact')),
    interactionsPerPost: v.number(),
    postsPerWeek: v.number()
  },
  handler: async (ctx, { sessionToken, tier, interactionsPerPost, postsPerWeek }) => {
    const admin = await requireAuth(ctx, sessionToken)
    assertAdmin(admin)
    validateLimitArgs(interactionsPerPost, postsPerWeek)

    const tierRows = await ctx.db
      .query('planLimits')
      .withIndex('by_tier', q => q.eq('tier', tier))
      .collect()

    const defaultRow = tierRows.find(r => r.userId === undefined)
    if (!defaultRow) {
      throw new Error('No default row found for tier — run seedPlanLimits first')
    }

    await ctx.db.patch(defaultRow._id, { interactionsPerPost, postsPerWeek })
  }
})

// Effective plan limits for a contact-tier user: their per-user override row if present,
// otherwise the contact tier default. Falls back to the hardcoded contact default
// (matches DEFAULTS.contact in lib/planLimits.ts) when no default row exists.
// Exported for unit testing.
export function effectiveContactLimits(
  override: { interactionsPerPost: number; postsPerWeek: number } | undefined,
  contactDefault: { interactionsPerPost: number; postsPerWeek: number } | undefined
): { interactionsPerPost: number; postsPerWeek: number; hasOverride: boolean } {
  if (override) {
    return {
      interactionsPerPost: override.interactionsPerPost,
      postsPerWeek: override.postsPerWeek,
      hasOverride: true
    }
  }
  if (contactDefault) {
    return {
      interactionsPerPost: contactDefault.interactionsPerPost,
      postsPerWeek: contactDefault.postsPerWeek,
      hasOverride: false
    }
  }
  return { interactionsPerPost: 200, postsPerWeek: 5, hasOverride: false }
}

// Returns every contact-tier user with their effective plan limits, for the read-only
// Plan Limits tab. Per-user limit editing lives in the Users tab (setContactUserLimit).
// Uses the by_tier index on users to avoid a full-table scan. Bounded take(500).
// Note: users where `tier` is `undefined` are excluded from the by_tier index scan.
export const listContactUsersWithLimits = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    const admin = await requireAuth(ctx, sessionToken)
    assertAdmin(admin)

    const contactUsers = await ctx.db
      .query('users')
      .withIndex('by_tier', q => q.eq('tier', 'contact'))
      .take(500)

    // Read all contact planLimits rows once (default row + per-user overrides), then index by userId.
    const contactRows = await ctx.db
      .query('planLimits')
      .withIndex('by_tier', q => q.eq('tier', 'contact'))
      .take(500)
    const contactDefault = contactRows.find(r => r.userId === undefined)
    const overrideByUser = new Map(
      contactRows.filter(r => r.userId !== undefined).map(r => [r.userId as Id<'users'>, r] as const)
    )

    return contactUsers
      .map(u => {
        const limits = effectiveContactLimits(overrideByUser.get(u._id), contactDefault)
        return { _id: u._id, name: u.name, ...limits }
      })
      .sort((a, b) => a.name.localeCompare(b.name))
  }
})

// Returns all users sorted by most recently created, with fields needed for admin management.
// Sensitive fields (tokens, stripe IDs) are omitted — only public/admin-useful data is returned.
export const listUsers = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    const admin = await requireAuth(ctx, sessionToken)
    assertAdmin(admin)

    // Bounded take — admin tool; 1000 is a safe ceiling for early-stage.
    const users = await ctx.db.query('users').order('desc').take(1000)

    return users.map(u => ({
      _id: u._id,
      name: u.name,
      headline: u.headline,
      tier: u.tier,
      subscriptionStatus: u.subscriptionStatus,
      isBanned: u.isBanned,
      createdAt: u._creationTime,
      // Public profile slug — used by the Users tab to gate the per-row sync actions.
      linkedinPublicIdentifier: u.linkedinPublicIdentifier
    }))
  }
})

// Sets a user's tier. Can be used to promote to 'contact' or change between any tiers.
// When promoting to 'contact', automatically seeds a planLimits override entry using
// the contact tier's current default values — so the user is fully covered in one step.
// If a planLimits override already exists for this user, it is left untouched.
export const setUserTier = mutation({
  args: {
    sessionToken: v.string(),
    userId: v.id('users'),
    tier: v.union(v.literal('starter'), v.literal('growth'), v.literal('pro'), v.literal('contact'))
  },
  handler: async (ctx, { sessionToken, userId, tier }) => {
    const admin = await requireAuth(ctx, sessionToken)
    assertAdmin(admin)

    const targetUser = await ctx.db.get(userId)
    if (!targetUser) throw new Error('User not found')

    await ctx.db.patch(userId, { tier })

    // Keep the denormalized authorTierRank/feedRank on the user's posts in sync with the new
    // tier — same as the Stripe webhook paths. Without this, an admin tier change would leave
    // the user's posts sorting at their previous tier until the next Stripe sync re-stamped them.
    await restampUserPostsTierRank(ctx, userId, tierToRank(tier))

    // When promoting to contact, auto-seed a planLimits override so the user is
    // immediately subject to the plan limits system without a separate admin step.
    if (tier === 'contact') {
      const existing = await ctx.db
        .query('planLimits')
        .withIndex('by_user', q => q.eq('userId', userId))
        .unique()

      if (!existing) {
        const contactDefaults = await ctx.db
          .query('planLimits')
          .withIndex('by_tier', q => q.eq('tier', 'contact'))
          .take(10)
        const contactDefault = contactDefaults.find(r => r.userId === undefined)

        if (contactDefault) {
          await ctx.db.insert('planLimits', {
            tier: 'contact',
            userId,
            interactionsPerPost: contactDefault.interactionsPerPost,
            postsPerWeek: contactDefault.postsPerWeek
          })
        }
      }
    }
  }
})

// Sets a user's subscription status directly. Admin override — primarily used to take a
// user out of `trialing` (which hides their posts from the shared feed) without waiting on
// Stripe. NOTE: this is a manual override; a later Stripe webhook (stripe.ts) may overwrite it.
// Touches only subscriptionStatus — tier and Stripe records are left untouched.
export const setUserSubscriptionStatus = mutation({
  args: {
    sessionToken: v.string(),
    userId: v.id('users'),
    status: v.union(
      v.literal('trialing'),
      v.literal('active'),
      v.literal('canceled'),
      v.literal('past_due'),
      v.literal('none')
    )
  },
  handler: async (ctx, { sessionToken, userId, status }) => {
    const admin = await requireAuth(ctx, sessionToken)
    assertAdmin(admin)

    const targetUser = await ctx.db.get(userId)
    if (!targetUser) throw new Error('User not found')

    await ctx.db.patch(userId, { subscriptionStatus: status })
  }
})

// Bans a user — hard lockout enforced centrally in requireAuth. Admin-only.
// reason is optional and user-visible (shown on the banned screen).
export const banUser = mutation({
  args: {
    sessionToken: v.string(),
    userId: v.id('users'),
    reason: v.optional(v.string())
  },
  handler: async (ctx, { sessionToken, userId, reason }) => {
    const admin = await requireAuth(ctx, sessionToken)
    assertAdmin(admin)
    assertNotSelfBan(admin._id, userId)

    const targetUser = await ctx.db.get(userId)
    if (!targetUser) throw new Error('User not found')

    const trimmed = reason?.trim()
    if (trimmed && trimmed.length > 500) {
      throw new Error('Ban reason must be 500 characters or fewer.')
    }
    await ctx.db.patch(userId, {
      isBanned: true,
      bannedAt: Date.now(),
      bannedBy: admin._id,
      ...(trimmed ? { bannedReason: trimmed } : {})
    })
  }
})

// Unbans a user — clears all ban fields. Admin-only.
export const unbanUser = mutation({
  args: {
    sessionToken: v.string(),
    userId: v.id('users')
  },
  handler: async (ctx, { sessionToken, userId }) => {
    const admin = await requireAuth(ctx, sessionToken)
    assertAdmin(admin)

    const targetUser = await ctx.db.get(userId)
    if (!targetUser) throw new Error('User not found')

    await ctx.db.patch(userId, {
      isBanned: false,
      bannedAt: undefined,
      bannedBy: undefined,
      bannedReason: undefined
    })
  }
})

// ─── Internal functions (for cron/action use — no admin check) ───────────────

export const getSettingsInternal = internalQuery({
  args: {},
  handler: async ctx => {
    return ctx.db.query('appSettings').first()
  }
})

export const updateSyncStatus = internalMutation({
  args: {
    lastApifySyncAt: v.number(),
    lastApifySyncError: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const settings = await ctx.db.query('appSettings').first()
    if (settings) {
      await ctx.db.patch(settings._id, {
        lastApifySyncAt: args.lastApifySyncAt,
        lastApifySyncError: args.lastApifySyncError
      })
    }
  }
})

// Records the profile-scrape fan-out's last run + error, parallel to updateSyncStatus.
export const updateProfileScrapeStatus = internalMutation({
  args: {
    lastProfileScrapeAt: v.number(),
    lastProfileScrapeError: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const settings = await ctx.db.query('appSettings').first()
    if (settings) {
      await ctx.db.patch(settings._id, {
        lastProfileScrapeAt: args.lastProfileScrapeAt,
        lastProfileScrapeError: args.lastProfileScrapeError
      })
    }
  }
})
