// Apify post sync via REST API (no SDK — avoids proxy-agent/native module issues in Convex runtime)
import { internalActionGeneric as internalAction } from 'convex/server'
import { v } from 'convex/values'
import { internal } from '../_generated/api.js'
import { env, type ActionCtx } from '../_generated/server'
import type { Id } from '../_generated/dataModel'
import { APIFY_FANOUT_CONCURRENCY, isApifyPostSyncEnabled, runApifyTask } from '../lib/apify.js'
import { settledInBatches } from '../lib/concurrency.js'
import { isAllowedLinkedInUrl, isHttpsUrl } from '../linkedin/parsePostUrl.js'
import { isValidPostUrn } from '../linkedin/parsePostContent.js'

// Users fetched per fan-out page (one page per action invocation; the action self-reschedules).
// Kept small (20): each invocation fans out paid Apify scrapes, and a 100-user page can outlive the
// action execution limit.
const PAGE_SIZE = 20

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

function apifyPostToUpsertArgs(
  post: ApifyPostResult,
  authorId: Id<'users'>,
  hidden: boolean,
  visibility: { industries: string[]; countries: string[] }
) {
  const urn = post.shareUrn
  const mediaUrls = (post.postImages ?? [])
    .map(img => img.url)
    .filter((url): url is string => typeof url === 'string' && url.length > 0)
    // Scraper output is untrusted: only keep https media URLs (blocks javascript:/data:/etc. that
    // would reach an href sink or the AI vision provider). See isHttpsUrl.
    .filter(isHttpsUrl)

  return {
    linkedinPostUrn: urn,
    authorId,
    content: post.content ?? '',
    publishedAt: post.postedAt?.timestamp ?? Date.now(),
    likeCount: post.engagement?.likes ?? 0,
    commentCount: post.engagement?.comments ?? 0,
    mediaUrls,
    isFeatured: false,
    // Copy the author's stored default visibility allowlists (backlog/B06). Absent/empty ⇒
    // visible to everyone.
    visibilityIndustries: visibility.industries,
    visibilityCountries: visibility.countries,
    hidden,
    // Untrusted scraper output reaches client navigation sinks (PostCard href, CommandPalette
    // window.open, handoff window.location.href). Only store a validated linkedin.com post URL —
    // a javascript:/data: URL would otherwise be click-to-execute. The manual path (posts.ts) already
    // stores a resolved+validated URL; this closes the Apify path to the same guarantee.
    sourceUrl: post.linkedinUrl && isAllowedLinkedInUrl(post.linkedinUrl) ? post.linkedinUrl : undefined
  }
}

// A post is worth an AI reaction prediction only when upsertPost actually inserted a new row —
// never on the update branch (re-sync of an already-seen URN) or the queue branch (over the
// weekly limit). Pure + exported so the created-vs-existing gate is unit-testable without mocking
// ctx (backlog/B09; mirrors the computeCapacity pattern in jobs/processQueue.ts). The type
// predicate lets callers narrow `postId` to non-null instead of asserting it.
export function shouldPredictReaction(result: {
  postId: Id<'posts'> | null
  created: boolean
}): result is { postId: Id<'posts'>; created: true } {
  return result.created && result.postId !== null
}

// ─── Sync posts for one user via Apify ───────────────────────────────────────

export const syncUserPostsViaApify = internalAction({
  args: { userId: v.id('users') },
  // Explicit return type breaks the same-file type cycle: syncAllPostsViaApify references this
  // function via `internal`, and the generated ActionCtx's runQuery/runAction return types depend
  // on the api — see the Convex guideline on same-file ctx.run* circularity (cf. posts.submitPost).
  handler: async (ctx, { userId }: { userId: Id<'users'> }): Promise<void> => {
    const actionCtx = ctx as unknown as ActionCtx
    const token = env.APIFY_API_TOKEN
    const actorId = env.APIFY_TASK_ID
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
    const visibility = {
      industries: user.defaultVisibilityIndustries ?? [],
      countries: user.defaultVisibilityCountries ?? []
    }

    for (const post of posts) {
      // Untrusted scraper output: drop a URN that doesn't match the same shape the manual path
      // enforces (extractPostUrn) before it becomes a stored dedup key.
      if (!isValidPostUrn(post.shareUrn)) {
        console.warn(`[Apify] dropping post with invalid URN for user ${userId}`)
        continue
      }
      const result = await actionCtx.runMutation(internal.jobs.syncPosts.upsertPost, {
        ...apifyPostToUpsertArgs(post, userId, hidden, visibility),
        queueOnLimitReached: true
      })
      // Best-effort, async: mirrors the manual-submit scheduling (posts.ts submitPost). Fires for
      // every genuinely new post, including trial-hidden ones — ponytail: no hidden special-case;
      // a few wasted predictions for a never-converting trial user is an acceptable ceiling.
      // predictReaction itself no-ops when AI is unconfigured, so this is safe either way.
      if (shouldPredictReaction(result)) {
        await actionCtx.scheduler.runAfter(0, internal.ai.reactions.predictReaction, { postId: result.postId })
      }
    }
  }
})

// ─── Fan-out: sync all active users via Apify ────────────────────────────────

export const syncAllPostsViaApify = internalAction({
  args: { cursor: v.optional(v.string()), failedSoFar: v.optional(v.number()) },
  handler: async (ctx, { cursor, failedSoFar }): Promise<void> => {
    const actionCtx = ctx as unknown as ActionCtx

    const settings = await actionCtx.runQuery(internal.admin.getSettingsInternal, {})
    if (!isApifyPostSyncEnabled(settings)) {
      console.log('[Apify] Sync is disabled — skipping')
      return
    }

    // One page per invocation; the next page is a fresh action. The per-user runAction hops below are
    // intentional (independent retries and logs) — only the redundant same-runtime router hop was removed.
    const page = await actionCtx.runQuery(internal.users.getActiveSubscribers, {
      paginationOpts: { numItems: PAGE_SIZE, cursor: cursor ?? null }
    })

    // Bounded fan-out: at most APIFY_FANOUT_CONCURRENCY users scraped at once (each is a paid,
    // rate-limited Apify run) instead of an unbounded users.map(). settledInBatches never rejects,
    // so one user's failure can't sink the sweep — mirrors the previous Promise.allSettled semantics.
    const results = await settledInBatches(page.page, APIFY_FANOUT_CONCURRENCY, u =>
      actionCtx.runAction(internal.jobs.syncPostsApify.syncUserPostsViaApify, { userId: u._id })
    )

    const failed = results.filter(r => r.status === 'rejected')
    const totalFailed = (failedSoFar ?? 0) + failed.length
    if (failed.length > 0) {
      console.error(`[Apify] ${failed.length}/${page.page.length} user syncs failed`)
    }

    // Status is written after EVERY page, with the sweep's running failed count. An interrupted
    // sweep therefore still shows the pages processed so far instead of a stale timestamp; the count
    // is threaded through the self-reschedule and starts fresh when the next cron passes no cursor.
    await actionCtx.runMutation(internal.admin.updateSyncStatus, {
      lastApifySyncAt: Date.now(),
      lastApifySyncError: totalFailed > 0 ? `${totalFailed} user(s) failed` : undefined
    })

    // More pages remain: self-reschedule with the cursor.
    if (!page.isDone) {
      await actionCtx.scheduler.runAfter(0, internal.jobs.syncPostsApify.syncAllPostsViaApify, {
        cursor: page.continueCursor,
        failedSoFar: totalFailed
      })
    }
  }
})
