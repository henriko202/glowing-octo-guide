// convex/lib/authMetrics.ts
// Sign-in funnel counters: one `authMetrics` row per (UTC day, event) holding a count, and nothing that
// identifies a member, a browser or an attempt. A leaf module on purpose: sessions.ts bumps these counters and
// lib/auth.ts imports sessions.ts, so the admin query's module (which imports lib/auth.ts) cannot host them.
import { type Infer, v } from 'convex/values'
import type { DatabaseWriter } from '../_generated/server'

// Why a sign-in stopped before LinkedIn confirmed the member. Stored once on its oauthStates row.
export const oauthFailureValidator = v.union(
  v.literal('denied'),
  v.literal('linkedin_error'),
  v.literal('lost_cookie'),
  v.literal('rejected')
)

export const authMetricEventValidator = v.union(
  v.literal('started'),
  v.literal('linkedin_ok_new'),
  v.literal('linkedin_ok_returning'),
  v.literal('signed_in_new'),
  v.literal('signed_in_returning'),
  v.literal('denied'),
  v.literal('linkedin_error'),
  v.literal('lost_cookie'),
  v.literal('rejected'),
  v.literal('error')
)

export type AuthMetricEvent = Infer<typeof authMetricEventValidator>
export type OAuthFailureReason = Infer<typeof oauthFailureValidator>

export const AUTH_METRIC_EVENTS: AuthMetricEvent[] = authMetricEventValidator.members.map(member => member.value)

// Adds one to today's (UTC) counter, inside the caller's transaction: a sign-in step that rolls back counts nothing.
// ponytail: one row per (day, event) is a hot row. Concurrent sign-ins conflict on it and Convex's OCC retries
// absorb that at today's volume; shard the counter (@convex-dev/sharded-counter) if sign-ins burst to many per second.
export async function bumpAuthMetric(db: DatabaseWriter, event: AuthMetricEvent): Promise<void> {
  const day = new Date().toISOString().slice(0, 10)
  const existing = await db
    .query('authMetrics')
    .withIndex('by_day_and_event', q => q.eq('day', day).eq('event', event))
    .unique()
  if (existing) await db.patch(existing._id, { count: existing.count + 1 })
  else await db.insert('authMetrics', { day, event, count: 1 })
}
