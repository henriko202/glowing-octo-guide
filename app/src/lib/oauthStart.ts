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

// SHA-256 (FIPS 180-4) for a browser without `crypto.subtle`. Only the 43-byte verifier goes through it;
// the 32-bit length field caps the input at 512 MB.
function sha256(message: Uint8Array): Uint8Array {
  // Round constants and initial state: fractional bits of the cube/square roots of the first 64/8 primes.
  const k: number[] = []
  const hash: number[] = []
  for (let n = 2; k.length < 64; n++) {
    let prime = true
    for (let d = 2; d * d <= n; d++) if (n % d === 0) prime = false
    if (!prime) continue
    if (hash.length < 8) hash.push(((Math.sqrt(n) % 1) * 2 ** 32) | 0)
    k.push(((Math.cbrt(n) % 1) * 2 ** 32) | 0)
  }

  const padded = new Uint8Array(((message.length + 8) >> 6) * 64 + 64)
  padded.set(message)
  padded[message.length] = 0x80
  const view = new DataView(padded.buffer)
  view.setUint32(padded.length - 4, message.length * 8)

  const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n))
  const w = new Array<number>(64)
  for (let offset = 0; offset < padded.length; offset += 64) {
    for (let i = 0; i < 64; i++) {
      if (i < 16) {
        w[i] = view.getUint32(offset + i * 4)
        continue
      }
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3)
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10)
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0
    }
    let [a, b, c, d, e, f, g, h] = hash
    for (let i = 0; i < 64; i++) {
      const t1 = (h + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + k[i] + w[i]) | 0
      const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0
      h = g
      g = f
      f = e
      e = (d + t1) | 0
      d = c
      c = b
      b = a
      a = (t1 + t2) | 0
    }
    ;[a, b, c, d, e, f, g, h].forEach((value, i) => (hash[i] = (hash[i] + value) | 0))
  }

  const out = new Uint8Array(32)
  hash.forEach((word, i) => new DataView(out.buffer).setUint32(i * 4, word))
  return out
}

export async function challengeFromVerifier(verifier: string): Promise<string> {
  const bytes = new TextEncoder().encode(verifier)
  // `crypto.subtle` is undefined outside a secure context and in some embedded browsers (seen in prod on
  // /auth/start). The Convex start route rejects a login without a challenge, so hash here instead.
  const subtle = crypto.subtle as SubtleCrypto | undefined
  return base64Url(subtle ? new Uint8Array(await subtle.digest('SHA-256', bytes)) : sha256(bytes))
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
