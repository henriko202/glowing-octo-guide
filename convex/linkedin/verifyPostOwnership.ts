// convex/linkedin/verifyPostOwnership.ts
import { ConvexError } from 'convex/values'

export interface OwnershipResult {
  confirmed: boolean
  content: string
  publishedAt: number
  // 'author-name' — the post's JSON-LD author matched the member's OIDC name (the primary,
  // non-spoofable check). 'vanity-heuristic' — fallback when the post carried no author block.
  // 'admin-override' — stamped by submitPost when a dev admin bypasses the check entirely.
  strategy: 'author-name' | 'vanity-heuristic' | 'admin-override'
}

/** Whether two display names are the same person: case- and accent-insensitive, whitespace-collapsed.
 *  Both sides come from LinkedIn (the post page vs the OIDC claim), so this only absorbs locale /
 *  rendering variance (e.g. "João" vs "Joao") — it is not meant to match different people. */
function sameName(a: string, b: string): boolean {
  const norm = (s: string): string => s.replace(/\s+/g, ' ').trim()
  return norm(a).localeCompare(norm(b), undefined, { sensitivity: 'base' }) === 0
}

/**
 * Verifies that a submitted LinkedIn post belongs to the signed-in member.
 *
 * PRIMARY — author-name match: the post page's JSON-LD `author.name` (rendered by LinkedIn) must
 * match the member's OIDC `name` (returned by LinkedIn at login, not editable in-app). Neither side
 * is attacker-controllable, so this cannot be spoofed via a settings field.
 *
 * FALLBACK — vanity heuristic: used ONLY when the post carried no author block. It compares the
 * URL's vanityName to the member's stored (auto-derived) publicIdentifier. Not attacker-triggerable —
 * a submitter can't make LinkedIn omit the author — so it only catches the rare untagged post.
 *
 * No LinkedIn API call is made; both signals come from the already-fetched post page. Throws on a
 * mismatch or when neither signal is available.
 *
 * @param postAuthorName         `author.name` from the post's JSON-LD (null if absent)
 * @param memberName             the member's OIDC `name` (from login)
 * @param vanityName             vanityName extracted from the post URL (null for Format 2 URLs)
 * @param storedPublicIdentifier the member's derived LinkedIn publicIdentifier (null if not yet set)
 */
export function verifyPostOwnership(
  postAuthorName: string | null,
  memberName: string,
  vanityName: string | null,
  storedPublicIdentifier: string | null
): OwnershipResult {
  if (postAuthorName) {
    if (!sameName(postAuthorName, memberName)) {
      throw new ConvexError("This post doesn't belong to your LinkedIn account.")
    }
    // When we already know the member's vanity, a Format 1 URL that points at a different vanity is
    // a different account, whatever the display name says.
    if (storedPublicIdentifier && vanityName && storedPublicIdentifier.toLowerCase() !== vanityName.toLowerCase()) {
      throw new ConvexError("This post doesn't belong to your LinkedIn account.")
    }
    return { confirmed: true, content: '', publishedAt: Date.now(), strategy: 'author-name' }
  }

  // Fallback: the post page exposed no author block. Fall back to the vanity heuristic.
  if (!vanityName) {
    throw new ConvexError('Could not verify post ownership. Use a /posts/… URL format so we can check the author.')
  }
  if (!storedPublicIdentifier) {
    throw new ConvexError("Couldn't verify this post's author. Submit a post whose page lists you as the author.")
  }
  if (storedPublicIdentifier.toLowerCase() !== vanityName.toLowerCase()) {
    throw new ConvexError("This post doesn't belong to your LinkedIn account.")
  }
  return { confirmed: true, content: '', publishedAt: Date.now(), strategy: 'vanity-heuristic' }
}
