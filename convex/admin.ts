import type { DatabaseWriter } from './_generated/server'
import { internalMutation, internalQuery, mutation, query } from './_generated/server'
import { v } from 'convex/values'
import type { Doc } from './_generated/dataModel'
import { requireAuth } from './lib/auth'

// SECURITY: Every admin endpoint MUST call this.
// Accepts the user doc already resolved by requireAuth — never re-fetches from client ID.
function assertAdmin(user: Doc<'users'>): void {
  if (!user.isAdmin) {
    throw new Error('Forbidden: admin access required')
  }
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
        lastApifySyncAt: undefined,
        lastApifySyncError: undefined
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
    tier: v.union(
      v.literal('starter'),
      v.literal('growth'),
      v.literal('pro'),
      v.literal('contact')
    ),
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

// Returns up to 10 contact-tier users whose name contains nameQuery (case-insensitive).
// Uses the by_tier index on users to avoid a full-table scan.
// Note: users where `tier` is `undefined` are excluded from the `by_tier` index scan — they will not appear in search results.
export const searchContactUsers = query({
  args: {
    sessionToken: v.string(),
    nameQuery: v.string(),
  },
  handler: async (ctx, { sessionToken, nameQuery }) => {
    const admin = await requireAuth(ctx, sessionToken)
    assertAdmin(admin)

    if (!nameQuery) return []

    const contactUsers = await ctx.db
      .query('users')
      .withIndex('by_tier', q => q.eq('tier', 'contact'))
      .take(500)

    const q = nameQuery.toLowerCase()
    return contactUsers
      .filter(u => u.name.toLowerCase().includes(q))
      .slice(0, 10)
      .map(u => ({ _id: u._id, name: u.name }))
  },
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
