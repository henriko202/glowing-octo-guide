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
 * Whether a Stripe subscription has a cancellation scheduled. Both fields count: on API
 * 2026-02-25.clover the portal cancels by setting `cancel_at` and leaves `cancel_at_period_end`
 * false, and a check on the flag alone is blind to every portal cancel.
 */
export function isCancelPending(sub: { cancel_at_period_end?: boolean | null; cancel_at?: number | null }): boolean {
  return sub.cancel_at_period_end === true || typeof sub.cancel_at === 'number'
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
 * Only Pro has a free trial (launch promotion, 2026-10-03): Starter and Growth bill at checkout.
 * Checkout grants a trial only when this AND trialEligible hold. The app imports it too, so every
 * "Try … free" label asks the same rule.
 */
export const TRIAL_PLAN = 'pro'
export function planHasTrial(plan: string): boolean {
  return plan === TRIAL_PLAN
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

/**
 * The event that first makes a row live: a trial's `created`, a paid Checkout's `created` (Checkout creates the
 * subscription once the payment succeeds), or the `updated` that follows the first payment of one born `incomplete`.
 * Only this event may void a duplicate (convex/stripe.ts), so a retry or any later event finds the row live already
 * and cannot void or notify twice.
 */
export function wentLive(prev: string | undefined, next: string): boolean {
  return LIVE_SUBSCRIPTION_STATUSES.includes(next) && !(prev !== undefined && LIVE_SUBSCRIPTION_STATUSES.includes(prev))
}

/**
 * Stripe never moves a subscription back to `incomplete`: an `incomplete` (or `incomplete_expired`) event for a row
 * already `trialing` or `active` is that subscription's own `created`, landing after its `updated`. Both carry the same
 * second, so isStaleEvent cannot order them, and applying it would lock the paying member out ('none').
 */
export function isStatusRegression(prev: string | undefined, next: string): boolean {
  return (prev === 'trialing' || prev === 'active') && (next === 'incomplete' || next === 'incomplete_expired')
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
/** backlog/R19 — a member who joined through another member's invite link gets two weeks (Pro only, like any trial). */
export const INVITED_TRIAL_PERIOD_DAYS = 14

export function trialDaysFor(user: { referredByCode?: string }): number {
  return user.referredByCode ? INVITED_TRIAL_PERIOD_DAYS : TRIAL_PERIOD_DAYS
}
