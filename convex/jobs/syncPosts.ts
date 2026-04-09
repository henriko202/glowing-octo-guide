// convex/jobs/syncPosts.ts
import { internalAction, internalMutation } from '../_generated/server'
import { v } from 'convex/values'
import { internal } from '../_generated/api'
import { getPlanLimitsHelper, tierToRank } from '../lib/planLimits'

// Upsert a single post — inserts new, updates like/comment counts on existing.
// On insert, performs an atomic weekly-limit check within this transaction.
// If the limit is reached and queueOnLimitReached is true, routes to postQueue instead.
export const upsertPost = internalMutation({
  args: {
    linkedinPostUrn: v.string(),
    authorId: v.id('users'),
    content: v.string(),
    publishedAt: v.number(),
    likeCount: v.number(),
    commentCount: v.number(),
    mediaUrls: v.array(v.string()),
    isFeatured: v.boolean(),
    visibilityIndustries: v.array(v.string()),
    visibilityCountries: v.array(v.string()),
    hidden: v.boolean(),
    sourceUrl: v.optional(v.string()),
    queueOnLimitReached: v.optional(v.boolean())
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('posts')
      .withIndex('by_urn', q => q.eq('linkedinPostUrn', args.linkedinPostUrn))
      .first()

    if (existing) {
      // Update branch — never checks limits; only updates engagement counts
      await ctx.db.patch(existing._id, {
        likeCount: args.likeCount,
        commentCount: args.commentCount,
        hidden: args.hidden
      })
      return existing._id
    }

    // Insert branch — atomic weekly-limit check (all reads+write in one transaction)
    const author = await ctx.db.get(args.authorId)
    const tier = (author?.tier ?? 'starter') as 'starter' | 'growth' | 'pro' | 'contact'
    const limits = await getPlanLimitsHelper(ctx, args.authorId, tier)

    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
    const recentPosts = await ctx.db
      .query('posts')
      .withIndex('by_author_and_publishedAt', q =>
        q.eq('authorId', args.authorId).gte('publishedAt', sevenDaysAgo))
      .take(limits.postsPerWeek)
    const recentCount = recentPosts.length

    if (recentCount >= limits.postsPerWeek) {
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
        return null
      }
      throw new Error(
        `Weekly post limit reached. Your plan allows ${limits.postsPerWeek} post${limits.postsPerWeek === 1 ? '' : 's'} per week.`
      )
    }

    const authorTierRank = tierToRank(author?.tier ?? 'starter')
    // Destructure out queueOnLimitReached so it is never stored on the post
    const { queueOnLimitReached: _queueOnLimitReached, ...postArgs } = args
    return await ctx.db.insert('posts', {
      ...postArgs,
      featuredAt: undefined,
      authorTierRank,
      interactionLimitReached: false
    })
  }
})

// Fan-out action — checks if Apify sync is enabled, then delegates accordingly
export const syncAllPosts = internalAction({
  args: {},
  handler: async ctx => {
    const settings = await ctx.runQuery(internal.admin.getSettingsInternal, {})

    if ((settings as Record<string, unknown> | null)?.apifySyncEnabled) {
      await ctx.runAction(internal.jobs.syncPostsApify.syncAllPostsViaApify, {})
      return
    }
  }
})
