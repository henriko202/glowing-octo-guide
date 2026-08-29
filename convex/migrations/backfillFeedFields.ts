import { internalMutation } from '../_generated/server'
import { internal } from '../_generated/api'
import { v } from 'convex/values'
import { computeFeedFields } from '../lib/feedRank'
import { tierToRank } from '../lib/planLimits'

// One-time backfill for the feed cursor-pagination rollout (see schema.ts's posts.feedRank/inFeed
// comments and docs/feed-cursor-pagination-plan.md). Stamps `feedRank` + `inFeed` on every post
// using the SAME `computeFeedFields` helper every live writer already calls (jobs/syncPosts.ts,
// posts.ts setPostHidden/deletePost, lib/feedRank.ts's tier restamp) — so the backfill can never
// drift from the ranking formula.
//
// Run once via the Convex dashboard or CLI:
//   npx convex run migrations/backfillFeedFields:backfillFeedFields --prod
//
// Batched + self-rescheduling (mirrors convex/privacy/retention.ts's page pattern) so it never
// `.collect()`s the posts table. Unconditionally re-stamps every row rather than filtering for
// missing fields first — cheaper to reason about, and safe/idempotent to re-run.
//
// ponytail: pre-launch there is no prod data, so this is currently a no-op (dev is disposable and
// could just be wiped instead). It's written now so it exists before the first real posts land, and
// so any future bulk-import path that bypasses the live writers is covered. Narrowing the schema's
// feedRank/inFeed from v.optional to required is a separate future item, out of scope here.
const BACKFILL_BATCH = 100

export const backfillFeedFields = internalMutation({
  args: { cursor: v.optional(v.union(v.string(), v.null())) },
  handler: async (ctx, { cursor }) => {
    const page = await ctx.db.query('posts').paginate({ numItems: BACKFILL_BATCH, cursor: cursor ?? null })

    for (const post of page.page) {
      let authorTierRank = post.authorTierRank
      if (authorTierRank === undefined) {
        // Hard-deleted / missing author falls back to starter rank rather than throwing.
        const author = await ctx.db.get(post.authorId)
        authorTierRank = tierToRank(author?.tier ?? 'starter')
      }
      const feed = computeFeedFields({
        isFeatured: post.isFeatured,
        publishedAt: post.publishedAt,
        authorTierRank,
        hidden: post.hidden,
        interactionLimitReached: post.interactionLimitReached,
        deletedAt: post.deletedAt
      })
      await ctx.db.patch(post._id, { authorTierRank, ...feed })
    }

    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, internal.migrations.backfillFeedFields.backfillFeedFields, {
        cursor: page.continueCursor
      })
    }
  }
})
