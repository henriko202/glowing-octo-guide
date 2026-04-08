// convex/jobs/syncPosts.ts
import { internalAction, internalMutation } from '../_generated/server'
import { v } from 'convex/values'
import { internal } from '../_generated/api'
import { tierToRank } from '../lib/planLimits'

// Upsert a single post — inserts new, updates like/comment counts on existing
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
    sourceUrl: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('posts')
      .withIndex('by_urn', q => q.eq('linkedinPostUrn', args.linkedinPostUrn))
      .first()
    if (existing) {
      await ctx.db.patch(existing._id, {
        likeCount: args.likeCount,
        commentCount: args.commentCount,
        hidden: args.hidden
      })
      return existing._id
    } else {
      const author = await ctx.db.get(args.authorId)
      const authorTierRank = tierToRank(author?.tier ?? 'starter')

      return await ctx.db.insert('posts', {
        ...args,
        featuredAt: undefined,
        authorTierRank,
        interactionLimitReached: false
      })
    }
  }
})

// Fan-out action — checks if Apify sync is enabled, then delegates accordingly
export const syncAllPosts = internalAction({
  args: {},
  handler: async ctx => {
    // Check if Apify sync is enabled
    const settings = await ctx.runQuery(internal.admin.getSettingsInternal, {})

    if ((settings as Record<string, unknown> | null)?.apifySyncEnabled) {
      // Delegate to Apify-based sync
      await ctx.runAction(internal.jobs.syncPostsApify.syncAllPostsViaApify, {})
      return
    }
  }
})
