// convex/interactions.ts
import { action, internalMutation, internalQuery } from './_generated/server'
import type { MutationCtx } from './_generated/server'
import { v } from 'convex/values'
import { internal } from './_generated/api'
import type { Doc, Id } from './_generated/dataModel'
import { requireAuthAction } from './lib/auth'
import { assertCanEngage } from './lib/access'
import { getPlanLimitsHelper } from './lib/planLimits'
import { computeFeedFields } from './lib/feedRank'
import { shouldFlipInteractionLimit } from './lib/interactionLimit'
import { crossesThreshold } from './lib/trialMilestone'
import { callMemberApi } from './linkedin/client'
import { reactionValidator } from './lib/reactions'

// Bump one side of a trialing user's interaction counter; when their combined count first
// reaches the threshold, schedule the early end of their Stripe trial (billing starts now).
async function bumpTrialInteraction(ctx: MutationCtx, userId: Id<'users'>, kind: 'made' | 'received'): Promise<void> {
  const u = await ctx.db.get(userId)
  if (!u || u.subscriptionStatus !== 'trialing') return
  const made = u.trialInteractionsMade ?? 0
  const received = u.trialInteractionsReceived ?? 0
  const combined = made + received
  if (kind === 'made') await ctx.db.patch(userId, { trialInteractionsMade: made + 1 })
  else await ctx.db.patch(userId, { trialInteractionsReceived: received + 1 })

  if (crossesThreshold(combined, 1)) {
    const sub = await ctx.db
      .query('subscriptions')
      .withIndex('by_user', q => q.eq('userId', userId))
      .first()
    if (sub?.stripeSubscriptionId) {
      await ctx.scheduler.runAfter(0, internal.billingNode.endTrialEarly, {
        stripeSubscriptionId: sub.stripeSubscriptionId
      })
    }
  }
}

// Internal query to get a post by ID
export const getPost = internalQuery({
  args: { postId: v.id('posts') },
  handler: async (ctx, { postId }) => {
    return ctx.db.get(postId)
  }
})

// Append a per-user engagement record (one reaction or comment) to `userInteractions`. Feeds the
// DSR export + a future admin dashboard. Callers wrap this best-effort so a logging failure never
// fails the user's already-completed LinkedIn action.
export const recordInteraction = internalMutation({
  args: {
    userId: v.id('users'),
    postId: v.id('posts'),
    kind: v.union(v.literal('reaction'), v.literal('comment')),
    reaction: v.optional(reactionValidator),
    comment: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    await ctx.db.insert('userInteractions', { ...args, createdAt: Date.now() })
  }
})

// Internal mutation to increment comment count
export const incrementCommentCount = internalMutation({
  args: { postId: v.id('posts'), actorId: v.id('users') },
  handler: async (ctx, { postId, actorId }) => {
    const post = await ctx.db.get(postId)
    if (!post) return
    const newCommentCount = post.commentCount + 1
    await ctx.db.patch(postId, { commentCount: newCommentCount })

    await bumpTrialInteraction(ctx, actorId, 'made')
    if (post.authorId !== actorId) await bumpTrialInteraction(ctx, post.authorId, 'received')

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
  args: { postId: v.id('posts'), actorId: v.id('users') },
  handler: async (ctx, { postId, actorId }) => {
    const post = await ctx.db.get(postId)
    if (!post) return
    const newLikeCount = post.likeCount + 1
    await ctx.db.patch(postId, { likeCount: newLikeCount })

    await bumpTrialInteraction(ctx, actorId, 'made')
    if (post.authorId !== actorId) await bumpTrialInteraction(ctx, post.authorId, 'received')

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
    assertCanEngage(user)

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

    await ctx.runMutation(internal.interactions.incrementCommentCount, { postId, actorId: user._id })
    try {
      await ctx.runMutation(internal.interactions.recordInteraction, {
        userId: user._id,
        postId,
        kind: 'comment',
        comment: commentText
      })
    } catch (e) {
      console.error('recordInteraction (comment) failed:', e)
    }
    return { success: true }
  }
})

// Public action: react to a LinkedIn post using the current user's token
export const reactToPost = action({
  args: {
    postId: v.id('posts'),
    reactionType: reactionValidator,
    sessionToken: v.string()
  },
  handler: async (ctx, { postId, reactionType, sessionToken }) => {
    const user = (await requireAuthAction(ctx, sessionToken)) as Doc<'users'>
    if (!user?.linkedinAccessToken) throw new Error('No LinkedIn token')
    assertCanEngage(user)

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

    await ctx.runMutation(internal.interactions.incrementLikeCount, { postId, actorId: user._id })
    try {
      await ctx.runMutation(internal.interactions.recordInteraction, {
        userId: user._id,
        postId,
        kind: 'reaction',
        reaction: reactionType
      })
    } catch (e) {
      console.error('recordInteraction (reaction) failed:', e)
    }
    return { success: true }
  }
})
