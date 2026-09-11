// convex/sessions.ts
// Internal session management — session tokens are issued by the OAuth callback
// and used by all protected Convex functions to derive the authenticated userId.
// Clients NEVER supply their own userId; they supply a session token, and the
// server resolves it to a user server-side.

import { internalMutation, internalQuery } from './_generated/server'
import { internal } from './_generated/api'
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

/** A full batch means rows may remain — reschedule another pass (see the reschedulers below). */
export function shouldContinueSessionPurge(deletedCount: number, batchSize: number): boolean {
  return deletedCount === batchSize
}

export const deleteExpiredSessions = internalMutation({
  args: {},
  handler: async ctx => {
    const now = Date.now()
    const expired = await ctx.db
      .query('sessions')
      .withIndex('by_expires_at', q => q.lt('expiresAt', now))
      .take(200)
    await Promise.all(expired.map(s => ctx.db.delete(s._id)))
    if (shouldContinueSessionPurge(expired.length, 200)) {
      await ctx.scheduler.runAfter(0, internal.sessions.deleteExpiredSessions, {})
    }
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
    if (shouldContinueSessionPurge(sessions.length, 200)) {
      await ctx.scheduler.runAfter(0, internal.sessions.deleteAllForUser, { userId })
    }
  }
})

// ─── OAuth state CSRF protection ─────────────────────────────────────────────

export function oauthNonceMatches(stored: string, presented: string): boolean {
  return stored === presented
}

/**
 * A stored OAuth state is consumable only when the presented browser nonce matches AND the row has
 * not expired. Pure so the validate-before-delete rule below is directly testable.
 */
export function isUsableOAuthState(
  stored: { browserNonce: string; expiresAt: number },
  presentedNonce: string,
  now: number
): boolean {
  return oauthNonceMatches(stored.browserNonce, presentedNonce) && stored.expiresAt >= now
}

export const createOAuthState = internalMutation({
  args: {
    state: v.string(),
    browserNonce: v.string(),
    plan: v.optional(v.string()),
    interval: v.optional(v.string()),
    ref: v.optional(v.string())
  },
  handler: async (ctx, { state, browserNonce, plan, interval, ref }) => {
    await ctx.db.insert('oauthStates', {
      state,
      browserNonce,
      expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
      plan,
      interval,
      ref
    })
  }
})

/** Validates the state (nonce + expiry) and deletes it only on success (single-use).
 * A failed attempt deliberately leaves the row for the legitimate browser until TTL/cleanup — a
 * wrong-nonce probe must not burn an in-flight state.
 * Returns { valid: true, plan?, interval?, ref? } on success, or { valid: false } if invalid/expired.
 */
export const validateAndConsumeOAuthState = internalMutation({
  args: { state: v.string(), browserNonce: v.string() },
  handler: async (ctx, { state, browserNonce }) => {
    const record = await ctx.db
      .query('oauthStates')
      .withIndex('by_state', q => q.eq('state', state))
      .unique()

    if (!record) return { valid: false }
    // Validate BEFORE deleting: only a fully valid presentation consumes the row. An early delete
    // would let any wrong-nonce callback destroy the legitimate browser's state.
    if (!isUsableOAuthState(record, browserNonce, Date.now())) return { valid: false }
    await ctx.db.delete(record._id)
    return { valid: true, plan: record.plan, interval: record.interval, ref: record.ref }
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
    // If batch was full, more rows may remain — reschedule immediately (drains faster than 200/hour)
    if (expired.length === 200) {
      await ctx.scheduler.runAfter(0, internal.sessions.deleteExpiredOAuthStates, {})
    }
  }
})
