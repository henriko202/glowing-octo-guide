// convex/sessions.ts
// Internal session management — session tokens are issued by the OAuth callback
// and used by all protected Convex functions to derive the authenticated userId.
// Clients NEVER supply their own userId; they supply a session token, and the
// server resolves it to a user server-side.

import { internalMutation, internalQuery, mutation } from './_generated/server'
import { internal } from './_generated/api'
import { ConvexError, v } from 'convex/values'
import { isPkceChallenge, isPkceVerifier, pkceChallengeFromVerifier } from './lib/pkce'

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
    challenge: v.string(),
    plan: v.optional(v.string()),
    interval: v.optional(v.string()),
    ref: v.optional(v.string())
  },
  handler: async (ctx, { state, browserNonce, challenge, plan, interval, ref }) => {
    await ctx.db.insert('oauthStates', {
      state,
      browserNonce,
      challenge,
      expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
      plan,
      interval,
      ref
    })
  }
})

/** Validates the state (nonce + expiry + PKCE challenge) and deletes it only on success (single-use).
 * A failed attempt deliberately leaves the row for the legitimate browser until TTL/cleanup — a
 * wrong-nonce probe must not burn an in-flight state. A missing/malformed challenge (a row minted
 * before the PKCE change, or a tampered row) is invalid.
 * Returns { valid: true, plan?, interval?, ref?, challenge } on success, or { valid: false }.
 */
export const validateAndConsumeOAuthState = internalMutation({
  args: { state: v.string(), browserNonce: v.string() },
  handler: async (ctx, { state, browserNonce }) => {
    const record = await ctx.db
      .query('oauthStates')
      .withIndex('by_state', q => q.eq('state', state))
      .unique()

    if (!record) return { valid: false as const }
    // Validate BEFORE deleting: only a fully valid presentation consumes the row. An early delete
    // would let any wrong-nonce callback destroy the legitimate browser's state.
    if (!isUsableOAuthState(record, browserNonce, Date.now())) return { valid: false as const }
    if (record.challenge === undefined || !isPkceChallenge(record.challenge)) return { valid: false as const }
    await ctx.db.delete(record._id)
    return {
      valid: true as const,
      plan: record.plan,
      interval: record.interval,
      ref: record.ref,
      challenge: record.challenge
    }
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

// ─── Login codes (PKCE-style verifier binding) ───────────────────────────────

/**
 * A login code lives 2 minutes: long enough for the callback redirect plus the SPA's redeem call,
 * short enough that a leaked row is worthless. Only the challenge is stored — never the verifier.
 */
export const AUTH_CODE_TTL_MS = 2 * 60 * 1000

export const createAuthCode = internalMutation({
  args: {
    code: v.string(),
    userId: v.id('users'),
    challenge: v.string(),
    plan: v.optional(v.string()),
    interval: v.optional(v.string())
  },
  handler: async (ctx, { code, userId, challenge, plan, interval }) => {
    await ctx.db.insert('authCodes', {
      code,
      userId,
      challenge,
      plan,
      interval,
      expiresAt: Date.now() + AUTH_CODE_TTL_MS
    })
  }
})

/**
 * Redeems a single-use login code for a session token. The client presents the verifier; we
 * re-derive its SHA-256 challenge and compare. On success the code row is deleted (single-use) and
 * the session is inserted here (rather than via internal.sessions.create) to keep redeem in one
 * transaction. A mismatch throws ConvexError — Convex rolls back a throwing mutation's writes, so
 * the row intentionally survives a failed attempt (nothing can be redeemed without the verifier
 * anyway; the row is TTL-cleaned). Never logs `code` or `verifier`.
 */
export const redeemAuthCode = mutation({
  args: { code: v.string(), verifier: v.string() },
  handler: async (ctx, { code, verifier }) => {
    const row = await ctx.db
      .query('authCodes')
      .withIndex('by_code', q => q.eq('code', code))
      .unique()

    if (!row || row.expiresAt < Date.now() || !isPkceVerifier(verifier)) {
      throw new ConvexError('Login could not be verified. Please try again.')
    }

    const challenge = await pkceChallengeFromVerifier(verifier)
    if (challenge !== row.challenge) {
      throw new ConvexError('Login could not be verified. Please try again.')
    }

    const sessionToken = crypto.randomUUID()
    await ctx.db.insert('sessions', {
      token: sessionToken,
      userId: row.userId,
      expiresAt: sessionExpiryFrom(Date.now())
    })
    await ctx.db.delete(row._id)
    return { sessionToken }
  }
})

export const deleteExpiredAuthCodes = internalMutation({
  args: {},
  handler: async ctx => {
    const now = Date.now()
    const expired = await ctx.db
      .query('authCodes')
      .withIndex('by_expires_at', q => q.lt('expiresAt', now))
      .take(200)
    await Promise.all(expired.map(c => ctx.db.delete(c._id)))
    // If batch was full, more rows may remain — reschedule immediately (mirrors deleteExpiredOAuthStates).
    if (expired.length === 200) {
      await ctx.scheduler.runAfter(0, internal.sessions.deleteExpiredAuthCodes, {})
    }
  }
})
