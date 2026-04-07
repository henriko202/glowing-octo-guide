// convex/linkedin/verifyPostOwnership.ts

export interface OwnershipResult {
  confirmed: boolean
  content: string
  publishedAt: number
  strategy: 'ugc-api' | 'vanity-heuristic'
}

/**
 * Verifies that a LinkedIn post belongs to the given user.
 *
 * Step A: Try GET /v2/ugcPosts/{urn} and compare post.author to urn:li:person:{linkedinId}.
 *         Requires r_member_social scope (LinkedIn MDP approval). Returns post content if ok.
 *
 * Step B (fallback): If Step A returns 403/404 AND vanityName is available,
 *         compare it case-insensitively against storedPublicIdentifier (the user's
 *         LinkedIn vanityName stored in their profile).
 *         NO external API call is made in Step B — standard OAuth apps cannot access
 *         any LinkedIn profile-identity endpoint with non-partner scopes.
 *
 * Throws on unrecoverable errors or ownership mismatch.
 *
 * @param token                  LinkedIn access token
 * @param urn                    Post URN (urn:li:ugcPost:{id})
 * @param linkedinId             User's LinkedIn person ID (OIDC sub)
 * @param vanityName             Vanity name extracted from the post URL (null for Format 2)
 * @param storedPublicIdentifier User's LinkedIn publicIdentifier stored in their profile
 */
export async function verifyPostOwnership(
  token: string,
  urn: string,
  linkedinId: string,
  vanityName: string | null,
  storedPublicIdentifier: string | null
): Promise<OwnershipResult> {
  // Step A: try the UGC Posts API (works when r_member_social scope is approved)
  const ugcRes = await fetch(`https://api.linkedin.com/v2/ugcPosts/${encodeURIComponent(urn)}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'X-Restli-Protocol-Version': '2.0.0'
    }
  })

  if (ugcRes.ok) {
    const ugcPost = (await ugcRes.json()) as Record<string, unknown>
    const expectedAuthor = `urn:li:person:${linkedinId}`
    if (ugcPost.author !== expectedAuthor) {
      throw new Error("This post doesn't belong to your LinkedIn account.")
    }
    const share = (ugcPost.specificContent as Record<string, unknown> | undefined)?.[
      'com.linkedin.ugc.ShareContent'
    ] as Record<string, unknown> | undefined
    const commentary = (share?.shareCommentary as Record<string, unknown> | undefined)?.text
    const publishedAt =
      typeof ugcPost.created === 'object' && ugcPost.created !== null
        ? (((ugcPost.created as Record<string, unknown>).time as number) ?? Date.now())
        : Date.now()
    return {
      confirmed: true,
      content: typeof commentary === 'string' ? commentary : '',
      publishedAt,
      strategy: 'ugc-api'
    }
  }

  if (ugcRes.status === 403 || ugcRes.status === 404) {
    // Step A failed (expected: r_member_social not approved for standard OAuth apps).
    // Step B: local comparison — no LinkedIn API call.
    // All authenticated LinkedIn profile-identity endpoints require either r_liteprofile
    // (legacy, not granted to OIDC apps) or LinkedIn Partner/MDP status.
    // Instead, we compare the URL's vanityName against the user's stored publicIdentifier.
    if (!vanityName) {
      throw new Error('Could not verify post ownership. Use a /posts/\u2026 URL format for fallback verification.')
    }
    if (!storedPublicIdentifier) {
      throw new Error(
        'Please set your LinkedIn Profile URL in Settings before submitting posts. ' +
          'This lets us verify that submitted posts belong to your account.'
      )
    }
    if (storedPublicIdentifier.toLowerCase() !== vanityName.toLowerCase()) {
      throw new Error("This post doesn't belong to your LinkedIn account.")
    }
    return {
      confirmed: true,
      content: '',
      publishedAt: Date.now(),
      strategy: 'vanity-heuristic'
    }
  }

  console.error(`LinkedIn UGC API error: ${ugcRes.status}`)
  throw new Error('Could not verify post ownership. Please try again or set your LinkedIn profile URL in Settings.')
}
