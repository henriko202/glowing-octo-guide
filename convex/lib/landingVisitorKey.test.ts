import { describe, expect, it } from 'vitest'
import { landingVisitorKey } from './landingVisitorKey'

const SECRET = 'test-secret'
const DAY = '2026-09-21'
const IP = '203.0.113.7'
const UA = 'Mozilla/5.0'

// Independent reference implementation of the frozen message, used only to prove the
// `landing-visitor:` prefix is part of the signed input.
async function hmacHex(input: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(input))
  return Array.from(new Uint8Array(signature), byte => byte.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 32)
}

describe('landingVisitorKey', () => {
  it('is deterministic for fixed inputs', async () => {
    expect(await landingVisitorKey(SECRET, DAY, IP, UA)).toBe('bd9afe87df4a7db8a251514d1f9f4934')
    expect(await landingVisitorKey(SECRET, DAY, IP, UA)).toBe(await landingVisitorKey(SECRET, DAY, IP, UA))
  })

  it('is 32 lowercase hex characters', async () => {
    expect(await landingVisitorKey(SECRET, DAY, IP, UA)).toMatch(/^[0-9a-f]{32}$/)
  })

  it('changes when the day, ip, user-agent or secret changes', async () => {
    const base = await landingVisitorKey(SECRET, DAY, IP, UA)
    expect(await landingVisitorKey(SECRET, '2026-09-22', IP, UA)).not.toBe(base)
    expect(await landingVisitorKey(SECRET, DAY, '203.0.113.8', UA)).not.toBe(base)
    expect(await landingVisitorKey(SECRET, DAY, IP, 'other-agent')).not.toBe(base)
    expect(await landingVisitorKey('other-secret', DAY, IP, UA)).not.toBe(base)
  })

  it('domain-separates the visitor prefix from another message under the same secret', async () => {
    const visitor = await landingVisitorKey(SECRET, DAY, IP, UA)
    expect(visitor).not.toBe(await hmacHex(`${DAY}:${IP}:${UA}`, SECRET))
    expect(visitor).not.toBe(await hmacHex(`landing-visitors:${DAY}:${IP}:${UA}`, SECRET))
  })
})
