// Landing unique-visitor keys: HMAC-SHA256 over "landing-visitor:<UTC day>:<ip>:<user-agent>",
// lowercase hex truncated to 32 chars. WebCrypto only, so this stays in the default Convex runtime.
// Pure — no env import — so the hashing rule is directly unit-testable; http.ts owns secret/ip
// selection and stamps the day, and the `landing-visitor:` prefix domain-separates the key from the
// unsubscribe token's use of the same secret.
export async function landingVisitorKey(secret: string, day: string, ip: string, ua: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`landing-visitor:${day}:${ip}:${ua}`)
  )
  return Array.from(new Uint8Array(signature), byte => byte.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 32)
}
