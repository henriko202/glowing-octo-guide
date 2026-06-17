import { describe, it, expect } from 'vitest'
import { computeFeedFields, FEATURED_BASE, TIER_WEIGHT } from './feedRank'

// Minimal post shape the helper reads.
type P = {
  isFeatured: boolean
  publishedAt: number
  authorTierRank?: number
  hidden: boolean
  interactionLimitReached?: boolean
  deletedAt?: number
}

const base: P = { isFeatured: false, publishedAt: 1000, hidden: false }

describe('computeFeedFields — feedRank ordering', () => {
  it('ranks any featured post above any regular post (even contact-tier)', () => {
    const featured = computeFeedFields({ ...base, isFeatured: true, publishedAt: 1 }).feedRank
    const contactRegular = computeFeedFields({ ...base, authorTierRank: 4, publishedAt: 9_999_999_999 }).feedRank
    expect(featured).toBeGreaterThan(contactRegular)
  })

  it('ranks higher author tier above lower tier at equal recency', () => {
    const contact = computeFeedFields({ ...base, authorTierRank: 4, publishedAt: 1000 }).feedRank
    const pro = computeFeedFields({ ...base, authorTierRank: 3, publishedAt: 1000 }).feedRank
    const starter = computeFeedFields({ ...base, authorTierRank: 1, publishedAt: 1000 }).feedRank
    expect(contact).toBeGreaterThan(pro)
    expect(pro).toBeGreaterThan(starter)
  })

  it('ranks newer above older within the same tier', () => {
    const newer = computeFeedFields({ ...base, authorTierRank: 2, publishedAt: 2000 }).feedRank
    const older = computeFeedFields({ ...base, authorTierRank: 2, publishedAt: 1000 }).feedRank
    expect(newer).toBeGreaterThan(older)
  })

  it('orders featured purely by recency (tier is irrelevant to featured)', () => {
    const newer = computeFeedFields({ ...base, isFeatured: true, authorTierRank: 1, publishedAt: 2000 }).feedRank
    const older = computeFeedFields({ ...base, isFeatured: true, authorTierRank: 4, publishedAt: 1000 }).feedRank
    expect(newer).toBeGreaterThan(older)
  })

  it('defaults a missing authorTierRank to rank 1 (starter)', () => {
    const missing = computeFeedFields({ ...base, authorTierRank: undefined, publishedAt: 1000 }).feedRank
    const starter = computeFeedFields({ ...base, authorTierRank: 1, publishedAt: 1000 }).feedRank
    expect(missing).toBe(starter)
  })

  // The critical guarantee: sorting by feedRank desc reproduces the EXACT order the current
  // getFeed produces — featured (publishedAt desc), then regular (authorTierRank desc, publishedAt desc).
  it('reproduces the current two-group feed sort via a single key', () => {
    const posts: Array<P & { id: string }> = [
      { id: 'reg-starter-old', isFeatured: false, authorTierRank: 1, publishedAt: 100, hidden: false },
      { id: 'reg-contact-new', isFeatured: false, authorTierRank: 4, publishedAt: 500, hidden: false },
      { id: 'feat-old', isFeatured: true, authorTierRank: 1, publishedAt: 200, hidden: false },
      { id: 'reg-pro-new', isFeatured: false, authorTierRank: 3, publishedAt: 900, hidden: false },
      { id: 'feat-new', isFeatured: true, authorTierRank: 2, publishedAt: 300, hidden: false },
      { id: 'reg-contact-old', isFeatured: false, authorTierRank: 4, publishedAt: 100, hidden: false }
    ]

    // Reference: today's getFeed sort.
    const featured = posts.filter(p => p.isFeatured).sort((a, b) => b.publishedAt - a.publishedAt)
    const regular = posts
      .filter(p => !p.isFeatured)
      .sort((a, b) => {
        const rankDiff = (b.authorTierRank ?? 1) - (a.authorTierRank ?? 1)
        if (rankDiff !== 0) return rankDiff
        return b.publishedAt - a.publishedAt
      })
    const reference = [...featured, ...regular].map(p => p.id)

    // New: single feedRank key, descending.
    const byFeedRank = [...posts]
      .sort((a, b) => computeFeedFields(b).feedRank - computeFeedFields(a).feedRank)
      .map(p => p.id)

    expect(byFeedRank).toEqual(reference)
  })

  it('keeps feedRank an exact, safe integer at the featured magnitude', () => {
    const r = computeFeedFields({ ...base, isFeatured: true, publishedAt: 1_750_000_000_000 }).feedRank
    expect(Number.isSafeInteger(r)).toBe(true)
    // Adjacent millisecond timestamps must not collide at the 1e15 scale.
    const a = computeFeedFields({ ...base, isFeatured: true, publishedAt: 1_750_000_000_000 }).feedRank
    const b = computeFeedFields({ ...base, isFeatured: true, publishedAt: 1_750_000_000_001 }).feedRank
    expect(b - a).toBe(1)
  })

  it('exposes constants that keep the partitions disjoint', () => {
    // Max regular feedRank (tier 4 + far-future publishedAt) stays below the featured floor.
    const maxRegular = 4 * TIER_WEIGHT + 4_000_000_000_000
    expect(maxRegular).toBeLessThan(FEATURED_BASE)
  })
})

describe('computeFeedFields — inFeed', () => {
  it('is true for a visible, live, non-deleted post', () => {
    expect(computeFeedFields(base).inFeed).toBe(true)
  })

  it('is false when hidden', () => {
    expect(computeFeedFields({ ...base, hidden: true }).inFeed).toBe(false)
  })

  it('is false when the interaction limit is reached', () => {
    expect(computeFeedFields({ ...base, interactionLimitReached: true }).inFeed).toBe(false)
  })

  it('is false when soft-deleted', () => {
    expect(computeFeedFields({ ...base, deletedAt: 12345 }).inFeed).toBe(false)
  })

  it('treats interactionLimitReached undefined/false as in-feed', () => {
    expect(computeFeedFields({ ...base, interactionLimitReached: false }).inFeed).toBe(true)
    expect(computeFeedFields({ ...base, interactionLimitReached: undefined }).inFeed).toBe(true)
  })
})
