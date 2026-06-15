export interface ParsedPostUrl {
  /** LinkedIn activity ID — used to form urn:li:ugcPost:{activityId} */
  activityId: string
  /** Vanity name extracted from URL path (null for Format 2) */
  vanityName: string | null
}

/**
 * Parses a LinkedIn post URL and extracts the activity ID and optional vanity name.
 *
 * Supported formats:
 *   Format 1: /posts/{vanityName}_{slug}-{activityId}-{hash}/
 *   Format 2: /feed/update/urn:li:activity:{activityId}/
 *
 * Returns null for unrecognized formats.
 */
// SSRF guard: the path checks below are NOT sufficient on their own — the caller fetch()es
// this URL server-side, so scheme + host MUST be restricted. Allows linkedin.com + subdomains.
const ALLOWED_LINKEDIN_HOST = /^([a-z0-9-]+\.)?linkedin\.com$/

export function parseLinkedInPostUrl(url: string): ParsedPostUrl | null {
  if (!url) return null

  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }

  // Reject anything that isn't an https LinkedIn URL before it can be fetched.
  if (parsed.protocol !== 'https:' || !ALLOWED_LINKEDIN_HOST.test(parsed.hostname.toLowerCase())) {
    return null
  }

  const pathname = parsed.pathname

  // Format 2: /feed/update/urn:li:activity:{id}
  const format2Match = pathname.match(/\/feed\/update\/urn:li:activity:(\d+)/)
  if (format2Match) {
    return { activityId: format2Match[1], vanityName: null }
  }

  // Format 1: /posts/{vanityName}_{slug}-{activityId}-{hash}
  // The vanity name is everything before the first underscore in the slug segment.
  // The activityId is the large number (15-20 digits) near the end.
  // Known limitation: if the slug contains a 15-20 digit number, the lazy .*? may
  // match it instead of the actual activityId. Extremely unlikely in practice.
  const format1Match = pathname.match(/\/posts\/([^_]+)_.*?-(\d{15,20})-[^/]+/)
  if (format1Match) {
    return { activityId: format1Match[2], vanityName: format1Match[1] }
  }

  return null
}
