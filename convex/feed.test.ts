import { describe, it, expect } from 'vitest'
import { buildFeedFilter, toFeedAuthor, isAuthorFeedEligible, fetchFeedPage } from './feed'
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
