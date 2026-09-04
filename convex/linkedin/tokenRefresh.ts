// convex/linkedin/tokenRefresh.ts
// Refresh cron: renews LinkedIn access tokens before they reach the retention cron's expiry
// cutoff. convex/privacy/retention.ts NULLs any token whose tokenExpiresAt is already in the
// past (daily); this cron acts on the PRE-expiry window (every 6h, more often than retention) so
// a still-refreshable token is renewed before retention ever sees it as expired. Retention stays
// a pure minimization/cleanup job and never attempts a refresh itself.
//
// Ground truth (backlog/B01-linkedin-token-refresh.md, verified 2026-08-20): the app's OAuth
// scopes are OIDC Standard-tier (`openid profile email`, see oauth.ts SCOPES) — LinkedIn does not
// issue a refresh_token for that tier, so linkedinRefreshToken is undefined for essentially every
// user and this cron is dormant/best-effort in practice. The real mitigation for expiry is a
// reconnect banner (task B01b, app/src) driven off the tokenExpiresAt this file keeps fresh when
// it can and which users.getMe now exposes to the client either way.
import { internalAction, internalQuery } from '../_generated/server'
import { v } from 'convex/values'
import { internal } from '../_generated/api'
import type { Id } from '../_generated/dataModel'
import { refreshAccessToken } from './oauth'

const REFRESH_WINDOW_MS = 7 * 24 * 60 * 60 * 1000
const REFRESH_BATCH = 100

// Pure: true when a user's token expires within [now, now + windowMs) AND a refresh token is on
// file. The by_token_expiry index (see getUsersPendingRefresh) already bounds tokenExpiresAt
// server-side; this re-checks that same range plus the refreshToken condition the index can't
// express, so the predicate stays independently testable (mirrors retention.ts's isTokenExpired).
export function isInRefreshWindow(
  u: { tokenExpiresAt?: number; linkedinRefreshToken?: string },
  now: number,
  windowMs: number
): boolean {
  return (
    typeof u.tokenExpiresAt === 'number' &&
    u.tokenExpiresAt >= now &&
    u.tokenExpiresAt < now + windowMs &&
    u.linkedinRefreshToken !== undefined
  )
}

export const getUsersPendingRefresh = internalQuery({
  args: { now: v.number(), cursor: v.optional(v.union(v.string(), v.null())) },
  handler: async (ctx, { now, cursor }) => {
    const page = await ctx.db
      .query('users')
      .withIndex('by_token_expiry', q => q.gte('tokenExpiresAt', now).lt('tokenExpiresAt', now + REFRESH_WINDOW_MS))
      .paginate({ numItems: REFRESH_BATCH, cursor: cursor ?? null })
    return {
      users: page.page
        .filter(u => isInRefreshWindow(u, now, REFRESH_WINDOW_MS))
        .map(u => ({ _id: u._id, linkedinRefreshToken: u.linkedinRefreshToken as string })),
      isDone: page.isDone,
      continueCursor: page.continueCursor
    }
  }
})

export const refreshExpiringTokens = internalAction({
  args: { cursor: v.optional(v.union(v.string(), v.null())) },
  handler: async (ctx, { cursor }) => {
    const now = Date.now()
    const {
      users,
      isDone,
      continueCursor
    }: { users: Array<{ _id: Id<'users'>; linkedinRefreshToken: string }>; isDone: boolean; continueCursor: string } =
      await ctx.runQuery(internal.linkedin.tokenRefresh.getUsersPendingRefresh, { now, cursor })

    for (const u of users) {
      try {
        const tokens = await refreshAccessToken(u.linkedinRefreshToken)
        await ctx.runMutation(internal.linkedin.auth.updateTokens, {
          userId: u._id,
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          tokenExpiresAt: Date.now() + tokens.expires_in * 1000
        })
      } catch (err) {
        // Failure isolation: one user's LinkedIn 400 (e.g. invalid_grant for an expired/revoked
        // refresh token — treated the same as "no refresh token") must not abort the batch.
        // refreshAccessToken already logs the real error server-side and throws a sanitized
        // message; log only that sanitized message here, never the token value.
        console.error(`[token-refresh] failed for user ${u._id}:`, err instanceof Error ? err.message : err)
      }
    }

    // The cursor (from ctx.db.query(...).paginate, computed BEFORE any refresh attempts above)
    // advances every run regardless of per-user success/failure, so this always terminates once
    // the whole pre-expiry window has been paged through — no starvation from rows stuck at the
    // front of the window, no infinite loop from permanently-failing rows. Mirrors
    // migrations/backfillFeedFields.ts's cursor pattern.
    if (!isDone) {
      await ctx.scheduler.runAfter(0, internal.linkedin.tokenRefresh.refreshExpiringTokens, { cursor: continueCursor })
    }
  }
})
