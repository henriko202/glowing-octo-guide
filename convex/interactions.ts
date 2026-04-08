// convex/interactions.ts
import { action, internalMutation, internalQuery } from './_generated/server'
import { v } from 'convex/values'
import { internal } from './_generated/api'
import type { Doc } from './_generated/dataModel'
import { requireAuthAction } from './lib/auth'
import { getPlanLimitsHelper } from './lib/planLimits'

// Internal query to get a post by ID
export const getPost = internalQuery({
  args: { postId: v.id('posts') },
  handler: async (ctx, { postId }) => {
    return ctx.db.get(postId)
  }
})

// Internal mutation to increment comment count
export const incrementCommentCount = internalMutation({
  args: { postId: v.id('posts') },
  handler: async (ctx, { postId }) => {
    const post = await ctx.db.get(postId)
    if (!post) return
    const newCommentCount = post.commentCount + 1
    await ctx.db.patch(postId, { commentCount: newCommentCount })

    // Check if combined interactions have reached the author's limit
    const total = newCommentCount + post.likeCount
    const author = await ctx.db.get(post.authorId)
    if (author) {
      const limits = await getPlanLimitsHelper(ctx, author._id, author.tier ?? 'starter')
      if (total >= limits.interactionsPerPost && !post.interactionLimitReached) {
        await ctx.db.patch(postId, { interactionLimitReached: true })
      }
    }
  }
})

// Internal mutation to increment like count
export const incrementLikeCount = internalMutation({
  args: { postId: v.id('posts') },
  handler: async (ctx, { postId }) => {
    const post = await ctx.db.get(postId)
    if (!post) return
    const newLikeCount = post.likeCount + 1
    await ctx.db.patch(postId, { likeCount: newLikeCount })

    // Check if combined interactions have reached the author's limit
    const total = post.commentCount + newLikeCount
    const author = await ctx.db.get(post.authorId)
    if (author) {
      const limits = await getPlanLimitsHelper(ctx, author._id, author.tier ?? 'starter')
      if (total >= limits.interactionsPerPost && !post.interactionLimitReached) {
        await ctx.db.patch(postId, { interactionLimitReached: true })
      }
    }
  }
})

// Public action: post a comment on a LinkedIn post using the current user's token
export const commentOnPost = action({
  args: {
    postId: v.id('posts'),
    commentText: v.string(),
    sessionToken: v.string()
  },
  handler: async (ctx, { postId, commentText, sessionToken }) => {
    if (commentText.length > 3000) {
      throw new Error('Comment text exceeds maximum length of 3000 characters')
    }

    const user = (await requireAuthAction(ctx, sessionToken)) as Doc<'users'>
    if (!user?.linkedinAccessToken) throw new Error('No LinkedIn token')

    // Rate limit: TODO — set the max comments per hour appropriate for your use case
    // e.g. 20/hr to prevent spam while allowing active engagement
    await ctx.runMutation(internal.lib.rateLimit.checkAndIncrement, {
      userId: user._id,
      action: 'commentOnPost',
      maxPerHour: 20
    })

    const post = await ctx.runQuery(internal.interactions.getPost, { postId })
    if (!post) throw new Error('Post not found')

    const res = await fetch(
      `https://api.linkedin.com/v2/socialActions/${encodeURIComponent(post.linkedinPostUrn)}/comments`,
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
      console.error(`LinkedIn comment failed: ${res.status}`, err)
      throw new Error('Failed to post comment. Please try again.')
    }

    await ctx.runMutation(internal.interactions.incrementCommentCount, { postId })
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
    ),
    sessionToken: v.string()
  },
  handler: async (ctx, { postId, reactionType, sessionToken }) => {
    const user = (await requireAuthAction(ctx, sessionToken)) as Doc<'users'>
    if (!user?.linkedinAccessToken) throw new Error('No LinkedIn token')

    // Rate limit: TODO — set the max reactions per hour appropriate for your use case
    // e.g. 30/hr to allow active engagement without overwhelming LinkedIn API
    await ctx.runMutation(internal.lib.rateLimit.checkAndIncrement, {
      userId: user._id,
      action: 'reactToPost',
      maxPerHour: 30
    })

    const post = await ctx.runQuery(internal.interactions.getPost, { postId })
    if (!post) throw new Error('Post not found')

    const res = await fetch(`https://api.linkedin.com/v2/reactions/${encodeURIComponent(post.linkedinPostUrn)}`, {
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
    })
    if (!res.ok) {
      const err = await res.text()
      console.error(`LinkedIn reaction failed: ${res.status}`, err)
      throw new Error('Failed to post reaction. Please try again.')
    }

    await ctx.runMutation(internal.interactions.incrementLikeCount, { postId })
    return { success: true }
  }
})
