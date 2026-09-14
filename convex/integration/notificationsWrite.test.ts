/// <reference types="vite/client" />
import { convexTest } from 'convex-test'
import { describe, expect, test } from 'vitest'
import { internal } from '../_generated/api'
import type { TestConvex } from 'convex-test'
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
