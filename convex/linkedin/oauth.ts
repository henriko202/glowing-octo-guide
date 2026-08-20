import type { LinkedInTokenResponse, LinkedInUserInfo } from './types.js'
import { callMemberApi } from './client'

// OpenID Connect only (Standard tier → every LinkedIn member can sign in). No w_member_social*/
// r_basicprofile: the app makes no LinkedIn API writes (react/comment happen on LinkedIn via the
// handoff, docs/PLATFORM.md §11), and those scopes would throw unauthorized_scope_error for any
// user without a role on the app — i.e. break login for everyone but the team.
const SCOPES = ['openid', 'profile', 'email'].join(' ')

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
  const res = await callMemberApi(
    accessToken,
    { method: 'GET', path: '/v2/userinfo' },
    { action: 'retrieve LinkedIn profile' }
  )
  return (await res!.json()) as LinkedInUserInfo
}
