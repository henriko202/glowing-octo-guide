// convex/posts.ts
import { action, internalQuery, mutation, query } from './_generated/server'
import { v } from 'convex/values'
import { internal } from './_generated/api'
import type { Doc, Id } from './_generated/dataModel'
import { isAllowedLinkedInUrl, parseLinkedInPostUrl } from './linkedin/parsePostUrl'
import { type OwnershipResult, verifyPostOwnership } from './linkedin/verifyPostOwnership'
import { requireAuth, requireAuthAction } from './lib/auth'
import { getPlanLimitsHelper } from './lib/planLimits'
import { computeFeedFields } from './lib/feedRank'
import { appendMediaLinks, parseArticle, parsePostContent, parsePostEngagement } from './linkedin/parsePostContent'
import { type ArticleData } from './lib/articleValidator'

/**
 * Whether the admin "share any post" override is active for this submitter.
 *
 * TESTING ONLY: when enabled, an admin bypasses post-ownership verification AND
 * the posting throttles (hourly rate limit + weekly per-plan limit). It is gated
 * behind the `ALLOW_ADMIN_SHARE_ANY_POST` env var, which is set **only** on the
 * local / dev Convex deployment. In production the var is absent, so admins submit
 * posts under exactly the same rules as everyone else.
 */
export function isAdminShareOverrideEnabled(
  user: { isAdmin?: boolean },
  env: { ALLOW_ADMIN_SHARE_ANY_POST?: string }
): boolean {
  return user.isAdmin === true && env.ALLOW_ADMIN_SHARE_ANY_POST === 'true'
}

/**
 * Authorization for hiding / deleting a post: the post's author, or any admin
 * (moderation). Pure helper so the rule is testable and applied identically by
 * the `setPostHidden` and `deletePost` mutations.
 */
export function canModifyPost(user: { _id: Id<'users'>; isAdmin?: boolean }, post: { authorId: Id<'users'> }): boolean {
  return post.authorId === user._id || user.isAdmin === true
}

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
    // Returns this user's posts EXCEPT soft-deleted ones. Hidden posts ARE included —
    // "hidden" means hidden from other users' feeds, not from the author's own My Posts
    // page (where they can unhide). Soft-deleted posts are dropped from this view, but
    // their rows persist so they still count toward the rolling weekly post limit.
    // Sort by publishedAt descending — the by_author index orders by _creationTime,
    // not publishedAt, so we sort in-memory to get correct chronological order.
    return posts.filter(p => p.deletedAt === undefined).sort((a, b) => b.publishedAt - a.publishedAt)
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

    // Admin "share any post" override — TESTING ONLY, enabled only on the local /
    // dev deployment via the ALLOW_ADMIN_SHARE_ANY_POST env var. When off (always
    // the case in production), admins submit under the normal rules below.
    const adminShareOverride = isAdminShareOverrideEnabled(user, process.env)

    // 3. Posting throttles — skipped only under the admin override. It lets a dev
    //    admin curate the shared feed by submitting any post in any volume, so both
    //    the hourly rate limit and the weekly per-plan limit are bypassed.
    if (!adminShareOverride) {
      // Rate limit: max 10 post submissions per hour per user
      await ctx.runMutation(internal.lib.rateLimit.checkAndIncrement, {
        userId: user._id,
        action: 'submitPost',
        maxPerHour: 10
      })

      // Weekly post limit (per plan tier)
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
    }

    // fetch the URL and try to get data-attributed-urn
    const rawLinkedinResponse = await fetch(postUrl)
    const rawLinkedinText = await rawLinkedinResponse.text()
    const urn = rawLinkedinText.match(/data-attributed-urn="([^"]+)"/)?.[1]

    // Validate the URN shape before using it downstream (ownership check, DB, later API calls).
    if (!urn || !/^urn:li:(ugcPost|activity|share):\d+$/.test(urn)) {
      throw new Error('Could not find a valid LinkedIn post URN')
    }

    // 4. Verify ownership — skipped only under the admin override (dev-only), so a
    //    dev admin may share ANY post regardless of who authored it.
    //    Normal path: Step A (UGC API, works when r_member_social is approved) →
    //    Step B (local comparison against stored publicIdentifier, no API call).
    //    Override path: synthesize a confirmed result. content stays empty (it falls
    //    back to the HTML-parsed text below) and publishedAt defaults to now —
    //    identical to the vanity-heuristic fallback's degraded shape.
    let ownership: OwnershipResult
    if (adminShareOverride) {
      ownership = { confirmed: true, content: '', publishedAt: Date.now(), strategy: 'admin-override' }
    } else {
      const token = user.linkedinAccessToken
      const storedIdentifier = user.linkedinPublicIdentifier ?? null
      ownership = await verifyPostOwnership(token, urn, user.linkedinId, parsed.vanityName, storedIdentifier)
    }

    // 4b. Extract full content + media from the page HTML we already fetched
    // above. Best-effort and non-fatal — empty results degrade gracefully to
    // whatever the ownership step returned. The media is appended to `content`
    // as labeled links and also stored structured in `mediaUrls` for future use.
    const parsedContent = parsePostContent(rawLinkedinText)
    const baseText = ownership.content || parsedContent.text
    const composedContent = appendMediaLinks(baseText, parsedContent.media)
    const mediaUrls = parsedContent.media.map(m => m.url)

    // 4c. Pull current engagement (reactions + comments) from the same page HTML's
    // JSON-LD. Best-effort: missing data degrades to 0, so the post just starts at
    // zero engagement rather than failing the submit.
    const engagement = parsePostEngagement(rawLinkedinText)

    // 4d. Best-effort article enrichment. If the post shares a LinkedIn article (e.g. a
    // Pulse post), fetch that article page and capture its title/summary/author/images to
    // seed a future AI-comment feature. Non-fatal: no article link, a network error, or a
    // parse miss simply leaves `article` undefined. SSRF: only fetch URLs that pass the
    // LinkedIn host allowlist (extractArticleUrl already enforces this; re-checked here as
    // defense-in-depth because this URL is fetched server-side). The full article body is
    // auth-walled, so parseArticle returns only the reliably-public subset.
    let article: ArticleData | undefined
    const articleUrl = parsedContent.media.find(m => m.type === 'article')?.url
    if (articleUrl && isAllowedLinkedInUrl(articleUrl)) {
      try {
        const articleResponse = await fetch(articleUrl)
        const articleHtml = await articleResponse.text()
        article = { url: articleUrl, ...parseArticle(articleHtml) }
      } catch {
        // best-effort — article enrichment must never block a submission
      }
    }

    // 5. Upsert the post — returns the post _id
    const postId = await ctx.runMutation(internal.jobs.syncPosts.upsertPost, {
      linkedinPostUrn: urn,
      authorId: user._id,
      content: composedContent,
      publishedAt: ownership.publishedAt,
      likeCount: engagement.likeCount,
      commentCount: engagement.commentCount,
      mediaUrls,
      isFeatured: false,
      visibilityIndustries: [],
      visibilityCountries: [],
      hidden: user.subscriptionStatus === 'trialing',
      // Preserve the original submitted URL so we can link back correctly —
      // reconstructing from URN loses information (activity ID ≠ ugcPost ID).
      sourceUrl: postUrl,
      // Best-effort article data (undefined when the post shares no article).
      article
    })

    if (!postId) {
      throw new Error('Failed to upsert post')
    }

    return { postId }
  }
})

/**
 * Hide or unhide a shared post. Hiding drops it from the public feed; the author
 * still sees it in My Posts and can unhide it. Authorized for the post's author or
 * any admin (see `canModifyPost`). Does NOT touch the weekly post count — the row
 * is unchanged apart from the `hidden` flag, so it stays within the rolling window.
 */
export const setPostHidden = mutation({
  args: {
    sessionToken: v.string(),
    postId: v.id('posts'),
    hidden: v.boolean()
  },
  handler: async (ctx, { sessionToken, postId, hidden }) => {
    const user = await requireAuth(ctx, sessionToken)
    const post = await ctx.db.get(postId)
    if (!post) throw new Error('Post not found')
    if (!canModifyPost(user, post)) {
      throw new Error('Forbidden: you can only modify your own posts')
    }
    // A soft-deleted post must never be resurfaced by un-hiding it.
    if (post.deletedAt !== undefined) {
      throw new Error('Post has been deleted')
    }
    // Hiding/unhiding flips feed eligibility — refresh the denormalized feed fields.
    const feed = computeFeedFields({
      isFeatured: post.isFeatured,
      publishedAt: post.publishedAt,
      authorTierRank: post.authorTierRank,
      hidden,
      interactionLimitReached: post.interactionLimitReached,
      deletedAt: post.deletedAt
    })
    await ctx.db.patch(postId, { hidden, ...feed })
  }
})

/**
 * Soft-delete a shared post: it disappears from the feed AND the author's My Posts
 * view, but the row is intentionally KEPT so it still counts toward the rolling
 * weekly post limit — deleting must never free up a posting slot. We also set
 * `hidden: true` so the post leaves the feed (the feed query keys on `hidden`).
 * Authorized for the post's author or any admin. Idempotent.
 */
export const deletePost = mutation({
  args: {
    sessionToken: v.string(),
    postId: v.id('posts')
  },
  handler: async (ctx, { sessionToken, postId }) => {
    const user = await requireAuth(ctx, sessionToken)
    const post = await ctx.db.get(postId)
    if (!post) throw new Error('Post not found')
    if (!canModifyPost(user, post)) {
      throw new Error('Forbidden: you can only modify your own posts')
    }
    if (post.deletedAt !== undefined) return // already deleted — idempotent no-op
    const deletedAt = Date.now()
    // Soft-delete removes the post from the feed — recompute so inFeed becomes false.
    const feed = computeFeedFields({
      isFeatured: post.isFeatured,
      publishedAt: post.publishedAt,
      authorTierRank: post.authorTierRank,
      hidden: true,
      interactionLimitReached: post.interactionLimitReached,
      deletedAt
    })
    await ctx.db.patch(postId, { deletedAt, hidden: true, ...feed })
  }
})
