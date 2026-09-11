// convex/jobs/processQueue.ts
// Daily post-queue drain: promotes queued posts to `posts` when an author gains capacity.
//
// Design:
// - Processes up to BATCH_SIZE queue rows per invocation (bounded transaction reads).
// - Uses by_author index to fetch each author's queued posts (no full-table JS grouping).
// - If the batch is full AND it made progress, schedules itself via runAfter(0); a full batch with
//   zero progress stops, letting the daily cron retry.
import { internalMutation } from '../_generated/server'
import { internal } from '../_generated/api'
import type { Id } from '../_generated/dataModel'
import { getPlanLimitsHelper, tierToRank } from '../lib/planLimits'
import { computeFeedFields } from '../lib/feedRank'
import { hasReachedInteractionLimit } from '../lib/interactionLimit'

const BATCH_SIZE = 100

// Exported for testing.
export function computeCapacity(recentCount: number, postsPerWeek: number): number {
  return Math.max(0, postsPerWeek - recentCount)
}

// Exported for testing. Reschedule a full batch only when it made progress; a full batch whose
// authors are all at their weekly cap would otherwise spin forever at runAfter(0).
export function shouldRescheduleQueue(batchFull: boolean, progressed: number): boolean {
  return batchFull && progressed > 0
}

export const processPostQueue = internalMutation({
  args: {},
  handler: async ctx => {
    // Take a bounded sample of queue rows to discover which authors have queued posts.
    const batch = await ctx.db.query('postQueue').take(BATCH_SIZE)
    if (batch.length === 0) return

    // Progress counter: rows actually promoted or deleted this invocation. Only a batch that made
    // progress may reschedule itself (see the tail) — a saturated queue head must not spin.
    let progressed = 0

    // Collect distinct authorIds from this batch
    const authorIds = [...new Set(batch.map(p => p.authorId as string))] as Array<Id<'users'>>
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000

    for (const authorId of authorIds) {
      const author = await ctx.db.get(authorId)

      if (!author) {
        // Author deleted — purge their queued posts
        const orphaned = await ctx.db
          .query('postQueue')
          .withIndex('by_author', q => q.eq('authorId', authorId))
          .take(BATCH_SIZE)
        for (const p of orphaned) {
          await ctx.db.delete(p._id)
          progressed++
        }
        continue
      }

      const tier = (author.tier ?? 'starter') as 'starter' | 'growth' | 'pro' | 'contact'
      const limits = await getPlanLimitsHelper(ctx, authorId, tier)

      // Count author's posts published in the last 7 days using the compound index
      const recentPosts = await ctx.db
        .query('posts')
        .withIndex('by_author_and_publishedAt', q => q.eq('authorId', authorId).gte('publishedAt', sevenDaysAgo))
        .take(limits.postsPerWeek)
      const recentCount = recentPosts.length

      const capacity = computeCapacity(recentCount, limits.postsPerWeek)
      if (capacity <= 0) continue

      // Fetch author's queued posts via index (bounded)
      const authorQueued = await ctx.db
        .query('postQueue')
        .withIndex('by_author', q => q.eq('authorId', authorId))
        .take(limits.postsPerWeek)

      // Promote oldest posts first (publishedAt ascending)
      const toPromote = [...authorQueued].sort((a, b) => a.publishedAt - b.publishedAt).slice(0, capacity)

      for (const queuedPost of toPromote) {
        // Dedup: skip if this URN was already promoted in a prior cron run
        const existingInPosts = await ctx.db
          .query('posts')
          .withIndex('by_urn', q => q.eq('linkedinPostUrn', queuedPost.linkedinPostUrn))
          .first()

        if (existingInPosts) {
          await ctx.db.delete(queuedPost._id)
          progressed++
          continue
        }

        const authorTierRank = tierToRank(author.tier)
        // Seed the interaction-cap flag from the queued engagement counts (Option A: total engagement
        // counts), consistent with upsertPost's insert — a queued post that already meets the cap is
        // promoted as interactionLimitReached ⇒ inFeed:false, so it never surfaces.
        const reached = hasReachedInteractionLimit(
          queuedPost.likeCount,
          queuedPost.commentCount,
          limits.interactionsPerPost
        )
        const feed = computeFeedFields({
          isFeatured: false,
          publishedAt: queuedPost.publishedAt,
          authorTierRank,
          hidden: queuedPost.hidden,
          interactionLimitReached: reached,
          deletedAt: undefined
        })
        await ctx.db.insert('posts', {
          linkedinPostUrn: queuedPost.linkedinPostUrn,
          authorId: queuedPost.authorId,
          content: queuedPost.content,
          publishedAt: queuedPost.publishedAt,
          likeCount: queuedPost.likeCount,
          commentCount: queuedPost.commentCount,
          mediaUrls: queuedPost.mediaUrls,
          isFeatured: false,
          // Copy the author's stored default visibility allowlists (backlog/B06). `author` was
          // fetched above via ctx.db.get(authorId) — absent/empty ⇒ visible to everyone.
          visibilityIndustries: author.defaultVisibilityIndustries ?? [],
          visibilityCountries: author.defaultVisibilityCountries ?? [],
          hidden: queuedPost.hidden,
          sourceUrl: queuedPost.sourceUrl,
          authorTierRank,
          interactionLimitReached: reached,
          ...feed
        })
        await ctx.db.delete(queuedPost._id)
        // One increment per promoted row (insert + delete are one unit of progress).
        progressed++
      }
    }

    // Reschedule only when this batch made progress; otherwise stop and let the daily cron retry.
    // Without this, a saturated queue head whose authors are all at their weekly cap spins forever.
    if (shouldRescheduleQueue(batch.length === BATCH_SIZE, progressed)) {
      await ctx.scheduler.runAfter(0, internal.jobs.processQueue.processPostQueue, {})
    }
  }
})
