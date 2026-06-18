// Apify post sync via REST API (no SDK — avoids proxy-agent/native module issues in Convex runtime)
import { internalActionGeneric as internalAction } from 'convex/server'
import { v } from 'convex/values'
import { internal } from '../_generated/api.js'
import type { ActionCtx } from '../_generated/server'
import type { Id } from '../_generated/dataModel'
import { isApifyPostSyncEnabled, runApifyTask } from '../lib/apify.js'

// ─── Types for Apify LinkedIn post scraper output ────────────────────────────

interface ApifyPostResult {
  type: string
  id: string
  linkedinUrl: string
  shareUrn: string
  content: string
  author: {
    publicIdentifier: string
    name: string
    linkedinUrl: string
  }
  postedAt: {
    timestamp: number
    date: string
  }
  postImages: Array<{ url?: string }>
  engagement: {
    likes: number
    comments: number
    shares: number
  }
}

// ─── Parse Apify result into our post shape ──────────────────────────────────

function apifyPostToUpsertArgs(post: ApifyPostResult, authorId: Id<'users'>, hidden: boolean) {
  const urn = post.shareUrn
  const mediaUrls = (post.postImages ?? [])
    .map(img => img.url)
    .filter((url): url is string => typeof url === 'string' && url.length > 0)

  return {
    linkedinPostUrn: urn,
    authorId,
    content: post.content ?? '',
    publishedAt: post.postedAt?.timestamp ?? Date.now(),
    likeCount: post.engagement?.likes ?? 0,
    commentCount: post.engagement?.comments ?? 0,
    mediaUrls,
    isFeatured: false,
    visibilityIndustries: [] as string[],
    visibilityCountries: [] as string[],
    hidden,
    sourceUrl: post.linkedinUrl
  }
}

// ─── Sync posts for one user via Apify ───────────────────────────────────────

export const syncUserPostsViaApify = internalAction({
  args: { userId: v.id('users') },
  // Explicit return type breaks the same-file type cycle: syncAllPostsViaApify references this
  // function via `internal`, and the generated ActionCtx's runQuery/runAction return types depend
  // on the api — see the Convex guideline on same-file ctx.run* circularity (cf. posts.submitPost).
  handler: async (ctx, { userId }: { userId: Id<'users'> }): Promise<void> => {
    const actionCtx = ctx as unknown as ActionCtx
    const token = process.env.APIFY_API_TOKEN
    const actorId = process.env.APIFY_TASK_ID
    if (!token || !actorId) {
      console.error('APIFY_API_TOKEN or APIFY_TASK_ID not configured')
      return
    }

    const user = await actionCtx.runQuery(internal.users.getWithTokens, { userId })
    if (!user?.linkedinPublicIdentifier) {
      console.warn(`User ${userId} has no linkedinPublicIdentifier — skipping Apify sync`)
      return
    }

    // Enrich the profile (country/location/locale) when we don't have a country yet. The scrape
    // action self-guards on the profile-scrape flag; gating on missing country bounds the (paid)
    // scrape to ~once per user instead of every sync.
    if (!user.country) {
      await actionCtx.scheduler.runAfter(0, internal.jobs.scrapeProfileApify.scrapeUserProfile, { userId })
    }

    const input = {
      includeQuotePosts: false,
      includeReposts: false,
      maxPosts: 3,
      postNestedComments: false,
      postNestedReactions: false,
      postedLimit: 'month',
      scrapeComments: false,
      scrapeReactions: false,
      targetUrls: [`https://www.linkedin.com/in/${user.linkedinPublicIdentifier as string}`]
    }

    const items = (await runApifyTask(actorId, token, input)) as ApifyPostResult[] | undefined

    if (!items?.length) {
      return console.log(`[Apify] No posts found for user ${userId} (${user.linkedinPublicIdentifier as string})`)
    }

    const posts = items.filter(item => item.type === 'post')

    console.log(`[Apify] Fetched ${posts.length} posts for user ${userId} (${user.linkedinPublicIdentifier as string})`)

    const hidden = user.subscriptionStatus === 'trialing'

    for (const post of posts) {
      await actionCtx.runMutation(internal.jobs.syncPosts.upsertPost, {
        ...apifyPostToUpsertArgs(post, userId, hidden),
        queueOnLimitReached: true
      })
    }
  }
})

// ─── Fan-out: sync all active users via Apify ────────────────────────────────

export const syncAllPostsViaApify = internalAction({
  args: {},
  handler: async (ctx): Promise<void> => {
    const actionCtx = ctx as unknown as ActionCtx

    const settings = await actionCtx.runQuery(internal.admin.getSettingsInternal, {})
    if (!isApifyPostSyncEnabled(settings)) {
      console.log('[Apify] Sync is disabled — skipping')
      return
    }

    const users = await actionCtx.runQuery(internal.users.getActiveSubscribers, {})

    const results = await Promise.allSettled(
      users.map(u => actionCtx.runAction(internal.jobs.syncPostsApify.syncUserPostsViaApify, { userId: u._id }))
    )

    const failed = results.filter(r => r.status === 'rejected')
    if (failed.length > 0) {
      console.error(`[Apify] ${failed.length}/${users.length} user syncs failed`)
    }

    await actionCtx.runMutation(internal.admin.updateSyncStatus, {
      lastApifySyncAt: Date.now(),
      lastApifySyncError: failed.length > 0 ? `${failed.length} user(s) failed` : undefined
    })
  }
})
