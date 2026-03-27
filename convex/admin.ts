import {
  internalMutationGeneric as internalMutation,
  internalQueryGeneric as internalQuery,
  mutationGeneric as mutation,
  queryGeneric as query
} from 'convex/server'
import { v } from 'convex/values'
import type { AppSettingsDoc, MutationCtx, QueryCtx, UserDoc } from './convexTypes.js'

// SECURITY: Every admin endpoint MUST call this. Reads isAdmin directly from DB.
// Never trust client-provided "isAdmin" — always verify server-side.
async function assertAdmin(db: QueryCtx['db'] | MutationCtx['db'], userId: string): Promise<UserDoc> {
  const user = (await db.get(userId)) as UserDoc | null
  if (!user || !user.isAdmin) {
    throw new Error('Forbidden: admin access required')
  }
  return user
}

// Returns global app settings (creates default if missing)
async function getOrCreateSettings(db: MutationCtx['db']): Promise<AppSettingsDoc> {
  const existing = (await db.query('appSettings').first()) as AppSettingsDoc | null
  if (existing) return existing
  const id = await db.insert('appSettings', {
    apifySyncEnabled: false
  })
  return { _id: id, _creationTime: Date.now(), apifySyncEnabled: false }
}

// ─── Public queries/mutations (all require isAdmin check) ────────────────────

export const checkIsAdmin = query({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }: { userId: string }) => {
    const db = (ctx as unknown as QueryCtx).db
    const user = (await db.get(userId)) as UserDoc | null
    return user?.isAdmin === true
  }
})

export const getSettings = query({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }: { userId: string }) => {
    const db = (ctx as unknown as QueryCtx).db
    await assertAdmin(db, userId)
    const settings = (await db.query('appSettings').first()) as AppSettingsDoc | null
    return settings ?? { apifySyncEnabled: false, lastApifySyncAt: undefined, lastApifySyncError: undefined }
  }
})

export const toggleApifySync = mutation({
  args: { userId: v.id('users'), enabled: v.boolean() },
  handler: async (ctx, { userId, enabled }: { userId: string; enabled: boolean }) => {
    const db = (ctx as unknown as MutationCtx).db
    await assertAdmin(db, userId)
    const settings = await getOrCreateSettings(db)
    await db.patch(settings._id, { apifySyncEnabled: enabled })
  }
})

// ─── Internal functions (for cron/action use — no admin check) ───────────────

export const getSettingsInternal = internalQuery({
  args: {},
  handler: async ctx => {
    const db = (ctx as unknown as QueryCtx).db
    return (await db.query('appSettings').first()) as AppSettingsDoc | null
  }
})

export const updateSyncStatus = internalMutation({
  args: {
    lastApifySyncAt: v.number(),
    lastApifySyncError: v.optional(v.string())
  },
  handler: async (ctx, args: { lastApifySyncAt: number; lastApifySyncError?: string }) => {
    const db = (ctx as unknown as MutationCtx).db
    const settings = await db.query('appSettings').first()
    if (settings) {
      await db.patch(settings._id, {
        lastApifySyncAt: args.lastApifySyncAt,
        lastApifySyncError: args.lastApifySyncError
      })
    }
  }
})
