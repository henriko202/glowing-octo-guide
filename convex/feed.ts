// convex/feed.ts
import { queryGeneric as query } from "convex/server";
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
    filterIndustries: v.optional(v.array(v.string())),
    filterCountries: v.optional(v.array(v.string())),
  },
  handler: async (ctx: any, { limit = 20, filterIndustries, filterCountries }: { limit?: number; filterIndustries?: string[]; filterCountries?: string[] }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return { posts: [], hasMore: false };

    const viewer = await ctx.db
      .query("users")
      .withIndex("by_linkedin_id", (q: any) => q.eq("linkedinId", identity.subject))
      .first();
    if (!viewer) return { posts: [], hasMore: false };

    const filter = buildFeedFilter({
      tier: viewer.tier,
      industry: viewer.industry,
      country: viewer.country,
      filterIndustries,
      filterCountries,
    });

    // Fetch all visible posts sorted by publishedAt desc
    let allPosts = await ctx.db
      .query("posts")
      .withIndex("by_published", (q: any) => q.eq("hidden", false))
      .order("desc")
      .collect();

    // Apply post-level visibility restrictions (Pro author settings)
    allPosts = allPosts.filter((post: any) => {
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
      const authorIdStrings = [...new Set<string>(allPosts.map((p: any) => p.authorId as unknown as string))];
      const authorIdMap = new Map<string, any>(allPosts.map((p: any) => [p.authorId as unknown as string, p.authorId]));
      const uniqueAuthorIds = authorIdStrings.map((s) => authorIdMap.get(s)!);
      const authors = await Promise.all(uniqueAuthorIds.map((id: any) => ctx.db.get(id)));
      const authorMap = new Map<string, any>(authors.filter(Boolean).map((a: any) => [a!._id as unknown as string, a!]));
      allPosts = allPosts.filter((post: any) => {
        const author = authorMap.get(post.authorId as unknown as string);
        return author?.industry && filter.industries.includes(author.industry);
      });
    }

    // Apply viewer-side country filter (Pro)
    if (filter.applyCountry && filter.countries.length > 0) {
      const authorIdStrings = [...new Set<string>(allPosts.map((p: any) => p.authorId as unknown as string))];
      const authorIdMap = new Map<string, any>(allPosts.map((p: any) => [p.authorId as unknown as string, p.authorId]));
      const uniqueAuthorIds = authorIdStrings.map((s) => authorIdMap.get(s)!);
      const authors = await Promise.all(uniqueAuthorIds.map((id: any) => ctx.db.get(id)));
      const authorMap = new Map<string, any>(authors.filter(Boolean).map((a: any) => [a!._id as unknown as string, a!]));
      allPosts = allPosts.filter((post: any) => {
        const author = authorMap.get(post.authorId as unknown as string);
        return author?.country && filter.countries.includes(author.country);
      });
    }

    // Load viewer's cached connection IDs for sort scoring
    const connCache = await ctx.db
      .query("userConnections")
      .withIndex("by_user", (q: any) => q.eq("userId", viewer._id))
      .first();
    const mutualLinkedinIds = new Set<string>(connCache?.connectionLinkedinIds ?? []);

    // Load all unique authors for sort scoring
    const allAuthorIdStrings = [...new Set<string>(allPosts.map((p: any) => p.authorId as unknown as string))];
    const allAuthorIdMap = new Map<string, any>(allPosts.map((p: any) => [p.authorId as unknown as string, p.authorId]));
    const uniqueAllAuthorIds = allAuthorIdStrings.map((s) => allAuthorIdMap.get(s)!);
    const allAuthors = await Promise.all(uniqueAllAuthorIds.map((id: any) => ctx.db.get(id)));
    const allAuthorMap = new Map<string, any>(allAuthors.filter(Boolean).map((a: any) => [a!._id as unknown as string, a!]));

    // Sort: featured first (by featuredAt desc) → score (mutual/industry/country) → publishedAt desc
    const featured = allPosts
      .filter((p: any) => p.isFeatured)
      .sort((a: any, b: any) => (b.featuredAt ?? 0) - (a.featuredAt ?? 0));

    const regular = allPosts
      .filter((p: any) => !p.isFeatured)
      .sort((a: any, b: any) => {
        const aAuthor = allAuthorMap.get(a.authorId as unknown as string) ?? null;
        const bAuthor = allAuthorMap.get(b.authorId as unknown as string) ?? null;
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
      paginated.map(async (post: any) => {
        const author = allAuthorMap.get(post.authorId as unknown as string);
        if (!author) return { ...post, author: null };
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { linkedinAccessToken, linkedinRefreshToken, tokenExpiresAt, ...safeAuthor } = author as any;
        return { ...post, author: safeAuthor };
      })
    );

    return { posts: enriched, hasMore };
  },
});
