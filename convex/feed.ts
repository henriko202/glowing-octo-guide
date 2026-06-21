// convex/feed.ts
import { query } from './_generated/server'
import { v } from 'convex/values'
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
 * Author eligibility for the shared feed. Excludes authors pending account deletion (their
 * content disappears from the feed the moment they request erasure, and reappears automatically
 * if they cancel — no post mutation needed). Trialing authors ARE eligible: they hold a
 * card-backed Growth trial (Task 4 / Plan 2B) so their posts belong in the feed (reciprocity).
 */
export function isAuthorFeedEligible(
  author: { subscriptionStatus?: string; deletionScheduledAt?: number } | null
): boolean {
  if (!author) return false
  if (author.deletionScheduledAt) return false
  return true
}

// Empty pagination page for unauthenticated/invalid sessions — the shape
// `usePaginatedQuery` expects so the client renders an empty feed, not an error.
const EMPTY_PAGE = { page: [], isDone: true, continueCursor: '' }

export const getFeed = query({
  args: {
    paginationOpts: paginationOptsValidator,
    sessionToken: v.optional(v.string()),
    filterIndustries: v.optional(v.array(v.string())),
    filterCountries: v.optional(v.array(v.string()))
  },
  handler: async (ctx, { paginationOpts, sessionToken, filterIndustries, filterCountries }) => {
    if (!sessionToken) return EMPTY_PAGE
    let viewer: Doc<'users'>
    try {
      viewer = await requireAuth(ctx, sessionToken)
    } catch {
      return EMPTY_PAGE
    }

    const filter = buildFeedFilter({
      tier: viewer.tier,
      industry: viewer.industry,
      country: viewer.country,
      filterIndustries,
      filterCountries
    })

    // Walk posts in feed order straight off the index: `inFeed === true` already encodes the
    // hidden / interaction-limit / soft-delete filters, and descending `feedRank` yields
    // featured → author tier → recency (see lib/feedRank.ts). The cursor reads only one page.
    const numItems = Math.min(Math.max(1, paginationOpts.numItems), MAX_FEED_PAGE)
    const result = await ctx.db
      .query('posts')
      .withIndex('by_feed_rank', q => q.eq('inFeed', true))
      .order('desc')
      .paginate({ ...paginationOpts, numItems })

    // Authors for THIS page only (≤ numItems). Fetched once, reused by the filters + enrichment.
    const uniqueAuthorIds = [...new Set(result.page.map(p => p.authorId))]
    const authors = await Promise.all(uniqueAuthorIds.map(id => ctx.db.get(id)))
    const authorMap = new Map(authors.filter((a): a is Doc<'users'> => a !== null).map(a => [a._id, a]))

    // Viewer-/author-dependent filters that can't live in the global index (plan §3c):
    // post visibility allowlists, author eligibility (trialing / pending deletion), and the
    // viewer's industry/country filters. Pages may come back short when these drop posts —
    // `usePaginatedQuery` just loads more.
    const enriched = result.page
      .filter(post => {
        if (post.visibilityIndustries.length > 0) {
          if (!viewer.industry || !post.visibilityIndustries.includes(viewer.industry)) return false
        }
        if (post.visibilityCountries.length > 0) {
          if (!viewer.country || !post.visibilityCountries.includes(viewer.country)) return false
        }
        const author = authorMap.get(post.authorId)
        if (!isAuthorFeedEligible(author ?? null)) return false
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
})
