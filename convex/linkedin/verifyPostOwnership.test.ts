// convex/linkedin/verifyPostOwnership.test.ts
import { describe, it, expect } from 'vitest'
import { verifyPostOwnership } from './verifyPostOwnership'

// Signature: verifyPostOwnership(postAuthorName, memberName, vanityName, storedPublicIdentifier).
// Primary = author-name match (non-spoofable); fallback = vanity heuristic, only when the post page
// carried no author block. No LinkedIn API call is made.
describe('verifyPostOwnership', () => {
  describe('primary: author-name match', () => {
    it('confirms when the post author name matches the member OIDC name', () => {
      const r = verifyPostOwnership('Mateus Yonemoto', 'Mateus Yonemoto', null, null)
      expect(r.confirmed).toBe(true)
      expect(r.strategy).toBe('author-name')
    })

    it('is case- and accent-insensitive and whitespace-tolerant', () => {
      expect(verifyPostOwnership('joão  silva', 'JOAO SILVA', null, null).strategy).toBe('author-name')
    })

    it('throws when the post author name does not match the member name', () => {
      expect(() => verifyPostOwnership('Someone Else', 'Mateus Yonemoto', 'mateus', 'mateus')).toThrow(
        "doesn't belong to your LinkedIn account"
      )
    })

    it('does NOT fall back to the vanity heuristic when a mismatching author name is present', () => {
      // author name present + mismatch → reject, even though the vanity would have matched
      expect(() => verifyPostOwnership('Imposter', 'Real Name', 'real-vanity', 'real-vanity')).toThrow(
        "doesn't belong to your LinkedIn account"
      )
    })
  })

  describe('fallback: vanity heuristic (post page has no author block)', () => {
    it('confirms when the URL vanity matches the stored identifier', () => {
      const r = verifyPostOwnership(null, 'Member', 'henri-durand', 'henri-durand')
      expect(r.confirmed).toBe(true)
      expect(r.strategy).toBe('vanity-heuristic')
    })

    it('is case-insensitive on the vanity', () => {
      expect(verifyPostOwnership(null, 'Member', 'Henri-Durand', 'henri-durand').confirmed).toBe(true)
    })

    it('throws when the URL vanity does not match the stored identifier', () => {
      expect(() => verifyPostOwnership(null, 'Member', 'someone-else', 'henri-durand')).toThrow(
        "doesn't belong to your LinkedIn account"
      )
    })

    it('throws asking for a post that lists the author when there is no stored identifier', () => {
      expect(() => verifyPostOwnership(null, 'Member', 'henri-durand', null)).toThrow('lists you as the author')
    })

    it('throws for Format 2 URLs (null vanity) with no author block', () => {
      expect(() => verifyPostOwnership(null, 'Member', null, null)).toThrow('/posts/… URL format')
    })
  })
})
