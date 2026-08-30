// convex/interactions.ts
import { action, internalMutation, internalQuery, query } from './_generated/server'
import type { MutationCtx } from './_generated/server'
import { ConvexError, v } from 'convex/values'
import { internal } from './_generated/api'
import type { Doc, Id } from './_generated/dataModel'
import { requireAuth, requireAuthAction } from './lib/auth'
import { assertCanEngage } from './lib/access'
import { getPlanLimitsHelper } from './lib/planLimits'
import { computeFeedFields } from './lib/feedRank'
import { shouldFlipInteractionLimit } from './lib/interactionLimit'
import { crossesThreshold } from './lib/trialMilestone'
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

// Load the user's saved AI comment draft for a post — shown in the comment box so they can reuse it
// or regenerate. Null when they haven't generated one for this post yet.
export const getCommentDraft = query({
  args: { sessionToken: v.string(), postId: v.id('posts') },
  handler: async (ctx, { sessionToken, postId }) => {
    const user = await requireAuth(ctx, sessionToken)
    const state = await ctx.db
      .query('userPostState')
      .withIndex('by_user_and_post', q => q.eq('userId', user._id).eq('postId', postId))
      .unique()
    return state?.commentDraft ?? null
  }
})

// Persist the last AI-generated comment for (user, post) onto userPostState so the comment box can
// reload it. Upsert: patch the existing row or create one.
export const saveCommentDraft = internalMutation({
  args: { userId: v.id('users'), postId: v.id('posts'), draft: v.string() },
  handler: async (ctx, { userId, postId, draft }) => {
    const state = await ctx.db
      .query('userPostState')
      .withIndex('by_user_and_post', q => q.eq('userId', userId).eq('postId', postId))
      .unique()
    if (state) await ctx.db.patch(state._id, { commentDraft: draft })
    else await ctx.db.insert('userPostState', { userId, postId, commentDraft: draft })
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

// Internal mutation to increment like count. Deduped: at most one reaction per user per post — a
// repeat tap is a no-op (a LinkedIn member can only hold one reaction on a post, so we must not
// double-count or double-bill). Returns { counted } so the caller skips the engagement log on a repeat.
export const incrementLikeCount = internalMutation({
  args: { postId: v.id('posts'), actorId: v.id('users') },
  handler: async (ctx, { postId, actorId }): Promise<{ counted: boolean }> => {
    const state = await ctx.db
      .query('userPostState')
      .withIndex('by_user_and_post', q => q.eq('userId', actorId).eq('postId', postId))
      .unique()
    if (state?.reactedAt) return { counted: false } // already reacted — don't double point

    const post = await ctx.db.get(postId)
    if (!post) return { counted: false }

    const now = Date.now()
    if (state) await ctx.db.patch(state._id, { reactedAt: now })
    else await ctx.db.insert('userPostState', { userId: actorId, postId, reactedAt: now })

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
    return { counted: true }
  }
})

// Public action: record an in-app comment engagement + count it. The comment itself is posted by
// the user on LinkedIn — the client opens the post and copies the AI draft to the clipboard —
// because LinkedIn exposes no member API for commenting on another member's post. We therefore
// count optimistically on tap rather than confirming the LinkedIn action. See docs/PLATFORM.md §11.
export const commentOnPost = action({
  args: {
    postId: v.id('posts'),
    commentText: v.string(),
    sessionToken: v.string()
  },
  handler: async (ctx, { postId, commentText, sessionToken }) => {
    if (commentText.length > 3000) {
      throw new ConvexError('Comment text exceeds maximum length of 3000 characters')
    }

    const user = (await requireAuthAction(ctx, sessionToken)) as Doc<'users'>
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
    if (!post) throw new ConvexError('Post not found')
    if (post.hidden) throw new ConvexError('This post is not available.')
    if (post.interactionLimitReached) throw new ConvexError('This post has reached its interaction limit.')

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

// Public action: record an in-app reaction engagement + count it. The reaction itself happens on
// LinkedIn — the client opens the post so the user reacts there — because LinkedIn exposes no
// member API for reacting to another member's post. Counted optimistically on tap. See §11.
export const reactToPost = action({
  args: {
    postId: v.id('posts'),
    reactionType: reactionValidator,
    sessionToken: v.string()
  },
  handler: async (ctx, { postId, reactionType, sessionToken }): Promise<{ success: boolean; counted: boolean }> => {
    const user = (await requireAuthAction(ctx, sessionToken)) as Doc<'users'>
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
    if (!post) throw new ConvexError('Post not found')
    if (post.hidden) throw new ConvexError('This post is not available.')
    if (post.interactionLimitReached) throw new ConvexError('This post has reached its interaction limit.')

    const { counted }: { counted: boolean } = await ctx.runMutation(internal.interactions.incrementLikeCount, {
      postId,
      actorId: user._id
    })
    // Skip the engagement log on a repeat reaction (already counted — see incrementLikeCount dedup).
    if (counted) {
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
    }
    return { success: true, counted }
  }
})
