// convex/posts.ts
import { action, internalQuery, query } from './_generated/server'
import { v } from 'convex/values'
import { internal } from './_generated/api'
import type { Doc } from './_generated/dataModel'
import { parseLinkedInPostUrl } from './linkedin/parsePostUrl'
import { verifyPostOwnership } from './linkedin/verifyPostOwnership'
import { requireAuth, requireAuthAction } from './lib/auth'
import { getPlanLimitsHelper } from './lib/planLimits'
import { parsePostContent, appendMediaLinks } from './linkedin/parsePostContent'

export const getMyPosts = query({
  args: {
    sessionToken: v.optional(v.string())
  },
  handler: async (ctx, { sessionToken }) => {
    if (!sessionToken) return []
    let user: Doc<'users'>
    try {
      user = (await requireAuth(ctx, sessionToken)) as Doc<'users'>
    } catch {
      return []
    }
    const posts = await ctx.db
      .query('posts')
      .withIndex('by_author', q => q.eq('authorId', user._id))
      .collect()
    // Returns all posts by this user including hidden ones — hidden means hidden from
    // other users' feeds, not from the author's own My Posts page.
    // Sort by publishedAt descending — the by_author index orders by _creationTime,
    // not publishedAt, so we sort in-memory to get correct chronological order.
    return posts.sort((a, b) => b.publishedAt - a.publishedAt)
  }
})

/**
 * Counts how many of the given posts were published at or after `since`.
 * Pure helper — the single source of truth for the rolling-window count shared
 * by weekly-limit enforcement (countRecentPosts → submitPost) and the My Posts
 * usage pill (getWeeklyUsage), so the two can never drift apart.
 */
export function countPostsSince(posts: { publishedAt: number }[], since: number): number {
  return posts.filter(p => p.publishedAt >= since).length
}

export const countRecentPosts = internalQuery({
  args: {
    authorId: v.id('users'),
    since: v.number()
  },
  handler: async (ctx, { authorId, since }) => {
    const posts = await ctx.db
      .query('posts')
      .withIndex('by_author', q => q.eq('authorId', authorId))
      .order('desc')
      .take(20)
    return countPostsSince(posts, since)
  }
})

/**
 * Public: returns the authenticated user's weekly post usage for the My Posts
 * pill. `postsThisWeek` is counted over the SAME rolling 7-day window that
 * submitPost enforces, so the pill always reflects what the backend will allow.
 * Returns null when not signed in (mirrors getMe / getMyPosts).
 */
export const getWeeklyUsage = query({
  args: {
    sessionToken: v.optional(v.string())
  },
  handler: async (ctx, { sessionToken }) => {
    if (!sessionToken) return null
    let user: Doc<'users'>
    try {
      user = (await requireAuth(ctx, sessionToken)) as Doc<'users'>
    } catch {
      return null
    }
    const tier = user.tier ?? 'starter'
    const limits = await getPlanLimitsHelper(ctx, user._id, tier)
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
    const posts = await ctx.db
      .query('posts')
      .withIndex('by_author', q => q.eq('authorId', user._id))
      .order('desc')
      .take(20)
    return {
      postsThisWeek: countPostsSince(posts, sevenDaysAgo),
      postsPerWeek: limits.postsPerWeek
    }
  }
})

export const submitPost = action({
  args: {
    sessionToken: v.string(),
    postUrl: v.string()
  },
  handler: async (ctx, { sessionToken, postUrl }): Promise<{ postId: string }> => {
    // 1. Parse URL
    const parsed = parseLinkedInPostUrl(postUrl)
    if (!parsed) {
      throw new Error('Unrecognized LinkedIn post URL. Use a /posts/… or /feed/update/… URL.')
    }

    // 2. Resolve authenticated user from session token (never trusts client-supplied userId)
    const user = (await requireAuthAction(ctx, sessionToken)) as Doc<'users'>
    if (!user?.linkedinAccessToken) {
      throw new Error('No LinkedIn access token. Please sign in again.')
    }

    // 3. Rate limit: max 10 post submissions per hour per user
    await ctx.runMutation(internal.lib.rateLimit.checkAndIncrement, {
      userId: user._id,
      action: 'submitPost',
      maxPerHour: 10
    })

    // Posts per week limit check
    const effectiveTier = user.tier ?? 'starter'
    const planLimits = await ctx.runQuery(internal.lib.planLimits.getPlanLimits, {
      userId: user._id,
      tier: effectiveTier
    })
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
    const recentPostCount = await ctx.runQuery(internal.posts.countRecentPosts, {
      authorId: user._id,
      since: sevenDaysAgo
    })
    if (recentPostCount >= planLimits.postsPerWeek) {
      throw new Error(
        `Weekly post limit reached. Your plan allows ${planLimits.postsPerWeek} post${planLimits.postsPerWeek === 1 ? '' : 's'} per week.`
      )
    }

    // fetch the URL and try to get data-attributed-urn
    const rawLinkedinResponse = await fetch(postUrl)
    const rawLinkedinText = await rawLinkedinResponse.text()
    const urn = rawLinkedinText.match(/data-attributed-urn="([^"]+)"/)?.[1]

    if (!urn) {
      throw new Error('Could not find data-attributed-urn in LinkedIn post')
    }

    const token = user.linkedinAccessToken

    // 4. Verify ownership (Step A → Step B fallback)
    // Step A: UGC API (works when r_member_social is approved)
    // Step B: local comparison against stored publicIdentifier (no API call needed)
    const storedIdentifier = user.linkedinPublicIdentifier ?? null
    const ownership = await verifyPostOwnership(token, urn, user.linkedinId, parsed.vanityName, storedIdentifier)

    // 4b. Extract full content + media from the page HTML we already fetched
    // above. Best-effort and non-fatal — empty results degrade gracefully to
    // whatever the ownership step returned. The media is appended to `content`
    // as labeled links and also stored structured in `mediaUrls` for future use.
    const parsedContent = parsePostContent(rawLinkedinText)
    const baseText = ownership.content || parsedContent.text
    const composedContent = appendMediaLinks(baseText, parsedContent.media)
    const mediaUrls = parsedContent.media.map(m => m.url)

    // 5. Upsert the post — returns the post _id
    const postId = await ctx.runMutation(internal.jobs.syncPosts.upsertPost, {
      linkedinPostUrn: urn,
      authorId: user._id,
      content: composedContent,
      publishedAt: ownership.publishedAt,
      likeCount: 0,
      commentCount: 0,
      mediaUrls,
      isFeatured: false,
      visibilityIndustries: [],
      visibilityCountries: [],
      hidden: user.subscriptionStatus === 'trialing',
      // Preserve the original submitted URL so we can link back correctly —
      // reconstructing from URN loses information (activity ID ≠ ugcPost ID).
      sourceUrl: postUrl
    })

    if (!postId) {
      throw new Error('Failed to upsert post')
    }

    return { postId }
  }
})
