/// <reference types="vite/client" />
import { convexTest } from 'convex-test'
import { describe, expect, test } from 'vitest'
import { api, internal } from '../_generated/api'
import type { TestConvex } from 'convex-test'
import type { Id } from '../_generated/dataModel'
import schema from '../schema'

// The real generated modules — this config has no `convex/server` alias, so functions run against
// the real convex-test backend (validators, indexes, transactions) instead of the unit mock shim.
const modules = import.meta.glob('../**/*.ts')

type T = TestConvex<typeof schema>

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

async function insertUser(
  t: T,
  fields: { linkedinId: string; name: string; tier?: 'starter' | 'growth' | 'pro' | 'contact' }
): Promise<Id<'users'>> {
  return t.run(async ctx =>
    ctx.db.insert('users', {
      linkedinId: fields.linkedinId,
      name: fields.name,
      tier: fields.tier,
      subscriptionStatus: 'active',
      createdAt: Date.now()
    })
  )
}

async function insertPost(
  t: T,
  authorId: Id<'users'>,
  fields: { linkedinPostUrn?: string; likeCount?: number } = {}
): Promise<Id<'posts'>> {
  return t.run(async ctx =>
    ctx.db.insert('posts', {
      linkedinPostUrn: fields.linkedinPostUrn ?? `urn:li:activity:${crypto.randomUUID()}`,
      authorId,
      content: 'integration seed post',
      publishedAt: Date.now(),
      likeCount: fields.likeCount ?? 0,
      commentCount: 0,
      mediaUrls: [],
      isFeatured: false,
      visibilityIndustries: [],
      visibilityCountries: [],
      hidden: false
    })
  )
}

function upsertArgs(authorId: Id<'users'>, urn: string, queueOnLimitReached?: boolean) {
  return {
    linkedinPostUrn: urn,
    authorId,
    content: 'synced post',
    publishedAt: Date.now(),
    likeCount: 0,
    commentCount: 0,
    mediaUrls: [],
    isFeatured: false,
    visibilityIndustries: [],
    visibilityCountries: [],
    hidden: false,
    queueOnLimitReached
  }
}

describe('high-risk backend paths', () => {
  test('weekly limit: the second fresh starter post is queued, a non-queue caller is refused', async () => {
    const t = convexTest(schema, modules)
    const authorId = await insertUser(t, { linkedinId: 'li-weekly', name: 'Weekly Author', tier: 'starter' })

    const first = await t.mutation(internal.jobs.syncPosts.upsertPost, upsertArgs(authorId, 'urn:li:activity:weekly-1'))
    expect(first.created).toBe(true)
    expect(first.postId).not.toBeNull()

    const queued = await t.mutation(
      internal.jobs.syncPosts.upsertPost,
      upsertArgs(authorId, 'urn:li:activity:weekly-2', true)
    )
    expect(queued).toEqual({ postId: null, created: false })

    const refused = t.mutation(internal.jobs.syncPosts.upsertPost, upsertArgs(authorId, 'urn:li:activity:weekly-3'))
    await expect(refused).rejects.toThrow(/WEEKLY_LIMIT:1/)

    const counts = await t.run(async ctx => ({
      posts: (await ctx.db.query('posts').collect()).length,
      queued: (await ctx.db.query('postQueue').collect()).length,
      recent: (
        await ctx.db
          .query('posts')
          .withIndex('by_author_and_publishedAt', q =>
            q.eq('authorId', authorId).gte('publishedAt', Date.now() - WEEK_MS)
          )
          .collect()
      ).length
    }))
    expect(counts).toEqual({ posts: 1, queued: 1, recent: 1 })
  })

  test('reaction dedupe: a repeat tap is a no-op (one count, one interaction row)', async () => {
    const t = convexTest(schema, modules)
    const authorId = await insertUser(t, { linkedinId: 'li-reaction-author', name: 'Author' })
    const actorId = await insertUser(t, { linkedinId: 'li-reaction-actor', name: 'Actor' })
    const postId = await insertPost(t, authorId, { likeCount: 0 })

    const first = await t.mutation(internal.interactions.incrementLikeCount, { postId, actorId, reaction: 'LIKE' })
    const second = await t.mutation(internal.interactions.incrementLikeCount, { postId, actorId, reaction: 'LIKE' })
    expect(first).toEqual({ counted: true })
    expect(second).toEqual({ counted: false })

    const observed = await t.run(async ctx => {
      const post = await ctx.db.get(postId)
      const interactions = await ctx.db
        .query('userInteractions')
        .withIndex('by_post', q => q.eq('postId', postId))
        .collect()
      const state = await ctx.db
        .query('userPostState')
        .withIndex('by_user_and_post', q => q.eq('userId', actorId).eq('postId', postId))
        .unique()
      return { likeCount: post?.likeCount, interactions: interactions.length, reacted: state?.reactedAt !== undefined }
    })
    expect(observed).toEqual({ likeCount: 1, interactions: 1, reacted: true })
  })

  test('auth negative: bogus token refused; a real token cannot modify another author’s post', async () => {
    const t = convexTest(schema, modules)
    const otherAuthorId = await insertUser(t, { linkedinId: 'li-other-author', name: 'Other Author' })
    const callerId = await insertUser(t, { linkedinId: 'li-caller', name: 'Caller' })
    const postId = await insertPost(t, otherAuthorId)
    const callerToken = 'integration-valid-token'
    await t.run(async ctx =>
      ctx.db.insert('sessions', { token: callerToken, userId: callerId, expiresAt: Date.now() + 60_000 })
    )

    await expect(
      t.mutation(api.posts.setPostHidden, { sessionToken: 'bogus-token', postId, hidden: true })
    ).rejects.toThrow('Unauthorized')

    await expect(
      t.mutation(api.posts.setPostHidden, { sessionToken: callerToken, postId, hidden: true })
    ).rejects.toThrow(/Forbidden/)
  })

  test('validator enforcement: missing and extra args are rejected before the handler runs', async () => {
    const t = convexTest(schema, modules)
    const authorId = await insertUser(t, { linkedinId: 'li-validator', name: 'Validator Author' })
    const postId = await insertPost(t, authorId)

    const call = t.mutation as unknown as (fn: typeof api.posts.setPostHidden, args: unknown) => Promise<unknown>

    await expect(call(api.posts.setPostHidden, { sessionToken: 'x', postId })).rejects.toThrow(/hidden/)
    await expect(call(api.posts.setPostHidden, { sessionToken: 'x', postId, hidden: true, extra: 1 })).rejects.toThrow()
  })
})
