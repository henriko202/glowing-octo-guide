/// <reference types="vite/client" />
import { convexTest } from 'convex-test'
import { describe, expect, test, vi } from 'vitest'
import { api, internal } from '../_generated/api'
import type { TestConvex } from 'convex-test'
import schema from '../schema'

const modules = import.meta.glob('../**/*.ts')
type T = TestConvex<typeof schema>
const NOW = Date.now()
const DAY = 86_400_000

async function seed(t: T) {
  const me = await t.run(async ctx =>
    ctx.db.insert('users', { linkedinId: 'me', name: 'Me', subscriptionStatus: 'none', createdAt: NOW })
  )
  const ana = await t.run(async ctx =>
    ctx.db.insert('users', { linkedinId: 'ana', name: 'Ana', subscriptionStatus: 'none', createdAt: NOW })
  )
  const post = await t.run(async ctx =>
    ctx.db.insert('posts', {
      linkedinPostUrn: 'urn:1',
      authorId: me,
      content: 'hello',
      publishedAt: NOW,
      likeCount: 1,
      commentCount: 0,
      mediaUrls: [],
      isFeatured: false,
      visibilityIndustries: [],
      visibilityCountries: [],
      hidden: false
    })
  )
  await t.run(async ctx =>
    ctx.db.insert('userInteractions', {
      userId: ana,
      postId: post,
      authorId: me,
      kind: 'reaction' as const,
      createdAt: NOW
    })
  )
  await t.run(async ctx => ctx.db.insert('sessions', { token: 'tok', userId: me, expiresAt: NOW + DAY }))
  return { me, ana }
}

describe('rankings', () => {
  test('getMyRankings returns both directions', async () => {
    const t = convexTest(schema, modules)
    await seed(t)
    const result = await t.query(api.rankings.getMyRankings, { sessionToken: 'tok', window: '7d', now: NOW })
    expect(result.received[0]).toMatchObject({ name: 'Ana', total: 1 })
    expect(result.made).toEqual([])
  })

  test('getSiteRankings joins the snapshot and reports the member position', async () => {
    const t = convexTest(schema, modules)
    await seed(t)
    await t.mutation(internal.jobs.rankingSnapshot.rebuildRankingSnapshots, { window: '7d' })
    const before = await t.query(api.rankings.getSiteRankings, { sessionToken: 'tok', window: '7d' })
    // Ana reacted to "Me"'s one-post, one-reaction window: the read carries the enriched per-row fields
    // plus the filtered-list competition position.
    expect(before.interactors[0]).toMatchObject({ name: 'Ana', count: 1, postsTouched: 1, position: 1 })
    expect(before.posters[0]).toMatchObject({ name: 'Me', count: 1, reactionsReceived: 1, position: 1 })
    // "Me" authored the post but made no interactions: zero count, no position.
    expect(before.me).toMatchObject({ count: 0, position: null, movement: null, optedOut: false })
  })

  test('getSiteRankings reports activeMembers from the newest snapshot board, 0 with no snapshot', async () => {
    const t = convexTest(schema, modules)
    await seed(t)
    const empty = await t.query(api.rankings.getSiteRankings, { sessionToken: 'tok', window: '7d' })
    expect(empty.activeMembers).toBe(0)
    await t.mutation(internal.jobs.rankingSnapshot.rebuildRankingSnapshots, { window: '7d' })
    const board = await t.query(api.rankings.getSiteRankings, { sessionToken: 'tok', window: '7d' })
    expect(board.activeMembers).toBe(1)
  })

  test('the member count is read live so a position exists beyond the stored top list', async () => {
    const t = convexTest(schema, modules)
    const { me, ana } = await seed(t)
    const myPost = await t.run(async ctx => (await ctx.db.query('posts').first())!)
    const anaPost = await t.run(async ctx =>
      ctx.db.insert('posts', {
        linkedinPostUrn: 'urn:2',
        authorId: ana,
        content: 'x',
        publishedAt: NOW,
        likeCount: 0,
        commentCount: 0,
        mediaUrls: [],
        isFeatured: false,
        visibilityIndustries: [],
        visibilityCountries: [],
        hidden: false
      })
    )
    await t.run(async ctx => {
      await ctx.db.insert('userInteractions', {
        userId: ana,
        postId: myPost._id,
        authorId: me,
        kind: 'reaction' as const,
        createdAt: NOW
      })
      await ctx.db.insert('userInteractions', {
        userId: me,
        postId: anaPost,
        authorId: ana,
        kind: 'reaction' as const,
        createdAt: NOW
      })
    })
    await t.mutation(internal.jobs.rankingSnapshot.rebuildRankingSnapshots, { window: '7d' })
    const result = await t.query(api.rankings.getSiteRankings, { sessionToken: 'tok', window: '7d' })
    expect(result.me).toMatchObject({ count: 1, position: 2 })
  })

  test('a live count above every stored count takes position 1', async () => {
    const t = convexTest(schema, modules)
    const { me, ana } = await seed(t)
    const anaPost = await t.run(async ctx =>
      ctx.db.insert('posts', {
        linkedinPostUrn: 'urn:overtake',
        authorId: ana,
        content: 'x',
        publishedAt: NOW,
        likeCount: 0,
        commentCount: 0,
        mediaUrls: [],
        isFeatured: false,
        visibilityIndustries: [],
        visibilityCountries: [],
        hidden: false
      })
    )
    await t.run(async ctx => {
      // Two live interactions against a stored max of 1: the old binary search returned null here.
      await ctx.db.insert('userInteractions', {
        userId: me,
        postId: anaPost,
        authorId: ana,
        kind: 'reaction' as const,
        createdAt: NOW
      })
      await ctx.db.insert('userInteractions', {
        userId: me,
        postId: anaPost,
        authorId: ana,
        kind: 'comment' as const,
        createdAt: NOW
      })
      await ctx.db.insert('rankingSnapshots', {
        window: '7d',
        generatedAt: NOW,
        since: NOW - 7 * DAY,
        topPosters: [],
        topInteractors: [{ userId: ana, count: 1, lastAt: NOW }],
        posterCountsDescending: [],
        interactorCountsDescending: [1],
        partial: false
      })
    })
    const result = await t.query(api.rankings.getSiteRankings, { sessionToken: 'tok', window: '7d' })
    expect(result.me).toMatchObject({ count: 2, position: 1, gapToNext: null })
  })

  test('getSiteRankings windows the interactor board around the member when they are beyond the buffer', async () => {
    const t = convexTest(schema, modules)
    const { me, ana } = await seed(t)
    const peers = await t.run(async ctx => {
      const ids = []
      for (let i = 0; i < 19; i += 1) {
        ids.push(
          await ctx.db.insert('users', {
            linkedinId: `peer-${i}`,
            name: `Peer ${i}`,
            subscriptionStatus: 'none',
            createdAt: NOW
          })
        )
      }
      return ids
    })
    await t.run(async ctx => {
      const anaPost = await ctx.db.insert('posts', {
        linkedinPostUrn: 'urn:window',
        authorId: ana,
        content: 'x',
        publishedAt: NOW,
        likeCount: 0,
        commentCount: 0,
        mediaUrls: [],
        isFeatured: false,
        visibilityIndustries: [],
        visibilityCountries: [],
        hidden: false
      })
      // The member's live count matches their stored count, so positions in the board and the distribution agree.
      for (let i = 0; i < 6; i += 1) {
        await ctx.db.insert('userInteractions', {
          userId: me,
          postId: anaPost,
          authorId: ana,
          kind: 'reaction' as const,
          createdAt: NOW
        })
      }
      const interactorIds = [...peers]
      interactorIds.splice(14, 0, me)
      await ctx.db.insert('rankingSnapshots', {
        window: '7d',
        generatedAt: NOW,
        since: NOW - 7 * DAY,
        topPosters: [],
        topInteractors: interactorIds.map((userId, i) => ({ userId, count: 20 - i, lastAt: NOW })),
        posterCountsDescending: [],
        interactorCountsDescending: interactorIds.map((_, i) => 20 - i),
        partial: false
      })
    })
    const result = await t.query(api.rankings.getSiteRankings, { sessionToken: 'tok', window: '7d' })
    expect(result.interactors).toHaveLength(20)
    expect(result.interactors.find(r => r.name === 'Me')?.position).toBe(15)
    expect(result.interactorNeighbors.map(r => r.position)).toEqual([13, 14, 15, 16, 17])
    expect(result.interactorNeighbors[2].name).toBe('Me')
    expect(result.posterNeighbors).toEqual([])
    expect(result.me?.position).toBe(15)
  })

  test('getSiteRankings sends no neighbor window when the member is inside the first rows', async () => {
    const t = convexTest(schema, modules)
    const { me } = await seed(t)
    const peers = await t.run(async ctx => {
      const ids = []
      for (let i = 0; i < 19; i += 1) {
        ids.push(
          await ctx.db.insert('users', {
            linkedinId: `near-${i}`,
            name: `Near ${i}`,
            subscriptionStatus: 'none',
            createdAt: NOW
          })
        )
      }
      return ids
    })
    await t.run(async ctx => {
      const interactorIds = [peers[0], me, ...peers.slice(1)]
      await ctx.db.insert('rankingSnapshots', {
        window: '7d',
        generatedAt: NOW,
        since: NOW - 7 * DAY,
        topPosters: [],
        topInteractors: interactorIds.map((userId, i) => ({ userId, count: 20 - i, lastAt: NOW })),
        posterCountsDescending: [],
        interactorCountsDescending: interactorIds.map((_, i) => 20 - i),
        partial: false
      })
    })
    const result = await t.query(api.rankings.getSiteRankings, { sessionToken: 'tok', window: '7d' })
    expect(result.interactorNeighbors).toEqual([])
  })

  test('getSiteRankings reports the member live posts count and its poster position', async () => {
    const t = convexTest(schema, modules)
    const { me, ana } = await seed(t)
    await t.run(async ctx => {
      for (let i = 0; i < 3; i += 1) {
        await ctx.db.insert('posts', {
          linkedinPostUrn: `urn:my-post-${i}`,
          authorId: me,
          content: 'x',
          publishedAt: NOW - i,
          likeCount: 0,
          commentCount: 0,
          mediaUrls: [],
          isFeatured: false,
          visibilityIndustries: [],
          visibilityCountries: [],
          hidden: false
        })
      }
      await ctx.db.insert('rankingSnapshots', {
        window: '7d',
        generatedAt: NOW,
        since: NOW - 7 * DAY,
        topPosters: [
          { userId: ana, count: 6, lastAt: NOW },
          { userId: me, count: 4, lastAt: NOW }
        ],
        topInteractors: [],
        posterCountsDescending: [6, 4, 1],
        interactorCountsDescending: [],
        partial: false
      })
    })
    const result = await t.query(api.rankings.getSiteRankings, { sessionToken: 'tok', window: '7d' })
    // The seed authored one post plus the three seeded here: the live read counts all four visible posts.
    expect(result.me).toMatchObject({ postsCount: 4, postsPosition: 2 })
    expect(result.posters[1]).toMatchObject({ name: 'Me', count: 4, position: 2 })
  })

  test('a counterpart post count is capped at 500, not 200', async () => {
    const t = convexTest(schema, modules)
    const { ana } = await seed(t)
    await t.run(async ctx => {
      for (let i = 0; i < 501; i += 1) {
        await ctx.db.insert('posts', {
          linkedinPostUrn: `urn:cap-${i}`,
          authorId: ana,
          content: 'x',
          publishedAt: NOW - i,
          likeCount: 0,
          commentCount: 0,
          mediaUrls: [],
          isFeatured: false,
          visibilityIndustries: [],
          visibilityCountries: [],
          hidden: false
        })
      }
    })
    const result = await t.query(api.rankings.getMyRankings, { sessionToken: 'tok', window: '7d', now: NOW })
    expect(result.received[0]).toMatchObject({ name: 'Ana', postsCount: 500 })
  })

  test('getSiteRankings assigns competition positions over the filtered list', async () => {
    const t = convexTest(schema, modules)
    const { ana } = await seed(t)
    const make = (linkedinId: string, name: string) =>
      t.run(async ctx => ctx.db.insert('users', { linkedinId, name, subscriptionStatus: 'none', createdAt: NOW }))
    const bruno = await make('bruno', 'Bruno')
    const carla = await make('carla', 'Carla')
    const dave = await make('dave', 'Dave')
    await t.run(async ctx => {
      // The banned member drops out BEFORE positions are assigned, and the 4-4 tie shares position 1.
      await ctx.db.patch(ana, { isBanned: true })
      await ctx.db.insert('rankingSnapshots', {
        window: '7d',
        generatedAt: NOW,
        since: NOW - 7 * DAY,
        topPosters: [],
        topInteractors: [
          { userId: ana, count: 5, lastAt: NOW },
          { userId: bruno, count: 4, lastAt: NOW },
          { userId: carla, count: 4, lastAt: NOW },
          { userId: dave, count: 3, lastAt: NOW }
        ],
        posterCountsDescending: [],
        interactorCountsDescending: [5, 4, 4, 3],
        partial: false
      })
    })
    const result = await t.query(api.rankings.getSiteRankings, { sessionToken: 'tok', window: '7d' })
    expect(result.interactors.map(r => ({ name: r.name, position: r.position }))).toEqual([
      { name: 'Bruno', position: 1 },
      { name: 'Carla', position: 1 },
      { name: 'Dave', position: 3 }
    ])
  })

  test('getMyRankings carries each person visible authored post count in both lists', async () => {
    const t = convexTest(schema, modules)
    const { me, ana } = await seed(t)
    const anaPost = await t.run(async ctx => {
      const at = (urn: string, publishedAt: number, extra: Record<string, unknown> = {}) =>
        ctx.db.insert('posts', {
          linkedinPostUrn: urn,
          authorId: ana,
          content: 'ana',
          publishedAt,
          likeCount: 0,
          commentCount: 0,
          mediaUrls: [],
          isFeatured: false,
          visibilityIndustries: [],
          visibilityCountries: [],
          hidden: false,
          ...extra
        })
      await at('urn:ana-visible', NOW - DAY)
      await at('urn:ana-hidden', NOW - 2 * DAY, { hidden: true })
      await at('urn:ana-deleted', NOW - 3 * DAY, { deletedAt: NOW })
      await at('urn:ana-old', NOW - 8 * DAY)
      return at('urn:ana-touched', NOW - DAY)
    })
    await t.run(async ctx =>
      ctx.db.insert('userInteractions', {
        userId: me,
        postId: anaPost,
        authorId: ana,
        kind: 'reaction' as const,
        createdAt: NOW
      })
    )
    const result = await t.query(api.rankings.getMyRankings, { sessionToken: 'tok', window: '7d', now: NOW })
    expect(result.received[0]).toMatchObject({ name: 'Ana', total: 1, postsCount: 2 })
    expect(result.made[0]).toMatchObject({ name: 'Ana', total: 1, postsCount: 2 })
  })

  test('getSiteRankings reports the gap to the next position', async () => {
    const t = convexTest(schema, modules)
    const { me, ana } = await seed(t)
    const anaPost = await t.run(async ctx =>
      ctx.db.insert('posts', {
        linkedinPostUrn: 'urn:gap',
        authorId: ana,
        content: 'x',
        publishedAt: NOW,
        likeCount: 0,
        commentCount: 0,
        mediaUrls: [],
        isFeatured: false,
        visibilityIndustries: [],
        visibilityCountries: [],
        hidden: false
      })
    )
    await t.run(async ctx => {
      await ctx.db.insert('userInteractions', {
        userId: me,
        postId: anaPost,
        authorId: ana,
        kind: 'reaction' as const,
        createdAt: NOW
      })
      await ctx.db.insert('rankingSnapshots', {
        window: '7d',
        generatedAt: NOW,
        since: NOW - 7 * DAY,
        topPosters: [],
        topInteractors: [],
        posterCountsDescending: [],
        interactorCountsDescending: [2, 1],
        partial: false
      })
    })
    const result = await t.query(api.rankings.getSiteRankings, { sessionToken: 'tok', window: '7d' })
    expect(result.me).toMatchObject({ count: 1, position: 2, gapToNext: 1 })
  })

  test('getSiteRankings reports no gap at position 1 or when unranked', async () => {
    const t = convexTest(schema, modules)
    await seed(t)
    await t.run(async ctx => {
      await ctx.db.insert('rankingSnapshots', {
        window: '7d',
        generatedAt: NOW,
        since: NOW - 7 * DAY,
        topPosters: [],
        topInteractors: [],
        posterCountsDescending: [],
        interactorCountsDescending: [2, 1],
        partial: false
      })
    })
    const result = await t.query(api.rankings.getSiteRankings, { sessionToken: 'tok', window: '7d' })
    expect(result.me).toMatchObject({ count: 0, position: null, gapToNext: null })
  })

  test('getGraphSummary returns the all-time graph and the live position with the gap', async () => {
    const t = convexTest(schema, modules)
    const { me, ana } = await seed(t)
    const myPost = await t.run(async ctx => (await ctx.db.query('posts').first())!)
    const bruno = await t.run(async ctx =>
      ctx.db.insert('users', { linkedinId: 'bruno', name: 'Bruno', subscriptionStatus: 'none', createdAt: NOW })
    )
    const anaPost = await t.run(async ctx =>
      ctx.db.insert('posts', {
        linkedinPostUrn: 'urn:graph-ana',
        authorId: ana,
        content: 'x',
        publishedAt: NOW,
        likeCount: 0,
        commentCount: 0,
        mediaUrls: [],
        isFeatured: false,
        visibilityIndustries: [],
        visibilityCountries: [],
        hidden: false
      })
    )
    const brunoPost = await t.run(async ctx =>
      ctx.db.insert('posts', {
        linkedinPostUrn: 'urn:graph-bruno',
        authorId: bruno,
        content: 'x',
        publishedAt: NOW,
        likeCount: 0,
        commentCount: 0,
        mediaUrls: [],
        isFeatured: false,
        visibilityIndustries: [],
        visibilityCountries: [],
        hidden: false
      })
    )
    await t.run(async ctx => {
      await ctx.db.insert('userInteractions', {
        userId: me,
        postId: anaPost,
        authorId: ana,
        kind: 'reaction' as const,
        createdAt: NOW
      })
      await ctx.db.insert('userInteractions', {
        userId: me,
        postId: anaPost,
        authorId: ana,
        kind: 'comment' as const,
        createdAt: NOW
      })
      await ctx.db.insert('userInteractions', {
        userId: me,
        postId: brunoPost,
        authorId: bruno,
        kind: 'reaction' as const,
        createdAt: NOW
      })
      await ctx.db.insert('userInteractions', {
        userId: bruno,
        postId: myPost._id,
        authorId: me,
        kind: 'comment' as const,
        createdAt: NOW
      })
      // Neither of these is an interaction with a person: a self-reaction and an AI draft.
      await ctx.db.insert('userInteractions', {
        userId: me,
        postId: myPost._id,
        authorId: me,
        kind: 'reaction' as const,
        createdAt: NOW
      })
      await ctx.db.insert('userInteractions', {
        userId: me,
        postId: anaPost,
        kind: 'ai_draft' as const,
        comment: 'draft',
        createdAt: NOW
      })
      await ctx.db.insert('rankingSnapshots', {
        window: '7d',
        generatedAt: NOW,
        since: NOW - 7 * DAY,
        topPosters: [],
        topInteractors: [],
        posterCountsDescending: [],
        interactorCountsDescending: [4, 3, 1],
        partial: false
      })
    })
    const summary = await t.query(internal.rankings.getGraphSummary, { userId: me })
    expect(summary).toMatchObject({
      peopleMade: 2,
      peopleReceived: 2,
      receivedReactions: 1,
      receivedComments: 1,
      position: 2,
      gapToNext: 1
    })
    // The public session-resolved read is the same computation, for the cancel interstitial.
    const mine = await t.query(api.rankings.getMyGraphSummary, { sessionToken: 'tok' })
    expect(mine).toEqual(summary)
  })

  test('getMyGraphSummary is zeroed at rest and refuses a bad session', async () => {
    const t = convexTest(schema, modules)
    await seed(t)
    const quiet = await t.run(async ctx =>
      ctx.db.insert('users', { linkedinId: 'quiet', name: 'Quiet', subscriptionStatus: 'none', createdAt: NOW })
    )
    await t.run(async ctx => ctx.db.insert('sessions', { token: 'quiet-tok', userId: quiet, expiresAt: NOW + DAY }))
    const zero = await t.query(api.rankings.getMyGraphSummary, { sessionToken: 'quiet-tok' })
    expect(zero).toEqual({
      peopleMade: 0,
      peopleReceived: 0,
      receivedReactions: 0,
      receivedComments: 0,
      position: null,
      gapToNext: null
    })
    await expect(t.query(api.rankings.getMyGraphSummary, { sessionToken: 'nope' })).rejects.toThrow('Unauthorized')
  })

  test('getWeeklyTop returns positions 1..3 after dropping banned and opted-out members', async () => {
    const t = convexTest(schema, modules)
    const { ana } = await seed(t)
    const make = (linkedinId: string, name: string) =>
      t.run(async ctx => ctx.db.insert('users', { linkedinId, name, subscriptionStatus: 'none', createdAt: NOW }))
    const bruno = await make('bruno', 'Bruno')
    const carla = await make('carla', 'Carla')
    const dave = await make('dave', 'Dave')
    const erin = await make('erin', 'Erin')
    await t.run(async ctx => {
      await ctx.db.patch(ana, { isBanned: true })
      await ctx.db.patch(bruno, { leaderboardOptOut: true })
      const ranked = [ana, bruno, carla, dave, erin]
      await ctx.db.insert('rankingSnapshots', {
        window: '7d',
        generatedAt: NOW,
        since: NOW - 7 * DAY,
        topPosters: ranked.map((userId, i) => ({ userId, count: 5 - i, lastAt: NOW })),
        topInteractors: ranked.map((userId, i) => ({ userId, count: 5 - i, lastAt: NOW })),
        posterCountsDescending: [5, 4, 3, 2, 1],
        interactorCountsDescending: [5, 4, 3, 2, 1],
        partial: false
      })
    })
    const result = await t.query(api.rankings.getWeeklyTop, { sessionToken: 'tok' })
    expect(result.generatedAt).toBe(NOW)
    expect(result.interactors).toEqual([
      { userId: carla, position: 1 },
      { userId: dave, position: 2 },
      { userId: erin, position: 3 }
    ])
    expect(result.posters).toEqual([
      { userId: carla, position: 1 },
      { userId: dave, position: 2 },
      { userId: erin, position: 3 }
    ])
  })

  test('getWeeklyTop returns empty arrays when no snapshot exists', async () => {
    const t = convexTest(schema, modules)
    await seed(t)
    const result = await t.query(api.rankings.getWeeklyTop, { sessionToken: 'tok' })
    expect(result).toEqual({ generatedAt: null, posters: [], interactors: [] })
  })

  test('an opted-out member disappears from the site board', async () => {
    const t = convexTest(schema, modules)
    const { ana } = await seed(t)
    await t.mutation(internal.jobs.rankingSnapshot.rebuildRankingSnapshots, { window: '7d' })
    await t.run(async ctx => ctx.db.patch(ana, { leaderboardOptOut: true }))
    const after = await t.query(api.rankings.getSiteRankings, { sessionToken: 'tok', window: '7d' })
    expect(after.interactors.map(r => r.name)).not.toContain('Ana')
  })

  test('a banned counterparty disappears from the personal rankings', async () => {
    const t = convexTest(schema, modules)
    const { ana } = await seed(t)
    await t.run(async ctx => ctx.db.patch(ana, { isBanned: true }))
    const result = await t.query(api.rankings.getMyRankings, { sessionToken: 'tok', window: '7d', now: NOW })
    expect(result.received).toEqual([])
  })

  test('setLeaderboardOptOut flips the flag and is audited', async () => {
    const t = convexTest(schema, modules)
    await seed(t)
    await t.mutation(internal.jobs.rankingSnapshot.rebuildRankingSnapshots, { window: '7d' })
    await t.mutation(api.users.setLeaderboardOptOut, { sessionToken: 'tok', optOut: true })
    const after = await t.query(api.rankings.getSiteRankings, { sessionToken: 'tok', window: '7d' })
    expect(after.me).toMatchObject({ optedOut: true })
    const audits = await t.run(async ctx => ctx.db.query('auditLogs').collect())
    expect(audits.some(a => a.action === 'leaderboard_opt_out_changed')).toBe(true)
  })

  test('rebuildRankingSnapshotsNow rejects a non-admin', async () => {
    const t = convexTest(schema, modules)
    await seed(t)
    await expect(t.mutation(api.admin.rebuildRankingSnapshotsNow, { sessionToken: 'tok' })).rejects.toThrow(/admin/i)
  })

  test('rebuildRankingSnapshotsNow schedules a rebuild for both windows', async () => {
    const t = convexTest(schema, modules)
    const { me } = await seed(t)
    await t.run(async ctx => ctx.db.patch(me, { isAdmin: true }))
    // Fake timers keep runAfter(0) jobs pending so the scheduled rows can be inspected before they run.
    vi.useFakeTimers()
    try {
      await t.mutation(api.admin.rebuildRankingSnapshotsNow, { sessionToken: 'tok' })
      const jobs = await t.run(async ctx => ctx.db.system.query('_scheduled_functions').collect())
      expect(jobs.map(j => j.name)).toEqual([
        'jobs/rankingSnapshot:rebuildRankingSnapshots',
        'jobs/rankingSnapshot:rebuildRankingSnapshots'
      ])
      expect(jobs.map(j => j.args[0])).toEqual(expect.arrayContaining([{ window: '7d' }, { window: '30d' }]))
    } finally {
      vi.useRealTimers()
    }
  })
})
