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
    // Ana reacted to "Me"'s one-post, one-reaction window: the read carries the enriched per-row fields.
    expect(before.interactors[0]).toMatchObject({ name: 'Ana', count: 1, postsTouched: 1 })
    expect(before.posters[0]).toMatchObject({ name: 'Me', count: 1, reactionsReceived: 1 })
    // "Me" authored the post but made no interactions: zero count, no position.
    expect(before.me).toMatchObject({ count: 0, position: null, movement: null, optedOut: false })
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
