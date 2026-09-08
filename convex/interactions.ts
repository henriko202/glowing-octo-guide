// convex/interactions.ts
import { action, internalMutation, internalQuery, mutation, query } from './_generated/server'
import type { MutationCtx } from './_generated/server'
import { ConvexError, v } from 'convex/values'
import { paginationOptsValidator } from 'convex/server'
import { internal } from './_generated/api'
import type { Doc, Id } from './_generated/dataModel'
import { requireAuth, requireAuthAction } from './lib/auth'
import { assertCanEngage } from './lib/access'
import { assertPostEngageable } from './feed'
import { getPlanLimitsHelper, nextTier } from './lib/planLimits'
import { computeFeedFields } from './lib/feedRank'
import { shouldFlipInteractionLimit } from './lib/interactionLimit'
import { canHide } from './lib/feedHygiene'
import {
  crossesThreshold,
  pickTrialingSubscription,
  shouldEndTrialEarly,
  TRIAL_WARNING_THRESHOLD
} from './lib/trialMilestone'
import { reactionValidator } from './lib/reactions'
import { toHistoryRow, type HistoryRow } from './lib/history'
import {
  countInteractions,
  excerpt,
  excludeSelf,
  pickNearCapPost,
  RECAP_POST_CEILING,
  RECAP_ROW_CEILING,
  windowBounds
} from './lib/recap'

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

  // 80% of the way: one heads-up before the plan starts, never an alarm. crossesThreshold's
  // semantics guarantee it fires exactly once per member.
  if (crossesThreshold(combined, 1, TRIAL_WARNING_THRESHOLD)) {
    await ctx.scheduler.runAfter(0, internal.notifications.sendTrialNearEnd, { userId })
  }

  if (crossesThreshold(combined, 1)) {
    // NOT .first(): by_user is ordered by _creationTime, so .first() is the OLDEST row — after a
    // cancel + re-subscribe that is the canceled subscription, and ending its trial does nothing.
    const rows = await ctx.db
      .query('subscriptions')
      .withIndex('by_user', q => q.eq('userId', userId))
      .collect()
    const sub = pickTrialingSubscription(rows)
    if (shouldEndTrialEarly(sub)) {
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

// Load a post for engagement (comment / react / AI draft) and enforce the SAME gate the feed and
// search apply — so a direct get() by id can't reach a post the viewer could never see or act on.
// Throws ConvexError when the post isn't engageable by this viewer; returns the post otherwise.
export const getEngageablePost = internalQuery({
  args: { postId: v.id('posts'), viewerId: v.id('users') },
  handler: async (ctx, { postId, viewerId }) => {
    const post = await ctx.db.get(postId)
    if (!post) throw new ConvexError('Post not found')
    const viewer = await ctx.db.get(viewerId)
    if (!viewer) throw new ConvexError('Post not found')
    const author = await ctx.db.get(post.authorId)
    assertPostEngageable(post, viewer, author, Date.now())
    return post
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

/**
 * Flip `interactionLimitReached` the moment a post reaches its plan cap, recompute the feed fields
 * (the post leaves the feed) and — once per post — tell the author by email (backlog/R20). The
 * email is scheduled only from inside the flip, and both callers bail earlier when the post is
 * already capped, so a second email for the same post cannot happen.
 */
async function flipCapIfReached(
  ctx: MutationCtx,
  post: Doc<'posts'>,
  likeCount: number,
  commentCount: number
): Promise<void> {
  const author = await ctx.db.get(post.authorId)
  if (!author) return
  const limits = await getPlanLimitsHelper(ctx, author._id, author.tier ?? 'starter')
  // The callers already returned when the post was capped, so it's provably not-yet-reached here.
  if (!shouldFlipInteractionLimit(likeCount, commentCount, limits.interactionsPerPost, false)) return
  // Hitting the interaction limit removes the post from the feed — refresh feed fields.
  const feed = computeFeedFields({
    isFeatured: post.isFeatured,
    publishedAt: post.publishedAt,
    authorTierRank: post.authorTierRank,
    hidden: post.hidden,
    interactionLimitReached: true,
    deletedAt: post.deletedAt
  })
  await ctx.db.patch(post._id, { interactionLimitReached: true, ...feed })
  await ctx.scheduler.runAfter(0, internal.notifications.sendPostCapReached, { postId: post._id })
}

// Internal mutation to increment comment count
export const incrementCommentCount = internalMutation({
  args: { postId: v.id('posts'), actorId: v.id('users'), comment: v.string() },
  handler: async (ctx, { postId, actorId, comment }) => {
    const post = await ctx.db.get(postId)
    if (!post) return
    // Already at the cap — never overshoot. Under concurrent engagement, OCC retries this mutation
    // against the now-flagged post, and this guard turns that retry into a no-op (mirrors
    // featurePost's `if (post.isFeatured) return`). getEngageablePost gates the happy path; this
    // closes the race window.
    if (post.interactionLimitReached) return
    const now = Date.now()
    const newCommentCount = post.commentCount + 1
    await ctx.db.patch(postId, { commentCount: newCommentCount })

    // Same transaction as the counter: the log is the source for recap/history (backlog/R15).
    await ctx.db.insert('userInteractions', {
      userId: actorId,
      postId,
      authorId: post.authorId,
      kind: 'comment',
      comment,
      createdAt: now
    })

    // backlog/R21 — the per-viewer state that starts the 24 h "done" window. Upsert like
    // saveCommentDraft: the row may already hold a draft or a reaction.
    const state = await ctx.db
      .query('userPostState')
      .withIndex('by_user_and_post', q => q.eq('userId', actorId).eq('postId', postId))
      .unique()
    if (state) await ctx.db.patch(state._id, { commentedAt: now })
    else await ctx.db.insert('userPostState', { userId: actorId, postId, commentedAt: now })

    await bumpTrialInteraction(ctx, actorId, 'made')
    if (post.authorId !== actorId) await bumpTrialInteraction(ctx, post.authorId, 'received')

    // Check if combined interactions have reached the author's limit
    await flipCapIfReached(ctx, post, post.likeCount, newCommentCount)
  }
})

// Internal mutation to increment like count. Deduped: at most one reaction per user per post — a
// repeat tap is a no-op (a LinkedIn member can only hold one reaction on a post, so we must not
// double-count or double-bill). The dedup lives here: the engagement-log row below is written only on
// a first tap. `counted` is returned for callers that want to distinguish a repeat tap.
export const incrementLikeCount = internalMutation({
  args: { postId: v.id('posts'), actorId: v.id('users'), reaction: reactionValidator },
  handler: async (ctx, { postId, actorId, reaction }): Promise<{ counted: boolean }> => {
    const state = await ctx.db
      .query('userPostState')
      .withIndex('by_user_and_post', q => q.eq('userId', actorId).eq('postId', postId))
      .unique()
    if (state?.reactedAt) return { counted: false } // already reacted — don't double point

    const post = await ctx.db.get(postId)
    if (!post) return { counted: false }
    // Already at the cap — never overshoot (see incrementCommentCount). Bail before writing
    // reactedAt so a capped post never records a reaction that wasn't counted.
    if (post.interactionLimitReached) return { counted: false }

    const now = Date.now()
    if (state) await ctx.db.patch(state._id, { reactedAt: now })
    else await ctx.db.insert('userPostState', { userId: actorId, postId, reactedAt: now })

    const newLikeCount = post.likeCount + 1
    await ctx.db.patch(postId, { likeCount: newLikeCount })

    await ctx.db.insert('userInteractions', {
      userId: actorId,
      postId,
      authorId: post.authorId,
      kind: 'reaction',
      reaction,
      createdAt: now
    })

    await bumpTrialInteraction(ctx, actorId, 'made')
    if (post.authorId !== actorId) await bumpTrialInteraction(ctx, post.authorId, 'received')

    // Check if combined interactions have reached the author's limit
    await flipCapIfReached(ctx, post, newLikeCount, post.commentCount)
    return { counted: true }
  }
})

/**
 * backlog/R21 — "Hide now": the post leaves the viewer's feed at once instead of after 24 h.
 * Only for a post the viewer already reacted to or commented on (there is no hide for untouched
 * posts, and no unhide — /history keeps the record). Idempotent: a second call changes nothing.
 */
export const hidePost = mutation({
  args: { sessionToken: v.string(), postId: v.id('posts') },
  handler: async (ctx, { sessionToken, postId }) => {
    const user = await requireAuth(ctx, sessionToken)
    const state = await ctx.db
      .query('userPostState')
      .withIndex('by_user_and_post', q => q.eq('userId', user._id).eq('postId', postId))
      .unique()
    if (!state || !canHide(state)) throw new ConvexError('NOT_INTERACTED')
    if (state.hiddenAt === undefined) await ctx.db.patch(state._id, { hiddenAt: Date.now() })
    return null
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

    // Enforce the shared engagement gate (hidden / soft-deleted / at cap / not visible to this
    // viewer) — the same rule the feed, search and AI-draft paths use, so none can diverge.
    await ctx.runQuery(internal.interactions.getEngageablePost, { postId, viewerId: user._id })

    await ctx.runMutation(internal.interactions.incrementCommentCount, {
      postId,
      actorId: user._id,
      comment: commentText
    })
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

    // Enforce the shared engagement gate (hidden / soft-deleted / at cap / not visible to this
    // viewer) — the same rule the feed, search and AI-draft paths use, so none can diverge.
    await ctx.runQuery(internal.interactions.getEngageablePost, { postId, viewerId: user._id })

    const { counted }: { counted: boolean } = await ctx.runMutation(internal.interactions.incrementLikeCount, {
      postId,
      actorId: user._id,
      reaction: reactionType
    })
    return { success: true, counted }
  }
})

// ── Recap (backlog/R15) ────────────────────────────────────────────────────────────────────────
// `now` comes from the client floored to the hour so args are stable across renders. The current
// window is [since, +∞) so interactions inside the partial hour count immediately; the previous
// window is [prevSince, since). Reads are newest-first with a hard ceiling, so truncation drops the
// oldest rows first and `truncated` tells the page.
export const getRecap = query({
  args: {
    sessionToken: v.string(),
    window: v.union(v.literal('7d'), v.literal('30d')),
    now: v.number()
  },
  handler: async (ctx, { sessionToken, window, now }) => {
    const user = await requireAuth(ctx, sessionToken)
    const { since, prevSince, until } = windowBounds(window, now)

    const made = await ctx.db
      .query('userInteractions')
      .withIndex('by_user', q => q.eq('userId', user._id).gte('_creationTime', prevSince))
      .order('desc')
      .take(RECAP_ROW_CEILING)
    const receivedRaw = await ctx.db
      .query('userInteractions')
      .withIndex('by_author', q => q.eq('authorId', user._id).gte('_creationTime', prevSince))
      .order('desc')
      .take(RECAP_ROW_CEILING)
    const received = excludeSelf(receivedRaw)

    const tier = user.tier ?? 'starter'
    const limits = await getPlanLimitsHelper(ctx, user._id, tier)

    const recent = await ctx.db
      .query('posts')
      .withIndex('by_author', q => q.eq('authorId', user._id).gte('_creationTime', since))
      .order('desc')
      .take(RECAP_POST_CEILING)
    const posts = recent.filter(p => p.deletedAt === undefined && !p.hidden)
    const near = pickNearCapPost(posts, limits.interactionsPerPost)

    const OPEN_END = Number.POSITIVE_INFINITY
    return {
      window,
      since,
      until,
      made: {
        current: countInteractions(made, since, OPEN_END),
        previous: countInteractions(made, prevSince, since)
      },
      received: {
        current: countInteractions(received, since, OPEN_END),
        previous: countInteractions(received, prevSince, since)
      },
      truncated: made.length >= RECAP_ROW_CEILING || receivedRaw.length >= RECAP_ROW_CEILING,
      plan: { tier, ...limits, nextTier: nextTier(tier) },
      posts: posts.map(p => ({
        id: p._id,
        linkedinPostUrn: p.linkedinPostUrn,
        sourceUrl: p.sourceUrl,
        excerpt: excerpt(p.content),
        likeCount: p.likeCount,
        commentCount: p.commentCount,
        isFeatured: p.isFeatured,
        interactionLimitReached: p.interactionLimitReached === true
      })),
      nearCapPost: near
        ? { id: near._id, excerpt: excerpt(near.content), total: near.likeCount + near.commentCount }
        : null
    }
  }
})

// ── History (backlog/R16) ──────────────────────────────────────────────────────────────────────
// `since` = 0 means all time. Newest first; 20 per page from the client.
export const listMyInteractions = query({
  args: { sessionToken: v.string(), since: v.number(), paginationOpts: paginationOptsValidator },
  handler: async (ctx, { sessionToken, since, paginationOpts }) => {
    const user = await requireAuth(ctx, sessionToken)
    const result = await ctx.db
      .query('userInteractions')
      .withIndex('by_user', q => q.eq('userId', user._id).gte('_creationTime', since))
      .order('desc')
      .paginate(paginationOpts)
    const page: HistoryRow[] = await Promise.all(
      result.page.map(async row => {
        const post = await ctx.db.get(row.postId)
        const author = post ? await ctx.db.get(post.authorId) : null
        return toHistoryRow(row, post, author)
      })
    )
    return { ...result, page }
  }
})
