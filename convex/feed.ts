// convex/feed.ts
import { query, type QueryCtx } from './_generated/server'
import { ConvexError, type Infer, v } from 'convex/values'
import { paginationOptsValidator, paginationResultValidator } from 'convex/server'
import type { Doc } from './_generated/dataModel'
import { requireAuth, resolveSession } from './lib/auth'
import { articleValidator } from './lib/articleValidator'
import { reactionValidator } from './lib/reactions'
import { INTERACTED_TTL_MS, toFeedViewerState, viewerPostStatus } from './lib/feedHygiene'
import { getPlanLimitsHelper } from './lib/planLimits'
import { effectiveInteractionCap, hasReachedInteractionLimit } from './lib/interactionLimit'

type FeedFilterParams = {
  tier?: string
  industry?: string
  country?: string
  filterIndustries?: string[]
  filterCountries?: string[]
}

export type FeedFilter = {
  applyIndustry: boolean
  applyCountry: boolean
  industries: string[]
  countries: string[]
}

export function buildFeedFilter(params: FeedFilterParams): FeedFilter {
  if (params.tier === 'growth') {
    return {
      applyIndustry: true,
      applyCountry: true,
      industries: params.industry ? [params.industry] : [],
      countries: params.country ? [params.country] : []
    }
  }
  if (params.tier === 'pro' || params.tier === 'contact') {
    const industries = params.filterIndustries ?? []
    const countries = params.filterCountries ?? []
    return {
      applyIndustry: industries.length > 0,
      applyCountry: countries.length > 0,
      industries,
      countries
    }
  }
  // starter: no filters
  return {
    applyIndustry: false,
    applyCountry: false,
    industries: [],
    countries: []
  }
}

// Hard cap on the page size a client can request (clamps paginationOpts.numItems).
const MAX_FEED_PAGE = 100

/**
 * Allow-list projection of an author for client responses. Returns ONLY display fields —
 * never tokens, isAdmin, ban state, Stripe IDs, linkedinId, or subscription details.
 * Allow-list (not deny-list) so new schema fields never leak by default.
 */
export function toFeedAuthor(author: Doc<'users'>) {
  return {
    _id: author._id,
    name: author.name,
    headline: author.headline,
    profilePictureUrl: author.profilePictureUrl,
    industry: author.industry,
    country: author.country,
    tier: author.tier
  }
}

/**
 * Author eligibility for the shared feed. Excludes BANNED authors (moderation — their content
 * leaves the feed and search the moment they are banned, and returns on unban, with no post
 * mutation), authors pending account deletion (their content disappears the moment they request
 * erasure, and reappears if they cancel), and `past_due` authors: a failed renewal hides their
 * posts (and any featured boost on them) until the charge clears, and `syncUserSubscription`
 * writing `active` brings them back — computed live from the status, so recovery needs no post
 * mutation. Trialing authors ARE eligible: they hold a card-backed Growth trial (Task 4 / Plan 2B)
 * so their posts belong in the feed (reciprocity).
 *
 * A CANCELED author keeps their posts in the feed only until their paid period ends: cancellation
 * never revokes engage access (see lib/access.canEngage), but the member's own posts drop out once
 * `now` passes `subscriptionEndsAt` (the paid-through instant). Missing/elapsed → not eligible.
 */
export function isAuthorFeedEligible(
  author: {
    subscriptionStatus?: string
    subscriptionEndsAt?: number
    deletionScheduledAt?: number
    isBanned?: boolean
  } | null,
  now: number
): boolean {
  if (!author) return false
  if (author.isBanned) return false
  if (author.deletionScheduledAt) return false
  if (author.subscriptionStatus === 'past_due') return false
  if (author.subscriptionStatus === 'canceled') {
    return author.subscriptionEndsAt !== undefined && now < author.subscriptionEndsAt
  }
  return true
}

/**
 * Whether a single post should be shown to `viewer`. The SINGLE per-viewer access gate shared by
 * getFeed and search, so neither can bypass the other's rules. A post is hidden when it is the
 * viewer's OWN post (feed/search surface other members' content), when the viewer falls outside the
 * post's visibility allowlists, or when its author isn't feed-eligible (see isAuthorFeedEligible).
 * The feed's tier-based industry/country filter is layered on top by fetchFeedPage — it is a
 * "what I want to see" preference, not an access rule, so it is not part of this gate.
 */
export function isPostVisibleToViewer(
  post: Pick<Doc<'posts'>, 'authorId' | 'visibilityIndustries' | 'visibilityCountries'>,
  viewer: Pick<Doc<'users'>, '_id' | 'industry' | 'country'>,
  author: Pick<Doc<'users'>, 'subscriptionStatus' | 'subscriptionEndsAt' | 'deletionScheduledAt' | 'isBanned'> | null,
  now: number
): boolean {
  if (post.authorId === viewer._id) return false
  if (post.visibilityIndustries.length > 0) {
    if (!viewer.industry || !post.visibilityIndustries.includes(viewer.industry)) return false
  }
  if (post.visibilityCountries.length > 0) {
    if (!viewer.country || !post.visibilityCountries.includes(viewer.country)) return false
  }
  return isAuthorFeedEligible(author, now)
}

/**
 * The single engagement gate, shared by commentOnPost, reactToPost and generateComment (via
 * interactions.getEngageablePost) so the three can never diverge on what a viewer may act on. A post
 * is engageable exactly when it would surface in this viewer's feed: not at its interaction cap, not
 * hidden / soft-deleted (the `inFeed` storage conditions that a direct `ctx.db.get(id)` bypasses),
 * and visible to the viewer (isPostVisibleToViewer: not own-post, within visibility allowlists,
 * author feed-eligible). Throws ConvexError with a viewer-facing message; returns when engageable.
 */
export function assertPostEngageable(
  post: Pick<
    Doc<'posts'>,
    'authorId' | 'visibilityIndustries' | 'visibilityCountries' | 'hidden' | 'deletedAt' | 'interactionLimitReached'
  >,
  viewer: Pick<Doc<'users'>, '_id' | 'industry' | 'country'>,
  author: Pick<Doc<'users'>, 'subscriptionStatus' | 'subscriptionEndsAt' | 'deletionScheduledAt' | 'isBanned'> | null,
  now: number
): void {
  // Interaction cap keeps its own message — a meaningful "this post is full" signal for the UI.
  if (post.interactionLimitReached) throw new ConvexError('This post has reached its interaction limit.')
  // Everything else the viewer isn't allowed to reach collapses to one generic "not available".
  if (post.hidden || post.deletedAt || !isPostVisibleToViewer(post, viewer, author, now)) {
    throw new ConvexError('This post is not available.')
  }
}

// Empty pagination page for unauthenticated/invalid sessions — the shape
// `usePaginatedQuery` expects so the client renders an empty feed, not an error.
const EMPTY_PAGE = { page: [], isDone: true, continueCursor: '' }

/** The token-stripped author projection `toFeedAuthor` returns (allow-list, see above). */
const feedAuthorValidator = v.object({
  _id: v.id('users'),
  name: v.string(),
  headline: v.optional(v.string()),
  profilePictureUrl: v.optional(v.string()),
  industry: v.optional(v.string()),
  country: v.optional(v.string()),
  tier: v.optional(v.union(v.literal('starter'), v.literal('growth'), v.literal('pro'), v.literal('contact')))
})

/** The per-viewer R21 done-state `toFeedViewerState` returns. */
const feedViewerStateValidator = v.object({
  reacted: v.boolean(),
  commented: v.boolean(),
  hidesAt: v.number()
})

/**
 * One enriched feed page item: the full `posts` document plus the two fields `fetchFeedPage`
 * attaches. Must cover the doc exactly — an extra field fails return validation at runtime and a
 * missing field fails typecheck.
 */
const feedItemValidator = v.object({
  _id: v.id('posts'),
  _creationTime: v.number(),
  linkedinPostUrn: v.string(),
  authorId: v.id('users'),
  content: v.string(),
  publishedAt: v.number(),
  likeCount: v.number(),
  commentCount: v.number(),
  mediaUrls: v.array(v.string()),
  imageUrls: v.optional(v.array(v.string())),
  isFeatured: v.boolean(),
  featuredAt: v.optional(v.number()),
  visibilityIndustries: v.array(v.string()),
  visibilityCountries: v.array(v.string()),
  hidden: v.boolean(),
  authorTierRank: v.optional(v.number()),
  interactionLimitReached: v.optional(v.boolean()),
  interactionCapBonus: v.optional(v.number()),
  featuredPurchase: v.optional(
    v.object({ checkoutSessionId: v.string(), amountCents: v.number(), paidAt: v.number() })
  ),
  sourceUrl: v.optional(v.string()),
  article: v.optional(articleValidator),
  deletedAt: v.optional(v.number()),
  feedRank: v.optional(v.number()),
  inFeed: v.optional(v.boolean()),
  suggestedReaction: v.optional(reactionValidator),
  author: v.union(feedAuthorValidator, v.null()),
  viewerState: v.union(feedViewerStateValidator, v.null())
})

export const getFeed = query({
  args: {
    paginationOpts: paginationOptsValidator,
    sessionToken: v.optional(v.string())
  },
  returns: paginationResultValidator(feedItemValidator),
  handler: async (ctx, { paginationOpts, sessionToken }) => {
    if (!sessionToken) return EMPTY_PAGE
    let viewer: Doc<'users'>
    try {
      viewer = await requireAuth(ctx, sessionToken)
    } catch {
      return EMPTY_PAGE
    }

    // Pro/Contact filter is a saved preference read straight off the viewer doc (set via
    // users.setFeedFilter). Patching it re-runs this query reactively — no client-supplied args.
    const filter = buildFeedFilter({
      tier: viewer.tier,
      industry: viewer.industry,
      country: viewer.country,
      filterIndustries: viewer.feedFilterIndustries,
      filterCountries: viewer.feedFilterCountries
    })

    return fetchFeedPage(ctx, viewer, { paginationOpts, filter, now: Date.now() })
  }
})

/**
 * Reads one page of the shared feed for `viewer` and applies every per-request filter. Split out
 * of the `getFeed` wrapper so the filtering is unit-testable with a mock `ctx` (the query wrapper
 * itself isn't callable in unit tests). The wrapper owns auth + tier→filter mapping; `now` is
 * passed in so the query stays deterministic per the wall-clock guideline.
 */
export async function fetchFeedPage(
  ctx: QueryCtx,
  viewer: Doc<'users'>,
  opts: { paginationOpts: Infer<typeof paginationOptsValidator>; filter: FeedFilter; now: number }
) {
  const { filter, now } = opts
  // Walk posts in feed order straight off the index: `inFeed === true` encodes the
  // hidden / stored interaction-limit / soft-delete filters, and descending `feedRank` yields
  // featured → author tier → recency (see lib/feedRank.ts). The cursor reads only one page.
  const numItems = Math.min(Math.max(1, opts.paginationOpts.numItems), MAX_FEED_PAGE)
  const result = await ctx.db
    .query('posts')
    .withIndex('by_in_feed_and_feed_rank', q => q.eq('inFeed', true))
    .order('desc')
    .paginate({ ...opts.paginationOpts, numItems })

  // Authors for THIS page only (≤ numItems). Fetched once, reused by the filters + enrichment.
  const uniqueAuthorIds = [...new Set(result.page.map(p => p.authorId))]
  const authors = await Promise.all(uniqueAuthorIds.map(id => ctx.db.get(id)))
  const authorMap = new Map(authors.filter((a): a is Doc<'users'> => a !== null).map(a => [a._id, a]))
  const authorCaps = new Map(
    await Promise.all(
      [...authorMap.values()].map(async author => {
        const limits = await getPlanLimitsHelper(ctx, author._id, author.tier ?? 'starter')
        return [author._id, limits.interactionsPerPost] as const
      })
    )
  )
  // Counts and plan changes can outpace the stored flag. Check the current author cap too.
  const underCapPosts = result.page.filter(post => {
    const cap = authorCaps.get(post.authorId)
    return (
      cap !== undefined &&
      !post.interactionLimitReached &&
      !hasReachedInteractionLimit(
        post.likeCount,
        post.commentCount,
        effectiveInteractionCap(cap, post.interactionCapBonus)
      )
    )
  })

  // backlog/R21 — the viewer's own state per post (one indexed point read each, ≤ numItems): a
  // post they handled stays for 24 h as a "done" card, then leaves their feed; "Hide now" makes it
  // leave at once. Per viewer only — nothing global changes, and the author still sees the post.
  const states = await Promise.all(
    underCapPosts.map(p =>
      ctx.db
        .query('userPostState')
        .withIndex('by_user_and_post', q => q.eq('userId', viewer._id).eq('postId', p._id))
        .unique()
    )
  )

  // Viewer-/author-dependent filters that can't live in the global index (plan §3c): the viewer's
  // own posts + visibility allowlists + author eligibility (shared with search via
  // isPostVisibleToViewer), then the viewer's tier-based industry/country filter, then the
  // per-viewer hygiene above. Pages may come back short (even empty) when these drop posts, while
  // `isDone` and the cursor still describe the unfiltered walk. The client contract: keep calling
  // `loadMore` while the page is empty and the status is CanLoadMore — an all-filtered page yields
  // no rows to scroll, so an auto-load keyed on the last rendered item never fires.
  const enriched = underCapPosts
    .map((post, i) => ({ post, state: states[i] }))
    .filter(({ post, state }) => {
      const author = authorMap.get(post.authorId) ?? null
      if (!isPostVisibleToViewer(post, viewer, author, now)) return false
      if (filter.applyIndustry && filter.industries.length > 0) {
        if (!author?.industry || !filter.industries.includes(author.industry)) return false
      }
      if (filter.applyCountry && filter.countries.length > 0) {
        if (!author?.country || !filter.countries.includes(author.country)) return false
      }
      return viewerPostStatus(state, now) !== 'gone'
    })
    .map(({ post, state }) => {
      const author = authorMap.get(post.authorId)
      const viewerState = toFeedViewerState(state)
      return author ? { ...post, author: toFeedAuthor(author), viewerState } : { ...post, author: null, viewerState }
    })

  // Preserve isDone + continueCursor from the index walk; only `page` is filtered/enriched.
  return { ...result, page: enriched }
}

/**
 * backlog/R21 — an empty feed page means one of two things: nothing exists yet (the R05 empty
 * state) or the viewer handled everything and it aged out (the caught-up state). "Interacted with
 * something in the last 24 h" tells them apart: older interactions have already left the feed and
 * prove nothing about today. Read by FeedPage only while the feed is empty.
 */
export const getCaughtUp = query({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, { sessionToken }) => {
    const viewer = await resolveSession(ctx, sessionToken)
    // A banned viewer gets EMPTY_PAGE from getFeed, so "caught up" would be a lie about a feed
    // they are not being shown at all.
    if (!viewer || viewer.isBanned) return { caughtUp: false }
    const latest = await ctx.db
      .query('userInteractions')
      .withIndex('by_user', q => q.eq('userId', viewer._id))
      .order('desc')
      .first()
    return { caughtUp: latest !== null && Date.now() - latest.createdAt < INTERACTED_TTL_MS }
  }
})
