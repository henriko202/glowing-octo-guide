import { describe, it, expect } from 'vitest'
import {
  SESSION_TTL_MS,
  isUsableOAuthState,
  oauthNonceMatches,
  sessionExpiryFrom,
  shouldContinueSessionPurge,
  shouldRenewSession
} from './sessions'

describe('session sliding expiry', () => {
  const now = 1_000_000_000_000

  it('mints/renews to now + 15 days', () => {
    expect(SESSION_TTL_MS).toBe(15 * 24 * 60 * 60 * 1000)
    expect(sessionExpiryFrom(now)).toBe(now + SESSION_TTL_MS)
  })

  it('does not renew while in the first half of the window', () => {
    expect(shouldRenewSession(now + SESSION_TTL_MS, now)).toBe(false) // just minted
    expect(shouldRenewSession(now + SESSION_TTL_MS / 2 + 1, now)).toBe(false) // a hair before halfway
    expect(shouldRenewSession(now + SESSION_TTL_MS / 2, now)).toBe(false) // exactly halfway
  })

  it('renews once past the halfway point', () => {
    expect(shouldRenewSession(now + SESSION_TTL_MS / 2 - 1, now)).toBe(true) // just past halfway
    expect(shouldRenewSession(now + 1, now)).toBe(true) // nearly expired
  })
})

describe('shouldContinueSessionPurge', () => {
  it('continues when the deleted batch was full', () => {
    expect(shouldContinueSessionPurge(200, 200)).toBe(true)
  })

  it('stops when fewer than a full batch was deleted', () => {
    expect(shouldContinueSessionPurge(199, 200)).toBe(false)
    expect(shouldContinueSessionPurge(0, 200)).toBe(false)
  })
})

describe('oauthNonceMatches', () => {
  it('matches identical nonces', () => {
    expect(oauthNonceMatches('nonce-123', 'nonce-123')).toBe(true)
  })

  it('rejects different nonces', () => {
    expect(oauthNonceMatches('nonce-123', 'nonce-456')).toBe(false)
    expect(oauthNonceMatches('nonce-123', 'nonce-1234')).toBe(false)
  })

  it('rejects when either side is empty', () => {
    expect(oauthNonceMatches('', 'nonce-123')).toBe(false)
    expect(oauthNonceMatches('nonce-123', '')).toBe(false)
    expect(oauthNonceMatches('', '')).toBe(true)
  })
})

describe('isUsableOAuthState', () => {
  const now = 1_000_000_000_000

  it('accepts a state only when the nonce matches and it has not expired', () => {
    expect(isUsableOAuthState({ browserNonce: 'n', expiresAt: now + 1 }, 'n', now)).toBe(true)
    expect(isUsableOAuthState({ browserNonce: 'n', expiresAt: now }, 'n', now)).toBe(true) // boundary
  })

  it('rejects a non-matching nonce even when unexpired (the failed attempt must not consume)', () => {
    expect(isUsableOAuthState({ browserNonce: 'n', expiresAt: now + 1 }, 'other', now)).toBe(false)
  })

  it('rejects an expired state even when the nonce matches', () => {
    expect(isUsableOAuthState({ browserNonce: 'n', expiresAt: now - 1 }, 'n', now)).toBe(false)
  })
})
