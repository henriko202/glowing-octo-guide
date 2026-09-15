import type { DatabaseWriter, MutationCtx } from './_generated/server'
import { internalMutation, internalQuery, mutation, query } from './_generated/server'
import { ConvexError, v } from 'convex/values'
import type { Doc, Id } from './_generated/dataModel'
import { internal } from './_generated/api'
import { requireAuth } from './lib/auth'
import { tierToRank, buildTierDefaultRow, DEFAULTS } from './lib/planLimits'
import { restampUserPostsTierRank } from './lib/feedRank'
import { type ApifyFlags, isApifyPostSyncEnabled, isApifyProfileScrapeEnabled } from './lib/apify'

// SECURITY: Every admin endpoint MUST call this.
// Accepts the user doc already resolved by requireAuth — never re-fetches from client ID.
export function assertAdmin(user: Doc<'users'>): void {
  if (!user.isAdmin) {
    throw new ConvexError('Forbidden: admin access required')
  }
}

// Pure guardrail: an admin may not ban their own account. (Banning OTHER admins
// is intentionally allowed — self-ban being blocked guarantees at least one admin
// always remains.)
export function assertNotSelfBan(adminId: string, targetId: string): void {
  if (adminId === targetId) throw new ConvexError("You can't ban yourself")
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

// Shared gate for the admin-initiated Apify triggers: auth + admin + the feature flag.
// Throws the same messages the four triggers threw inline. Returns nothing — callers schedule.
async function assertApifyTriggerEnabled(
  ctx: MutationCtx,
  sessionToken: string,
  isEnabled: (s: ApifyFlags) => boolean,
  disabledMessage: string
): Promise<void> {
  const user = await requireAuth(ctx, sessionToken)
  assertAdmin(user)
  const settings = await ctx.db.query('appSettings').first()
  if (!isEnabled(settings)) throw new ConvexError(disabledMessage)
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
    await assertApifyTriggerEnabled(
      ctx,
      sessionToken,
      isApifyPostSyncEnabled,
      'Post sync is disabled — enable it in Settings first.'
    )
    await ctx.scheduler.runAfter(0, internal.jobs.syncPostsApify.syncAllPostsViaApify, {})
  }
})

export const syncUserPosts = mutation({
  args: { sessionToken: v.string(), userId: v.id('users') },
  handler: async (ctx, { sessionToken, userId }) => {
    // syncUserPostsViaApify does NOT self-check the flag (the fan-out checks before calling),
    // so for the per-user trigger this wrapper is the only server gate.
    await assertApifyTriggerEnabled(
      ctx,
      sessionToken,
      isApifyPostSyncEnabled,
      'Post sync is disabled — enable it in Settings first.'
    )
    const target = await ctx.db.get(userId)
    if (!target) throw new ConvexError('User not found')
    if (!target.linkedinPublicIdentifier) throw new ConvexError('User has no LinkedIn URL on file.')
    await ctx.scheduler.runAfter(0, internal.jobs.syncPostsApify.syncUserPostsViaApify, { userId })
  }
})

export const syncAllProfiles = mutation({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    await assertApifyTriggerEnabled(
      ctx,
      sessionToken,
      isApifyProfileScrapeEnabled,
      'Profile scrape is disabled — enable it in Settings first.'
    )
    await ctx.scheduler.runAfter(0, internal.jobs.scrapeProfileApify.scrapeAllProfilesViaApify, {})
  }
})

export const syncUserProfile = mutation({
  args: { sessionToken: v.string(), userId: v.id('users') },
  handler: async (ctx, { sessionToken, userId }) => {
    await assertApifyTriggerEnabled(
      ctx,
      sessionToken,
      isApifyProfileScrapeEnabled,
      'Profile scrape is disabled — enable it in Settings first.'
    )
    const target = await ctx.db.get(userId)
    if (!target) throw new ConvexError('User not found')
    if (!target.linkedinPublicIdentifier) throw new ConvexError('User has no LinkedIn URL on file.')
    await ctx.scheduler.runAfter(0, internal.jobs.scrapeProfileApify.scrapeUserProfile, { userId })
  }
})

// Manual ranking-board rebuild — queues one snapshot generation per window immediately, for a fresh
// deployment (no board until the first 03:30 / 03:35 UTC cron) or an on-demand refresh without waiting.
// Not Apify-gated: it reads only already-synced data. Returns immediately; the jobs run in the background.
export const rebuildRankingSnapshotsNow = mutation({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    const admin = await requireAuth(ctx, sessionToken)
    assertAdmin(admin)
    await ctx.scheduler.runAfter(0, internal.jobs.rankingSnapshot.rebuildRankingSnapshots, { window: '7d' })
    await ctx.scheduler.runAfter(0, internal.jobs.rankingSnapshot.rebuildRankingSnapshots, { window: '30d' })
  }
})

// Exported for testing.
export function validateLimitArgs(interactionsPerPost: number, postsPerWeek: number): void {
  if (interactionsPerPost < 1 || postsPerWeek < 1) {
    throw new ConvexError('interactionsPerPost and postsPerWeek must each be >= 1')
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
    if (!targetUser) throw new ConvexError('User not found')
    if (targetUser.tier !== 'contact') throw new ConvexError('User is not on the contact tier')

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
// Self-heals (backlog/B27): if no default row exists yet for this tier (e.g. an
// environment where migrations/seedPlanLimits.ts was never run), inserts one from
// buildTierDefaultRow — the same DEFAULTS-sourced values the explicit seed and the read
// fallback use — instead of throwing. Never inserts/patches a per-user override row: the
// `userId === undefined` filter and the fresh insert (which omits userId) both stay
// scoped to the tier-default row only.
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

    let defaultRowId = tierRows.find(r => r.userId === undefined)?._id
    if (defaultRowId === undefined) {
      defaultRowId = await ctx.db.insert('planLimits', buildTierDefaultRow(tier))
    }

    await ctx.db.patch(defaultRowId, { interactionsPerPost, postsPerWeek })
  }
})

// Effective plan limits for a contact-tier user: their per-user override row if present,
// otherwise the contact tier default. Falls back to DEFAULTS.contact
// (lib/planLimits.ts — the single source of truth, backlog/B27) when no default row exists.
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
  return {
    interactionsPerPost: DEFAULTS.contact.interactionsPerPost,
    postsPerWeek: DEFAULTS.contact.postsPerWeek,
    hasOverride: false
  }
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

// ─── Survival panel (backlog/R18) ────────────────────────────────────────────
// Reads the nightly snapshot built by jobs/survivalSnapshot.ts — one row per window instead of the
// old reactive query's ~4 indexed reads per cohort member (and its silent newest-1000 cap). The
// panel is as-of the last rebuild: generatedAt is rendered by SurvivalTab. Returns null until the
// first rebuild runs. The cohort semantics live in lib/survival.summarizeCohort.
// Exported for testing: the pure projection from a stored row to the panel payload.
export function toSurvivalMetrics(snapshot: Doc<'survivalSnapshots'> | null) {
  if (!snapshot) return null
  return {
    days: snapshot.days,
    since: snapshot.since,
    generatedAt: snapshot.generatedAt,
    cohort: { ...snapshot.cohort, onboarded: snapshot.cohort.onboarded ?? 0 },
    payingByTier: snapshot.payingByTier
  }
}

export const survivalMetrics = query({
  args: { sessionToken: v.string(), days: v.union(v.literal(7), v.literal(28)) },
  handler: async (ctx, { sessionToken, days }) => {
    const admin = await requireAuth(ctx, sessionToken)
    assertAdmin(admin)

    const snapshot = await ctx.db
      .query('survivalSnapshots')
      .withIndex('by_days', q => q.eq('days', days))
      .unique()
    return toSurvivalMetrics(snapshot)
  }
})

// ─── Churn risk / attention list ─────────────────────────────────────────────
// On-demand instead of a nightly snapshot: an admin query is always fresh and adds no storage.
// One bounded `.take(1000)` over users (the same admin ceiling listUsers uses), then four indexed
// reads per member. Banned and pending-deletion accounts are skipped — they are not "members who
// need attention" — while admins are included and treated like anyone else.
const CHURN_USER_CAP = 1000
// Newest-first row ceiling per side per member. A heavy member is capped, never unbounded.
const CHURN_ROW_CAP = 200
const CHURN_DAY_MS = 86_400_000

export type ChurnReason = 'received_no_reply' | 'silent_7d' | 'cooling'

export interface ChurnSignals {
  made7d: number
  made30d: number
  received7d: number
  // Active = logged in during the last 7 days (`users.lastLoginAt`). Only `silent_7d` needs it:
  // a member who stopped showing up is a different (dormancy) problem than one who shows up and
  // does nothing.
  active: boolean
  lastInteractionAt: number | null
}

/** Reason codes for the Attention card (the UI maps them to English labels); a member can carry more than one. */
export function deriveChurnReasons({ made7d, made30d, received7d, active }: ChurnSignals): ChurnReason[] {
  const reasons: ChurnReason[] = []
  // Received attention but gave none back — the most actionable nudge.
  if (received7d > 0 && made7d === 0) reasons.push('received_no_reply')
  // Still logging in, but neither gave nor received anything this week.
  if (made7d === 0 && received7d === 0 && active) reasons.push('silent_7d')
  // This week's own pace is well below a quarter of the 30-day pace.
  if (made30d > 0 && made7d < made30d / 4) reasons.push('cooling')
  return reasons
}

export function relativeDay(ts: number, now: number): string {
  const days = Math.floor((now - ts) / CHURN_DAY_MS)
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  return `${days} days ago`
}

/** One concrete line per member, strongest signal first, built only from the computed facts. */
export function buildChurnHook(signals: ChurnSignals, now: number): string {
  const { made7d, made30d, received7d, lastInteractionAt } = signals
  if (received7d > 0 && made7d === 0) {
    return `${received7d} ${received7d === 1 ? 'interaction' : 'interactions'} on your post, no reply`
  }
  if (made7d === 0 && received7d === 0 && signals.active) {
    return lastInteractionAt === null
      ? 'no interactions yet'
      : `no interactions since ${relativeDay(lastInteractionAt, now)}`
  }
  return `${made7d} ${made7d === 1 ? 'interaction' : 'interactions'} this week, down from ${made30d} in 30 days`
}

const CHURN_SEVERITY: Record<ChurnReason, number> = { received_no_reply: 0, silent_7d: 1, cooling: 2 }

export function churnSeverity(reasons: ChurnReason[]): number {
  return reasons.reduce((min, reason) => Math.min(min, CHURN_SEVERITY[reason]), Number.POSITIVE_INFINITY)
}

// The Attention card's data source. Returns only members with at least one reason, sorted by
// severity (received_no_reply → silent_7d → cooling), then by oldest last interaction so the
// quietest member of a tier surfaces first. `null` for "never".
export const getChurnRisk = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    const admin = await requireAuth(ctx, sessionToken)
    assertAdmin(admin)

    const now = Date.now()
    const since7 = now - 7 * CHURN_DAY_MS
    const since30 = now - 30 * CHURN_DAY_MS

    const users = await ctx.db.query('users').order('desc').take(CHURN_USER_CAP)

    const rows = await Promise.all(
      users
        .filter(u => !u.isBanned && u.deletionScheduledAt === undefined)
        .map(async user => {
          // One read covers both windows: the 30d range newest-first, then count its 7d subset in
          // memory instead of a second index read. `ai_draft` rows are not engagement the member
          // initiated (the draft was never posted), so both counts and `lastInteractionAt` drop them.
          const madeRows = await ctx.db
            .query('userInteractions')
            .withIndex('by_user', q => q.eq('userId', user._id).gte('_creationTime', since30))
            .order('desc')
            .take(CHURN_ROW_CAP)
          const made = madeRows.filter(r => r.kind !== 'ai_draft')
          const made7d = made.filter(r => r._creationTime >= since7).length
          const made30d = made.length

          const receivedRows = await ctx.db
            .query('userInteractions')
            .withIndex('by_author', q => q.eq('authorId', user._id).gte('_creationTime', since7))
            .order('desc')
            .take(CHURN_ROW_CAP)
          // `by_author` includes the author's own rows; received never counts self.
          const received7d = receivedRows.filter(r => r.userId !== user._id).length

          // Newest own engagement of any age. The filter keeps a draft-only member from reading as
          // active; the index range is this member's history, so the scan is bounded by their rows.
          const lastInteraction = await ctx.db
            .query('userInteractions')
            .withIndex('by_user', q => q.eq('userId', user._id))
            .order('desc')
            .filter(q => q.neq(q.field('kind'), 'ai_draft'))
            .first()

          const lastPost = await ctx.db
            .query('posts')
            .withIndex('by_author_and_publishedAt', q => q.eq('authorId', user._id))
            .order('desc')
            .filter(q => q.and(q.eq(q.field('hidden'), false), q.eq(q.field('deletedAt'), undefined)))
            .first()

          const signals: ChurnSignals = {
            made7d,
            made30d,
            received7d,
            active: user.lastLoginAt !== undefined && user.lastLoginAt >= since7,
            lastInteractionAt: lastInteraction?.createdAt ?? null
          }
          const reasons = deriveChurnReasons(signals)
          if (reasons.length === 0) return null

          return {
            userId: user._id,
            name: user.name,
            headline: user.headline,
            profilePictureUrl: user.profilePictureUrl,
            made7d,
            made30d,
            received7d,
            lastInteractionAt: signals.lastInteractionAt,
            lastPostAt: lastPost?.publishedAt ?? null,
            reasons,
            hook: buildChurnHook(signals, now),
            severity: churnSeverity(reasons)
          }
        })
    )

    return rows
      .filter((row): row is NonNullable<typeof row> => row !== null)
      .sort(
        (a, b) =>
          a.severity - b.severity ||
          (a.lastInteractionAt ?? 0) - (b.lastInteractionAt ?? 0) ||
          a.userId.localeCompare(b.userId)
      )
      .map(({ severity: _severity, ...row }) => row)
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
    if (!targetUser) throw new ConvexError('User not found')

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
    if (!targetUser) throw new ConvexError('User not found')

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
    if (!targetUser) throw new ConvexError('User not found')

    const trimmed = reason?.trim()
    if (trimmed && trimmed.length > 500) {
      throw new ConvexError('Ban reason must be 500 characters or fewer.')
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
    if (!targetUser) throw new ConvexError('User not found')

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
