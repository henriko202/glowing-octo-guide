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
// lnkd.in is LinkedIn's own URL shortener. It is the ONLY non-linkedin.com host we ever fetch,
// and only to read its redirect Location (never its target) — see resolveLinkedInShortlink.
const ALLOWED_SHORTLINK_HOST = /^([a-z0-9-]+\.)?lnkd\.in$/

/**
 * Resolves a lnkd.in shortlink to the underlying linkedin.com post URL, SSRF-safely.
 *
 * lnkd.in shortens ANY link posted on LinkedIn — not just posts — so we must never let a
 * shortener redirect steer a server-side fetch to an attacker-chosen host. We therefore follow
 * redirects MANUALLY (`redirect: 'manual'`), re-validating every hop against the host allowlist
 * before touching it, and stop at the first linkedin.com URL (handed off to the caller's normal
 * auto-follow fetch, which already stays within linkedin.com).
 *
 * A URL that is already on linkedin.com is returned unchanged WITHOUT any network call.
 * Returns null when the input is not an https linkedin.com / lnkd.in URL, the chain leaves the
 * allowlist, a hop has no Location, or the hop budget is exceeded.
 *
 * ponytail: 5-hop budget — real lnkd.in links resolve in a single hop; raise only if LinkedIn
 * ever chains shorteners.
 */
export async function resolveLinkedInShortlink(url: string): Promise<string | null> {
  let current = url
  for (let hop = 0; hop < 5; hop++) {
    let parsed: URL
    try {
      parsed = new URL(current)
    } catch {
      return null
    }
    if (parsed.protocol !== 'https:') return null
    const host = parsed.hostname.toLowerCase()
    if (ALLOWED_LINKEDIN_HOST.test(host)) return current // reached the real post URL
    if (!ALLOWED_SHORTLINK_HOST.test(host)) return null // off-allowlist → reject before fetching
    // Shortener hop: read ONE redirect without auto-following it to an unvalidated host.
    const res = await fetch(current, { redirect: 'manual' })
    const location = res.headers.get('location')
    if (!location) return null
    current = new URL(location, current).toString() // resolve a possibly-relative Location
  }
  return null // exceeded the hop budget without reaching linkedin.com
}

/**
 * SSRF guard for any LinkedIn URL we are about to fetch server-side (e.g. a shared
 * article link extracted from post HTML). Returns true only for https URLs on
 * linkedin.com or a subdomain. Shares ALLOWED_LINKEDIN_HOST with parseLinkedInPostUrl
 * so the article-fetch guard and the post-fetch guard can never drift apart.
 */
export function isAllowedLinkedInUrl(url: string): boolean {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return false
  }
  return parsed.protocol === 'https:' && ALLOWED_LINKEDIN_HOST.test(parsed.hostname.toLowerCase())
}

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
