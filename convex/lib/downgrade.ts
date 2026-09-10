// backlog/B07 — the scheduled cross-tier downgrade, decided here so it can be tested.
//
// Why a schedule at all: the Customer Portal runs proration_behavior 'always_invoice' (D7) and only
// defers a switch between prices that share a PRODUCT. Starter/Growth/Pro are three products, and no
// rearrangement fixes that — Stripe refuses a portal config whose product carries two prices of the
// same interval ("For each product, its price must have unique billing intervals", proven
// 2026-09-09). So a cross-tier downgrade leaves the portal: our own subscription schedule swaps the
// item price at current_period_end with proration_behavior 'none', and nothing is ever credited.
//
// This module holds only decisions. The Stripe calls live in billingNode.ts (a 'use node' action
// file, which the repo's test setup cannot run) and the row writes in stripe.ts (a Convex mutation).
import { ConvexError } from 'convex/values'
import { tierToRank } from './planLimits'

export type PlanChangeDirection = 'up' | 'down' | 'same'

/**
 * Which way a plan change goes — by TIER RANK, never by price amount or price-id order (a decoy
 * ladder makes amounts a liar, and ids carry no order at all). tierToRank is the one rank source.
 * Same tier, different interval reads as `same`: that is not a downgrade, and the portal already
 * defers it to period end with no credit, because both prices sit on one product.
 */
export function planChangeDirection(fromTier: string, toTier: string): PlanChangeDirection {
  const from = tierToRank(fromTier)
  const to = tierToRank(toTier)
  if (to < from) return 'down'
  if (to > from) return 'up'
  return 'same'
}

// ── Schedule phases ──────────────────────────────────────────────────────────────────────────────
// Structural mirrors of the Stripe SDK's shapes, narrow enough to build a fixture by hand. Stripe's
// real SubscriptionSchedule is assignable to ScheduleIn, and SchedulePhaseOut is assignable to
// SubscriptionScheduleUpdateParams.Phase — the compiler checks both at the call site.

type PriceRef = string | { id: string }
type DiscountIn = { coupon?: unknown; discount?: unknown; promotion_code?: unknown }

export interface SchedulePhaseIn {
  start_date: number
  end_date: number
  items: Array<{ price: PriceRef; quantity?: number | null }>
  discounts?: DiscountIn[] | null
  metadata?: Record<string, string> | null
  /** Seen and deliberately NOT carried — see buildDowngradePhases. */
  trial_end?: number | null
}

export interface ScheduleIn {
  current_phase: { start_date: number; end_date?: number } | null
  phases: SchedulePhaseIn[]
}

export interface SchedulePhaseOut {
  items: Array<{ price: string; quantity: number }>
  start_date?: number
  end_date?: number
  duration?: { interval: 'month' | 'year'; interval_count: number }
  proration_behavior?: 'none'
  discounts?: Array<{ coupon?: string; discount?: string; promotion_code?: string }>
  metadata?: Record<string, string>
}

const idOf = (value: unknown): string | undefined => {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object' && 'id' in value) {
    const id = (value as { id: unknown }).id
    if (typeof id === 'string') return id
  }
  return undefined
}

/**
 * One discount as the update endpoint wants it: exactly ONE of the three id fields. An existing
 * `discount` id wins, because reusing it keeps a consumed `once` coupon consumed; a raw `coupon` or
 * `promotion_code` would mint a fresh discount instead.
 */
function carryDiscount(d: DiscountIn): { coupon?: string; discount?: string; promotion_code?: string } | null {
  const discount = idOf(d.discount)
  if (discount) return { discount }
  const coupon = idOf(d.coupon)
  if (coupon) return { coupon }
  const promotion_code = idOf(d.promotion_code)
  if (promotion_code) return { promotion_code }
  return null
}

/**
 * The two phases of a downgrade schedule: the period the member has already paid for, then the
 * cheaper tier for one interval.
 *
 * Phase 0 repeats the current phase IN FULL because Stripe removes whatever an update omits from it
 * ("Include all items and settings of the current phase in the update… Stripe removes omitted
 * parameters"). `trial_end` is the one thing deliberately not carried: this path runs for `active`
 * subscriptions only, whose trial is over, and Stripe rejects a trial_end in the past.
 *
 * Phase 1 carries `proration_behavior: 'none'` — a phase's setting governs the transition INTO it,
 * so this single line is what closes the credit gap. Its `duration` is one billing interval of the
 * TARGET price, after which `end_behavior: 'release'` hands the subscription back untouched.
 * (`iterations` is gone from the current API; `duration` replaced it.)
 *
 * A promotion code from Checkout (`allow_promotion_codes`) carries into both phases: dropping it
 * from phase 1 would break a running repeating/forever code. Ceiling: an already-consumed `once`
 * code can apply once more on the first cheaper invoice.
 */
export function buildDowngradePhases(
  schedule: ScheduleIn,
  targetPriceId: string,
  targetInterval: 'month' | 'year'
): [SchedulePhaseOut, SchedulePhaseOut] {
  const startDate = schedule.current_phase?.start_date
  const current = startDate === undefined ? undefined : schedule.phases.find(p => p.start_date === startDate)
  // A schedule with no current phase has not started (or has ended). Guessing which phase to keep
  // would rewrite the wrong period, so refuse and let the caller surface it.
  if (!current) throw new ConvexError('Schedule has no current phase')

  const discounts = (current.discounts ?? [])
    .map(carryDiscount)
    .filter((d): d is { coupon?: string; discount?: string; promotion_code?: string } => d !== null)
  const carried = discounts.length > 0 ? { discounts } : {}

  const keep: SchedulePhaseOut = {
    items: current.items.map(i => ({ price: idOf(i.price) ?? '', quantity: i.quantity ?? 1 })),
    start_date: current.start_date,
    end_date: current.end_date,
    ...carried,
    // Checkout stamps convexUserId for Dashboard support lookups; omitting it here would unset it.
    ...(current.metadata && Object.keys(current.metadata).length > 0 ? { metadata: current.metadata } : {})
  }

  const next: SchedulePhaseOut = {
    items: [{ price: targetPriceId, quantity: 1 }],
    duration: { interval: targetInterval, interval_count: 1 },
    proration_behavior: 'none',
    ...carried
  }

  return [keep, next]
}

// ── The webhook's pending rule ───────────────────────────────────────────────────────────────────

export type PendingOutcome = 'none' | 'keep' | 'clear' | 'applied'

/**
 * What a `customer.subscription.updated` event means for the pending-downgrade mirror on our row.
 * `applied` is checked BEFORE `clear` on purpose: the swap event and the release event both arrive,
 * and only the first may schedule the release.
 *
 * - `none`    — nothing is pending; the event says nothing about a downgrade.
 * - `applied` — the row's tier moved while a downgrade was pending: the swap landed (or someone
 *               changed the price in the Dashboard). Clear the mirror AND release the spent schedule.
 * - `clear`   — no schedule on the event: it was released, canceled or undone elsewhere.
 * - `keep`    — a schedule is attached and the tier has not moved: still waiting.
 */
export function resolvePendingDowngrade(
  existing: { tier: string; pendingTier?: string } | null,
  incoming: { tier: string; stripeScheduleId?: string }
): PendingOutcome {
  if (!existing?.pendingTier) return 'none'
  if (incoming.tier !== existing.tier) return 'applied'
  if (!incoming.stripeScheduleId) return 'clear'
  return 'keep'
}

/**
 * A schedule still attached to the subscription with nothing pending on our row: its swap already
 * applied and the release that should have followed never landed. `releaseSubscriptionSchedule` is
 * a one-shot scheduled action and Convex does not retry actions, so any Stripe refusal leaves the
 * spent schedule attached until phase 1's own `end_behavior` fires — a whole period later, a year
 * on annual.
 *
 * That state is a dead end for the member: `scheduleIdOf(sub)` still reads as "a downgrade is
 * pending", but `pendingTier` — the only thing BillingPage renders — says nothing is. So every
 * upgrade is refused with PENDING_DOWNGRADE, whose toast asks them to undo a downgrade the page
 * shows no undo button for. `pendingTier` is the mirror this whole design trusts; a schedule id is
 * not, and never was. So a spent schedule is released in place rather than raised.
 */
export function isSpentSchedule(scheduleId: string | undefined, pendingTier: string | undefined): boolean {
  return Boolean(scheduleId) && !pendingTier
}
