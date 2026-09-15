/// <reference types="vite/client" />
import { convexTest } from 'convex-test'
import { describe, expect, test } from 'vitest'
import { internal } from '../_generated/api'
import type { TestConvex } from 'convex-test'
import schema from '../schema'

const modules = import.meta.glob('../**/*.ts')

type T = TestConvex<typeof schema>

const NOW = Date.now()
const DAY = 86_400_000

async function seedUser(t: T, name: string, createdAt = NOW) {
  return await t.run(async ctx =>
    ctx.db.insert('users', { linkedinId: `li-${name}`, name, subscriptionStatus: 'none', createdAt })
  )
}

// NOW must be the real clock: the job computes its own window from Date.now().
async function seedPost(
  t: T,
  authorId: Awaited<ReturnType<typeof seedUser>>,
  fields: { publishedAt?: number; hidden?: boolean; deletedAt?: number; likeCount?: number } = {}
) {
  return await t.run(async ctx =>
    ctx.db.insert('posts', {
      linkedinPostUrn: `urn:${crypto.randomUUID()}`,
      authorId,
      content: 'x',
      publishedAt: fields.publishedAt ?? NOW,
      likeCount: fields.likeCount ?? 0,
      commentCount: 0,
      mediaUrls: [],
      isFeatured: false,
      visibilityIndustries: [],
      visibilityCountries: [],
      hidden: fields.hidden ?? false,
      deletedAt: fields.deletedAt
    })
  )
}

async function seedInteraction(
  t: T,
  userId: Awaited<ReturnType<typeof seedUser>>,
  authorId: Awaited<ReturnType<typeof seedUser>>,
  at = NOW
) {
  const postId = await seedPost(t, authorId, { publishedAt: at })
  return await t.run(async ctx =>
    ctx.db.insert('userInteractions', {
      userId,
      postId,
      authorId,
      kind: 'reaction' as const,
      createdAt: at
    })
  )
}

describe('rankingSnapshot.rebuildRankingSnapshots', () => {
  test('writes one row per window with posters and interactors, excluding hidden, deleted and out-of-window posts', async () => {
    const t = convexTest(schema, modules)
    const ana = await seedUser(t, 'Ana')
    const bruno = await seedUser(t, 'Bruno')
    const carla = await seedUser(t, 'Carla')
    await seedInteraction(t, bruno, ana)
    await seedInteraction(t, bruno, ana)
    await seedInteraction(t, ana, bruno)
    await seedPost(t, carla, { hidden: true })
    await seedPost(t, carla, { deletedAt: NOW })
    await seedPost(t, carla, { publishedAt: NOW - 8 * DAY })

    await t.mutation(internal.jobs.rankingSnapshot.rebuildRankingSnapshots, { window: '7d' })

    const rows = await t.run(async ctx =>
      ctx.db.query('rankingSnapshots').withIndex('by_window_and_generated_at').collect()
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].window).toBe('7d')
    expect(rows[0].partial).toBe(false)
    expect(rows[0].topInteractors[0]).toMatchObject({ userId: bruno, count: 2 })
    expect(rows[0].interactorCountsDescending).toEqual([2, 1])
    expect(rows[0].topPosters.map(p => p.userId)).toEqual([ana, bruno])
    expect(rows[0].topPosters.map(p => p.userId)).not.toContain(carla)
  })

  test('stores identities for the top 300 while the distribution covers everyone', async () => {
    const t = convexTest(schema, modules)
    const ana = await seedUser(t, 'Ana')
    const post = await seedPost(t, ana)
    await t.run(async ctx => {
      for (let i = 0; i < 301; i += 1) {
        const userId = await ctx.db.insert('users', {
          linkedinId: `member-${i}`,
          name: `Member ${i}`,
          subscriptionStatus: 'none',
          createdAt: NOW
        })
        await ctx.db.insert('userInteractions', {
          userId,
          postId: post,
          authorId: ana,
          kind: 'reaction' as const,
          createdAt: NOW
        })
      }
    })

    await t.mutation(internal.jobs.rankingSnapshot.rebuildRankingSnapshots, { window: '7d' })

    const rows = await t.run(async ctx => ctx.db.query('rankingSnapshots').collect())
    expect(rows[0].topInteractors).toHaveLength(300)
    expect(rows[0].interactorCountsDescending).toHaveLength(301)
  })

  test('enriches poster entries with summed reactions received and interactor entries with distinct posts touched', async () => {
    const t = convexTest(schema, modules)
    const ana = await seedUser(t, 'Ana')
    const bruno = await seedUser(t, 'Bruno')
    const first = await seedPost(t, ana, { likeCount: 7 })
    const second = await seedPost(t, ana, { likeCount: 2 })
    await t.run(async ctx => {
      // Two interactions on the same post plus one on another: count 3, distinct posts 2.
      await ctx.db.insert('userInteractions', {
        userId: bruno,
        postId: first,
        authorId: ana,
        kind: 'reaction' as const,
        createdAt: NOW
      })
      await ctx.db.insert('userInteractions', {
        userId: bruno,
        postId: first,
        authorId: ana,
        kind: 'reaction' as const,
        createdAt: NOW
      })
      await ctx.db.insert('userInteractions', {
        userId: bruno,
        postId: second,
        authorId: ana,
        kind: 'comment' as const,
        createdAt: NOW
      })
    })

    await t.mutation(internal.jobs.rankingSnapshot.rebuildRankingSnapshots, { window: '7d' })

    const rows = await t.run(async ctx =>
      ctx.db.query('rankingSnapshots').withIndex('by_window_and_generated_at').collect()
    )
    expect(rows[0].topPosters[0]).toMatchObject({ userId: ana, count: 2, reactionsReceived: 9 })
    expect(rows[0].topInteractors[0]).toMatchObject({ userId: bruno, count: 3, postsTouched: 2 })
  })

  test('second run keeps the previous generation for movement', async () => {
    const t = convexTest(schema, modules)
    const ana = await seedUser(t, 'Ana')
    await seedInteraction(t, ana, await seedUser(t, 'Bruno'))

    await t.mutation(internal.jobs.rankingSnapshot.rebuildRankingSnapshots, { window: '7d' })
    await t.run(async ctx => {
      const rows = await ctx.db.query('rankingSnapshots').collect()
      await ctx.db.patch(rows[0]._id, { generatedAt: Date.now() - DAY })
    })
    await t.mutation(internal.jobs.rankingSnapshot.rebuildRankingSnapshots, { window: '7d' })

    const rows = await t.run(async ctx =>
      ctx.db.query('rankingSnapshots').withIndex('by_window_and_generated_at').collect()
    )
    expect(rows).toHaveLength(2)
  })
})
