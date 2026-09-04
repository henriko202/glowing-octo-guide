import { describe, it, expect } from 'vitest'
import { searchPostsAndPeople, toSearchPerson } from './search'
import type { Doc, Id } from './_generated/dataModel'

const NOW = 1_000_000

// Builders — only the fields search reads. Cast because the mock ctx is untyped; the real Doc
// shape is enforced at the call sites inside search.ts.
const post = (id: string, authorId: string, over: Record<string, unknown> = {}) =>
  ({
    _id: id,
    authorId,
    content: `content-${id}`,
    sourceUrl: `https://x/${id}`,
    visibilityIndustries: [] as string[],
    visibilityCountries: [] as string[],
    ...over
  }) as unknown as Doc<'posts'>

const user = (id: string, over: Record<string, unknown> = {}) =>
  ({ _id: id, name: id, subscriptionStatus: 'active', ...over }) as unknown as Doc<'users'>

// Minimal QueryCtx mock: the search_content take() returns posts, search_name take() returns
// people, and get() resolves post authors. The `q => q.search(...)` callbacks are ignored.
function searchCtx(posts: Doc<'posts'>[], authors: Doc<'users'>[], people: Doc<'users'>[]) {
  const byId = new Map(authors.map(a => [a._id, a]))
  return {
    db: {
      query: (table: string) => ({
        withSearchIndex: () => ({ take: async () => (table === 'posts' ? posts : people) })
      }),
      get: async (id: Id<'users'>) => byId.get(id) ?? null
    }
  } as any
}

// Search applies the SAME per-viewer gate as the feed (isPostVisibleToViewer), so the same 10-post
// fixture proves search excludes the viewer's own posts and honors visibility + author eligibility.
describe('searchPostsAndPeople — filters posts over 10 posts', () => {
  const viewer = user('viewer', { industry: 'tech', country: 'US' })

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
  const people = [user('x1', { linkedinPublicIdentifier: 'x-one' }), user('x2'), user('x3')]

  it('excludes the viewer’s own posts and applies the feed access gate', async () => {
    const { posts: got } = await searchPostsAndPeople(searchCtx(posts, authors, people), viewer, {
      text: 'q',
      now: NOW
    })
    expect(got.map(p => p._id)).toEqual(['p1', 'p2', 'p4', 'p8'])
  })

  it('returns people through the safe projection (people search is not viewer-filtered)', async () => {
    const { people: got } = await searchPostsAndPeople(searchCtx(posts, authors, people), viewer, {
      text: 'q',
      now: NOW
    })
    expect(got).toHaveLength(3)
    expect(got[0]).toEqual(toSearchPerson(people[0]))
  })

  // People results honor the SAME eligibility rule as posts (isAuthorFeedEligible): banned,
  // pending-deletion and canceled-lapsed members are hidden; active and still-paid are kept.
  it('excludes banned / pending-deletion / lapsed people from people results', async () => {
    const mixed = [
      user('ok'), //                                                                       active   → keep
      user('banned', { isBanned: true }), //                                               banned   → DROP
      user('leaving', { deletionScheduledAt: 5 }), //                                       deletion → DROP
      user('lapsed', { subscriptionStatus: 'canceled', subscriptionEndsAt: NOW - 1 }), //   lapsed   → DROP
      user('paid', { subscriptionStatus: 'canceled', subscriptionEndsAt: NOW + 1000 }) //   paid     → keep
    ]
    const { people: got } = await searchPostsAndPeople(searchCtx(posts, authors, mixed), viewer, {
      text: 'q',
      now: NOW
    })
    expect(got.map(p => p._id)).toEqual(['ok', 'paid'])
  })
})
