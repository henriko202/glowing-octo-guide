// convex/posts.ts
import {
  action,
  env,
  internalMutation,
  internalQuery,
  mutation,
  type MutationCtx,
  query,
  type QueryCtx
} from './_generated/server'
import { ConvexError, v } from 'convex/values'
import { internal } from './_generated/api'
import type { Doc, Id } from './_generated/dataModel'
import {
  fetchAllowedLinkedInUrl,
  isAllowedLinkedInUrl,
  isHttpsUrl,
  parseLinkedInPostUrl,
  resolveLinkedInShortlink
} from './linkedin/parsePostUrl'
import { type OwnershipResult, verifyPostOwnership } from './linkedin/verifyPostOwnership'
import { requireAuth, requireAuthAction } from './lib/auth'
import { fetchWithTimeout } from './lib/fetchWithTimeout'
import { assertCanEngage, assertCanSubmitPost, postCreatedHidden } from './lib/access'
import { DEFAULTS, getPlanLimitsHelper, type PlanLimits, type Tier } from './lib/planLimits'
import { computeFeedFields } from './lib/feedRank'
import { currentUtcMonthKey, hasPermanentFeaturedEntitlement, isFeaturedLimitReached } from './lib/postLimit'
import { hasReachedInteractionLimit } from './lib/interactionLimit'
import { featuredPurchaseBlocker, fulfilmentAction, purchasedFeaturePatch } from './lib/featuredPurchase'
import { type AuditDb, writeAuditLog } from './lib/audit'
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
    // Bounded read: the 500 most-recently-published posts for this author via the
    // by_author_and_publishedAt index. Ordered desc on publishedAt, so the cap keeps the newest
    // posts and the result is already in display order — no in-memory sort.
    const posts = await ctx.db
      .query('posts')
      .withIndex('by_author_and_publishedAt', q => q.eq('authorId', user._id))
      .order('desc')
      .take(500)
    // Returns this user's posts EXCEPT soft-deleted ones. Hidden posts ARE included —
    // "hidden" means hidden from other users' feeds, not from the author's own My Posts
    // page (where they can unhide). Soft-deleted posts are dropped from this view, but
    // their rows persist so they still count toward the rolling weekly post limit.
    return posts.filter(p => p.deletedAt === undefined)
  }
})

/**
 * Bounded count of this author's posts published at or after `since`, read through the
 * `by_author_and_publishedAt` index — the SAME index and range the authoritative insert-path
 * check uses (jobs/syncPosts.upsertPost), so the weekly-limit enforcement (countRecentPosts →
 * submitPost) and the My Posts usage pill (getWeeklyUsage) can never drift apart. `limit` is the
 * caller's plan cap: both callers only need to know whether the count reaches postsPerWeek, so
 * scanning past it would be wasted work. The cutoff is inclusive.
 */
export async function countPostsPublishedSince(
  ctx: QueryCtx,
  authorId: Id<'users'>,
  since: number,
  limit: number
): Promise<number> {
  const posts = await ctx.db
    .query('posts')
    .withIndex('by_author_and_publishedAt', q => q.eq('authorId', authorId).gte('publishedAt', since))
    .take(limit)
  return posts.length
}

export const countRecentPosts = internalQuery({
  args: {
    authorId: v.id('users'),
    since: v.number(),
    limit: v.number()
  },
  handler: async (ctx, { authorId, since, limit }) => countPostsPublishedSince(ctx, authorId, since, limit)
})

/**
 * Public: returns the authenticated user's weekly post usage for the My Posts
 * pill. `postsThisWeek` is counted over the SAME rolling 7-day window that
 * submitPost enforces, so the pill always reflects what the backend will allow.
 * `now` is client-supplied (queries must not read the wall clock); the enforcement
 * path still uses server time inside its action. Returns null when not signed in
 * (mirrors getMe / getMyPosts).
 */
export const getWeeklyUsage = query({
  args: {
    sessionToken: v.optional(v.string()),
    now: v.number()
  },
  handler: async (ctx, { sessionToken, now }) => {
    if (!sessionToken) return null
    let user: Doc<'users'>
    try {
      user = (await requireAuth(ctx, sessionToken)) as Doc<'users'>
    } catch {
      return null
    }
    const tier = user.tier ?? 'starter'
    const limits = await getPlanLimitsHelper(ctx, user._id, tier)
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000
    const postsThisWeek = await countPostsPublishedSince(ctx, user._id, sevenDaysAgo, limits.postsPerWeek)
    return {
      postsThisWeek,
      postsPerWeek: limits.postsPerWeek
    }
  }
})

/**
 * Public: returns the authenticated user's featured-post usage for the current UTC calendar
 * month — backs the My Posts quota pill and the feature-toggle disabled state. Reads the SAME
 * tier limit + `by_user_id_and_month` row that `featurePost` enforces, so the UI never disagrees with
 * what the backend will allow. `now` is client-supplied (queries must not read the wall clock);
 * `featurePost` still uses server time inside its mutation. Returns null when not signed in
 * (mirrors getWeeklyUsage).
 */
export const getFeaturedUsage = query({
  args: {
    sessionToken: v.optional(v.string()),
    now: v.number()
  },
  handler: async (ctx, { sessionToken, now }) => {
    if (!sessionToken) return null
    let user: Doc<'users'>
    try {
      user = (await requireAuth(ctx, sessionToken)) as Doc<'users'>
    } catch {
      return null
    }
    const tier = user.tier ?? 'starter'
    const limits = await getPlanLimitsHelper(ctx, user._id, tier)
    const month = currentUtcMonthKey(now)
    const usage = await ctx.db
      .query('featuredPostUsage')
      .withIndex('by_user_id_and_month', q => q.eq('userId', user._id).eq('month', month))
      .unique()
    return {
      usedCount: usage?.usedCount ?? 0,
      featuredPerMonth: limits.featuredPerMonth
    }
  }
})

/**
 * Finds the tier-wide default planLimits row (userId undefined) for `tier`, mirroring
 * getPlanLimitsHelper's contact branch in lib/planLimits.ts. The userId===undefined check is
 * pushed into the query itself rather than run JS-side over a bounded `.take` — a contact tier
 * with more than 20 per-user override rows sharing the by_tier index value used to be able to push
 * the one true default row past the cap, silently falling back to DEFAULTS[tier] (F11). Split out
 * of getTierLimits so it's unit-testable with a mock ctx (the query wrapper itself isn't callable
 * in unit tests) — same pattern as fetchFeedPage in feed.ts.
 */
export async function findTierDefaultRow(ctx: QueryCtx, tier: Tier): Promise<Doc<'planLimits'> | null> {
  const rows = await ctx.db
    .query('planLimits')
    .withIndex('by_tier', q => q.eq('tier', tier))
    .filter(q => q.eq(q.field('userId'), undefined))
    .take(20)
  return rows[0] ?? null
}

/**
 * Public: tier-default plan limits for every tier, keyed by tier name. Backs the
 * "upgrade at the limit" prompts (backlog/R08) so their copy always names the
 * DB-configured number (an admin override in PlanLimitsTab shows up immediately),
 * never a hardcoded one. Contact's per-user overrides are per-user, not tier-wide,
 * so this always returns the contact tier's DEFAULT row, not any member's override.
 */
export const getTierLimits = query({
  args: {},
  handler: async (ctx): Promise<Record<Tier, PlanLimits>> => {
    const tiers: Tier[] = ['starter', 'growth', 'pro', 'contact']
    const entries = await Promise.all(
      tiers.map(async tier => {
        const row = await findTierDefaultRow(ctx, tier)
        const limits: PlanLimits = row
          ? {
              interactionsPerPost: row.interactionsPerPost,
              postsPerWeek: row.postsPerWeek,
              featuredPerMonth: row.featuredPerMonth ?? DEFAULTS[tier].featuredPerMonth
            }
          : DEFAULTS[tier]
        return [tier, limits] as const
      })
    )
    return Object.fromEntries(entries) as Record<Tier, PlanLimits>
  }
})

export const submitPost = action({
  args: {
    sessionToken: v.string(),
    postUrl: v.string()
  },
  handler: async (ctx, { sessionToken, postUrl }): Promise<{ postId: string }> => {
    // 1. Resolve authenticated user FIRST, so no anonymous caller can trigger outbound requests
    //    (the per-user rate limit and weekly-limit checks below only exist for resolved users).
    const user = (await requireAuthAction(ctx, sessionToken)) as Doc<'users'>
    if (!user?.linkedinAccessToken) {
      throw new ConvexError('No LinkedIn access token. Please sign in again.')
    }

    // 2. Admin "share any post" override — TESTING ONLY, enabled only on the local /
    //    dev deployment via the ALLOW_ADMIN_SHARE_ANY_POST env var. When off (always
    //    the case in production), admins submit under the normal rules below.
    const adminShareOverride = isAdminShareOverrideEnabled(user, env)

    // 2b. A failed payment blocks submission (assertCanSubmitPost): the member already has an
    //     account in dunning, and a post written now would be created hidden into a void. `none`
    //     stays allowed — the onboarding first post is hidden by design until a card arrives.
    assertCanSubmitPost(user)

    // 3. Posting throttles — BEFORE any outbound fetch (shortlink resolution and the page fetches
    //    below), so submitting is what consumes budget: an invalid or hostile URL still consumes the
    //    hourly budget (intended abuse control). Skipped only under the admin override. It lets a dev
    //    admin curate the shared feed by submitting any post in any volume, so both the hourly rate
    //    limit and the weekly per-plan limit are bypassed.
    // Hoisted out of the block so the per-post interaction cap (checked after we've read the post's
    // engagement, below) can reuse it; stays undefined under the admin override, so the cap check
    // there is skipped too — consistent with the other per-plan throttles.
    let interactionsPerPost: number | undefined
    if (!adminShareOverride) {
      // Rate limit: max 10 post submissions per hour per user
      await ctx.runMutation(internal.lib.rateLimit.checkAndIncrement, {
        userId: user._id,
        action: 'submitPost',
        maxPerHour: 10
      })

      // Weekly post limit (per plan tier)
      const effectiveTier = user.tier ?? 'starter'
      const planLimits = await ctx.runQuery(internal.lib.planLimitsQuery.getPlanLimits, {
        userId: user._id,
        tier: effectiveTier
      })
      interactionsPerPost = planLimits.interactionsPerPost
      const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
      const recentPostCount = await ctx.runQuery(internal.posts.countRecentPosts, {
        authorId: user._id,
        since: sevenDaysAgo,
        limit: planLimits.postsPerWeek
      })
      if (recentPostCount >= planLimits.postsPerWeek) {
        // Prefixed code, not English prose: survives production error redaction and is
        // localized client-side by lib/errors.ts's mapLimitError (backlog/R08).
        throw new ConvexError(`WEEKLY_LIMIT:${planLimits.postsPerWeek}`)
      }
    }

    // 4. Resolve any lnkd.in shortlink to its underlying linkedin.com URL (SSRF-safe: manual
    //    redirect, every hop re-validated) and parse it. Deliberately after the throttle: an invalid
    //    URL consumes rate-limit budget too (abuse control).
    const resolvedUrl = await resolveLinkedInShortlink(postUrl)
    const parsed = resolvedUrl ? parseLinkedInPostUrl(resolvedUrl) : null
    if (!resolvedUrl || !parsed) {
      throw new ConvexError('Unrecognized LinkedIn post URL. Use a /posts/… or /feed/update/… URL.')
    }
    // No card-gate here: a not-yet-subscribed member CAN submit (incl. the onboarding first post).
    // The post is created HIDDEN for non-active authors (postCreatedHidden, at the upsert below) and
    // revealed when they become 'active'. Reactions/comments stay card-gated (see interactions.ts).

    // Fetch the post page, then extract its URN — namespace-preserving (ugcPost/share/activity),
    // since LinkedIn's embed auth-walls a post addressed under the wrong namespace. `extractPostUrn`
    // tries the legacy `data-attributed-urn` attribute, then the `-{ns}-{id}-` slug of the submitted
    // URL (preferred — it carries the shared ugcPost id) and the final redirected URL. It returns a
    // format-validated URN, so it's safe downstream (ownership check, DB, later API calls).
    const rawLinkedinResponse = await fetchAllowedLinkedInUrl(resolvedUrl)
    if (!rawLinkedinResponse) {
      throw new ConvexError('Could not reach LinkedIn to read this post. Please try again in a moment.')
    }
    // A public post page returns 200. A non-2xx here is a transient/blocked LinkedIn response
    // (429 rate-limit, 999 anti-bot, 5xx) — surface a retryable error instead of letting an empty
    // body fall through to the misleading "Could not find a valid LinkedIn post URN". ponytail:
    // ceiling — if LinkedIn ever 999s a genuinely-valid public post, the user just retries (usually
    // succeeds on a later attempt); still strictly better than today's wrong message.
    if (!rawLinkedinResponse.ok) {
      throw new ConvexError('Could not reach LinkedIn to read this post. Please try again in a moment.')
    }
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
    const embedResponse = await fetchWithTimeout(`https://www.linkedin.com/embed/feed/update/${urn}/`)
    // Distinguish a transient/blocked response (non-2xx) from the restricted-audience wall, which
    // LinkedIn serves as a 200 with wall HTML (detected by isEmbeddablePostHtml below). Without this,
    // a rate-limit/5xx would be mislabeled as "change your post's audience" — a confusing dead end.
    if (!embedResponse.ok) {
      throw new ConvexError('Could not reach LinkedIn to verify this post. Please try again in a moment.')
    }
    const embedHtml = await embedResponse.text()
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
    // https-only: these URLs are stored and (imageUrls) fetched by the AI vision provider — drop any
    // non-https scheme parsed out of the page HTML before it reaches storage/a third party.
    const mediaUrls = parsedContent.media.map(m => m.url).filter(isHttpsUrl)
    // Image-typed media only — sent to the AI as vision input (a non-image URL would error the model).
    const imageUrls = parsedContent.media
      .filter(m => m.type === 'image')
      .map(m => m.url)
      .filter(isHttpsUrl)

    // 4c. Pull current engagement (reactions + comments) from the same page HTML's
    // JSON-LD. Best-effort: missing data degrades to 0, so the post just starts at
    // zero engagement rather than failing the submit.
    const engagement = parsePostEngagement(rawLinkedinText)

    // 4c-ii. Reject a post whose current LinkedIn engagement already meets the author's per-post
    // interaction cap (Option A: total engagement counts). Such a post would insert as
    // interactionLimitReached ⇒ never visible in the feed, so tell the submitter up front instead of
    // silently creating a hidden post. Skipped under the admin share-override (interactionsPerPost is
    // left undefined there), matching the other per-plan throttles.
    if (
      interactionsPerPost !== undefined &&
      hasReachedInteractionLimit(engagement.likeCount, engagement.commentCount, interactionsPerPost)
    ) {
      throw new ConvexError(
        `This LinkedIn post already has ${engagement.likeCount + engagement.commentCount} reactions and comments, which meets your plan's limit of ${interactionsPerPost} interactions per post — so it can't be added to your feed.`
      )
    }

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
        const articleResponse = await fetchAllowedLinkedInUrl(articleUrl)
        // Best-effort: skip a non-OK article page rather than parsing a block/error body into `article`.
        if (articleResponse?.ok) {
          const articleHtml = await articleResponse.text()
          article = { url: articleUrl, ...parseArticle(articleHtml) }
        }
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
      throw new ConvexError('This post is already linked to another LinkedIn account and cannot be updated here.')
    }

    // The first successful submission clears the first-post onboarding step (set-once), whether the
    // post came from the onboarding gate or the normal My Posts composer.
    await ctx.runMutation(internal.users.markFirstPostPrompted, { userId: user._id })

    // Best-effort, async: predict the most-likely reaction without blocking the submit.
    // Failure (incl. missing OPENROUTER_API_KEY) leaves the post at its default LIKE.
    await ctx.scheduler.runAfter(0, internal.ai.reactions.predictReaction, { postId })

    // Best-effort, async: guess the member's industry from their own post while they have none, so
    // the Growth filter works without a Settings visit. Not under the admin override (the post may
    // not be theirs), and never after they saved the profile form themselves.
    if (!adminShareOverride && !user.industry && !user.profileEditedAt) {
      await ctx.scheduler.runAfter(0, internal.ai.industry.guessIndustry, { userId: user._id, postId })
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
 * admin (`canModifyPost`, same as `setPostHidden`/`deletePost`). The first feature permanently
 * assigns that allowance to this post; later unfeature/re-feature cycles reuse it.
 */
type FeaturedToggleArgs = { sessionToken: string; postId: Id<'posts'> }

export async function featurePostHandler(
  ctx: MutationCtx,
  { sessionToken, postId }: FeaturedToggleArgs
): Promise<void> {
  const user = await requireAuth(ctx, sessionToken)
  // The plan allowance is card-gated like every other engagement: a `past_due` member (payment
  // failed) or a `none` member cannot boost a post while the subscription behind it is not in
  // good standing. `unfeaturePost` stays ungated on purpose — removing a boost must always work.
  assertCanEngage(user)
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

  // Featuring changes feed rank — refresh the denormalized feed fields (see lib/feedRank.ts).
  const feed = computeFeedFields({
    isFeatured: true,
    publishedAt: post.publishedAt,
    authorTierRank: post.authorTierRank,
    hidden: post.hidden,
    interactionLimitReached: post.interactionLimitReached,
    deletedAt: post.deletedAt
  })
  // A plan allowance or paid slot belongs to this post permanently. `featuredAt` survives
  // unfeaturing, so re-featuring never checks or increments the current month's quota.
  if (hasPermanentFeaturedEntitlement(post)) {
    await ctx.db.patch(postId, { isFeatured: true, featuredAt: post.featuredAt ?? Date.now(), ...feed })
    return
  }

  const tier = user.tier ?? 'starter'
  const limits = await getPlanLimitsHelper(ctx, user._id, tier)
  const month = currentUtcMonthKey()
  const usageRow = await ctx.db
    .query('featuredPostUsage')
    .withIndex('by_user_id_and_month', q => q.eq('userId', user._id).eq('month', month))
    .unique()
  const usedCount = usageRow?.usedCount ?? 0
  if (isFeaturedLimitReached(usedCount, limits.featuredPerMonth)) {
    // Prefixed code, not English prose: survives production error redaction and is
    // localized client-side by lib/errors.ts's mapLimitError (backlog/R08).
    throw new ConvexError(`FEATURED_LIMIT:${limits.featuredPerMonth}`)
  }

  await ctx.db.patch(postId, { isFeatured: true, featuredAt: Date.now(), ...feed })

  if (usageRow) await ctx.db.patch(usageRow._id, { usedCount: usedCount + 1 })
  else await ctx.db.insert('featuredPostUsage', { userId: user._id, month, usedCount: 1 })
}

export const featurePost = mutation({
  args: {
    sessionToken: v.string(),
    postId: v.id('posts')
  },
  handler: featurePostHandler
})

/**
 * Reverse `featurePost`. Does NOT decrement `featuredPostUsage` and retains `featuredAt` as the
 * permanent entitlement marker. Authorized for the post's author or any admin. Idempotent.
 */
export async function unfeaturePostHandler(
  ctx: MutationCtx,
  { sessionToken, postId }: FeaturedToggleArgs
): Promise<void> {
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
  await ctx.db.patch(postId, { isFeatured: false, ...feed })
  // No usedCount decrement; retained featuredAt lets this post reuse the same allowance later.
}

export const unfeaturePost = mutation({
  args: {
    sessionToken: v.string(),
    postId: v.id('posts')
  },
  handler: unfeaturePostHandler
})

// ── Featured post add-on (backlog/revenue/R17) ───────────────────────────────────────────────────

// billingNode.purchaseFeaturedPost asks before opening Checkout. Throws the blocker's code; the
// client shows it through friendlyError.
export const assertFeaturedPurchasable = internalQuery({
  args: { postId: v.id('posts'), userId: v.id('users') },
  handler: async (ctx, { postId, userId }): Promise<null> => {
    const [post, user] = await Promise.all([ctx.db.get(postId), ctx.db.get(userId)])
    const blocker = featuredPurchaseBlocker(post, userId, user?.tier ?? 'starter')
    if (blocker) throw new ConvexError(blocker)
    return null
  }
})

export interface ApplyPurchasedFeatureArgs {
  postId: string
  checkoutSessionId: string
  amountCents: number
  paidAt: number
}

/**
 * Fulfilment, called by http.ts on checkout.session.completed. `postId` is a plain string on
 * purpose: Stripe retries a failing webhook for days, so a bad id must log and return, never fail
 * the validator. Idempotent — a redelivered event finds `featuredPurchase` set and stops. Never
 * touches featuredPostUsage: the purchase is outside the monthly quota by design.
 *
 * Extracted from the mutation below so every branch of a money path is unit-testable with a mock
 * ctx (posts.test.ts), the same shape as users.ts's setPostVisibilityHandler.
 */
export async function applyPurchasedFeatureHandler(
  ctx: MutationCtx,
  { postId, checkoutSessionId, amountCents, paidAt }: ApplyPurchasedFeatureArgs
): Promise<null> {
  const id = ctx.db.normalizeId('posts', postId)
  const post = id ? await ctx.db.get(id) : null
  // A hard-deleted post (not merely soft-deleted) means the author ran the erasure cascade
  // (convex/privacy/deletion.ts); by design, no audit row is written against an erased subject.
  if (!id || !post) {
    console.error('[posts] featured purchase for unknown post', { postId, checkoutSessionId })
    return null
  }
  // Stripe redelivers checkout.session.completed: the same session id is a replay (already
  // applied, nothing left to do); a different one is a second payment for a post that can only
  // be featured — and billed — once.
  const existing = post.featuredPurchase
  const fulfilment = fulfilmentAction(existing, checkoutSessionId)
  if (fulfilment === 'replay') return null
  if (fulfilment === 'duplicate_payment') {
    // Stripe already has the $5 and won't take it back on our say-so — never throw (that would
    // just make Stripe retry this same charge forever). Log loudly and leave an audit row naming
    // both sessions; the owner refunds the second one from there.
    const existingCheckoutSessionId = existing!.checkoutSessionId
    console.error('[posts] duplicate featured purchase', {
      postId: id,
      existingCheckoutSessionId,
      checkoutSessionId
    })
    await writeAuditLog(ctx.db as unknown as AuditDb, {
      actor: 'system',
      action: 'post.featured_purchase_duplicate',
      targetUserId: post.authorId,
      metadata: JSON.stringify({ existingCheckoutSessionId, checkoutSessionId, amountCents })
    })
    return null
  }
  const author = await ctx.db.get(post.authorId)
  const tier: Tier = author?.tier ?? 'starter'
  const limits = await getPlanLimitsHelper(ctx, post.authorId, tier)
  const purchase = { checkoutSessionId, amountCents, paidAt }
  const { patch, action } = purchasedFeaturePatch({
    post,
    tier,
    planCap: limits.interactionsPerPost,
    purchase,
    now: Date.now()
  })
  await ctx.db.patch(id, patch)
  // Money moved without a member action in our app, so the row says what it bought (or why
  // nothing was featured: the post was deleted between Checkout and the webhook).
  await writeAuditLog(ctx.db as unknown as AuditDb, {
    actor: 'system',
    action,
    targetUserId: post.authorId,
    metadata: JSON.stringify({ postId: id, checkoutSessionId, amountCents, bonus: patch.interactionCapBonus ?? 0 })
  })
  return null
}

export const applyPurchasedFeature = internalMutation({
  args: { postId: v.string(), checkoutSessionId: v.string(), amountCents: v.number(), paidAt: v.number() },
  handler: (ctx, args): Promise<null> => applyPurchasedFeatureHandler(ctx, args)
})
