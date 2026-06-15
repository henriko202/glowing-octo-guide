// LinkedIn profile scrape via a dedicated Apify actor (APIFY_TASK_ID_PROFILE_SCRAPE).
// Populates users.country (fill-when-empty), users.location + users.primaryLocale (refresh).
import { internalActionGeneric as internalAction } from 'convex/server'
import { v } from 'convex/values'
import { internal } from '../_generated/api.js'
import type { ActionCtx } from '../convexTypes.js'
import { runApifyTask, isApifyProfileScrapeEnabled } from '../lib/apify.js'

// Only the fields we read from the (much larger) profile-scraper payload.
interface ApifyProfileResult {
  location?: { linkedinText?: string; countryCode?: string }
  primaryLocale?: { country?: string; language?: string }
}

export interface ParsedProfile {
  country?: string
  location?: string
  primaryLocale?: string
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
  return out
}

export const scrapeUserProfile = internalAction({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }: { userId: string }) => {
    const actionCtx = ctx as unknown as ActionCtx
    const token = process.env.APIFY_API_TOKEN
    const actorId = process.env.APIFY_TASK_ID_PROFILE_SCRAPE
    if (!token || !actorId) {
      console.error('APIFY_API_TOKEN or APIFY_TASK_ID_PROFILE_SCRAPE not configured')
      return
    }

    const settings = (await actionCtx.runQuery(internal.admin.getSettingsInternal, {})) as Record<
      string,
      unknown
    > | null
    if (!isApifyProfileScrapeEnabled(settings)) {
      console.log('[Apify] Profile scrape disabled — skipping')
      return
    }

    const user = (await actionCtx.runQuery(internal.users.getWithTokens, { userId })) as Record<
      string,
      unknown
    > | null
    if (!user?.linkedinPublicIdentifier) {
      console.warn(`User ${userId} has no linkedinPublicIdentifier — skipping profile scrape`)
      return
    }

    const items = await runApifyTask(actorId, token, {
      profileScraperMode: 'Profile details no email ($4 per 1k)',
      queries: [user.linkedinPublicIdentifier as string]
    })

    const parsed = parseProfileScrapeResult(items)
    if (parsed.country === undefined && parsed.location === undefined && parsed.primaryLocale === undefined) {
      console.log(`[Apify] No profile fields parsed for user ${userId}`)
      return
    }

    await actionCtx.runMutation(internal.users.applyScrapedProfile, { userId, ...parsed })
  }
})
