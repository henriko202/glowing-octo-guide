import { describe, expect, it } from 'vitest'
import { DAY_MS, payingByTier, returnWindows, summarizeCohort, type CohortRow } from './survival'

const T0 = 1_700_000_000_000
// Every window of a member who signed up at T0 has closed by then, so the eligible denominators
// equal the cohort size unless a test deliberately moves the clock back.
const AGED = T0 + 9 * DAY_MS

function row(over: Partial<CohortRow> = {}): CohortRow {
  return {
    createdAt: T0,
    subscriptionStatus: 'none',
    startedTrial: false,
    cancelPending: false,
    hasPost: false,
    returnedDay1: false,
    returnedDays2to7: false,
    ...over
  }
}

describe('returnWindows', () => {
  it('is half-open and relative to signup: day 1 = [24 h, 48 h), days 1–7 = [24 h, 8 d)', () => {
    expect(returnWindows(T0)).toEqual({
      day1: [T0 + DAY_MS, T0 + 2 * DAY_MS],
      days2to7: [T0 + DAY_MS, T0 + 8 * DAY_MS]
    })
  })
})

describe('summarizeCohort', () => {
  it('activates only a first interaction strictly under 24 h after signup', () => {
    const s = summarizeCohort(
      [
        row({ firstInteractionAt: T0 + DAY_MS - 1 }),
        row({ firstInteractionAt: T0 + DAY_MS }), // exactly 24 h is NOT activated
        row()
      ],
      AGED
    )
    expect(s.signups).toBe(3)
    expect(s.activated).toBe(1)
  })

  it('median minutes: odd count, even count (mean of the two middles, rounded), none', () => {
    const odd = summarizeCohort(
      [
        row({ firstInteractionAt: T0 + 60_000 }),
        row({ firstInteractionAt: T0 + 180_000 }),
        row({ firstInteractionAt: T0 + 600_000 })
      ],
      AGED
    )
    expect(odd.medianMinutesToFirstInteraction).toBe(3)
    const even = summarizeCohort(
      [row({ firstInteractionAt: T0 + 60_000 }), row({ firstInteractionAt: T0 + 120_000 })],
      AGED
    )
    expect(even.medianMinutesToFirstInteraction).toBe(2) // (1 + 2) / 2 = 1.5 → 2
    expect(summarizeCohort([row()], AGED).medianMinutesToFirstInteraction).toBeNull()
    expect(summarizeCohort([], AGED).medianMinutesToFirstInteraction).toBeNull()
  })

  it('trials ended / converted need a started trial; canceled counts a pending cancel', () => {
    const s = summarizeCohort(
      [
        row({ startedTrial: true, subscriptionStatus: 'active' }),
        row({ startedTrial: true, subscriptionStatus: 'trialing' }),
        row({ startedTrial: true, subscriptionStatus: 'trialing', cancelPending: true }),
        row({ startedTrial: true, subscriptionStatus: 'canceled' }),
        row({ startedTrial: true, subscriptionStatus: 'past_due' }),
        row({ subscriptionStatus: 'active' }) // no subscription row → never "ended", never "converted"
      ],
      AGED
    )
    expect(s.startedTrial).toBe(5)
    expect(s.trialsEnded).toBe(3)
    expect(s.converted).toBe(1)
    expect(s.canceled).toBe(2)
  })

  it('sums the return flags', () => {
    const s = summarizeCohort(
      [row({ returnedDay1: true, returnedDays2to7: true }), row({ returnedDays2to7: true })],
      AGED
    )
    expect(s.returnedDay1).toBe(1)
    expect(s.returnedDays2to7).toBe(2)
  })

  it('counts a member as onboarded once, with a post or with an interaction', () => {
    const s = summarizeCohort(
      [
        row({ hasPost: true }),
        row({ firstInteractionAt: T0 + 60_000 }),
        row({ hasPost: true, firstInteractionAt: T0 + 60_000 }),
        row()
      ],
      AGED
    )
    expect(s.signups).toBe(4)
    expect(s.onboarded).toBe(3)
  })

  it('is all zeros and a null median for an empty cohort', () => {
    expect(summarizeCohort([], AGED)).toEqual({
      signups: 0,
      startedTrial: 0,
      onboarded: 0,
      activated: 0,
      medianMinutesToFirstInteraction: null,
      returnedDay1: 0,
      returnedDays2to7: 0,
      trialsEnded: 0,
      converted: 0,
      canceled: 0,
      activatedEligible: 0,
      returnedDay1Eligible: 0,
      returnedDays2to7Eligible: 0
    })
  })

  // The panel exists to answer "does anyone reach value at all". Dividing by the whole cohort made
  // every window a member is still inside read as a miss, so a cohort that all signed up yesterday
  // reported 0 % returned no matter what those members did.
  it('counts a row as eligible only once its window has closed', () => {
    // Signed up 30 h ago: 24 h is behind them, 48 h and 8 d are not.
    const s = summarizeCohort([row()], T0 + 30 * 3_600_000)
    expect(s.signups).toBe(1)
    expect(s.activatedEligible).toBe(1)
    expect(s.returnedDay1Eligible).toBe(0)
    expect(s.returnedDays2to7Eligible).toBe(0)
  })

  it('reports nothing eligible for a cohort that is entirely too young', () => {
    const s = summarizeCohort([row(), row(), row()], T0 + 3_600_000)
    expect(s.signups).toBe(3)
    expect(s.activatedEligible).toBe(0)
    expect(s.returnedDay1Eligible).toBe(0)
    expect(s.returnedDays2to7Eligible).toBe(0)
  })

  it('makes every window eligible once the whole cohort has aged past 8 days', () => {
    const rows = [row({ returnedDay1: true, returnedDays2to7: true }), row(), row(), row()]
    const s = summarizeCohort(rows, AGED)
    expect(s.activatedEligible).toBe(4)
    expect(s.returnedDay1Eligible).toBe(4)
    expect(s.returnedDays2to7Eligible).toBe(4)
    // Fully aged, the eligible base is the cohort — the shares are exactly what they always were.
    expect(s.returnedDay1 / s.returnedDay1Eligible).toBe(0.25)
    expect(s.returnedDays2to7 / s.returnedDays2to7Eligible).toBe(0.25)
  })

  it('measures each row against its own signup time, not the cohort as a whole', () => {
    const now = T0 + 3 * DAY_MS
    const s = summarizeCohort([row(), row({ createdAt: now - 3_600_000 })], now)
    expect(s.activatedEligible).toBe(1) // only the older row has cleared 24 h
    expect(s.returnedDay1Eligible).toBe(1)
    expect(s.returnedDays2to7Eligible).toBe(0) // neither has cleared 8 d
  })

  // A count above a base that excludes the member would print "3 of 1 · 300%": each windowed count
  // is taken over the same closed rows as its base, so a share can never pass 100 %.
  it('counts a return only once its window has closed', () => {
    // Signed up 30 h ago, tapped at minute 10, came back at hour 26: activated (24 h has closed),
    // but "returned" stays out of both the count and the base until hour 48 / day 8.
    const now = T0 + 30 * 3_600_000
    const s = summarizeCohort(
      [row({ firstInteractionAt: T0 + 600_000, returnedDay1: true, returnedDays2to7: true })],
      now
    )
    expect(s.activated).toBe(1)
    expect(s.activatedEligible).toBe(1)
    expect(s.returnedDay1).toBe(0)
    expect(s.returnedDay1Eligible).toBe(0)
    expect(s.returnedDays2to7).toBe(0)
    expect(s.returnedDays2to7Eligible).toBe(0)
  })

  it('leaves a fresh signup who already tapped out of both the activated count and its base', () => {
    const now = T0 + 9 * DAY_MS
    const s = summarizeCohort([row(), row({ createdAt: now - 3_600_000, firstInteractionAt: now - 3_000_000 })], now)
    expect(s.activatedEligible).toBe(1) // the aged row only
    expect(s.activated).toBe(0) // the fresh tap is real, but its 24 h window has not closed
    expect(s.medianMinutesToFirstInteraction).toBe(10) // the median is a time, not a share: it still sees it
  })
})

describe('payingByTier', () => {
  it('counts active members only and defaults a missing tier to starter', () => {
    expect(
      payingByTier([
        { subscriptionStatus: 'active', tier: 'growth' },
        { subscriptionStatus: 'active' },
        { subscriptionStatus: 'trialing', tier: 'pro' },
        { subscriptionStatus: 'canceled', tier: 'pro' },
        { subscriptionStatus: 'active', tier: 'contact' }
      ])
    ).toEqual({ starter: 1, growth: 1, pro: 0, contact: 1 })
  })
})
