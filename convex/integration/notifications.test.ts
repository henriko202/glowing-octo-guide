/// <reference types="vite/client" />
import { convexTest } from 'convex-test'
import { describe, expect, test } from 'vitest'
import { api, internal } from '../_generated/api'
import type { TestConvex } from 'convex-test'
import schema from '../schema'

const modules = import.meta.glob('../**/*.ts')
type T = TestConvex<typeof schema>
const NOW = Date.now()

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
      likeCount: 0,
      commentCount: 0,
      mediaUrls: [],
      isFeatured: false,
      visibilityIndustries: [],
      visibilityCountries: [],
      hidden: false
    })
  )
  await t.run(async ctx => ctx.db.insert('sessions', { token: 'tok', userId: me, expiresAt: NOW + 86_400_000 }))
  await t.mutation(internal.interactions.incrementCommentCount, { postId: post, actorId: ana, comment: 'nice' })
  return { me, ana, post }
}

describe('notifications queries', () => {
  test('listMine joins the actor, counts unread and marks read', async () => {
    const t = convexTest(schema, modules)
    await seed(t)
    const page = await t.query(api.notifications.listMine, {
      sessionToken: 'tok',
      paginationOpts: { numItems: 10, cursor: null }
    })
    expect(page.page).toHaveLength(1)
    expect(page.page[0]).toMatchObject({ actorName: 'Ana', kind: 'comment', unread: true, removed: false })
    expect(await t.query(api.notifications.getUnreadCount, { sessionToken: 'tok' })).toBe(1)
    await t.mutation(api.notifications.markRead, { sessionToken: 'tok', ids: [page.page[0].id] })
    expect(await t.query(api.notifications.getUnreadCount, { sessionToken: 'tok' })).toBe(0)
  })

  test('a deleted post reads as removed', async () => {
    const t = convexTest(schema, modules)
    const { post } = await seed(t)
    await t.run(async ctx => ctx.db.patch(post, { deletedAt: NOW }))
    const page = await t.query(api.notifications.listMine, {
      sessionToken: 'tok',
      paginationOpts: { numItems: 10, cursor: null }
    })
    expect(page.page[0].removed).toBe(true)
  })

  test('a banned actor drops from the inbox', async () => {
    const t = convexTest(schema, modules)
    const { ana } = await seed(t)
    await t.run(async ctx => ctx.db.patch(ana, { isBanned: true }))
    const page = await t.query(api.notifications.listMine, {
      sessionToken: 'tok',
      paginationOpts: { numItems: 10, cursor: null }
    })
    expect(page.page).toEqual([])
  })

  test('getUnreadCount does not count an unread row whose actor is banned', async () => {
    const t = convexTest(schema, modules)
    const { me, post } = await seed(t)
    const banned = await t.run(async ctx =>
      ctx.db.insert('users', {
        linkedinId: 'banned',
        name: 'Banned',
        subscriptionStatus: 'none',
        createdAt: NOW,
        isBanned: true
      })
    )
    await t.run(async ctx => {
      const rows = await ctx.db.query('notifications').collect()
      await ctx.db.patch(rows[0]._id, { createdAt: NOW })
      await ctx.db.insert('notifications', {
        recipientId: me,
        actorId: banned,
        postId: post,
        kind: 'reaction' as const,
        createdAt: NOW + 1000
      })
    })
    // Only Ana's older comment is visible, so the banned actor's newer row cannot light the badge.
    expect(await t.query(api.notifications.getUnreadCount, { sessionToken: 'tok' })).toBe(1)
  })

  test('getUnreadCount caps the 9+ badge at 10 even with more visible unread rows', async () => {
    const t = convexTest(schema, modules)
    const { me } = await seed(t)
    await t.run(async ctx => {
      const post = await ctx.db.query('posts').first()
      if (!post) throw new Error('seed post missing')
      for (let i = 0; i < 11; i += 1) {
        await ctx.db.insert('notifications', {
          recipientId: me,
          actorId: me,
          postId: post._id,
          kind: 'reaction' as const,
          createdAt: NOW + i
        })
      }
    })
    // 12 visible unread rows exist (Ana's seed row plus 11 here); the badge number stops at 10.
    expect(await t.query(api.notifications.getUnreadCount, { sessionToken: 'tok' })).toBe(10)
  })

  test('getLatest returns the actor name and post link for the toast', async () => {
    const t = convexTest(schema, modules)
    await seed(t)
    expect(await t.query(api.notifications.getLatest, { sessionToken: 'tok' })).toMatchObject({
      actorName: 'Ana',
      kind: 'comment',
      postUrn: 'urn:1',
      removed: false
    })
  })

  test('listMine and getLatest carry actorId and total for a record row', async () => {
    const t = convexTest(schema, modules)
    const { me, post } = await seed(t)
    await t.run(async ctx => {
      // Pin the seeded comment to NOW so the record row below is unambiguously the newest, no matter how long
      // after module load this test runs (the seed writes its notification with the real Date.now()).
      const rows = await ctx.db.query('notifications').collect()
      await ctx.db.patch(rows[0]._id, { createdAt: NOW })
      await ctx.db.insert('notifications', {
        recipientId: me,
        actorId: me,
        postId: post,
        kind: 'record' as const,
        total: 5,
        createdAt: NOW + 1000
      })
    })
    const page = await t.query(api.notifications.listMine, {
      sessionToken: 'tok',
      paginationOpts: { numItems: 10, cursor: null }
    })
    const record = page.page.find(row => row.kind === 'record')
    expect(record).toMatchObject({ actorId: me, total: 5 })
    expect(await t.query(api.notifications.getLatest, { sessionToken: 'tok' })).toMatchObject({
      actorId: me,
      kind: 'record',
      total: 5
    })
  })

  test('getLatest skips a newest notification whose actor is banned', async () => {
    const t = convexTest(schema, modules)
    const { me, post } = await seed(t)
    const banned = await t.run(async ctx =>
      ctx.db.insert('users', {
        linkedinId: 'banned',
        name: 'Banned',
        subscriptionStatus: 'none',
        createdAt: NOW,
        isBanned: true
      })
    )
    await t.run(async ctx => {
      const rows = await ctx.db.query('notifications').collect()
      await ctx.db.patch(rows[0]._id, { createdAt: NOW })
      await ctx.db.insert('notifications', {
        recipientId: me,
        actorId: banned,
        postId: post,
        kind: 'reaction' as const,
        createdAt: NOW + 1000
      })
    })
    expect(await t.query(api.notifications.getLatest, { sessionToken: 'tok' })).toMatchObject({
      actorName: 'Ana',
      kind: 'comment'
    })
  })

  test('getLatest returns null when every recent actor is banned', async () => {
    const t = convexTest(schema, modules)
    const { ana } = await seed(t)
    await t.run(async ctx => ctx.db.patch(ana, { isBanned: true }))
    expect(await t.query(api.notifications.getLatest, { sessionToken: 'tok' })).toBeNull()
  })

  test('markRead ignores ids owned by someone else', async () => {
    const t = convexTest(schema, modules)
    await seed(t)
    const rows = await t.run(async ctx => ctx.db.query('notifications').collect())
    await t.run(async ctx =>
      ctx.db.insert('sessions', { token: 'other', userId: rows[0].actorId, expiresAt: NOW + 86_400_000 })
    )
    await t.mutation(api.notifications.markRead, { sessionToken: 'other', ids: [rows[0]._id] })
    expect(await t.query(api.notifications.getUnreadCount, { sessionToken: 'tok' })).toBe(1)
  })

  test('markAllRead clears the unread count', async () => {
    const t = convexTest(schema, modules)
    await seed(t)
    await t.mutation(api.notifications.markAllRead, { sessionToken: 'tok' })
    expect(await t.query(api.notifications.getUnreadCount, { sessionToken: 'tok' })).toBe(0)
  })

  test('markAllRead drains a backlog larger than one batch', async () => {
    const t = convexTest(schema, modules)
    const { me } = await seed(t)
    await t.run(async ctx => {
      const post = await ctx.db.query('posts').first()
      if (!post) throw new Error('seed post missing')
      for (let i = 0; i < 150; i += 1) {
        await ctx.db.insert('notifications', {
          recipientId: me,
          actorId: me,
          postId: post._id,
          kind: 'reaction' as const,
          createdAt: NOW + i
        })
      }
    })
    await t.mutation(api.notifications.markAllRead, { sessionToken: 'tok' })
    // The public mutation drains one batch and schedules the continuation; drain it (and anything it schedules)
    // before asserting. finishInProgressScheduledFunctions only waits for already-started jobs in convex-test
    // 0.0.57, so the scheduled runAfter(0) continuation needs finishAllScheduledFunctions. Manual fallback:
    // await t.mutation(internal.notifications.markAllReadBatch, { userId: me }).
    await t.finishAllScheduledFunctions(() => {})
    expect(await t.query(api.notifications.getUnreadCount, { sessionToken: 'tok' })).toBe(0)
  })
})
