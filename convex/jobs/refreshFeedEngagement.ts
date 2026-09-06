// Refresh like/comment COUNTS on every feed-eligible post via ONE batched Apify run, every 30 min.
// Dev/local only: isApifyPostSyncEnabled gates it, so prod (Apify dormant at launch — see docs
// §16 / lib/apify.ts) is never scraped. Counts only — scrapeComments/scrapeReactions stay off.
import { internalActionGeneric as internalAction } from 'convex/server'
import { internal } from '../_generated/api.js'
import type { ActionCtx } from '../_generated/server'
import type { Id } from '../_generated/dataModel'
import { isApifyPostSyncEnabled, runApifyTask } from '../lib/apify.js' // Only the fields we read from the (much larger) profile-posts scraper payload.

// Only the fields we read from the (much larger) profile-posts scraper payload.
interface ApifyPostResult {
  type: string
  shareUrn: string
  engagement?: { likes?: number; comments?: number }
}

export interface EngagementUpdate {
  postId: Id<'posts'>
  likeCount: number
  commentCount: number
}

// The URL we hand Apify for one feed post: prefer the stored, validated post URL; otherwise
// reconstruct the feed-update URL from the URN. The actor accepts both /posts/… and
// /feed/update/urn:li:activity:{id}/ forms in targetUrls. Pure + exported for test.
export function postScrapeUrl(post: { sourceUrl?: string; linkedinPostUrn: string }): string {
  return post.sourceUrl ?? `https://www.linkedin.com/feed/update/${post.linkedinPostUrn}/`
}

// Match scraped results back to our posts by URN and produce the count patches.
// Design decision (counts integrity): a returned item with NO engagement object means the scrape
// didn't read engagement for it — we skip it rather than overwrite real counts with 0. Flip the
// guard to `?? 0` if you'd rather treat "not returned" as zero. Non-post items and unmatched URNs
// are dropped. Pure + exported so this is unit-testable without an Apify/ctx mock.
export function buildEngagementUpdates(
  items: ApifyPostResult[],
  idByUrn: Map<string, Id<'posts'>>
): EngagementUpdate[] {
  const updates: EngagementUpdate[] = []
  for (const item of items) {
    if (item.type !== 'post' || !item.shareUrn) continue
    const postId = idByUrn.get(item.shareUrn)
    if (!postId) continue
    if (item.engagement?.likes === undefined && item.engagement?.comments === undefined) continue
    updates.push({
      postId,
      likeCount: item.engagement?.likes ?? 0,
      commentCount: item.engagement?.comments ?? 0
    })
  }
  return updates
}

export const refreshFeedEngagement = internalAction({
  args: {},
  handler: async (ctx): Promise<void> => {
    const actionCtx = ctx as unknown as ActionCtx
    const token = process.env.APIFY_API_TOKEN
    const actorId = process.env.APIFY_TASK_ID
    if (!token || !actorId) {
      console.error('APIFY_API_TOKEN or APIFY_TASK_ID not configured')
      return
    }

    const settings = await actionCtx.runQuery(internal.admin.getSettingsInternal, {})
    if (!isApifyPostSyncEnabled(settings)) {
      console.log('[Apify] Feed engagement refresh disabled — skipping')
      return
    }

    const posts = await actionCtx.runQuery(internal.jobs.syncPosts.getFeedPostsForRefresh, {})
    if (!posts.length) return

    // One blocking run for the whole feed. ponytail: run-sync blocks until the actor finishes, so a
    // very large feed could overrun the 30-min tick — chunk targetUrls if a real feed ever gets big.
    const items = (await runApifyTask(actorId, token, {
      includeQuotePosts: false,
      includeReposts: false,
      maxPosts: 1,
      scrapeComments: false,
      scrapeReactions: false,
      targetUrls: posts.map(postScrapeUrl)
    })) as ApifyPostResult[] | undefined

    if (!items?.length) {
      return console.log('[Apify] Feed engagement refresh: no items returned')
    }

    const idByUrn = new Map<string, Id<'posts'>>(posts.map(p => [p.linkedinPostUrn, p._id]))
    const updates = buildEngagementUpdates(items, idByUrn)

    console.log(`[Apify] Feed engagement refresh: ${updates.length}/${posts.length} posts matched & updated`)
    if (updates.length) {
      await actionCtx.runMutation(internal.jobs.syncPosts.applyEngagementCounts, { updates })
    }
  }
})
