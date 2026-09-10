// convex/sessions.ts
// Internal session management — session tokens are issued by the OAuth callback
// and used by all protected Convex functions to derive the authenticated userId.
// Clients NEVER supply their own userId; they supply a session token, and the
// server resolves it to a user server-side.

import { internalMutation, internalQuery } from './_generated/server'
import { v } from 'convex/values'

// ─── Session lifetime ────────────────────────────────────────────────────────
// 15-day sliding window: an idle (or stolen-but-unused) token expires SESSION_TTL_MS after its last
// authenticated use, while active users are renewed transparently (see resolveSession /
// requireAuthAction in lib/auth.ts). Renewal is guarded to the second half of the window so the
// sessions row is written at most ~once per (TTL/2) of activity — keeping reactive invalidation of
// the queries that read it (getMe, feed) negligible.
export const SESSION_TTL_MS = 15 * 24 * 60 * 60 * 1000

/** Absolute expiry (ms) for a session minted or touched at `now`. */
export function sessionExpiryFrom(now: number): number {
  return now + SESSION_TTL_MS
}

/** True once a session is past the halfway point of its window and should be slid forward. */
export function shouldRenewSession(expiresAt: number, now: number): boolean {
  return expiresAt - now < SESSION_TTL_MS / 2
}

export const create = internalMutation({
  args: {
    token: v.string(),
    userId: v.id('users')
  },
  handler: async (ctx, { token, userId }) => {
    await ctx.db.insert('sessions', { token, userId, expiresAt: sessionExpiryFrom(Date.now()) })
  }
})

/**
 * Sliding-expiry renewal used by the action auth path (actions can't write directly, so they call
 * this via ctx.runMutation). Re-checks the guard inside the transaction so racing calls don't
 * double-write, and never resurrects an already-expired session.
 */
export const slide = internalMutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const session = await ctx.db
      .query('sessions')
      .withIndex('by_token', q => q.eq('token', token))
      .unique()
    if (!session) return
    const now = Date.now()
    if (session.expiresAt < now) return
    if (shouldRenewSession(session.expiresAt, now)) {
      await ctx.db.patch(session._id, { expiresAt: sessionExpiryFrom(now) })
    }
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
    interval: v.optional(v.string()),
    ref: v.optional(v.string())
  },
  handler: async (ctx, { state, plan, interval, ref }) => {
    await ctx.db.insert('oauthStates', {
      state,
      expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
      plan,
      interval,
      ref
    })
  }
})

/** Validates the state and deletes it (single-use).
 * Returns { valid: true, plan?, interval?, ref? } on success, or { valid: false } if invalid/expired.
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
    const ref = record.ref
    await ctx.db.delete(record._id)

    if (record.expiresAt < Date.now()) return { valid: false }
    return { valid: true, plan, interval, ref }
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
