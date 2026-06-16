// Shared LinkedIn profile helpers used by Settings and the first-login onboarding prompt.

// Accepted LinkedIn vanityName format. Mirrors the server validation in
// users.setPublicIdentifier (`^[a-zA-Z0-9\-_]{3,100}$`) so the UI never enables "Save" on a value
// the mutation will reject — checked here (post-lowercasing) as the single source of truth.
const VANITY_NAME_RE = /^[a-z0-9_-]{3,100}$/

/** Extract a LinkedIn vanityName (publicIdentifier) from a profile URL or a bare username.
 *  Returns the lowercased slug when it matches the accepted format (3–100 chars), else null. */
export function extractVanityName(input: string): string | null {
  const trimmed = input.trim()
  let slug: string
  try {
    const u = new URL(trimmed)
    const m = u.pathname.match(/^\/in\/([^/?#]+)/)
    if (!m) return null
    slug = m[1]
  } catch {
    // Also accept bare vanityNames like "henriko202" or "@henriko202"
    slug = trimmed.replace(/^@/, '')
  }
  const lower = slug.toLowerCase()
  return VANITY_NAME_RE.test(lower) ? lower : null
}
