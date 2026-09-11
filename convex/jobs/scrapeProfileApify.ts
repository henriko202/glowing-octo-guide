// LinkedIn profile scrape via a dedicated Apify actor (APIFY_TASK_ID_PROFILE_SCRAPE).
// Populates users.country + users.headline (fill-when-empty), users.location + users.primaryLocale (refresh).
import { internalActionGeneric as internalAction } from 'convex/server'
import { v } from 'convex/values'
import { internal } from '../_generated/api.js'
import { env, type ActionCtx } from '../_generated/server'
import type { Id } from '../_generated/dataModel'
import { APIFY_FANOUT_CONCURRENCY, isApifyProfileScrapeEnabled, runApifyTask } from '../lib/apify.js'
import { settledInBatches } from '../lib/concurrency.js'

// Users fetched per fan-out page (one page per action invocation; the action self-reschedules).
// Kept small (20): each invocation fans out paid Apify scrapes, and a 100-user page can outlive the
// action execution limit.
const PAGE_SIZE = 20
// Only the fields we read from the (much larger) profile-scraper payload.

// Only the fields we read from the (much larger) profile-scraper payload.
interface ApifyProfileResult {
  location?: { linkedinText?: string; countryCode?: string }
  primaryLocale?: { country?: string; language?: string }
  headline?: string
}

export interface ParsedProfile {
  country?: string
  location?: string
  primaryLocale?: string
  headline?: string
}

/** Pure: extract the three fields we care about from the actor's dataset items. */
export function parseProfileScrapeResult(items: unknown): ParsedProfile {
  const first = Array.isArray(items) ? (items[0] as ApifyProfileResult | undefined) : undefined
  if (!first) return {}
  const out: ParsedProfile = {}
  const countryCode = first.location?.countryCode
  if (typeof countryCode === 'string' && countryCode.length > 0) out.country = countryCode.toUpperCase()
  const locText = first.location?.linkedinText
  if (typeof locText === 'string' && locText.length > 0) out.location = locText
  const lang = first.primaryLocale?.language
  if (typeof lang === 'string' && lang.length > 0) out.primaryLocale = lang
  const headline = first.headline
  if (typeof headline === 'string' && headline.length > 0) out.headline = headline
  return out
}

export const scrapeUserProfile = internalAction({
  args: { userId: v.id('users') },
  // Explicit return type breaks the same-file type cycle (scrapeAllProfilesViaApify references this
  // via `internal`); see the Convex guideline on same-file ctx.run* circularity (cf. posts.submitPost).
  handler: async (ctx, { userId }: { userId: Id<'users'> }): Promise<void> => {
    const actionCtx = ctx as unknown as ActionCtx
    const token = env.APIFY_API_TOKEN
    const actorId = env.APIFY_TASK_ID_PROFILE_SCRAPE
    if (!token || !actorId) {
      console.error('APIFY_API_TOKEN or APIFY_TASK_ID_PROFILE_SCRAPE not configured')
      return
    }

    const settings = await actionCtx.runQuery(internal.admin.getSettingsInternal, {})
    if (!isApifyProfileScrapeEnabled(settings)) {
      console.log('[Apify] Profile scrape disabled — skipping')
      return
    }

    const user = await actionCtx.runQuery(internal.users.getWithTokens, { userId })
    if (!user?.linkedinPublicIdentifier) {
      console.warn(`User ${userId} has no linkedinPublicIdentifier — skipping profile scrape`)
      return
    }

    const items = await runApifyTask(actorId, token, {
      profileScraperMode: 'Profile details no email ($4 per 1k)',
      queries: [user.linkedinPublicIdentifier as string]
    })

    const parsed = parseProfileScrapeResult(items)
    if (
      parsed.country === undefined &&
      parsed.location === undefined &&
      parsed.primaryLocale === undefined &&
      parsed.headline === undefined
    ) {
      console.log(`[Apify] No profile fields parsed for user ${user.linkedinPublicIdentifier}, check Apify console`)
      return
    }

    await actionCtx.runMutation(internal.users.applyScrapedProfile, { userId, ...parsed })
  }
})

// ─── Fan-out: scrape every user that has a LinkedIn identifier ───────────────
// Mirrors syncAllPostsViaApify. Honors the profile-scrape flag (the per-user action re-checks
// it too). Records its own last-run + error on appSettings, parallel to the post-sync status.
export const scrapeAllProfilesViaApify = internalAction({
  args: { cursor: v.optional(v.string()), failedSoFar: v.optional(v.number()) },
  handler: async (ctx, { cursor, failedSoFar }): Promise<void> => {
    const actionCtx = ctx as unknown as ActionCtx

    const settings = await actionCtx.runQuery(internal.admin.getSettingsInternal, {})
    if (!isApifyProfileScrapeEnabled(settings)) {
      console.log('[Apify] Profile scrape disabled — skipping')
      return
    }

    // One page per invocation; the next page is a fresh action. The per-user runAction hops below are
    // intentional (independent retries and logs) — only the redundant same-runtime router hop was removed.
    const page = await actionCtx.runQuery(internal.users.getUsersWithLinkedin, {
      paginationOpts: { numItems: PAGE_SIZE, cursor: cursor ?? null }
    })

    // Bounded fan-out (see syncAllPostsViaApify): cap concurrent per-user scrapes so a large
    // subscriber list can't open an unbounded number of paid, rate-limited Apify runs at once.
    const results = await settledInBatches(page.page, APIFY_FANOUT_CONCURRENCY, u =>
      actionCtx.runAction(internal.jobs.scrapeProfileApify.scrapeUserProfile, { userId: u._id })
    )

    const failed = results.filter(r => r.status === 'rejected')
    const totalFailed = (failedSoFar ?? 0) + failed.length
    if (failed.length > 0) {
      console.error(`[Apify] ${failed.length}/${page.page.length} profile scrapes failed`)
    }

    // Status is written after EVERY page, with the sweep's running failed count. An interrupted
    // sweep therefore still shows the pages processed so far instead of a stale timestamp; the count
    // is threaded through the self-reschedule and starts fresh when the next run passes no cursor.
    await actionCtx.runMutation(internal.admin.updateProfileScrapeStatus, {
      lastProfileScrapeAt: Date.now(),
      lastProfileScrapeError: totalFailed > 0 ? `${totalFailed} user(s) failed` : undefined
    })

    // More pages remain: self-reschedule with the cursor.
    if (!page.isDone) {
      await actionCtx.scheduler.runAfter(0, internal.jobs.scrapeProfileApify.scrapeAllProfilesViaApify, {
        cursor: page.continueCursor,
        failedSoFar: totalFailed
      })
    }
  }
})
