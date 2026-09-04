// convex/lib/apify.ts
// Shared Apify helpers: feature-gate logic + the REST task runner used by both
// the post-sync and profile-scrape jobs.
import { fetchWithTimeout } from './fetchWithTimeout'

const APIFY_BASE = 'https://api.apify.com/v2'
// 5 min: run-sync-get-dataset-items blocks until the actor finishes scraping, which legitimately
// takes minutes — far longer than the interactive seams. A ceiling, not a target: it just stops a
// stuck run from pinning the action indefinitely.
const APIFY_RUN_TIMEOUT_MS = 5 * 60_000

/** Shape of the Apify-related fields on the appSettings doc (all optional / nullable). */
export type ApifyFlags =
  | {
      apifyEnabled?: boolean
      apifySyncEnabled?: boolean
      apifyProfileScrapeEnabled?: boolean
    }
  | null
  | undefined

// Max users scraped concurrently by the per-user fan-outs (syncAllPostsViaApify /
// scrapeAllProfilesViaApify). Each user is a separate run-sync Apify call — paid and rate-limited —
// so an unbounded users.map() could open hundreds at once. 5 keeps the fan-out well under Apify's
// per-account run concurrency while still parallelizing.
export const APIFY_FANOUT_CONCURRENCY = 5

/** Master kill-switch. Absent ⇒ enabled (true). When false, all Apify is off. */
export function isApifyMasterEnabled(settings: ApifyFlags): boolean {
  return settings?.apifyEnabled ?? true
}

/** Hourly post sync runs only when master AND the post flag are on. */
export function isApifyPostSyncEnabled(settings: ApifyFlags): boolean {
  return isApifyMasterEnabled(settings) && !!settings?.apifySyncEnabled
}

/** Profile scrape runs only when master AND the profile flag are on (profile flag defaults off). */
export function isApifyProfileScrapeEnabled(settings: ApifyFlags): boolean {
  return isApifyMasterEnabled(settings) && !!settings?.apifyProfileScrapeEnabled
}

/**
 * Starts an Apify task run synchronously and returns its dataset items.
 * Throws on a non-OK response. Returns the parsed JSON array (caller casts to its row type).
 */
export async function runApifyTask(
  actorId: string,
  token: string,
  input: Record<string, unknown>
): Promise<unknown[] | undefined> {
  const res = await fetchWithTimeout(
    `${APIFY_BASE}/acts/${actorId}/run-sync-get-dataset-items`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(input)
    },
    APIFY_RUN_TIMEOUT_MS
  )

  if (!res.ok) {
    const body = await res.text()
    console.error(`Apify task run failed: ${res.status}`, body)
    throw new Error(`Apify task run failed: ${res.status}`)
  }

  return (await res.json()) as unknown[] | undefined
}
