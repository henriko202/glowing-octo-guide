// convex/interactions.ts
import {
  actionGeneric as action,
  internalMutationGeneric as internalMutation,
  internalQueryGeneric as internalQuery
} from 'convex/server'
import { makeFunctionReference } from 'convex/server'
import { v } from 'convex/values'
import type { MutationCtx, QueryCtx, ActionCtx, UserDoc, PostDoc } from './convexTypes.js'

const getUserWithTokens = makeFunctionReference<'query'>('users:getWithTokens')

// Internal query to get a post by ID
export const getPost = internalQuery({
  args: { postId: v.id('posts') },
  handler: async (ctx, { postId }: { postId: string }) => {
    const db = (ctx as unknown as QueryCtx).db
    return db.get(postId)
  }
})

// Internal mutation to increment comment count
export const incrementCommentCount = internalMutation({
  args: { postId: v.id('posts') },
  handler: async (ctx, { postId }: { postId: string }) => {
    const db = (ctx as unknown as MutationCtx).db
    const post = (await db.get(postId)) as PostDoc | null
    if (post) await db.patch(postId, { commentCount: post.commentCount + 1 })
  }
})

// Internal mutation to increment like count
export const incrementLikeCount = internalMutation({
  args: { postId: v.id('posts') },
  handler: async (ctx, { postId }: { postId: string }) => {
    const db = (ctx as unknown as MutationCtx).db
    const post = (await db.get(postId)) as PostDoc | null
    if (post) await db.patch(postId, { likeCount: post.likeCount + 1 })
  }
})

// Public action: post a comment on a LinkedIn post using the current user's token
export const commentOnPost = action({
  args: {
    postId: v.id('posts'),
    commentText: v.string()
  },
  handler: async (ctx, { postId, commentText }: { postId: string; commentText: string }) => {
    const actionCtx = ctx as unknown as ActionCtx
    const identity = await actionCtx.auth.getUserIdentity()
    if (!identity) throw new Error('Not authenticated')

    const user = await actionCtx.runQuery<UserDoc | null>(getUserWithTokens, { userId: identity.subject })
    if (!user?.linkedinAccessToken) throw new Error('No LinkedIn token')

    const getPostFn = makeFunctionReference<'query'>('interactions:getPost')
    const post = await actionCtx.runQuery<PostDoc | null>(getPostFn, { postId })
    if (!post) throw new Error('Post not found')

    const res = await fetch(
      `https://api.linkedin.com/v2/socialActions/${encodeURIComponent(post.linkedinPostUrn as string)}/comments`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${user.linkedinAccessToken}`,
          'Content-Type': 'application/json',
          'X-Restli-Protocol-Version': '2.0.0'
        },
        body: JSON.stringify({
          actor: `urn:li:person:${user.linkedinId}`,
          message: { text: commentText }
        })
      }
    )
    if (!res.ok) {
      const err = await res.text()
      throw new Error(`LinkedIn comment failed: ${res.status} ${err}`)
    }

    const incrementFn = makeFunctionReference<'mutation'>('interactions:incrementCommentCount')
    await actionCtx.runMutation(incrementFn, { postId })
    return { success: true }
  }
})

// Public action: react to a LinkedIn post using the current user's token
export const reactToPost = action({
  args: {
    postId: v.id('posts'),
    reactionType: v.union(
      v.literal('LIKE'),
      v.literal('CELEBRATE'),
      v.literal('SUPPORT'),
      v.literal('FUNNY'),
      v.literal('LOVE'),
      v.literal('INSIGHTFUL')
    )
  },
  handler: async (ctx, { postId, reactionType }: { postId: string; reactionType: string }) => {
    const actionCtx = ctx as unknown as ActionCtx
    const identity = await actionCtx.auth.getUserIdentity()
    if (!identity) throw new Error('Not authenticated')

    const user = await actionCtx.runQuery<UserDoc | null>(getUserWithTokens, { userId: identity.subject })
    if (!user?.linkedinAccessToken) throw new Error('No LinkedIn token')

    const getPostFn = makeFunctionReference<'query'>('interactions:getPost')
    const post = await actionCtx.runQuery<PostDoc | null>(getPostFn, { postId })
    if (!post) throw new Error('Post not found')

    const res = await fetch(
      `https://api.linkedin.com/v2/reactions/${encodeURIComponent(post.linkedinPostUrn as string)}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${user.linkedinAccessToken}`,
          'Content-Type': 'application/json',
          'X-Restli-Protocol-Version': '2.0.0'
        },
        body: JSON.stringify({
          actor: `urn:li:person:${user.linkedinId}`,
          reactionType
        })
      }
    )
    if (!res.ok) {
      const err = await res.text()
      throw new Error(`LinkedIn reaction failed: ${res.status} ${err}`)
    }

    const incrementFn = makeFunctionReference<'mutation'>('interactions:incrementLikeCount')
    await actionCtx.runMutation(incrementFn, { postId })
    return { success: true }
  }
})
