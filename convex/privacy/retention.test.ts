import { describe, it, expect } from 'vitest'
import { isTokenExpired, isExportExpired, isAuditExpired, isDormant } from './retention'

const NOW = 1_000_000_000_000
const DAY = 24 * 60 * 60 * 1000

describe('retention predicates', () => {
  it('isTokenExpired: true only when a token exists and is past expiry', () => {
    expect(isTokenExpired({ linkedinAccessToken: 't', tokenExpiresAt: NOW - 1 }, NOW)).toBe(true)
    expect(isTokenExpired({ linkedinAccessToken: 't', tokenExpiresAt: NOW + DAY }, NOW)).toBe(false)
    expect(isTokenExpired({ tokenExpiresAt: NOW - 1 }, NOW)).toBe(false)
  })

  it('isExportExpired: true only for ready exports past expiresAt', () => {
    expect(isExportExpired({ status: 'ready', expiresAt: NOW - 1 }, NOW)).toBe(true)
    expect(isExportExpired({ status: 'ready', expiresAt: NOW + DAY }, NOW)).toBe(false)
    expect(isExportExpired({ status: 'pending', expiresAt: NOW - 1 }, NOW)).toBe(false)
  })

  it('isAuditExpired: true when older than the TTL', () => {
    expect(isAuditExpired({ createdAt: NOW - 100 }, NOW, 50)).toBe(true)
    expect(isAuditExpired({ createdAt: NOW - 10 }, NOW, 50)).toBe(false)
  })

  it('isDormant: inactive past threshold, no active/trialing sub, not already scheduled', () => {
    const base = { lastLoginAt: NOW - 1000, subscriptionStatus: 'canceled' as const }
    expect(isDormant(base, NOW, 500)).toBe(true)
    expect(isDormant({ ...base, subscriptionStatus: 'active' }, NOW, 500)).toBe(false)
    expect(isDormant({ ...base, subscriptionStatus: 'trialing' }, NOW, 500)).toBe(false)
    expect(isDormant({ ...base, deletionScheduledAt: 123 }, NOW, 500)).toBe(false)
    expect(isDormant({ subscriptionStatus: 'canceled' }, NOW, 500)).toBe(false)
    expect(isDormant({ ...base }, NOW, 5_000_000)).toBe(false)
  })
})
