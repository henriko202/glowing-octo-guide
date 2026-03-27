import type { DatabaseReader, DatabaseWriter } from './_generated/server'
import { internalMutation, internalQuery, mutation, query } from './_generated/server'
import { v } from 'convex/values'
import type { Doc, Id } from './_generated/dataModel' // SECURITY: Every admin endpoint MUST call this. Reads isAdmin directly from DB.

// SECURITY: Every admin endpoint MUST call this. Reads isAdmin directly from DB.
// Never trust client-provided "isAdmin" — always verify server-side.
async function assertAdmin(db: DatabaseReader, userId: Id<'users'>): Promise<Doc<'users'>> {
  const user = await db.get(userId)
  if (!user || !user.isAdmin) {
    throw new Error('Forbidden: admin access required')
  }
  return user
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

// ─── Public queries/mutations (all require isAdmin check) ────────────────────

export const checkIsAdmin = query({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }) => {
    const user = await ctx.db.get(userId)
    return user?.isAdmin === true
  }
})

export const getSettings = query({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }) => {
    await assertAdmin(ctx.db, userId)
    const settings = await ctx.db.query('appSettings').first()
    return settings ?? { apifySyncEnabled: false }
  }
})

export const toggleApifySync = mutation({
  args: { userId: v.id('users'), enabled: v.boolean() },
  handler: async (ctx, { userId, enabled }) => {
    await assertAdmin(ctx.db, userId)
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
