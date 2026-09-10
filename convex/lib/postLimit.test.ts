import { describe, it, expect } from 'vitest'
import {
  currentUtcMonthKey,
  hasPermanentFeaturedEntitlement,
  isFeaturedLimitReached,
  isUnlimitedFeatured,
  isWeeklyLimitReached,
  UNLIMITED_FEATURED_SENTINEL
} from './postLimit'

describe('hasPermanentFeaturedEntitlement', () => {
  it('reuses a plan allowance after the post has been featured once', () => {
    expect(hasPermanentFeaturedEntitlement({ featuredAt: 0 })).toBe(true)
  })

  it('reuses a paid entitlement on legacy posts without a retained featuredAt', () => {
    expect(hasPermanentFeaturedEntitlement({ featuredPurchase: { checkoutSessionId: 'cs_1' } })).toBe(true)
  })

  it('requires an allowance or purchase for a post that has never been featured', () => {
    expect(hasPermanentFeaturedEntitlement({})).toBe(false)
  })
})

describe('isWeeklyLimitReached', () => {
  it('returns false when under limit', () => {
    expect(isWeeklyLimitReached(1, 3)).toBe(false)
    expect(isWeeklyLimitReached(0, 3)).toBe(false)
  })

  it('returns true when exactly at limit', () => {
    expect(isWeeklyLimitReached(3, 3)).toBe(true)
  })

  it('returns true when over limit', () => {
    expect(isWeeklyLimitReached(5, 3)).toBe(true)
  })

  it('handles starter tier edge: limit of 1', () => {
    expect(isWeeklyLimitReached(0, 1)).toBe(false)
    expect(isWeeklyLimitReached(1, 1)).toBe(true)
  })
})

// Pure quota-check boundary shared by posts.featurePost — see convex/posts.ts.
describe('isFeaturedLimitReached', () => {
  it('returns false when under the cap', () => {
    expect(isFeaturedLimitReached(0, 3)).toBe(false)
    expect(isFeaturedLimitReached(2, 3)).toBe(false)
  })

  it('returns true when exactly at the cap (boundary)', () => {
    expect(isFeaturedLimitReached(3, 3)).toBe(true)
  })

  it('returns true when over the cap', () => {
    expect(isFeaturedLimitReached(4, 3)).toBe(true)
  })

  it('starter tier (cap 0) always reports reached, even at zero usage', () => {
    expect(isFeaturedLimitReached(0, 0)).toBe(true)
  })

  it('contact tier sentinel stays open at realistic usage', () => {
    expect(isFeaturedLimitReached(50, UNLIMITED_FEATURED_SENTINEL)).toBe(false)
  })
})

// The "unlimited" featured cap: pinned here so a drift of the number or of the boundary fails a
// test instead of leaking a raw number into the My Posts pill (and later the recap page).
describe('isUnlimitedFeatured', () => {
  it('is 9999, true at and above the sentinel, false for every real cap below it', () => {
    expect(UNLIMITED_FEATURED_SENTINEL).toBe(9999)
    expect(isUnlimitedFeatured(UNLIMITED_FEATURED_SENTINEL)).toBe(true)
    expect(isUnlimitedFeatured(UNLIMITED_FEATURED_SENTINEL + 1)).toBe(true)
    expect(isUnlimitedFeatured(UNLIMITED_FEATURED_SENTINEL - 1)).toBe(false)
    expect(isUnlimitedFeatured(3)).toBe(false)
  })
})

// Deterministic UTC month-key derivation behind the featuredPostUsage reset — see
// convex/lib/postLimit.ts for why this must be UTC-based rather than server-local time.
describe('currentUtcMonthKey', () => {
  it('formats a mid-month UTC timestamp as YYYY-MM', () => {
    // 2026-03-15T12:00:00.000Z
    expect(currentUtcMonthKey(Date.UTC(2026, 2, 15, 12))).toBe('2026-03')
  })

  it('pads single-digit months', () => {
    // January
    expect(currentUtcMonthKey(Date.UTC(2026, 0, 1))).toBe('2026-01')
  })

  it('rolls over at the UTC month boundary, not a local one', () => {
    // 2026-01-31T23:59:59.999Z vs 2026-02-01T00:00:00.000Z
    const lastMomentOfJan = Date.UTC(2026, 0, 31, 23, 59, 59, 999)
    const firstMomentOfFeb = Date.UTC(2026, 1, 1, 0, 0, 0, 0)
    expect(currentUtcMonthKey(lastMomentOfJan)).toBe('2026-01')
    expect(currentUtcMonthKey(firstMomentOfFeb)).toBe('2026-02')
  })

  it('rolls over the year at the UTC year boundary', () => {
    expect(currentUtcMonthKey(Date.UTC(2026, 11, 31, 23, 59, 59, 999))).toBe('2026-12')
    expect(currentUtcMonthKey(Date.UTC(2027, 0, 1, 0, 0, 0, 0))).toBe('2027-01')
  })
})
