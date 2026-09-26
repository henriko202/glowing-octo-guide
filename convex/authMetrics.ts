// convex/authMetrics.ts
// The sign-in funnel: failure writers for the OAuth callback and the admin query. The success counters are
// bumped inside the sign-in mutations themselves (sessions.ts), through lib/authMetrics.bumpAuthMetric.
import { v } from 'convex/values'
import { internalMutation, query } from './_generated/server'
import { requireAuth } from './lib/auth'
import { assertAdmin } from './admin'
import { DAY_MS } from './lib/survival'
import { windowDays } from './landingMetrics'
import { AUTH_METRIC_EVENTS, type AuthMetricEvent, bumpAuthMetric, oauthFailureValidator } from './lib/authMetrics'

export type AuthDailyMetrics = { day: string; started: number; linkedinOk: number; signedIn: number; failed: number }

export type AuthMetricsSummary = { totals: Record<AuthMetricEvent, number>; daily: AuthDailyMetrics[] }

// The daily table folds new and returning members together and every failure reason into one column; the window
// totals keep every event apart.
const DAILY_COLUMN: Record<AuthMetricEvent, Exclude<keyof AuthDailyMetrics, 'day'>> = {
  started: 'started',
  linkedin_ok_new: 'linkedinOk',
  linkedin_ok_returning: 'linkedinOk',
  signed_in_new: 'signedIn',
  signed_in_returning: 'signedIn',
  denied: 'failed',
  linkedin_error: 'failed',
  lost_cookie: 'failed',
  rejected: 'failed',
  error: 'failed'
}

// Pure projection shared by the admin query and its tests. Like the landing summary, every UTC day of the window
// is listed newest first with zeros included, so a quiet day reads as zero rather than unknown.
export function summarizeAuthMetrics(
  rows: ReadonlyArray<{ day: string; event: AuthMetricEvent; count: number }>,
  window: { sinceDay: string; days: number }
): AuthMetricsSummary {
  const totals = Object.fromEntries(AUTH_METRIC_EVENTS.map(event => [event, 0])) as Record<AuthMetricEvent, number>
  const daily = new Map<string, AuthDailyMetrics>(
    windowDays(window.sinceDay, window.days).map(day => [
      day,
      { day, started: 0, linkedinOk: 0, signedIn: 0, failed: 0 }
    ])
  )
  for (const row of rows) {
    totals[row.event] += row.count
    const day = daily.get(row.day)
    if (day) day[DAILY_COLUMN[row.event]] += row.count
  }
  return { totals, daily: [...daily.values()] }
}

// A callback that failed before LinkedIn confirmed the member counts once per attempt we issued: the state must
// name an oauthStates row, and the row keeps its failure so a replayed callback counts nothing. The row itself is
// left alone (still consumable), so a stray callback cannot spoil the member's own sign-in.
export const recordOAuthFailure = internalMutation({
  args: { state: v.string(), reason: oauthFailureValidator },
  handler: async (ctx, { state, reason }) => {
    const row = await ctx.db
      .query('oauthStates')
      .withIndex('by_state', q => q.eq('state', state))
      .unique()
    if (!row || row.failure !== undefined) return
    // The nonce cookie expires with the row, so a member who came back too late has no cookie either: that is an
    // expired attempt, not the in-app-browser cookie loss that `lost_cookie` is there to catch.
    const failure = reason === 'lost_cookie' && row.expiresAt < Date.now() ? 'rejected' : reason
    await ctx.db.patch(row._id, { failure })
    await bumpAuthMetric(ctx.db, failure)
  }
})

// An error after LinkedIn confirmed the attempt (token exchange, profile fetch or account write). The callback
// calls this only after validateAndConsumeOAuthState deleted the state, which happens once per attempt, so there
// is nothing to dedupe.
export const recordOAuthError = internalMutation({
  args: {},
  handler: async ctx => {
    await bumpAuthMetric(ctx.db, 'error')
  }
})

export const getMetrics = query({
  args: { sessionToken: v.string(), days: v.union(v.literal(7), v.literal(28)) },
  handler: async (ctx, { sessionToken, days }) => {
    const user = await requireAuth(ctx, sessionToken)
    assertAdmin(user)
    // Same window as landingMetrics.getMetrics: `days` calendar days including today.
    const sinceDay = new Date(Date.now() - (days - 1) * DAY_MS).toISOString().slice(0, 10)
    // At most 10 events × 28 days = 280 rows.
    const rows = await ctx.db
      .query('authMetrics')
      .withIndex('by_day_and_event', q => q.gte('day', sinceDay))
      .take(500)
    return { days, sinceDay, ...summarizeAuthMetrics(rows, { sinceDay, days }) }
  }
})
