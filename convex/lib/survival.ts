// convex/lib/survival.ts
// Pure cohort maths for the admin Survival tab (backlog/R18). No I/O: admin.survivalMetrics reads
// the rows and this file turns them into the nine numbers the panel shows. Every number is one the
// admin could re-derive from the database by hand — nothing here comes from PostHog.
import type { Tier } from './planLimits'

export const DAY_MS = 86_400_000
export const ACTIVATION_WINDOW_MS = DAY_MS

export type CohortRow = {
  createdAt: number
  subscriptionStatus: string // users.subscriptionStatus
  startedTrial: boolean // any subscriptions row exists
  cancelPending: boolean // the live subscription row has cancelAtPeriodEnd === true
  firstInteractionAt?: number // earliest userInteractions row, any time
  returnedDay1: boolean // any interaction in [createdAt + 24 h, createdAt + 48 h)
  returnedDays2to7: boolean // any interaction in [createdAt + 24 h, createdAt + 8 d)
}

export type CohortSummary = {
  signups: number
  startedTrial: number
  activated: number // firstInteractionAt - createdAt < 24 h, over the activatedEligible rows only
  medianMinutesToFirstInteraction: number | null // over rows with a first interaction; null when none
  returnedDay1: number // over the returnedDay1Eligible rows only
  returnedDays2to7: number // over the returnedDays2to7Eligible rows only
  trialsEnded: number // started a trial and the status moved past 'trialing'
  converted: number // started a trial and is 'active'
  canceled: number // 'canceled', or cancel pending on the live row
  // Eligible denominators: rows whose window has actually closed by `now`. A member who signed up
  // an hour ago cannot have "returned on day 1" yet, so counting them in the base would deflate the
  // share for a reason that has nothing to do with behaviour — in a 7-day cohort every member is
  // younger than 8 days, which would pin "returned" at 0 %. Divide each count by its own base.
  activatedEligible: number // createdAt + 24 h <= now
  returnedDay1Eligible: number // createdAt + 48 h <= now
  returnedDays2to7Eligible: number // createdAt + 8 d <= now
}

/**
 * Half-open windows relative to signup: day 1 = [24 h, 48 h), days 1–7 = [24 h, 8 d).
 * The wider window deliberately starts at 24 h too, so it is a superset of day 1 — it answers "did
 * they ever come back after the first day", not "did they come back on days 2–7". The
 * `days2to7` key name predates that reading and is kept so the stored metric stays comparable.
 */
export function returnWindows(createdAt: number): { day1: [number, number]; days2to7: [number, number] } {
  return {
    day1: [createdAt + DAY_MS, createdAt + 2 * DAY_MS],
    days2to7: [createdAt + DAY_MS, createdAt + 8 * DAY_MS]
  }
}

// Whole minutes: the middle element, or the mean of the two middles when even.
function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  const m = sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
  return Math.round(m)
}

// A trial is "over" once the user's status left 'trialing' in any direction. users.trialEndsAt is
// NOT usable here: stripe.syncUserSubscription erases it once the subscription is active.
const ENDED_STATUSES = ['active', 'canceled', 'past_due']

/** `now` is the clock the eligible denominators are measured against — admin.survivalMetrics's. */
export function summarizeCohort(rows: CohortRow[], now: number): CohortSummary {
  const minutes: number[] = []
  for (const r of rows) {
    if (r.firstInteractionAt !== undefined) minutes.push((r.firstInteractionAt - r.createdAt) / 60_000)
  }
  const trialed = rows.filter(r => r.startedTrial)
  // Each window's own closing edge, so the denominators can never drift from returnWindows(). Every
  // windowed COUNT is taken over the same closed rows as its base: a member who signed up an hour ago
  // and tapped has activated in fact, but counting them above a base that excludes them prints
  // "3 of 1 · 300%". They join both numbers the moment their window closes.
  const closed = (endOf: (r: CohortRow) => number) => rows.filter(r => endOf(r) <= now)
  const activation = closed(r => r.createdAt + ACTIVATION_WINDOW_MS)
  const day1 = closed(r => returnWindows(r.createdAt).day1[1])
  const days2to7 = closed(r => returnWindows(r.createdAt).days2to7[1])
  return {
    signups: rows.length,
    startedTrial: trialed.length,
    activated: activation.filter(
      r => r.firstInteractionAt !== undefined && r.firstInteractionAt - r.createdAt < ACTIVATION_WINDOW_MS
    ).length,
    medianMinutesToFirstInteraction: median(minutes),
    returnedDay1: day1.filter(r => r.returnedDay1).length,
    returnedDays2to7: days2to7.filter(r => r.returnedDays2to7).length,
    trialsEnded: trialed.filter(r => ENDED_STATUSES.includes(r.subscriptionStatus)).length,
    converted: trialed.filter(r => r.subscriptionStatus === 'active').length,
    canceled: rows.filter(r => r.subscriptionStatus === 'canceled' || r.cancelPending).length,
    activatedEligible: activation.length,
    returnedDay1Eligible: day1.length,
    returnedDays2to7Eligible: days2to7.length
  }
}

const TIERS: readonly Tier[] = ['starter', 'growth', 'pro', 'contact']

/** Paying = status 'active'. A member without a tier counts as starter (the app's default tier). */
export function payingByTier(users: { subscriptionStatus: string; tier?: string }[]): Record<Tier, number> {
  const out: Record<Tier, number> = { starter: 0, growth: 0, pro: 0, contact: 0 }
  for (const u of users) {
    if (u.subscriptionStatus !== 'active') continue
    const tier = TIERS.find(t => t === u.tier) ?? 'starter'
    out[tier]++
  }
  return out
}
