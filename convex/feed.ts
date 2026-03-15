// convex/feed.ts
import { query } from "convex/server";
import { v } from "convex/values";

type FeedFilterParams = {
  tier: string;
  industry?: string;
  country?: string;
  filterIndustries?: string[];
  filterCountries?: string[];
};

export type FeedFilter = {
  applyIndustry: boolean;
  applyCountry: boolean;
  industries: string[];
  countries: string[];
};

export function buildFeedFilter(params: FeedFilterParams): FeedFilter {
  if (params.tier === "growth") {
    return {
      applyIndustry: true,
      applyCountry: true,
      industries: params.industry ? [params.industry] : [],
      countries: params.country ? [params.country] : [],
    };
  }
  if (params.tier === "pro" || params.tier === "contact") {
    const industries = params.filterIndustries ?? [];
    const countries = params.filterCountries ?? [];
    return {
      applyIndustry: industries.length > 0,
      applyCountry: countries.length > 0,
      industries,
      countries,
    };
  }
  // starter: no filters
  return {
    applyIndustry: false,
    applyCountry: false,
    industries: [],
    countries: [],
  };
}

// Sort score for non-featured posts (higher = shown earlier)
function postSortScore(
  author: { linkedinId: string; industry?: string; country?: string } | null,
  viewer: { industry?: string; country?: string },
  mutualLinkedinIds: Set<string>
): number {
  if (!author) return 0;
  if (mutualLinkedinIds.has(author.linkedinId)) return 3;
  if (author.industry && author.industry === viewer.industry) return 2;
  if (author.country && author.country === viewer.country) return 1;
  return 0;
}

export const getFeed = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { limit = 20 }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return { posts: [], hasMore: false };

    const viewer = await ctx.db
      .query("users")
      .withIndex("by_linkedin_id", (q) => q.eq("linkedinId", identity.subject))
      .first();
    if (!viewer) return { posts: [], hasMore: false };

    const filter = buildFeedFilter({
      tier: viewer.tier,
      industry: viewer.industry,
      country: viewer.country,
    });

    // Fetch all visible posts sorted by publishedAt desc
    let allPosts = await ctx.db
      .query("posts")
      .withIndex("by_published", (q) => q.eq("hidden", false))
      .order("desc")
      .collect();

    // Apply post-level visibility restrictions (Pro author settings)
    allPosts = allPosts.filter((post) => {
      if (post.visibilityIndustries.length > 0) {
        if (!viewer.industry || !post.visibilityIndustries.includes(viewer.industry)) return false;
      }
      if (post.visibilityCountries.length > 0) {
        if (!viewer.country || !post.visibilityCountries.includes(viewer.country)) return false;
      }
      return true;
    });

    // Apply viewer-side industry filter (Growth/Pro)
    if (filter.applyIndustry && filter.industries.length > 0) {
      // Need author industries — fetch unique authors
      const authorIds = [...new Set(allPosts.map((p) => p.authorId.toString()))];
      const authors = await Promise.all(authorIds.map((id) => ctx.db.get(id as any)));
      const authorMap = new Map(authors.filter(Boolean).map((a) => [a!._id.toString(), a!]));
      allPosts = allPosts.filter((post) => {
        const author = authorMap.get(post.authorId.toString());
        return author?.industry && filter.industries.includes(author.industry);
      });
    }

    // Apply viewer-side country filter (Pro)
    if (filter.applyCountry && filter.countries.length > 0) {
      const authorIds = [...new Set(allPosts.map((p) => p.authorId.toString()))];
      const authors = await Promise.all(authorIds.map((id) => ctx.db.get(id as any)));
      const authorMap = new Map(authors.filter(Boolean).map((a) => [a!._id.toString(), a!]));
      allPosts = allPosts.filter((post) => {
        const author = authorMap.get(post.authorId.toString());
        return author?.country && filter.countries.includes(author.country);
      });
    }

    // Load viewer's cached connection IDs for sort scoring
    const connCache = await ctx.db
      .query("userConnections")
      .withIndex("by_user", (q) => q.eq("userId", viewer._id))
      .first();
    const mutualLinkedinIds = new Set(connCache?.connectionLinkedinIds ?? []);

    // Load all unique authors for sort scoring
    const allAuthorIds = [...new Set(allPosts.map((p) => p.authorId.toString()))];
    const allAuthors = await Promise.all(allAuthorIds.map((id) => ctx.db.get(id as any)));
    const allAuthorMap = new Map(allAuthors.filter(Boolean).map((a) => [a!._id.toString(), a!]));

    // Sort: featured first (by featuredAt desc) → score (mutual/industry/country) → publishedAt desc
    const featured = allPosts
      .filter((p) => p.isFeatured)
      .sort((a, b) => (b.featuredAt ?? 0) - (a.featuredAt ?? 0));

    const regular = allPosts
      .filter((p) => !p.isFeatured)
      .sort((a, b) => {
        const aAuthor = allAuthorMap.get(a.authorId.toString()) ?? null;
        const bAuthor = allAuthorMap.get(b.authorId.toString()) ?? null;
        const scoreDiff =
          postSortScore(bAuthor, viewer, mutualLinkedinIds) -
          postSortScore(aAuthor, viewer, mutualLinkedinIds);
        if (scoreDiff !== 0) return scoreDiff;
        return b.publishedAt - a.publishedAt;
      });

    const sorted = [...featured, ...regular];
    const paginated = sorted.slice(0, limit);
    const hasMore = sorted.length > limit;

    // Enrich with author info (safe — no tokens returned)
    const enriched = await Promise.all(
      paginated.map(async (post) => {
        const author = allAuthorMap.get(post.authorId.toString());
        if (!author) return { ...post, author: null };
        const { linkedinAccessToken, linkedinRefreshToken, tokenExpiresAt, ...safeAuthor } = author as any;
        return { ...post, author: safeAuthor };
      })
    );

    return { posts: enriched, hasMore };
  },
});
