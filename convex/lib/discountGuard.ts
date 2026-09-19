// The free-year hole found 2026-09-18, second half. A Stripe discount on a subscription is attached
// to the SUBSCRIPTION, not to a price, so Stripe applies it to whatever invoice comes next — the
// prorated annual invoice of a monthly -> annual switch included. A free-month promotion code turned
// into a free year twice in test mode: a `repeating` coupon discounted an annual switch inside its
// window, and a `once` coupon did the same when the switch happened during a trial, because a `once`
// coupon is not consumed until the first invoice after the trial ends.
//
// The portal half of the fix is a trial configuration with plan switching off (lib/portalConfig).
// This is the backstop, because a plan change can also come from the Dashboard or from any future
// portal path: when a subscription's price changes and it still carries a discount, detach it.
//
// Two carve-outs, both decision inputs rather than conditions here:
//   - the first `created` event (no row yet) is not a change;
//   - a scheduled downgrade APPLYING is not an arbitrary change — buildDowngradePhases deliberately
//     carries the discount into the cheaper phase, and this guard must not undo that carry.

import type { PendingOutcome } from './downgrade'

/** The two row fields that together identify which price a subscription is on. */
export interface PriceSnapshot {
  tier: string
  priceInterval?: string
}

/**
 * Whether the webhook should schedule detaching the subscription's discounts.
 *
 * `pending` is resolvePendingDowngrade's answer for this event, so `applied` means the price moved
 * under our own schedule's phase 1. Everything else that moves the price — a portal interval
 * switch, a portal upgrade, a Dashboard edit — detaches.
 *
 * The interval comparison demands BOTH values: a row that predates the price snapshot cannot tell a
 * real interval switch from a missing field, and detaching on that guess would strip a promotion
 * from a member who never changed anything. Tier changes need no such caution — the field is always
 * on the row.
 */
export function shouldDetachDiscounts(input: {
  existing: PriceSnapshot | null
  incoming: PriceSnapshot
  pending: PendingOutcome
  hasDiscount: boolean
}): boolean {
  const { existing, incoming, pending, hasDiscount } = input
  if (!hasDiscount) return false
  if (!existing) return false
  if (pending === 'applied') return false
  if (existing.tier !== incoming.tier) return true
  return (
    existing.priceInterval !== undefined &&
    incoming.priceInterval !== undefined &&
    existing.priceInterval !== incoming.priceInterval
  )
}
