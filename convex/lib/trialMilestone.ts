// The trial converts (Stripe trial ends early) at this many combined interactions
// (made + received). The 7-day side of "50 OR 7 days" is Stripe's own trial_period_days.
export const TRIAL_INTERACTION_THRESHOLD = 50

// True only on the increment that first reaches the threshold, so endTrialEarly fires once.
export function crossesThreshold(current: number, delta: number, threshold = TRIAL_INTERACTION_THRESHOLD): boolean {
  return current < threshold && current + delta >= threshold
}

// The trial's near-end warning fires at 80% of the interaction threshold. One email, one amber
// banner — the user learns the charge is coming before it arrives (card-network trial rules).
export const TRIAL_WARNING_THRESHOLD = 40

// Stripe statuses that mean "this user already holds a subscription we must not duplicate".
// 'canceled' is deliberately absent: a canceled member may re-subscribe (without a new trial).
export const LIVE_SUBSCRIPTION_STATUSES: readonly string[] = ['trialing', 'active', 'past_due']

/** True while the member is in the amber window: at or past 40 combined, not yet at 50. */
export function isNearThreshold(combined: number): boolean {
  return combined >= TRIAL_WARNING_THRESHOLD && combined < TRIAL_INTERACTION_THRESHOLD
}

/** The row that blocks a new checkout, if any. */
export function findLiveSubscription<T extends { status: string }>(rows: readonly T[]): T | undefined {
  return rows.find(r => LIVE_SUBSCRIPTION_STATUSES.includes(r.status))
}

/**
 * The row the 50-interaction early end must target. NEVER use `.first()` on the by_user index:
 * Convex appends _creationTime to every index, so `.first()` returns the OLDEST row — which after
 * a cancel + re-subscribe is the canceled one, and ending its trial is a silent no-op.
 */
export function pickTrialingSubscription<T extends { status: string }>(rows: readonly T[]): T | undefined {
  return rows.find(r => r.status === 'trialing')
}

/**
 * Whether the 50-interaction milestone may end this trial early. A cancel-pending trial has nothing
 * to convert — it runs to the date the cancel dialog promised (the trial emails skip it the same way).
 */
export function shouldEndTrialEarly<T extends { stripeSubscriptionId?: string; cancelAtPeriodEnd?: boolean }>(
  sub: T | undefined
): sub is T & { stripeSubscriptionId: string } {
  return Boolean(sub?.stripeSubscriptionId) && !sub?.cancelAtPeriodEnd
}

/**
 * One trial per user, forever. Keyed on the subscription-row COUNT rather than user.trialEndsAt,
 * because syncUserSubscription (convex/stripe.ts) overwrites trialEndsAt with undefined for a
 * non-trial subscription — a marker that erases itself would hand a returning user a second trial.
 */
export function trialEligible(subscriptionCount: number): boolean {
  return subscriptionCount === 0
}

/**
 * With two or more live rows, the one to void: the NEWEST by Stripe's own `created`, never by
 * webhook arrival order (Stripe does not guarantee it). A row without the stamp counts as the
 * oldest, so a subscription that predates the stamp is never the one voided. Ties keep the
 * earlier row (rows arrive oldest-first from the by_user index).
 */
export function findDuplicateSubscription<T extends { status: string; stripeCreated?: number }>(
  rows: readonly T[]
): T | undefined {
  const live = rows.filter(r => LIVE_SUBSCRIPTION_STATUSES.includes(r.status))
  if (live.length < 2) return undefined
  return live.reduce((a, b) => ((b.stripeCreated ?? 0) > (a.stripeCreated ?? 0) ? b : a))
}

/** trialing → active on the same subscription row = the trial converted (backlog/R14 email). */
export function isTrialConversion(prev: string | undefined, next: string): boolean {
  return prev === 'trialing' && next === 'active'
}

/**
 * Stripe does not deliver webhook events in order. An event whose `created` is strictly older than
 * the newest one applied to the row (`subscriptions.lastEventAt`) must not be applied: it would
 * rewind status — a retried `trialing` update landing after the trial converted makes the next
 * `active` event look like a second conversion. Stripe stamps events at second resolution, so equal
 * stamps apply in arrival order (the checkout `created` and its sibling `updated` share a second).
 * Either stamp missing ⇒ never stale: rows and events that predate the stamp keep today's behavior.
 */
export function isStaleEvent(lastEventAt: number | undefined, eventCreated: number | undefined): boolean {
  return lastEventAt !== undefined && eventCreated !== undefined && eventCreated < lastEventAt
}

/** Stripe trial_period_days for a plain signup — the 7-day side of "50 OR 7 days". */
export const TRIAL_PERIOD_DAYS = 7
/** backlog/R19 — a member who joined through another member's invite link starts with two weeks. */
export const INVITED_TRIAL_PERIOD_DAYS = 14

export function trialDaysFor(user: { referredByCode?: string }): number {
  return user.referredByCode ? INVITED_TRIAL_PERIOD_DAYS : TRIAL_PERIOD_DAYS
}
