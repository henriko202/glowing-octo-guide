// convex/jobs/syncPosts.ts
import { internalAction, internalMutation, internalQuery } from '../_generated/server'
import { v } from 'convex/values'
import { internal } from '../_generated/api'
import { getPlanLimitsHelper, tierToRank } from '../lib/planLimits'
import { computeFeedFields } from '../lib/feedRank'
import { type ApifyFlags, isApifyPostSyncEnabled } from '../lib/apify'
import { articleValidator } from '../lib/articleValidator'
import { isWeeklyLimitReached } from '../lib/postLimit'

// Upsert a single post — inserts new, updates like/comment counts on existing.
// On insert, performs an atomic weekly-limit check within this transaction.
// If the limit is reached and queueOnLimitReached is true, routes to postQueue instead.
// Returns `created: true` only on a genuine insert, so callers can schedule follow-up work
// (e.g. AI reaction prediction — backlog/B09) exactly once per post, never on a re-sync.
export const upsertPost = internalMutation({
  args: {
    linkedinPostUrn: v.string(),
    authorId: v.id('users'),
    content: v.string(),
    publishedAt: v.number(),
    likeCount: v.number(),
    commentCount: v.number(),
    mediaUrls: v.array(v.string()),
    imageUrls: v.optional(v.array(v.string())),
    isFeatured: v.boolean(),
    visibilityIndustries: v.array(v.string()),
    visibilityCountries: v.array(v.string()),
    hidden: v.boolean(),
    sourceUrl: v.optional(v.string()),
    // Best-effort article enrichment from the manual-submit path (absent on the Apify path).
    article: v.optional(articleValidator),
    queueOnLimitReached: v.optional(v.boolean())
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('posts')
      .withIndex('by_urn', q => q.eq('linkedinPostUrn', args.linkedinPostUrn))
      .first()

    if (existing) {
      // Update branch — never checks limits; only updates engagement counts.
      // `hidden` can change here (e.g. a re-sync after activation), so refresh the
      // denormalized feed fields from the existing post + the incoming hidden flag.
      const feed = computeFeedFields({
        isFeatured: existing.isFeatured,
        publishedAt: existing.publishedAt,
        authorTierRank: existing.authorTierRank,
        hidden: args.hidden,
        interactionLimitReached: existing.interactionLimitReached,
        deletedAt: existing.deletedAt
      })
      await ctx.db.patch(existing._id, {
        likeCount: args.likeCount,
        commentCount: args.commentCount,
        hidden: args.hidden,
        ...feed
      })
      return { postId: existing._id, created: false }
    }

    // Insert branch — atomic weekly-limit check (all reads+write in one transaction)
    const author = await ctx.db.get(args.authorId)
    const tier = (author?.tier ?? 'starter') as 'starter' | 'growth' | 'pro' | 'contact'
    const limits = await getPlanLimitsHelper(ctx, args.authorId, tier)

    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
    const recentPosts = await ctx.db
      .query('posts')
      .withIndex('by_author_and_publishedAt', q => q.eq('authorId', args.authorId).gte('publishedAt', sevenDaysAgo))
      .take(limits.postsPerWeek)
    const recentCount = recentPosts.length

    if (isWeeklyLimitReached(recentCount, limits.postsPerWeek)) {
      if (args.queueOnLimitReached) {
        // Apify path: route to postQueue (dedup by URN)
        const existingInQueue = await ctx.db
          .query('postQueue')
          .withIndex('by_urn', q => q.eq('linkedinPostUrn', args.linkedinPostUrn))
          .first()
        if (!existingInQueue) {
          await ctx.db.insert('postQueue', {
            linkedinPostUrn: args.linkedinPostUrn,
            authorId: args.authorId,
            content: args.content,
            publishedAt: args.publishedAt,
            likeCount: args.likeCount,
            commentCount: args.commentCount,
            mediaUrls: args.mediaUrls,
            hidden: args.hidden,
            sourceUrl: args.sourceUrl,
            queuedAt: Date.now()
          })
        }
        return { postId: null, created: false }
      }
      throw new Error(
        `Weekly post limit reached. Your plan allows ${limits.postsPerWeek} post${limits.postsPerWeek === 1 ? '' : 's'} per week.`
      )
    }

    const authorTierRank = tierToRank(author?.tier ?? 'starter')
    // Destructure out queueOnLimitReached so it is never stored on the post
    const { queueOnLimitReached: _queueOnLimitReached, ...postArgs } = args
    const feed = computeFeedFields({
      isFeatured: postArgs.isFeatured,
      publishedAt: postArgs.publishedAt,
      authorTierRank,
      hidden: postArgs.hidden,
      interactionLimitReached: false,
      deletedAt: undefined
    })
    const postId = await ctx.db.insert('posts', {
      ...postArgs,
      featuredAt: undefined,
      authorTierRank,
      interactionLimitReached: false,
      ...feed
    })
    return { postId, created: true }
  }
})

// Fan-out action — checks if Apify sync is enabled, then delegates accordingly
export const syncAllPosts = internalAction({
  args: {},
  handler: async ctx => {
    const settings = await ctx.runQuery(internal.admin.getSettingsInternal, {})

    // Honor the master kill-switch here too (the delegate re-checks, but gating early
    // avoids an unnecessary action hop when Apify is disabled).
    if (isApifyPostSyncEnabled(settings as ApifyFlags)) {
      await ctx.runAction(internal.jobs.syncPostsApify.syncAllPostsViaApify, {})
      return
    }
  }
})

// ─── Feed engagement refresh (30-min cron) ────────────────────────────────────

// Feed-eligible posts for the 30-min Apify engagement refresh. `inFeed === true` is the same
// structural gate the feed itself walks (not hidden / not interaction-capped / not soft-deleted),
// so this returns exactly "all posts visible in the feed" minus per-viewer filters. Only the fields
// the refresh needs: the URN to match scraped results back, and the URL to scrape.
// ponytail: .take(500) bound — dev feeds are tiny; paginate only if a feed ever exceeds this.
export const getFeedPostsForRefresh = internalQuery({
  args: {},
  handler: async ctx => {
    const posts = await ctx.db
      .query('posts')
      .withIndex('by_feed_rank', q => q.eq('inFeed', true))
      .take(500)
    return posts.map(p => ({ _id: p._id, linkedinPostUrn: p.linkedinPostUrn, sourceUrl: p.sourceUrl }))
  }
})

// Patch like/comment COUNTS on a batch of existing feed posts (the 30-min refresh). Counts-only,
// exactly like upsertPost's update branch: interactionLimitReached is intentionally NOT re-evaluated
// from external LinkedIn engagement — only in-app interactions trip that gate, so the two sync paths
// stay consistent. Skips any id that vanished between the query and this write.
export const applyEngagementCounts = internalMutation({
  args: {
    updates: v.array(v.object({ postId: v.id('posts'), likeCount: v.number(), commentCount: v.number() }))
  },
  handler: async (ctx, { updates }) => {
    for (const u of updates) {
      const post = await ctx.db.get(u.postId)
      if (!post) continue
      await ctx.db.patch(u.postId, { likeCount: u.likeCount, commentCount: u.commentCount })
    }
  }
})
