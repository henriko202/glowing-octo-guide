// convex/sessions.ts
// Internal session management — session tokens are issued by the OAuth callback
// and used by all protected Convex functions to derive the authenticated userId.
// Clients NEVER supply their own userId; they supply a session token, and the
// server resolves it to a user server-side.

import { internalMutation, internalQuery } from './_generated/server'
import { v } from 'convex/values'

export const create = internalMutation({
  args: {
    token: v.string(),
    userId: v.id('users'),
    expiresAt: v.number()
  },
  handler: async (ctx, args) => {
    await ctx.db.insert('sessions', args)
  }
})

export const getByToken = internalQuery({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    return ctx.db
      .query('sessions')
      .withIndex('by_token', q => q.eq('token', token))
      .unique()
  }
})

export const deleteByToken = internalMutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const session = await ctx.db
      .query('sessions')
      .withIndex('by_token', q => q.eq('token', token))
      .unique()
    if (session) await ctx.db.delete(session._id)
  }
})

// ─── Session cleanup (called from cron) ──────────────────────────────────────

export const deleteExpiredSessions = internalMutation({
  args: {},
  handler: async ctx => {
    const now = Date.now()
    const expired = await ctx.db
      .query('sessions')
      .withIndex('by_expires_at', q => q.lt('expiresAt', now))
      .take(200)
    await Promise.all(expired.map(s => ctx.db.delete(s._id)))
  }
})

// ─── Force-logout all sessions for a user ────────────────────────────────────

export const deleteAllForUser = internalMutation({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }) => {
    const sessions = await ctx.db
      .query('sessions')
      .withIndex('by_userId', q => q.eq('userId', userId))
      .take(200)
    await Promise.all(sessions.map(s => ctx.db.delete(s._id)))
  }
})

// ─── OAuth state CSRF protection ─────────────────────────────────────────────

export const createOAuthState = internalMutation({
  args: {
    state: v.string(),
    plan: v.optional(v.string()),
    interval: v.optional(v.string())
  },
  handler: async (ctx, { state, plan, interval }) => {
    await ctx.db.insert('oauthStates', {
      state,
      expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
      plan,
      interval
    })
  }
})

/** Validates the state and deletes it (single-use).
 * Returns { valid: true, plan?, interval? } on success, or { valid: false } if invalid/expired.
 */
export const validateAndConsumeOAuthState = internalMutation({
  args: { state: v.string() },
  handler: async (ctx, { state }) => {
    const record = await ctx.db
      .query('oauthStates')
      .withIndex('by_state', q => q.eq('state', state))
      .unique()

    if (!record) return { valid: false }
    // Read plan/interval BEFORE deleting (single-use token)
    const plan = record.plan
    const interval = record.interval
    await ctx.db.delete(record._id)

    if (record.expiresAt < Date.now()) return { valid: false }
    return { valid: true, plan, interval }
  }
})

export const deleteExpiredOAuthStates = internalMutation({
  args: {},
  handler: async ctx => {
    const now = Date.now()
    const expired = await ctx.db
      .query('oauthStates')
      .withIndex('by_expires_at', q => q.lt('expiresAt', now))
      .take(200)
    await Promise.all(expired.map(s => ctx.db.delete(s._id)))
  }
})
