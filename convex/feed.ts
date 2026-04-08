// convex/feed.ts
import { query } from './_generated/server'
import { v } from 'convex/values'
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


export const getFeed = query({
  args: {
    sessionToken: v.optional(v.string()),
    limit: v.optional(v.number()),
    filterIndustries: v.optional(v.array(v.string())),
    filterCountries: v.optional(v.array(v.string()))
  },
  handler: async (ctx, { sessionToken, limit = 20, filterIndustries, filterCountries }) => {
    if (!sessionToken) return { posts: [], hasMore: false }
    let viewer: Doc<'users'>
    try {
      viewer = await requireAuth(ctx, sessionToken)
    } catch {
      return { posts: [], hasMore: false }
    }

    const filter = buildFeedFilter({
      tier: viewer.tier,
      industry: viewer.industry,
      country: viewer.country,
      filterIndustries,
      filterCountries
    })

    // Fetch all visible posts sorted by publishedAt desc
    let allPosts = await ctx.db
      .query('posts')
      .withIndex('by_published', q => q.eq('hidden', false))
      .order('desc')
      .collect()

    // Filter out posts that have reached their interaction limit
    allPosts = allPosts.filter(post => post.interactionLimitReached !== true)

    // Apply post-level visibility restrictions (Pro author settings)
    allPosts = allPosts.filter(post => {
      if (post.visibilityIndustries.length > 0) {
        if (!viewer.industry || !post.visibilityIndustries.includes(viewer.industry)) return false
      }
      if (post.visibilityCountries.length > 0) {
        if (!viewer.country || !post.visibilityCountries.includes(viewer.country)) return false
      }
      return true
    })

    // Apply viewer-side industry filter (Growth/Pro)
    if (filter.applyIndustry && filter.industries.length > 0) {
      // Need author industries — fetch unique authors
      const uniqueAuthorIds = [...new Set(allPosts.map(p => p.authorId))]
      const authors = await Promise.all(uniqueAuthorIds.map(id => ctx.db.get(id)))
      const authorMap = new Map(authors.filter((a): a is Doc<'users'> => a !== null).map(a => [a._id, a]))
      allPosts = allPosts.filter(post => {
        const author = authorMap.get(post.authorId)
        return author?.industry && filter.industries.includes(author.industry)
      })
    }

    // Apply viewer-side country filter (Pro)
    if (filter.applyCountry && filter.countries.length > 0) {
      const uniqueAuthorIds = [...new Set(allPosts.map(p => p.authorId))]
      const authors = await Promise.all(uniqueAuthorIds.map(id => ctx.db.get(id)))
      const authorMap = new Map(authors.filter((a): a is Doc<'users'> => a !== null).map(a => [a._id, a]))
      allPosts = allPosts.filter(post => {
        const author = authorMap.get(post.authorId)
        return author?.country && filter.countries.includes(author.country)
      })
    }

    // Load all unique authors for sort scoring and trial filter
    const uniqueAllAuthorIds = [...new Set(allPosts.map(p => p.authorId))]
    const allAuthors = await Promise.all(uniqueAllAuthorIds.map(id => ctx.db.get(id)))
    const allAuthorMap = new Map(allAuthors.filter((a): a is Doc<'users'> => a !== null).map(a => [a._id, a]))

    // Filter out posts from trialing users
    allPosts = allPosts.filter(post => {
      const author = allAuthorMap.get(post.authorId)
      return author?.subscriptionStatus !== 'trialing'
    })

    // Sort: featured first (by publishedAt desc) → authorTierRank desc → publishedAt desc
    const featured = allPosts
      .filter(p => p.isFeatured)
      .sort((a, b) => b.publishedAt - a.publishedAt)

    const regular = allPosts
      .filter(p => !p.isFeatured)
      .sort((a, b) => {
        // Sort by authorTierRank desc (higher tier first), then publishedAt desc
        const rankDiff = (b.authorTierRank ?? 1) - (a.authorTierRank ?? 1)
        if (rankDiff !== 0) return rankDiff
        return b.publishedAt - a.publishedAt
      })

    const sorted = [...featured, ...regular]
    const paginated = sorted.slice(0, limit)
    const hasMore = sorted.length > limit

    // Enrich with author info (safe — no tokens returned)
    const enriched = await Promise.all(
      paginated.map(async post => {
        const author = allAuthorMap.get(post.authorId)
        if (!author) return { ...post, author: null }
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { linkedinAccessToken, linkedinRefreshToken, tokenExpiresAt, ...safeAuthor } = author
        return { ...post, author: safeAuthor }
      })
    )

    return { posts: enriched, hasMore }
  }
})
