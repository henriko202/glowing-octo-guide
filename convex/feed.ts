// convex/feed.ts
import { query, type QueryCtx } from './_generated/server'
import { type Infer, v } from 'convex/values'
import { paginationOptsValidator } from 'convex/server'
import type { Doc } from './_generated/dataModel'
import { requireAuth } from './lib/auth'

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
 * mutation) and authors pending account deletion (their content disappears the moment they request
 * erasure, and reappears if they cancel). Trialing authors ARE eligible: they hold a card-backed
 * Growth trial (Task 4 / Plan 2B) so their posts belong in the feed (reciprocity).
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

// Empty pagination page for unauthenticated/invalid sessions — the shape
// `usePaginatedQuery` expects so the client renders an empty feed, not an error.
const EMPTY_PAGE = { page: [], isDone: true, continueCursor: '' }

export const getFeed = query({
  args: {
    paginationOpts: paginationOptsValidator,
    sessionToken: v.optional(v.string())
  },
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
  // Walk posts in feed order straight off the index: `inFeed === true` already encodes the
  // hidden / interaction-limit / soft-delete filters, and descending `feedRank` yields
  // featured → author tier → recency (see lib/feedRank.ts). The cursor reads only one page.
  const numItems = Math.min(Math.max(1, opts.paginationOpts.numItems), MAX_FEED_PAGE)
  const result = await ctx.db
    .query('posts')
    .withIndex('by_feed_rank', q => q.eq('inFeed', true))
    .order('desc')
    .paginate({ ...opts.paginationOpts, numItems })

  // Authors for THIS page only (≤ numItems). Fetched once, reused by the filters + enrichment.
  const uniqueAuthorIds = [...new Set(result.page.map(p => p.authorId))]
  const authors = await Promise.all(uniqueAuthorIds.map(id => ctx.db.get(id)))
  const authorMap = new Map(authors.filter((a): a is Doc<'users'> => a !== null).map(a => [a._id, a]))

  // Viewer-/author-dependent filters that can't live in the global index (plan §3c): the viewer's
  // own posts + visibility allowlists + author eligibility (shared with search via
  // isPostVisibleToViewer), then the viewer's tier-based industry/country filter. Pages may come
  // back short when these drop posts — `usePaginatedQuery` just loads more.
  const enriched = result.page
    .filter(post => {
      const author = authorMap.get(post.authorId) ?? null
      if (!isPostVisibleToViewer(post, viewer, author, now)) return false
      if (filter.applyIndustry && filter.industries.length > 0) {
        if (!author?.industry || !filter.industries.includes(author.industry)) return false
      }
      if (filter.applyCountry && filter.countries.length > 0) {
        if (!author?.country || !filter.countries.includes(author.country)) return false
      }
      return true
    })
    .map(post => {
      const author = authorMap.get(post.authorId)
      return author ? { ...post, author: toFeedAuthor(author) } : { ...post, author: null }
    })

  // Preserve isDone + continueCursor from the index walk; only `page` is filtered/enriched.
  return { ...result, page: enriched }
}
