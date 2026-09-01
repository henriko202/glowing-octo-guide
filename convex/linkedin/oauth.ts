import type { LinkedInTokenResponse, LinkedInUserInfo } from './types.js'
import { callMemberApi } from './client'
import { scrubError } from '../lib/scrubError'
import { fetchWithTimeout } from '../lib/fetchWithTimeout'

// OpenID Connect only (Standard tier → every LinkedIn member can sign in). No w_member_social*/
// r_basicprofile: the app makes no LinkedIn API writes (react/comment happen on LinkedIn via the
// handoff, docs/PLATFORM.md §11), and those scopes would throw unauthorized_scope_error for any
// user without a role on the app — i.e. break login for everyone but the team.
const SCOPES = ['openid', 'profile', 'email'].join(' ')

// Fail loud + clear on a missing OAuth env var instead of silently embedding the string "undefined"
// (what `process.env.X!` yields when unset) into the auth URL / token request, which surfaces as a
// cryptic LinkedIn error. Mirrors the explicit-guard pattern in ai/openrouter.callOpenRouter.
function requireEnv(name: 'LINKEDIN_CLIENT_ID' | 'LINKEDIN_CLIENT_SECRET' | 'LINKEDIN_REDIRECT_URI'): string {
  const value = process.env[name]
  if (!value) {
    console.error(`${name} not set`)
    throw new Error('LinkedIn sign-in is not configured.')
  }
  return value
}

export function buildAuthUrl(state: string): string {
  const clientId = requireEnv('LINKEDIN_CLIENT_ID')
  const redirectUri = requireEnv('LINKEDIN_REDIRECT_URI')
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
  const clientId = requireEnv('LINKEDIN_CLIENT_ID')
  const clientSecret = requireEnv('LINKEDIN_CLIENT_SECRET')
  const redirectUri = requireEnv('LINKEDIN_REDIRECT_URI')

  const res = await fetchWithTimeout('https://www.linkedin.com/oauth/v2/accessToken', {
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
    console.error(`LinkedIn token exchange failed: ${res.status}`, scrubError(body))
    throw new Error('LinkedIn authentication failed. Please try again.')
  }
  return res.json() as Promise<LinkedInTokenResponse>
}

// Best-effort refresh (see backlog/B01): the app's OIDC Standard-tier scopes (SCOPES above) mean
// LinkedIn essentially never issues a refresh_token, so linkedinRefreshToken is undefined for
// almost every user and this path is dormant in practice. Kept correct for the rare account that
// does have one (or a future tier change). Mirrors exchangeCodeForTokens' error handling exactly.
export async function refreshAccessToken(refreshToken: string): Promise<LinkedInTokenResponse> {
  const clientId = requireEnv('LINKEDIN_CLIENT_ID')
  const clientSecret = requireEnv('LINKEDIN_CLIENT_SECRET')

  const res = await fetchWithTimeout('https://www.linkedin.com/oauth/v2/accessToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret
    })
  })

  if (!res.ok) {
    // LinkedIn's error body is {error, error_description} — never the token — but route it through
    // the scrub helper anyway so this seam can't regress into logging a token if the body shape
    // ever changes.
    const body = await res.text()
    console.error(`LinkedIn token refresh failed: ${res.status}`, scrubError(body))
    throw new Error('LinkedIn token refresh failed.')
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
