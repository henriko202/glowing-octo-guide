import type { LinkedInTokenResponse, LinkedInUserInfo } from './types.js'

// Scopes for "Sign In with LinkedIn using OpenID Connect" (default product for new apps).
//
// - openid / profile / email: standard OIDC, requires "Sign In with LinkedIn using OpenID Connect"
// - w_member_social: comment + react as the user, requires "Share on LinkedIn" product
//
// Scopes that need LinkedIn MDP review (NOT included here until approved):
//   r_member_social  — read user's own posts
//   r_network        — read 1st-degree connection IDs
// Add them back to SCOPES once LinkedIn approves the app:
//   "r_member_social", "r_network"
const SCOPES = ['openid', 'profile', 'r_profile_basicinfo', 'email', 'w_member_social'].join(' ')

export function buildAuthUrl(state: string): string {
  const clientId = process.env.LINKEDIN_CLIENT_ID!
  const redirectUri = process.env.LINKEDIN_REDIRECT_URI!
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
    scope: SCOPES
  })
  return `https://www.linkedin.com/oauth/v2/authorization?${params}`
}

export async function exchangeCodeForTokens(code: string): Promise<LinkedInTokenResponse> {
  const clientId = process.env.LINKEDIN_CLIENT_ID!
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET!
  const redirectUri = process.env.LINKEDIN_REDIRECT_URI!

  const res = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret
    })
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Token exchange failed: ${res.status} — ${body}`)
  }
  return res.json() as Promise<LinkedInTokenResponse>
}

// OpenID Connect userinfo endpoint — works with openid/profile/email scopes.
// Replaces the deprecated /v2/me + r_liteprofile approach.
export async function fetchLinkedInUserInfo(accessToken: string): Promise<LinkedInUserInfo> {
  const res = await fetch('https://api.linkedin.com/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` }
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`UserInfo fetch failed: ${res.status} — ${body}`)
  }
  return res.json() as Promise<LinkedInUserInfo>
}

/**
 * Fetches the user's LinkedIn publicIdentifier (vanityName) using the /rest/identityMe
 * endpoint (requires r_profile_basicinfo scope).
 *
 * The endpoint returns basicInfo.profileUrl which is a privacy-preserving redirect URL
 * (linkedin.com/profile-thirdparty-redirect/...). We follow the redirect and parse the
 * final /in/{vanityName} URL to extract the publicIdentifier.
 *
 * Returns null (not throws) on any failure — callers should treat null as "identifier
 * unavailable" and fall back gracefully. The Settings page allows users to set it manually.
 */
export async function fetchLinkedInPublicIdentifier(accessToken: string): Promise<string | null> {
  try {
    // Primary: identityMe versioned API — requires r_profile_basicinfo scope
    const identityRes = await fetch('https://api.linkedin.com/rest/identityMe', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'LinkedIn-Version': '202510.03'
      }
    })

    if (identityRes.ok) {
      const data = (await identityRes.json()) as Record<string, unknown>
      const basicInfo = data.basicInfo as Record<string, unknown> | undefined
      const profileUrl = basicInfo?.profileUrl as string | undefined

      if (profileUrl) {
        // profileUrl may be a direct /in/{id} URL or a privacy-preserving redirect.
        // Try direct parse first — avoids an extra HTTP round-trip.
        const directMatch = profileUrl.match(/\/in\/([^/?#]+)/)
        if (directMatch) {
          return directMatch[1].toLowerCase()
        }

        // Follow the redirect to get the actual LinkedIn profile URL.
        // LinkedIn's profile-thirdparty-redirect returns a 301/302 to the profile page.
        // We use redirect: "manual" to catch the 3xx response and the Location header.
        // This avoids visiting the profile page (which may return 999 or require auth).
        const redirectRes = await fetch(profileUrl, {
          method: 'GET',
          redirect: 'manual',
          headers: {
            // A common User-Agent to avoid potential blocking
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          }
        })

        // The Location header contains the actual profile URL (/in/vanityName)
        const location = redirectRes.headers.get('location')
        const finalUrl = location || redirectRes.url

        const finalMatch = finalUrl.match(/\/in\/([^/?#]+)/)
        if (finalMatch) {
          return finalMatch[1].toLowerCase()
        }
      }
    } else {
      const body = await identityRes.text()
      console.warn(`identityMe returned ${identityRes.status}: ${body}`)
    }
  } catch (err) {
    console.warn('identityMe fetch failed:', err instanceof Error ? err.message : String(err))
  }

  console.warn(
    'fetchLinkedInPublicIdentifier: could not determine publicIdentifier. ' +
      'User must set LinkedIn Profile URL manually in Settings.'
  )
  return null
}
