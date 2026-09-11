// Login entry point. Generates a PKCE-style verifier (kept only in this browser's sessionStorage),
// derives its SHA-256 challenge, and navigates to the Convex OAuth start with `?vc=<challenge>`.
// Every sign-in path (landing CTAs, RequireAuth auto-OAuth, ReconnectBanner) routes through here.
import { AUTH_URL } from './session'

export const OAUTH_VERIFIER_KEY = 'oauthVerifier'

function base64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function generateVerifier(): string {
  return base64Url(crypto.getRandomValues(new Uint8Array(32)))
}

export async function challengeFromVerifier(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  return base64Url(new Uint8Array(digest))
}

export function buildOAuthStartUrl(
  challenge: string,
  params?: { plan?: string; interval?: string; ref?: string }
): string {
  const query = new URLSearchParams({ vc: challenge })
  if (params?.plan) query.set('plan', params.plan)
  if (params?.interval) query.set('interval', params.interval)
  if (params?.ref) query.set('ref', params.ref)
  return `${AUTH_URL}?${query.toString()}`
}

export async function beginOAuthLogin(params?: { plan?: string; interval?: string; ref?: string }): Promise<void> {
  const verifier = generateVerifier()
  sessionStorage.setItem(OAUTH_VERIFIER_KEY, verifier)
  const challenge = await challengeFromVerifier(verifier)
  window.location.assign(buildOAuthStartUrl(challenge, params))
}
