// convex/posts.ts
import { action, internalQuery, mutation, query } from './_generated/server'
import { ConvexError, v } from 'convex/values'
import { internal } from './_generated/api'
import type { Doc, Id } from './_generated/dataModel'
import { isAllowedLinkedInUrl, parseLinkedInPostUrl, resolveLinkedInShortlink } from './linkedin/parsePostUrl'
import { type OwnershipResult, verifyPostOwnership } from './linkedin/verifyPostOwnership'
import { requireAuth, requireAuthAction } from './lib/auth'
import { postCreatedHidden } from './lib/access'
import { getPlanLimitsHelper } from './lib/planLimits'
import { computeFeedFields } from './lib/feedRank'
import { currentUtcMonthKey, isFeaturedLimitReached } from './lib/postLimit'
import {
  appendMediaLinks,
  extractPostUrn,
  isEmbeddablePostHtml,
  parseArticle,
  parsePostAuthor,
  parsePostContent,
  parsePostEngagement
} from './linkedin/parsePostContent'
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
  env: Record<string, string | undefined>
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
    // Bounded read: take the 500 most-recently-added posts for this author instead of an
    // unbounded .collect(). Ordered desc on the by_author index (_creationTime) so the cap
    // keeps the newest posts; we re-sort by publishedAt below for display.
    const posts = await ctx.db
      .query('posts')
      .withIndex('by_author', q => q.eq('authorId', user._id))
      .order('desc')
      .take(500)
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

/**
 * Public: returns the authenticated user's featured-post usage for the current UTC calendar
 * month — backs the My Posts quota pill and the feature-toggle disabled state. Reads the SAME
 * tier limit + `by_user_month` row that `featurePost` enforces, so the UI never disagrees with
 * what the backend will allow. Returns null when not signed in (mirrors getWeeklyUsage).
 */
export const getFeaturedUsage = query({
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
    const month = currentUtcMonthKey()
    const usage = await ctx.db
      .query('featuredPostUsage')
      .withIndex('by_user_month', q => q.eq('userId', user._id).eq('month', month))
      .unique()
    return {
      usedCount: usage?.usedCount ?? 0,
      featuredPerMonth: limits.featuredPerMonth
    }
  }
})

export const submitPost = action({
  args: {
    sessionToken: v.string(),
    postUrl: v.string()
  },
  handler: async (ctx, { sessionToken, postUrl }): Promise<{ postId: string }> => {
    // 1. Resolve any lnkd.in shortlink to its underlying linkedin.com URL (SSRF-safe: manual
    //    redirect, every hop re-validated against the host allowlist). A normal linkedin.com URL
    //    passes straight through with no network call. Everything downstream uses `resolvedUrl`.
    const resolvedUrl = await resolveLinkedInShortlink(postUrl)
    const parsed = resolvedUrl ? parseLinkedInPostUrl(resolvedUrl) : null
    if (!resolvedUrl || !parsed) {
      throw new ConvexError('Unrecognized LinkedIn post URL. Use a /posts/… or /feed/update/… URL.')
    }

    // 2. Resolve authenticated user from session token (never trusts client-supplied userId)
    const user = (await requireAuthAction(ctx, sessionToken)) as Doc<'users'>
    if (!user?.linkedinAccessToken) {
      throw new ConvexError('No LinkedIn access token. Please sign in again.')
    }
    // No card-gate here: a not-yet-subscribed member CAN submit (incl. the onboarding first post).
    // The post is created HIDDEN for non-active authors (postCreatedHidden, at the upsert below) and
    // revealed when they become 'active'. Reactions/comments stay card-gated (see interactions.ts).

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
        throw new ConvexError(
          `Weekly post limit reached. Your plan allows ${planLimits.postsPerWeek} post${planLimits.postsPerWeek === 1 ? '' : 's'} per week.`
        )
      }
    }

    // Fetch the post page, then extract its URN — namespace-preserving (ugcPost/share/activity),
    // since LinkedIn's embed auth-walls a post addressed under the wrong namespace. `extractPostUrn`
    // tries the legacy `data-attributed-urn` attribute, then the `-{ns}-{id}-` slug of the submitted
    // URL (preferred — it carries the shared ugcPost id) and the final redirected URL. It returns a
    // format-validated URN, so it's safe downstream (ownership check, DB, later API calls).
    const rawLinkedinResponse = await fetch(resolvedUrl)
    const rawLinkedinText = await rawLinkedinResponse.text()
    const urn = extractPostUrn(rawLinkedinText, [resolvedUrl, rawLinkedinResponse.url])
    if (!urn) {
      throw new ConvexError('Could not find a valid LinkedIn post URN')
    }

    // 3b. Embeddability gate. LinkedIn only serves a post to the logged-out embed iframe when its
    // audience is public; a restricted-audience post (Connections-only, or some "new position"
    // occasion posts) auth-walls with "This post is unavailable". We probe the embed endpoint —
    // the wall is server-rendered, so a plain fetch reveals it (see isEmbeddablePostHtml) — and
    // reject at submit, so the shared feed never carries a dead embed. This applies to EVERYONE,
    // including admins under the share-any-post override: unlike ownership/throttles (curation
    // conveniences), a walling embed is a useless dead card in the feed no matter who submits it,
    // so the gate is deliberately NOT skipped for admins. The fetch (not wrapped in try/catch,
    // matching the page fetch above) propagates a transient LinkedIn error to the client.
    const embedHtml = await (await fetch(`https://www.linkedin.com/embed/feed/update/${urn}/`)).text()
    if (!isEmbeddablePostHtml(embedHtml)) {
      throw new ConvexError(
        'This LinkedIn post is not publicly visible, so it can\'t be shown here. Open the post on LinkedIn, change its audience to "Anyone" (the globe icon), then submit it again.'
      )
    }

    // 4. Verify ownership — skipped only under the admin override (dev-only), so a
    //    dev admin may share ANY post regardless of who authored it.
    //    Normal path: match the post's JSON-LD author name (rendered by LinkedIn) against the
    //    member's OIDC name — non-spoofable, no LinkedIn API call. Falls back to the vanity heuristic
    //    only when the page carried no author block. On a name-verified post we also auto-fill the
    //    member's LinkedIn identifier from the author's profile URL — the trustworthy seed for Apify.
    //    Override path: synthesize a confirmed result. content stays empty (it falls back to the
    //    HTML-parsed text below) and publishedAt defaults to now — identical to the heuristic shape.
    let ownership: OwnershipResult
    if (adminShareOverride) {
      ownership = { confirmed: true, content: '', publishedAt: Date.now(), strategy: 'admin-override' }
    } else {
      const postAuthor = parsePostAuthor(rawLinkedinText)
      ownership = verifyPostOwnership(
        postAuthor.name ?? null,
        user.name,
        parsed.vanityName,
        user.linkedinPublicIdentifier ?? null
      )
      // Set-once: fill the member's vanity from this name-verified post so Apify has a trustworthy,
      // never-typed profile locator. ponytail: set-once (not refresh-on-change) — vanity churn is rare
      // pre-launch; upgrade to refresh-if-different if members start changing their LinkedIn URLs.
      if (postAuthor.vanity && !user.linkedinPublicIdentifier) {
        await ctx.runMutation(internal.users.setDerivedPublicIdentifier, {
          userId: user._id,
          vanity: postAuthor.vanity
        })
      }
    }

    // 4b. Extract full content + media from the page HTML we already fetched
    // above. Best-effort and non-fatal — empty results degrade gracefully to
    // whatever the ownership step returned. The media is appended to `content`
    // as labeled links and also stored structured in `mediaUrls` for future use.
    const parsedContent = parsePostContent(rawLinkedinText)
    const baseText = ownership.content || parsedContent.text
    const composedContent = appendMediaLinks(baseText, parsedContent.media)
    const mediaUrls = parsedContent.media.map(m => m.url)
    // Image-typed media only — sent to the AI as vision input (a non-image URL would error the model).
    const imageUrls = parsedContent.media.filter(m => m.type === 'image').map(m => m.url)

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

    // 5. Upsert the post — returns { postId, created }; submitPost always schedules the
    // prediction below regardless of created (a resubmit of an already-known URN is rare and
    // harmless — see backlog/B09, which only gates the Apify re-sync path on `created`).
    const { postId } = await ctx.runMutation(internal.jobs.syncPosts.upsertPost, {
      linkedinPostUrn: urn,
      authorId: user._id,
      content: composedContent,
      publishedAt: ownership.publishedAt,
      likeCount: engagement.likeCount,
      commentCount: engagement.commentCount,
      mediaUrls,
      imageUrls,
      isFeatured: false,
      // Copy the author's stored default visibility allowlists (backlog/B06 — user-default
      // model, set via users.setPostVisibility). Absent/empty ⇒ visible to everyone.
      visibilityIndustries: user.defaultVisibilityIndustries ?? [],
      visibilityCountries: user.defaultVisibilityCountries ?? [],
      hidden: postCreatedHidden(user),
      // Store the resolved linkedin.com URL so we can link back correctly — it preserves the
      // ugcPost ID (activity ID ≠ ugcPost ID) and, unlike a lnkd.in shortlink, won't rot.
      sourceUrl: resolvedUrl,
      // Best-effort article data (undefined when the post shares no article).
      article
    })

    if (!postId) {
      throw new Error('Failed to upsert post')
    }

    // The first successful submission clears the first-post onboarding step (set-once), whether the
    // post came from the onboarding gate or the normal My Posts composer.
    await ctx.runMutation(internal.users.markFirstPostPrompted, { userId: user._id })

    // Best-effort, async: predict the most-likely reaction without blocking the submit.
    // Failure (incl. missing OPENROUTER_API_KEY) leaves the post at its default LIKE.
    await ctx.scheduler.runAfter(0, internal.ai.reactions.predictReaction, { postId })

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
    if (!post) throw new ConvexError('Post not found')
    if (!canModifyPost(user, post)) {
      throw new ConvexError('Forbidden: you can only modify your own posts')
    }
    // A soft-deleted post must never be resurfaced by un-hiding it.
    if (post.deletedAt !== undefined) {
      throw new ConvexError('Post has been deleted')
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
    if (!post) throw new ConvexError('Post not found')
    if (!canModifyPost(user, post)) {
      throw new ConvexError('Forbidden: you can only modify your own posts')
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

/**
 * Feature a post: pins it to the top of the feed until unfeatured. Gated by the caller's tier's
 * monthly quota (`planLimits.featuredPerMonth`), tracked in `featuredPostUsage` keyed by the
 * current UTC calendar month (`currentUtcMonthKey` — UTC so the quota resets at the same instant
 * for everyone, not at each user's local midnight). The usage read, cap check, post patch, and
 * usage upsert all happen inside this one mutation — Convex mutations are transactional, so a
 * concurrent duplicate call is either serialized after this one commits or retried against the
 * post-commit state. The `post.isFeatured` early-return below is what makes that retry safe: without
 * it, a retried call would re-run the whole feature flow (including the usage increment) a second
 * time even though the post was already featured by the call it raced against — this guard is the
 * actual double-increment fix, not just an optimization. Authorized for the post's author or any
 * admin (`canModifyPost`, same as `setPostHidden`/`deletePost`). No quota refund on unfeature
 * (below) — featuring permanently consumes one monthly slot by design (product decision, backlog/B07).
 */
export const featurePost = mutation({
  args: {
    sessionToken: v.string(),
    postId: v.id('posts')
  },
  handler: async (ctx, { sessionToken, postId }) => {
    const user = await requireAuth(ctx, sessionToken)
    const post = await ctx.db.get(postId)
    if (!post) throw new ConvexError('Post not found')
    if (!canModifyPost(user, post)) {
      throw new ConvexError('Forbidden: you can only modify your own posts')
    }
    // A soft-deleted post must never be resurfaced by featuring it.
    if (post.deletedAt !== undefined) {
      throw new ConvexError('Post has been deleted')
    }
    // Idempotent no-op if already featured — see the concurrency note above.
    if (post.isFeatured) return

    const tier = user.tier ?? 'starter'
    const limits = await getPlanLimitsHelper(ctx, user._id, tier)
    const month = currentUtcMonthKey()
    const usageRow = await ctx.db
      .query('featuredPostUsage')
      .withIndex('by_user_month', q => q.eq('userId', user._id).eq('month', month))
      .unique()
    const usedCount = usageRow?.usedCount ?? 0
    if (isFeaturedLimitReached(usedCount, limits.featuredPerMonth)) {
      throw new ConvexError(
        `Monthly featured-post limit reached. Your plan allows ${limits.featuredPerMonth} featured post${limits.featuredPerMonth === 1 ? '' : 's'} per month.`
      )
    }

    // Featuring changes feed rank — refresh the denormalized feed fields (see lib/feedRank.ts).
    const feed = computeFeedFields({
      isFeatured: true,
      publishedAt: post.publishedAt,
      authorTierRank: post.authorTierRank,
      hidden: post.hidden,
      interactionLimitReached: post.interactionLimitReached,
      deletedAt: post.deletedAt
    })
    await ctx.db.patch(postId, { isFeatured: true, featuredAt: Date.now(), ...feed })

    if (usageRow) await ctx.db.patch(usageRow._id, { usedCount: usedCount + 1 })
    else await ctx.db.insert('featuredPostUsage', { userId: user._id, month, usedCount: 1 })
  }
})

/**
 * Reverse `featurePost`. Does NOT decrement `featuredPostUsage` — see the no-refund decision in
 * the doc comment above `featurePost`. Authorized for the post's author or any admin. Idempotent.
 */
export const unfeaturePost = mutation({
  args: {
    sessionToken: v.string(),
    postId: v.id('posts')
  },
  handler: async (ctx, { sessionToken, postId }) => {
    const user = await requireAuth(ctx, sessionToken)
    const post = await ctx.db.get(postId)
    if (!post) throw new ConvexError('Post not found')
    if (!canModifyPost(user, post)) {
      throw new ConvexError('Forbidden: you can only modify your own posts')
    }
    if (!post.isFeatured) return // already unfeatured — idempotent no-op

    // Unfeaturing changes feed rank — refresh the denormalized feed fields.
    const feed = computeFeedFields({
      isFeatured: false,
      publishedAt: post.publishedAt,
      authorTierRank: post.authorTierRank,
      hidden: post.hidden,
      interactionLimitReached: post.interactionLimitReached,
      deletedAt: post.deletedAt
    })
    await ctx.db.patch(postId, { isFeatured: false, featuredAt: undefined, ...feed })
    // No usedCount decrement — unfeaturing does not refund the monthly quota.
  }
})
