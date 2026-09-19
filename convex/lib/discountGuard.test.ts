import { describe, expect, it } from 'vitest'
import { shouldDetachDiscounts } from './discountGuard'

const GROWTH_MONTH = { tier: 'growth', priceInterval: 'month' }

describe('shouldDetachDiscounts', () => {
  it('detaches when the interval changes and a discount is attached', () => {
    expect(
      shouldDetachDiscounts({
        existing: GROWTH_MONTH,
        incoming: { tier: 'growth', priceInterval: 'year' },
        pending: 'none',
        hasDiscount: true
      })
    ).toBe(true)
  })

  it('detaches when the tier changes and a discount is attached', () => {
    expect(
      shouldDetachDiscounts({
        existing: GROWTH_MONTH,
        incoming: { tier: 'pro', priceInterval: 'month' },
        pending: 'none',
        hasDiscount: true
      })
    ).toBe(true)
  })

  it('never touches a subscription with no discount', () => {
    expect(
      shouldDetachDiscounts({
        existing: GROWTH_MONTH,
        incoming: { tier: 'growth', priceInterval: 'year' },
        pending: 'none',
        hasDiscount: false
      })
    ).toBe(false)
  })

  it('does nothing on the first event: there is no previous price to have changed from', () => {
    expect(
      shouldDetachDiscounts({
        existing: null,
        incoming: GROWTH_MONTH,
        pending: 'none',
        hasDiscount: true
      })
    ).toBe(false)
  })

  it('leaves a same-price event alone', () => {
    expect(
      shouldDetachDiscounts({
        existing: GROWTH_MONTH,
        incoming: GROWTH_MONTH,
        pending: 'none',
        hasDiscount: true
      })
    ).toBe(false)
  })

  it('does not guess an interval change from a missing snapshot', () => {
    expect(
      shouldDetachDiscounts({
        existing: { tier: 'growth' },
        incoming: { tier: 'growth', priceInterval: 'year' },
        pending: 'none',
        hasDiscount: true
      })
    ).toBe(false)
    expect(
      shouldDetachDiscounts({
        existing: GROWTH_MONTH,
        incoming: { tier: 'growth' },
        pending: 'none',
        hasDiscount: true
      })
    ).toBe(false)
  })

  // buildDowngradePhases carries the discount into phase 1 on purpose: dropping it would break a
  // running repeating/forever code. That carry survives because this guard stands down on the one
  // event that applies it.
  it('stands down when our own scheduled downgrade applies', () => {
    expect(
      shouldDetachDiscounts({
        existing: { tier: 'growth', priceInterval: 'month' },
        incoming: { tier: 'starter', priceInterval: 'month' },
        pending: 'applied',
        hasDiscount: true
      })
    ).toBe(false)
  })

  it('still stands down only for `applied` — keep/clear/none all detach on a real change', () => {
    const base = {
      existing: { tier: 'growth', priceInterval: 'month' },
      incoming: { tier: 'starter', priceInterval: 'month' },
      hasDiscount: true
    }
    expect(shouldDetachDiscounts({ ...base, pending: 'keep' })).toBe(true)
    expect(shouldDetachDiscounts({ ...base, pending: 'clear' })).toBe(true)
    expect(shouldDetachDiscounts({ ...base, pending: 'none' })).toBe(true)
  })
})
