/// <reference types="vite/client" />
import { convexTest } from 'convex-test'
import { describe, expect, test } from 'vitest'
import { api } from '../_generated/api'
import type { TestConvex } from 'convex-test'
import schema from '../schema'

const modules = import.meta.glob('../**/*.ts')
type T = TestConvex<typeof schema>

const NOW = Date.now()
const DAY = 86_400_000

async function seed(t: T) {
  const me = await t.run(async ctx =>
    ctx.db.insert('users', {
      linkedinId: 'me',
      name: 'Me',
      subscriptionStatus: 'none',
      createdAt: NOW,
      language: 'en'
    })
  )
  const ana = await t.run(async ctx =>
    ctx.db.insert('users', { linkedinId: 'ana', name: 'Ana', subscriptionStatus: 'none', createdAt: NOW })
  )
  const post = await t.run(async ctx =>
    ctx.db.insert('posts', {
      linkedinPostUrn: 'urn:1',
      authorId: me,
      content: 'hello world',
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
      createdAt: NOW - DAY
    })
  )
  await t.run(async ctx => ctx.db.insert('sessions', { token: 'tok', userId: me, expiresAt: NOW + DAY }))
  return { me, ana, post, token: 'tok' }
}

describe('interactions people queries', () => {
  test('made list is empty when the member made no interactions', async () => {
    const t = convexTest(schema, modules)
    await seed(t)
    const result = await t.query(api.interactions.listPeopleIInteractedWith, {
      sessionToken: 'tok',
      window: '30d',
      now: NOW
    })
    expect(result.people).toEqual([])
  })

  test('by-post accordion groups the received interaction under its post', async () => {
    const t = convexTest(schema, modules)
    await seed(t)
    const result = await t.query(api.interactions.listInteractionsByPost, {
      sessionToken: 'tok',
      window: '7d',
      now: NOW
    })
    expect(result.posts).toHaveLength(1)
    expect(result.posts[0].actors[0]).toMatchObject({ name: 'Ana', total: 1 })
  })

  test('banned counterparts disappear from the made list and the by-post actors', async () => {
    const t = convexTest(schema, modules)
    const { me, ana } = await seed(t)
    const anaPost = await t.run(async ctx =>
      ctx.db.insert('posts', {
        linkedinPostUrn: 'urn:2',
        authorId: ana,
        content: 'ana post',
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
    await t.run(async ctx =>
      ctx.db.insert('userInteractions', {
        userId: me,
        postId: anaPost,
        authorId: ana,
        kind: 'reaction' as const,
        createdAt: NOW - DAY
      })
    )
    await t.run(async ctx => ctx.db.patch(ana, { isBanned: true }))

    const made = await t.query(api.interactions.listPeopleIInteractedWith, {
      sessionToken: 'tok',
      window: '7d',
      now: NOW
    })
    expect(made.people).toEqual([])

    const byPost = await t.query(api.interactions.listInteractionsByPost, {
      sessionToken: 'tok',
      window: '7d',
      now: NOW
    })
    expect(byPost.posts.flatMap(p => p.actors)).toEqual([])
  })
})
