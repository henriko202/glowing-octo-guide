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
