// Apify post sync via REST API (no SDK — avoids proxy-agent/native module issues in Convex runtime)
import { internalActionGeneric as internalAction } from 'convex/server'
import { v } from 'convex/values'
import { internal } from '../_generated/api.js'
import type { ActionCtx } from '../convexTypes.js'

const APIFY_BASE = 'https://api.apify.com/v2'

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

function apifyPostToUpsertArgs(post: ApifyPostResult, authorId: string, hidden: boolean) {
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

// ─── Apify REST API helpers ──────────────────────────────────────────────────

async function runApifyTask(
  actorId: string,
  token: string,
  input: Record<string, unknown>
): Promise<ApifyPostResult[] | undefined> {
  // Start the task run and wait for it to finish (synchronous run)
  const res = await fetch(`${APIFY_BASE}/acts/${actorId}/run-sync-get-dataset-items`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(input)
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Apify task run failed: ${res.status} — ${body}`)
  }

  return await res.json()
}

// ─── Sync posts for one user via Apify ───────────────────────────────────────

export const syncUserPostsViaApify = internalAction({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }: { userId: string }) => {
    const actionCtx = ctx as unknown as ActionCtx
    const token = process.env.APIFY_API_TOKEN
    const actorId = process.env.APIFY_TASK_ID
    if (!token || !actorId) {
      console.error('APIFY_API_TOKEN or APIFY_TASK_ID not configured')
      return
    }

    const user = (await actionCtx.runQuery(internal.users.getWithTokens, { userId })) as Record<string, unknown> | null
    if (!user?.linkedinPublicIdentifier) {
      console.warn(`User ${userId} has no linkedinPublicIdentifier — skipping Apify sync`)
      return
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

    const items = await runApifyTask(actorId, token, input)

    if (!items?.length) {
      return console.log(`[Apify] No posts found for user ${userId} (${user.linkedinPublicIdentifier as string})`)
    }

    const posts = items.filter(item => item.type === 'post')

    console.log(`[Apify] Fetched ${posts.length} posts for user ${userId} (${user.linkedinPublicIdentifier as string})`)

    console.log(posts)

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
  handler: async ctx => {
    const actionCtx = ctx as unknown as ActionCtx

    const settings = (await actionCtx.runQuery(internal.admin.getSettingsInternal, {})) as Record<
      string,
      unknown
    > | null
    if (!settings?.apifySyncEnabled) {
      console.log('[Apify] Sync is disabled — skipping')
      return
    }

    const users = (await actionCtx.runQuery(internal.users.getActiveSubscribers, {})) as Array<Record<string, unknown>>

    const results = await Promise.allSettled(
      users.map(u =>
        actionCtx.runAction(internal.jobs.syncPostsApify.syncUserPostsViaApify, { userId: u._id as string })
      )
    )

    console.log(results)

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
