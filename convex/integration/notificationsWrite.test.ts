/// <reference types="vite/client" />
import { convexTest } from 'convex-test'
import { describe, expect, test } from 'vitest'
import { internal } from '../_generated/api'
import type { TestConvex } from 'convex-test'
import type { Id } from '../_generated/dataModel'
import schema from '../schema'

const modules = import.meta.glob('../**/*.ts')
type T = TestConvex<typeof schema>
const NOW = Date.now()

async function seed(t: T) {
  const ana = await t.run(async ctx =>
    ctx.db.insert('users', { linkedinId: 'ana', name: 'Ana', subscriptionStatus: 'none', createdAt: NOW })
  )
  const bruno = await t.run(async ctx =>
    ctx.db.insert('users', { linkedinId: 'bruno', name: 'Bruno', subscriptionStatus: 'none', createdAt: NOW })
  )
  const post = await t.run(async ctx =>
    ctx.db.insert('posts', {
      linkedinPostUrn: 'urn:1',
      authorId: bruno,
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
  return { ana, bruno, post }
}

describe('notification writes', () => {
  test('a comment writes a notification to the author with an excerpt', async () => {
    const t = convexTest(schema, modules)
    const { ana, bruno, post } = await seed(t)
    await t.mutation(internal.interactions.incrementCommentCount, {
      postId: post,
      actorId: ana,
      comment: 'Great point about the SSI'
    })
    const rows = await t.run(async ctx => ctx.db.query('notifications').collect())
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      recipientId: bruno,
      actorId: ana,
      kind: 'comment'
    })
    expect(rows[0].readAt).toBeUndefined()
    expect(rows[0].excerpt).toContain('Great point')
  })

  test('a reaction writes one notification and a repeat reaction writes none', async () => {
    const t = convexTest(schema, modules)
    const { ana, post } = await seed(t)
    await t.mutation(internal.interactions.incrementLikeCount, { postId: post, actorId: ana, reaction: 'LIKE' })
    await t.mutation(internal.interactions.incrementLikeCount, { postId: post, actorId: ana, reaction: 'LIKE' })
    const rows = await t.run(async ctx => ctx.db.query('notifications').collect())
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ kind: 'reaction', reaction: 'LIKE' })
  })

  test('a self-interaction writes no notification and no received counter', async () => {
    const t = convexTest(schema, modules)
    const { bruno, post } = await seed(t)
    await t.mutation(internal.interactions.incrementCommentCount, {
      postId: post,
      actorId: bruno,
      comment: 'my own post'
    })
    expect(await t.run(async ctx => ctx.db.query('notifications').collect())).toHaveLength(0)
  })
})

describe('record-post notifications', () => {
  const DAY = 86_400_000

  async function selfComments(t: T, post: Id<'posts'>, author: Id<'users'>, n: number) {
    for (let i = 0; i < n; i += 1) {
      await t.mutation(internal.interactions.incrementCommentCount, { postId: post, actorId: author, comment: `c${i}` })
    }
  }

  test('the first post to reach 5 writes one record row and one self-addressed notification', async () => {
    const t = convexTest(schema, modules)
    const { bruno, post } = await seed(t)
    await selfComments(t, post, bruno, 5)
    const records = await t.run(async ctx => ctx.db.query('userRecords').collect())
    expect(records).toHaveLength(1)
    expect(records[0]).toMatchObject({ userId: bruno, postId: post, total: 5 })
    const rows = await t.run(async ctx => ctx.db.query('notifications').collect())
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      recipientId: bruno,
      actorId: bruno,
      postId: post,
      kind: 'record',
      total: 5
    })
  })

  test('a larger total within 7 days updates the stored best but writes no notification', async () => {
    const t = convexTest(schema, modules)
    const { bruno, post } = await seed(t)
    await selfComments(t, post, bruno, 6)
    const records = await t.run(async ctx => ctx.db.query('userRecords').collect())
    expect(records).toHaveLength(1)
    expect(records[0].total).toBe(6)
    const rows = await t.run(async ctx => ctx.db.query('notifications').collect())
    expect(rows.filter(r => r.kind === 'record')).toHaveLength(1)
  })

  test('after the 7-day cooldown a new record notifies again', async () => {
    const t = convexTest(schema, modules)
    const { bruno, post } = await seed(t)
    await selfComments(t, post, bruno, 6)
    await t.run(async ctx => {
      const row = await ctx.db.query('userRecords').first()
      if (!row) throw new Error('record row missing')
      await ctx.db.patch(row._id, { notifiedAt: Date.now() - 8 * DAY })
    })
    await selfComments(t, post, bruno, 1) // → 7
    const records = await t.run(async ctx => ctx.db.query('userRecords').collect())
    expect(records).toHaveLength(1)
    expect(records[0].total).toBe(7)
    const rows = await t.run(async ctx => ctx.db.query('notifications').collect())
    expect(rows.filter(r => r.kind === 'record')).toHaveLength(2)
  })

  test('below the floor writes nothing', async () => {
    const t = convexTest(schema, modules)
    const { bruno, post } = await seed(t)
    await selfComments(t, post, bruno, 4)
    expect(await t.run(async ctx => ctx.db.query('userRecords').collect())).toHaveLength(0)
    expect(await t.run(async ctx => ctx.db.query('notifications').collect())).toHaveLength(0)
  })
})
