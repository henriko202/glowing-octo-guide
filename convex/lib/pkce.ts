// convex/lib/pkce.ts
// PKCE-style verifier/challenge helpers (RFC 7636 shape) for the login handoff. The initiating
// browser generates a 32-byte random verifier, keeps it in sessionStorage, and sends only
// SHA-256(verifier) base64url (`?vc=`) to the OAuth start route; the server stores the challenge,
// never the verifier. Redeem re-derives the challenge from the presented verifier and compares, so
// a handed-over login code is inert.

const PKCE_VALUE_RE = /^[A-Za-z0-9_-]{43}$/

/** A 43-char base64url value (32 bytes, unpadded). Verifiers and challenges share the shape. */
export function isPkceChallenge(value: string): boolean {
  return PKCE_VALUE_RE.test(value)
}

export function isPkceVerifier(value: string): boolean {
  return PKCE_VALUE_RE.test(value)
}

const BASE64URL_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'

/** Unpadded base64url, shared with the unsubscribe token (`lib/unsubscribeToken.ts`). */
export function base64UrlEncode(bytes: Uint8Array): string {
  let encoded = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i]
    const b1 = i + 1 < bytes.length ? bytes[i + 1] : 0
    const b2 = i + 2 < bytes.length ? bytes[i + 2] : 0
    encoded += BASE64URL_ALPHABET[b0 >> 2]
    encoded += BASE64URL_ALPHABET[((b0 & 3) << 4) | (b1 >> 4)]
    if (i + 1 < bytes.length) encoded += BASE64URL_ALPHABET[((b1 & 15) << 2) | (b2 >> 6)]
    if (i + 2 < bytes.length) encoded += BASE64URL_ALPHABET[b2 & 63]
  }
  return encoded
}

/** SHA-256(utf8(verifier)) as unpadded base64url — the `code_challenge` of the login handoff. */
export async function pkceChallengeFromVerifier(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  return base64UrlEncode(new Uint8Array(digest))
}
