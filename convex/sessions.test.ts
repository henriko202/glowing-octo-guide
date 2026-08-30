import { describe, it, expect } from 'vitest'
import { SESSION_TTL_MS, sessionExpiryFrom, shouldRenewSession } from './sessions'

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
