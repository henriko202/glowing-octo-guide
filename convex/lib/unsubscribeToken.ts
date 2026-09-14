// R24 — stateless unsubscribe tokens for the digest email. HMAC-SHA256 over `digest:<userId>`, base64url, compared
// in constant time. Stateless on purpose: an old email in an inbox must keep working, so there is nothing to
// expire or clean up. WebCrypto only, like pkce.ts, so this stays in the default Convex runtime.
import { base64UrlEncode } from './pkce'

export const UNSUBSCRIBE_PURPOSE = 'digest'
const TOKEN_RE = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/

async function hmacBase64Url(input: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(input))
  return base64UrlEncode(new Uint8Array(signature))
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export async function signUnsubscribeToken(userId: string, secret: string): Promise<string> {
  const payload = base64UrlEncode(new TextEncoder().encode(userId))
  const signature = await hmacBase64Url(`${UNSUBSCRIBE_PURPOSE}:${userId}`, secret)
  return `${payload}.${signature}`
}

export async function verifyUnsubscribeToken(token: string, secret: string): Promise<string | null> {
  if (!token || !TOKEN_RE.test(token)) return null
  const [payload, signature] = token.split('.')
  let userId: string
  try {
    const bytes = Uint8Array.from(atob(payload.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0))
    userId = new TextDecoder().decode(bytes)
  } catch {
    return null
  }
  const expected = await hmacBase64Url(`${UNSUBSCRIBE_PURPOSE}:${userId}`, secret)
  return constantTimeEqual(signature, expected) ? userId : null
}
