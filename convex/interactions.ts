// convex/interactions.ts
import { action, internalMutation, internalQuery } from './_generated/server'
import { v } from 'convex/values'
import { internal } from './_generated/api'
import type { Doc } from './_generated/dataModel'
import { requireAuthAction } from './lib/auth'
import { getPlanLimitsHelper } from './lib/planLimits'
import { computeFeedFields } from './lib/feedRank'
import { shouldFlipInteractionLimit } from './lib/interactionLimit'
import { callMemberApi } from './linkedin/client'

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
    const author = await ctx.db.get(post.authorId)
    if (author) {
      const limits = await getPlanLimitsHelper(ctx, author._id, author.tier ?? 'starter')
      if (
        shouldFlipInteractionLimit(
          post.likeCount,
          newCommentCount,
          limits.interactionsPerPost,
          post.interactionLimitReached === true
        )
      ) {
        // Hitting the interaction limit removes the post from the feed — refresh feed fields.
        const feed = computeFeedFields({
          isFeatured: post.isFeatured,
          publishedAt: post.publishedAt,
          authorTierRank: post.authorTierRank,
          hidden: post.hidden,
          interactionLimitReached: true,
          deletedAt: post.deletedAt
        })
        await ctx.db.patch(postId, { interactionLimitReached: true, ...feed })
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
    const author = await ctx.db.get(post.authorId)
    if (author) {
      const limits = await getPlanLimitsHelper(ctx, author._id, author.tier ?? 'starter')
      if (
        shouldFlipInteractionLimit(
          newLikeCount,
          post.commentCount,
          limits.interactionsPerPost,
          post.interactionLimitReached === true
        )
      ) {
        // Hitting the interaction limit removes the post from the feed — refresh feed fields.
        const feed = computeFeedFields({
          isFeatured: post.isFeatured,
          publishedAt: post.publishedAt,
          authorTierRank: post.authorTierRank,
          hidden: post.hidden,
          interactionLimitReached: true,
          deletedAt: post.deletedAt
        })
        await ctx.db.patch(postId, { interactionLimitReached: true, ...feed })
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

    // Rate limit: 20 comments/hour (admins are exempt)
    if (!user.isAdmin) {
      await ctx.runMutation(internal.lib.rateLimit.checkAndIncrement, {
        userId: user._id,
        action: 'commentOnPost',
        maxPerHour: 20
      })
    }

    const post = await ctx.runQuery(internal.interactions.getPost, { postId })
    if (!post) throw new Error('Post not found')
    if (post.hidden) throw new Error('This post is not available.')
    if (post.interactionLimitReached) throw new Error('This post has reached its interaction limit.')

    await callMemberApi(
      user.linkedinAccessToken,
      {
        method: 'POST',
        path: `/v2/socialActions/${encodeURIComponent(post.linkedinPostUrn)}/comments`,
        body: { actor: `urn:li:person:${user.linkedinId}`, message: { text: commentText } },
        headers: { 'X-Restli-Protocol-Version': '2.0.0' }
      },
      { action: 'post comment' }
    )

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

    // Rate limit: 30 reactions/hour (admins are exempt)
    if (!user.isAdmin) {
      await ctx.runMutation(internal.lib.rateLimit.checkAndIncrement, {
        userId: user._id,
        action: 'reactToPost',
        maxPerHour: 30
      })
    }

    const post = await ctx.runQuery(internal.interactions.getPost, { postId })
    if (!post) throw new Error('Post not found')
    if (post.hidden) throw new Error('This post is not available.')
    if (post.interactionLimitReached) throw new Error('This post has reached its interaction limit.')

    await callMemberApi(
      user.linkedinAccessToken,
      {
        method: 'POST',
        path: `/rest/reactions?actor=${encodeURIComponent(`urn:li:person:${user.linkedinId}`)}`,
        body: { root: post.linkedinPostUrn, reactionType },
        headers: { 'X-Restli-Protocol-Version': '2.0.0', 'Linkedin-Version': '202603' }
      },
      { action: 'post reaction' }
    )

    await ctx.runMutation(internal.interactions.incrementLikeCount, { postId })
    return { success: true }
  }
})
