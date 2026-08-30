import { describe, expect, it } from 'vitest'
import { buildFeedFilter, fetchFeedPage, isAuthorFeedEligible, toFeedAuthor } from './feed'
import { computeFeedFields } from './lib/feedRank'
import type { Doc, Id } from './_generated/dataModel'

const NOW = 1_000_000

// Builders — only the fields the feed filters + enrichment read. Cast because the mock ctx below
// is untyped; the real Doc shape is enforced at the call sites inside feed.ts.
const post = (id: string, authorId: string, over: Record<string, unknown> = {}) =>
  ({
    _id: id,
    authorId,
    content: `content-${id}`,
    sourceUrl: `https://x/${id}`,
    visibilityIndustries: [] as string[],
    visibilityCountries: [] as string[],
    isFeatured: false,
    publishedAt: 1,
    ...over
  }) as unknown as Doc<'posts'>

const user = (id: string, over: Record<string, unknown> = {}) =>
  ({ _id: id, name: id, subscriptionStatus: 'active', ...over }) as unknown as Doc<'users'>

// Minimal QueryCtx mock: the by_feed_rank page walk returns `page`, and get() resolves authors.
function feedCtx(page: Doc<'posts'>[], authors: Doc<'users'>[]) {
  const byId = new Map(authors.map(a => [a._id, a]))
  return {
    db: {
      query: () => ({
        withIndex: () => ({ order: () => ({ paginate: async () => ({ page, isDone: true, continueCursor: 'END' }) }) })
      }),
      get: async (id: Id<'users'>) => byId.get(id) ?? null
    }
  } as any
}

const opts = (filter: ReturnType<typeof buildFeedFilter>) => ({
  paginationOpts: { numItems: 50, cursor: null },
  filter,
  now: NOW
})

describe('buildFeedFilter', () => {
  it('starter: no filters applied', () => {
    const filter = buildFeedFilter({ tier: 'starter', industry: 'tech', country: 'US' })
    expect(filter.applyIndustry).toBe(false)
    expect(filter.applyCountry).toBe(false)
  })

  it('growth: filters by user industry and country', () => {
    const filter = buildFeedFilter({ tier: 'growth', industry: 'tech', country: 'US' })
    expect(filter.applyIndustry).toBe(true)
    expect(filter.applyCountry).toBe(true)
    expect(filter.industries).toEqual(['tech'])
    expect(filter.countries).toEqual(['US'])
  })

  it('pro with overrides: uses provided filter lists', () => {
    const filter = buildFeedFilter({
      tier: 'pro',
      industry: 'tech',
      country: 'US',
      filterIndustries: ['tech', 'finance'],
      filterCountries: ['US', 'GB']
    })
    expect(filter.applyIndustry).toBe(true)
    expect(filter.applyCountry).toBe(true)
    expect(filter.industries).toEqual(['tech', 'finance'])
    expect(filter.countries).toEqual(['US', 'GB'])
  })

  it('pro with no overrides: no filters applied', () => {
    const filter = buildFeedFilter({ tier: 'pro', industry: 'tech', country: 'US' })
    expect(filter.applyIndustry).toBe(false)
    expect(filter.applyCountry).toBe(false)
  })

  it('contact tier: same behavior as pro (respects filterIndustries)', () => {
    const filter = buildFeedFilter({
      tier: 'contact',
      industry: 'tech',
      country: 'US',
      filterIndustries: ['tech'],
      filterCountries: []
    })
    expect(filter.applyIndustry).toBe(true)
    expect(filter.applyCountry).toBe(false)
  })
})

describe('toFeedAuthor', () => {
  it('returns only display fields and strips secrets/internal fields', () => {
    const author = {
      _id: 'u1',
      _creationTime: 0,
      name: 'Jordan',
      headline: 'Engineer',
      profilePictureUrl: 'https://x/y.jpg',
      industry: '4',
      country: 'BR',
      tier: 'pro',
      linkedinId: 'li1',
      linkedinAccessToken: 'secret',
      linkedinRefreshToken: 'secret2',
      tokenExpiresAt: 1,
      isAdmin: true,
      isBanned: true,
      bannedReason: 'x',
      bannedBy: 'admin1',
      bannedAt: 2,
      stripeCustomerId: 'cus_1',
      subscriptionStatus: 'active',
      trialEndsAt: 3,
      linkedinPublicIdentifier: 'jordan'
    } as any
    const safe = toFeedAuthor(author) as Record<string, unknown>
    expect(safe).toEqual({
      _id: 'u1',
      name: 'Jordan',
      headline: 'Engineer',
      profilePictureUrl: 'https://x/y.jpg',
      industry: '4',
      country: 'BR',
      tier: 'pro'
    })
    for (const k of [
      'isAdmin',
      'stripeCustomerId',
      'linkedinId',
      'linkedinAccessToken',
      'isBanned',
      'bannedBy',
      'subscriptionStatus',
      'linkedinPublicIdentifier'
    ]) {
      expect(k in safe).toBe(false)
    }
  })
})

describe('isAuthorFeedEligible', () => {
  it('includes an active author', () => {
    expect(isAuthorFeedEligible({ subscriptionStatus: 'active' }, NOW)).toBe(true)
  })
  it('includes a trialing author (card-backed Growth trial — reciprocity)', () => {
    expect(isAuthorFeedEligible({ subscriptionStatus: 'active', deletionScheduledAt: undefined }, NOW)).toBe(true)
    expect(isAuthorFeedEligible({ subscriptionStatus: 'trialing' }, NOW)).toBe(true)
  })
  it('excludes an author pending deletion', () => {
    expect(isAuthorFeedEligible({ subscriptionStatus: 'active', deletionScheduledAt: 123 }, NOW)).toBe(false)
  })
  it('excludes a banned author (overrides an otherwise-eligible subscription)', () => {
    expect(isAuthorFeedEligible({ subscriptionStatus: 'active', isBanned: true }, NOW)).toBe(false)
    // Ban wins even inside a still-paid canceled window.
    expect(
      isAuthorFeedEligible({ subscriptionStatus: 'canceled', subscriptionEndsAt: NOW + 1, isBanned: true }, NOW)
    ).toBe(false)
  })
  it('excludes a missing author', () => {
    expect(isAuthorFeedEligible(null, NOW)).toBe(false)
  })
  it('keeps a canceled author until their paid period ends, then drops them', () => {
    expect(isAuthorFeedEligible({ subscriptionStatus: 'canceled', subscriptionEndsAt: NOW + 1 }, NOW)).toBe(true)
    expect(isAuthorFeedEligible({ subscriptionStatus: 'canceled', subscriptionEndsAt: NOW - 1 }, NOW)).toBe(false)
    expect(isAuthorFeedEligible({ subscriptionStatus: 'canceled' }, NOW)).toBe(false) // unknown end → dropped
  })
})

// End-to-end filtering of one feed page through a mock ctx. 10 posts exercise every drop reason at
// once — the whole point of the fix is that the viewer's OWN posts (p0) never survive.
describe('fetchFeedPage — filters one page over 10 posts (starter: no tier filter)', () => {
  const viewer = user('viewer', { tier: 'starter', industry: 'tech', country: 'US' })
  const filter = buildFeedFilter({ tier: 'starter', industry: 'tech', country: 'US' })

  const posts = [
    post('p0', 'viewer'), //                                    own post           → DROP
    post('p1', 'a1'), //                                        plain, eligible    → keep
    post('p2', 'a2', { visibilityIndustries: ['tech'] }), //    viewer is tech     → keep
    post('p3', 'a3', { visibilityIndustries: ['finance'] }), // viewer not finance → DROP
    post('p4', 'a4', { visibilityCountries: ['US'] }), //       viewer is US       → keep
    post('p5', 'a5', { visibilityCountries: ['GB'] }), //       viewer not GB      → DROP
    post('p6', 'a6'), //                                        author deleting    → DROP
    post('p7', 'a7'), //                                        canceled, lapsed   → DROP
    post('p8', 'a8'), //                                        canceled, paid     → keep
    post('p9', 'ghost') //                                      author missing     → DROP
  ]
  const authors = [
    user('a1'),
    user('a2'),
    user('a3'),
    user('a4'),
    user('a5'),
    user('a6', { deletionScheduledAt: 5 }),
    user('a7', { subscriptionStatus: 'canceled', subscriptionEndsAt: NOW - 1 }),
    user('a8', { subscriptionStatus: 'canceled', subscriptionEndsAt: NOW + 1000 })
    // 'ghost' deliberately absent
  ]

  it('drops own posts, visibility mismatches, and ineligible/missing authors', async () => {
    const { page } = await fetchFeedPage(feedCtx(posts, authors), viewer, opts(filter))
    expect(page.map(p => p._id)).toEqual(['p1', 'p2', 'p4', 'p8'])
    expect(page.some(p => p.authorId === 'viewer')).toBe(false)
  })

  it('enriches surviving posts with the safe author projection', async () => {
    const { page } = await fetchFeedPage(feedCtx(posts, authors), viewer, opts(filter))
    expect(page.find(p => p._id === 'p1')?.author).toMatchObject({ _id: 'a1', name: 'a1' })
  })

  it('preserves isDone + continueCursor from the index walk', async () => {
    const res = await fetchFeedPage(feedCtx(posts, authors), viewer, opts(filter))
    expect(res.isDone).toBe(true)
    expect(res.continueCursor).toBe('END')
  })
})

// Growth auto-applies the viewer's own industry+country as a preference filter — layered on top of
// the access gate, so the viewer's own post is still dropped even when it would match.
describe('fetchFeedPage — growth tier auto-filter', () => {
  const viewer = user('viewer', { tier: 'growth', industry: 'tech', country: 'US' })
  const filter = buildFeedFilter({ tier: 'growth', industry: 'tech', country: 'US' })

  const posts = [
    post('p0', 'viewer'), // own (tech/US) → DROP
    post('p1', 'a1'), //     tech + US     → keep
    post('p2', 'a2'), //     finance       → DROP (industry)
    post('p3', 'a3'), //     tech + GB     → DROP (country)
    post('p4', 'a4') //      tech + US     → keep
  ]
  const authors = [
    user('a1', { industry: 'tech', country: 'US' }),
    user('a2', { industry: 'finance', country: 'US' }),
    user('a3', { industry: 'tech', country: 'GB' }),
    user('a4', { industry: 'tech', country: 'US' })
  ]

  it('keeps only same-industry + same-country authors, never the viewer’s own', async () => {
    const { page } = await fetchFeedPage(feedCtx(posts, authors), viewer, opts(filter))
    expect(page.map(p => p._id)).toEqual(['p1', 'p4'])
  })
})

// ── Seeded-DB parity: every feed state, one page, both layers ──────────────────────────────────
// Mirrors the states created by convex/seed.ts (each persona = one real seeded author) and runs the
// whole pipeline with PRODUCTION logic for both layers:
//   1. computeFeedFields()  → the by_feed_rank index: the inFeed gate (hidden / interaction-capped /
//      soft-deleted never page in) and the feedRank order (featured → author-tier → recency),
//   2. fetchFeedPage()      → the per-viewer read gate (own post / visibility allow-lists / author
//      eligibility: banned, pending-deletion, canceled-lapsed vs canceled-but-paid).
// So one table documents exactly what a viewer sees for every state — and WHERE each drop happens.
describe('fetchFeedPage — seeded feed-state parity', () => {
  const R = { pro: 3, growth: 2, starter: 1 }

  // Simulate the by_feed_rank index walk: stamp the denormalized fields with the REAL helper, drop
  // inFeed=false, and sort by feedRank desc — the exact page `fetchFeedPage` receives in production.
  const indexPage = (raw: Doc<'posts'>[]): Doc<'posts'>[] =>
    raw
      .map(p => ({
        ...p,
        ...computeFeedFields({
          isFeatured: p.isFeatured,
          publishedAt: p.publishedAt,
          authorTierRank: p.authorTierRank,
          hidden: p.hidden === true, // the post() builder omits `hidden`; absent ⇒ visible
          interactionLimitReached: p.interactionLimitReached,
          deletedAt: p.deletedAt
        })
      }))
      .filter(p => p.inFeed === true)
      .sort((a, b) => (b.feedRank ?? 0) - (a.feedRank ?? 0))

  // One author per seeded persona/state (see convex/seed.ts).
  const authors = [
    user('junior', { tier: 'pro', subscriptionStatus: 'active' }),
    user('mateus', { tier: 'growth', subscriptionStatus: 'active' }),
    user('guilherme', { tier: 'pro', subscriptionStatus: 'active' }),
    user('gustavo', { tier: 'pro', subscriptionStatus: 'active', industry: '51', country: 'BR' }),
    user('kevin', { tier: 'pro', subscriptionStatus: 'canceled', subscriptionEndsAt: NOW + 1000 }), // still paid → eligible
    user('zara', { tier: 'starter', subscriptionStatus: 'active', isBanned: true }), //                banned → ineligible
    user('elena', { tier: 'growth', subscriptionStatus: 'canceled', subscriptionEndsAt: NOW - 1 }), // lapsed → ineligible
    user('tom', { tier: 'pro', subscriptionStatus: 'active', deletionScheduledAt: NOW + 5000 }), //   deleting → ineligible
    user('david', { tier: 'starter', subscriptionStatus: 'past_due' }), //                            eligible; post hidden
    user('kreo', { subscriptionStatus: 'none' }) //                                                   eligible; post hidden
  ]

  // One post per persona, carrying its seeded state. authorTierRank mirrors the author's tier
  // (denormalized at write time in the real path).
  const posts = [
    // Featured — above every regular post, ordered among themselves purely by recency.
    post('guilherme-feat', 'guilherme', { isFeatured: true, authorTierRank: R.pro, publishedAt: 980 }),
    post('mateus-feat', 'mateus', { isFeatured: true, authorTierRank: R.growth, publishedAt: 950 }),
    post('junior-feat', 'junior', { isFeatured: true, authorTierRank: R.pro, publishedAt: 900 }),
    // Regular, eligible & visible to a software/BR viewer.
    post('kevin-paid', 'kevin', { authorTierRank: R.pro, publishedAt: 850 }), //                    canceled-but-paid author
    post('junior-visBR', 'junior', { authorTierRank: R.pro, publishedAt: 820, visibilityCountries: ['BR'] }),
    post('mateus-visSoft', 'mateus', { authorTierRank: R.growth, publishedAt: 800, visibilityIndustries: ['4'] }),
    // Combined visibility (industry 51 + country BR) — copied from the author's user-defaults.
    post('gustavo-vis', 'gustavo', {
      authorTierRank: R.pro,
      publishedAt: 780,
      visibilityIndustries: ['51'],
      visibilityCountries: ['BR']
    }),
    // Storage-excluded by computeFeedFields (inFeed=false) → never reach the page.
    post('junior-hidden', 'junior', { authorTierRank: R.pro, publishedAt: 700, hidden: true }), //     author-hidden
    post('junior-capped', 'junior', { authorTierRank: R.pro, publishedAt: 690, interactionLimitReached: true }),
    post('mateus-deleted', 'mateus', { authorTierRank: R.growth, publishedAt: 680, deletedAt: NOW - 1 }),
    post('david-hidden', 'david', { authorTierRank: R.starter, publishedAt: 670, hidden: true }), //   past_due → created hidden
    post('kreo-hidden', 'kreo', { authorTierRank: R.starter, publishedAt: 660, hidden: true }), //     non-carded → created hidden
    // Read-time excluded (reach the page, dropped by the per-viewer gate).
    post('zara-banned', 'zara', { authorTierRank: R.starter, publishedAt: 650 }), //                   banned author
    post('elena-lapsed', 'elena', { authorTierRank: R.growth, publishedAt: 640 }), //                  canceled + lapsed
    post('tom-deleting', 'tom', { authorTierRank: R.pro, publishedAt: 630 }), //                       pending deletion
    post('viewer-own', 'viewer', { authorTierRank: R.pro, publishedAt: 999 }) //                       viewer's own
  ]

  it('software/BR starter viewer sees featured→pro→growth order, every edge state dropped', async () => {
    const viewer = user('viewer', { tier: 'starter', industry: '4', country: 'BR' })
    const filter = buildFeedFilter({ tier: 'starter', industry: '4', country: 'BR' })
    const { page } = await fetchFeedPage(feedCtx(indexPage(posts), authors), viewer, opts(filter))
    expect(page.map(p => p._id)).toEqual([
      'guilherme-feat', // featured (980)
      'mateus-feat', //    featured (950)
      'junior-feat', //    featured (900)
      'kevin-paid', //     pro — canceled-but-still-paid author is eligible
      'junior-visBR', //   pro — country BR matches
      'mateus-visSoft' //  growth — industry 4 matches
    ])
    // Every excluded state is absent — read-time drops + storage drops together.
    for (const gone of [
      'viewer-own', //     own post
      'gustavo-vis', //    visibility: civil-eng (51) ≠ viewer's software (4)
      'zara-banned', //    author banned
      'elena-lapsed', //   author canceled past paid-through
      'tom-deleting', //   author pending deletion
      'junior-hidden', //  ── below: storage-excluded, never paged in ──
      'junior-capped',
      'mateus-deleted',
      'david-hidden',
      'kreo-hidden'
    ]) {
      expect(page.some(p => p._id === gone)).toBe(false)
    }
  })

  it('civil-eng/BR viewer sees the combined-visibility post and loses the software-only one', async () => {
    const viewer = user('viewer', { tier: 'starter', industry: '51', country: 'BR' })
    const filter = buildFeedFilter({ tier: 'starter', industry: '51', country: 'BR' })
    const { page } = await fetchFeedPage(feedCtx(indexPage(posts), authors), viewer, opts(filter))
    const ids = page.map(p => p._id)
    expect(ids).toContain('gustavo-vis') //     industry 51 + country BR both match
    expect(ids).not.toContain('mateus-visSoft') // industry 4 ≠ 51
    expect(ids).toContain('junior-visBR') //    country-only restriction, BR still matches
  })

  it('the storage layer removes hidden/capped/deleted — they never reach fetchFeedPage', () => {
    const staged = indexPage(posts).map(p => p._id)
    for (const gone of ['junior-hidden', 'junior-capped', 'mateus-deleted', 'david-hidden', 'kreo-hidden']) {
      expect(staged).not.toContain(gone)
    }
    // Ineligible-author posts DO survive the index (author state is a read-time concern, not inFeed).
    for (const kept of ['zara-banned', 'elena-lapsed', 'tom-deleting']) {
      expect(staged).toContain(kept)
    }
  })
})
