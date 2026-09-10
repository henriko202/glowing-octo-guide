import { describe, it, expect } from 'vitest'
import { toSafeMe } from './users'
import type { Doc, Id } from './_generated/dataModel'

function makeUser(overrides: Partial<Doc<'users'>> = {}): Doc<'users'> {
  return {
    _id: 'u1',
    _creationTime: 0,
    linkedinId: 'li1',
    name: 'Jordan Maxwell',
    tier: 'growth',
    subscriptionStatus: 'active',
    linkedinAccessToken: 'secret-access',
    linkedinRefreshToken: 'secret-refresh',
    tokenExpiresAt: 123,
    createdAt: 0,
    ...overrides
  } as Doc<'users'>
}

describe('toSafeMe', () => {
  it('strips token secrets but keeps the raw isAdmin flag out and tokenExpiresAt in', () => {
    const safe = toSafeMe(makeUser({ isAdmin: true })) as Record<string, unknown>
    expect(safe.linkedinAccessToken).toBeUndefined()
    expect(safe.linkedinRefreshToken).toBeUndefined()
    // tokenExpiresAt is not a secret (just an expiry timestamp) and is exposed for the
    // reconnect-before-expiry banner (B01b) — see backlog/B01-linkedin-token-refresh.md.
    expect(safe.tokenExpiresAt).toBe(123)
    expect(safe.name).toBe('Jordan Maxwell')
  })

  it('re-adds isAdmin: true only for admins', () => {
    expect((toSafeMe(makeUser({ isAdmin: true })) as Record<string, unknown>).isAdmin).toBe(true)
    expect((toSafeMe(makeUser({ isAdmin: false })) as Record<string, unknown>).isAdmin).toBeUndefined()
  })

  it('passes the ban signal through to the client', () => {
    const safe = toSafeMe(makeUser({ isBanned: true, bannedReason: 'Spam' })) as Record<string, unknown>
    expect(safe.isBanned).toBe(true)
    expect(safe.bannedReason).toBe('Spam')
  })

  it('strips stripeCustomerId and ban audit fields but keeps bannedReason', () => {
    const safe = toSafeMe(
      makeUser({
        stripeCustomerId: 'cus_1',
        isBanned: true,
        bannedAt: 123,
        bannedBy: 'admin1' as Id<'users'>,
        bannedReason: 'Spam'
      })
    ) as Record<string, unknown>
    expect(safe.stripeCustomerId).toBeUndefined()
    expect(safe.bannedBy).toBeUndefined()
    expect(safe.bannedAt).toBeUndefined()
    expect(safe.isBanned).toBe(true)
    expect(safe.bannedReason).toBe('Spam')
  })
})

// backlog/R19 — the client renders "{{days}}-day trial" from this, so it must follow referredByCode.
describe('toSafeMe trial days (R19)', () => {
  it('is 7 for a plain signup and 14 for an invited member', () => {
    expect((toSafeMe(makeUser()) as Record<string, unknown>).trialDays).toBe(7)
    expect((toSafeMe(makeUser({ referredByCode: 'abc12345' })) as Record<string, unknown>).trialDays).toBe(14)
  })
})
