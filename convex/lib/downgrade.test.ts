import { describe, it, expect } from 'vitest'
import { buildDowngradePhases, isSpentSchedule, planChangeDirection, resolvePendingDowngrade } from './downgrade'

// A schedule as Stripe returns it right after create({ from_subscription }): ONE phase, matching
// the period the member has already paid for.
const SCHEDULE = {
  current_phase: { start_date: 1_000, end_date: 2_000 },
  phases: [
    {
      start_date: 1_000,
      end_date: 2_000,
      items: [{ price: 'price_growth_month', quantity: 1 }],
      discounts: [],
      metadata: { convexUserId: 'u1' }
    }
  ]
}

describe('planChangeDirection', () => {
  it('reads a cheaper tier as down and a dearer one as up', () => {
    expect(planChangeDirection('pro', 'starter')).toBe('down')
    expect(planChangeDirection('growth', 'starter')).toBe('down')
    expect(planChangeDirection('pro', 'growth')).toBe('down')
    expect(planChangeDirection('starter', 'growth')).toBe('up')
    expect(planChangeDirection('starter', 'pro')).toBe('up')
    expect(planChangeDirection('growth', 'pro')).toBe('up')
  })

  it('reads the same tier as same, which is what an interval switch is', () => {
    expect(planChangeDirection('starter', 'starter')).toBe('same')
    expect(planChangeDirection('growth', 'growth')).toBe('same')
    expect(planChangeDirection('pro', 'pro')).toBe('same')
  })

  it('ranks contact above pro and treats an unknown tier as starter', () => {
    expect(planChangeDirection('contact', 'pro')).toBe('down')
    expect(planChangeDirection('pro', 'contact')).toBe('up')
    expect(planChangeDirection('mystery', 'growth')).toBe('up')
    expect(planChangeDirection('growth', 'mystery')).toBe('down')
  })
})

describe('buildDowngradePhases', () => {
  it('repeats the current phase and appends the cheaper one', () => {
    const [keep, next] = buildDowngradePhases(SCHEDULE, 'price_starter_month', 'month')
    expect(keep).toEqual({
      items: [{ price: 'price_growth_month', quantity: 1 }],
      start_date: 1_000,
      end_date: 2_000,
      metadata: { convexUserId: 'u1' }
    })
    expect(next).toEqual({
      items: [{ price: 'price_starter_month', quantity: 1 }],
      duration: { interval: 'month', interval_count: 1 },
      proration_behavior: 'none'
    })
  })

  it('never prorates into the cheaper phase — the whole point of the schedule', () => {
    const [, next] = buildDowngradePhases(SCHEDULE, 'price_starter_year', 'year')
    expect(next.proration_behavior).toBe('none')
    expect(next.duration).toEqual({ interval: 'year', interval_count: 1 })
  })

  it('takes the id when Stripe expands the price into an object', () => {
    const expanded = {
      ...SCHEDULE,
      phases: [{ ...SCHEDULE.phases[0], items: [{ price: { id: 'price_growth_month' }, quantity: 2 }] }]
    }
    const [keep] = buildDowngradePhases(expanded, 'price_starter_month', 'month')
    expect(keep.items).toEqual([{ price: 'price_growth_month', quantity: 2 }])
  })

  it('defaults a missing quantity to 1', () => {
    const noQty = { ...SCHEDULE, phases: [{ ...SCHEDULE.phases[0], items: [{ price: 'price_growth_month' }] }] }
    const [keep] = buildDowngradePhases(noQty, 'price_starter_month', 'month')
    expect(keep.items).toEqual([{ price: 'price_growth_month', quantity: 1 }])
  })

  it('carries a discount into BOTH phases, preferring an existing discount id over the coupon', () => {
    const discounted = {
      ...SCHEDULE,
      phases: [
        {
          ...SCHEDULE.phases[0],
          discounts: [{ coupon: 'co_free_month', discount: 'di_live', promotion_code: null }]
        }
      ]
    }
    const [keep, next] = buildDowngradePhases(discounted, 'price_starter_month', 'month')
    expect(keep.discounts).toEqual([{ discount: 'di_live' }])
    expect(next.discounts).toEqual([{ discount: 'di_live' }])
  })

  it('falls back to the coupon, then the promotion code, and expands objects to ids', () => {
    const build = (d: Record<string, unknown>) =>
      buildDowngradePhases(
        { ...SCHEDULE, phases: [{ ...SCHEDULE.phases[0], discounts: [d] }] },
        'price_starter_month',
        'month'
      )[0].discounts
    expect(build({ coupon: 'co_x', discount: null, promotion_code: null })).toEqual([{ coupon: 'co_x' }])
    expect(build({ coupon: null, discount: null, promotion_code: 'promo_x' })).toEqual([{ promotion_code: 'promo_x' }])
    expect(build({ coupon: { id: 'co_obj' }, discount: null, promotion_code: null })).toEqual([{ coupon: 'co_obj' }])
  })

  it('omits discounts and metadata entirely when there are none', () => {
    const bare = { ...SCHEDULE, phases: [{ ...SCHEDULE.phases[0], discounts: [], metadata: {} }] }
    const [keep, next] = buildDowngradePhases(bare, 'price_starter_month', 'month')
    expect('discounts' in keep).toBe(false)
    expect('metadata' in keep).toBe(false)
    expect('discounts' in next).toBe(false)
  })

  it('drops trial_end: this path runs for active subscriptions only, and a past trial_end is rejected', () => {
    const trialing = { ...SCHEDULE, phases: [{ ...SCHEDULE.phases[0], trial_end: 1_500 }] }
    const [keep] = buildDowngradePhases(trialing, 'price_starter_month', 'month')
    expect('trial_end' in keep).toBe(false)
  })

  it('refuses a schedule with no current phase rather than guessing which one to keep', () => {
    expect(() => buildDowngradePhases({ ...SCHEDULE, current_phase: null }, 'price_starter_month', 'month')).toThrow(
      'Schedule has no current phase'
    )
  })

  it('refuses when no phase matches current_phase.start_date', () => {
    expect(() =>
      buildDowngradePhases({ ...SCHEDULE, current_phase: { start_date: 999, end_date: 2_000 } }, 'p', 'month')
    ).toThrow('Schedule has no current phase')
  })

  it('keeps the phase that is current, not the first one, when a spent phase is still listed', () => {
    const twoPhase = {
      current_phase: { start_date: 2_000, end_date: 3_000 },
      phases: [
        SCHEDULE.phases[0],
        {
          start_date: 2_000,
          end_date: 3_000,
          items: [{ price: 'price_pro_month', quantity: 1 }],
          discounts: [],
          metadata: {}
        }
      ]
    }
    const [keep] = buildDowngradePhases(twoPhase, 'price_starter_month', 'month')
    expect(keep.items).toEqual([{ price: 'price_pro_month', quantity: 1 }])
    expect(keep.start_date).toBe(2_000)
  })
})

describe('resolvePendingDowngrade', () => {
  const pendingRow = { tier: 'growth', pendingTier: 'starter' }

  it('does nothing when the row has no pending downgrade', () => {
    expect(resolvePendingDowngrade({ tier: 'growth' }, { tier: 'growth', stripeScheduleId: 'sub_sched_1' })).toBe(
      'none'
    )
    expect(resolvePendingDowngrade(null, { tier: 'growth' })).toBe('none')
  })

  it('keeps the pending state while the schedule is attached and the tier has not moved', () => {
    expect(resolvePendingDowngrade(pendingRow, { tier: 'growth', stripeScheduleId: 'sub_sched_1' })).toBe('keep')
  })

  it('reads a moved tier as applied — the swap landed', () => {
    expect(resolvePendingDowngrade(pendingRow, { tier: 'starter', stripeScheduleId: 'sub_sched_1' })).toBe('applied')
  })

  it('reads a vanished schedule as cleared — released, canceled, or undone elsewhere', () => {
    expect(resolvePendingDowngrade(pendingRow, { tier: 'growth' })).toBe('clear')
  })

  it('checks applied BEFORE clear, so the swap event schedules the release and the release event does not', () => {
    // The swap arrives with the schedule still attached, then the release arrives without it.
    expect(resolvePendingDowngrade(pendingRow, { tier: 'starter' })).toBe('applied')
  })

  it('reads a tier that moved somewhere other than the pending target as applied too', () => {
    // A Dashboard price edit while pending: the mirror is stale either way, so clear it.
    expect(resolvePendingDowngrade(pendingRow, { tier: 'pro', stripeScheduleId: 'sub_sched_1' })).toBe('applied')
  })
})

describe('isSpentSchedule', () => {
  it('leaves a genuinely pending downgrade alone, so the upgrade guard still raises', () => {
    expect(isSpentSchedule('sub_sched_1', 'starter')).toBe(false)
  })

  it('reads an attached schedule with no pendingTier as spent — the release never landed', () => {
    expect(isSpentSchedule('sub_sched_1', undefined)).toBe(true)
  })

  it('is false with no schedule at all: nothing to hand back', () => {
    expect(isSpentSchedule(undefined, undefined)).toBe(false)
    expect(isSpentSchedule(undefined, 'starter')).toBe(false)
  })

  // The dead end this closes, in the order it happens: the swap event reads `applied`, which clears
  // pendingTier and schedules the release. If that one-shot action is refused (Convex does not retry
  // actions), the very next read of the same subscription is a spent schedule — and before this
  // helper existed, every upgrade from there was refused with PENDING_DOWNGRADE until phase 1 ended.
  it('is exactly the state an applied swap leaves behind when the release is refused', () => {
    const applied = resolvePendingDowngrade(
      { tier: 'growth', pendingTier: 'starter' },
      { tier: 'starter', stripeScheduleId: 'sub_sched_1' }
    )
    expect(applied).toBe('applied')
    expect(isSpentSchedule('sub_sched_1', undefined)).toBe(true)
  })
})
