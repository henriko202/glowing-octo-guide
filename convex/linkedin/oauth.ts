import type { LinkedInTokenResponse, LinkedInUserInfo } from './types.js'

const SCOPES = ['openid', 'profile', 'email', 'r_basicprofile', 'w_member_social_feed', 'w_member_social'].join(' ')

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
    console.error(`LinkedIn token exchange failed: ${res.status}`, body)
    throw new Error('LinkedIn authentication failed. Please try again.')
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
    console.error(`LinkedIn userinfo fetch failed: ${res.status}`, body)
    throw new Error('Failed to retrieve LinkedIn profile. Please try again.')
  }
  return res.json() as Promise<LinkedInUserInfo>
}
