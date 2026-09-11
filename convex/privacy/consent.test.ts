import { describe, it, expect } from 'vitest'
import { latestConsentByPurpose } from './consent'

describe('latestConsentByPurpose', () => {
  it('returns an empty map for no records', () => {
    expect(latestConsentByPurpose([])).toEqual({})
  })

  it('takes the latest record per purpose (by createdAt)', () => {
    const records = [
      { purpose: 'marketing', granted: true, createdAt: 100 },
      { purpose: 'marketing', granted: false, createdAt: 200 },
      { purpose: 'analytics', granted: true, createdAt: 50 }
    ]
    expect(latestConsentByPurpose(records)).toEqual({ marketing: false, analytics: true })
  })

  it('is order-independent (uses createdAt, not array order)', () => {
    const records = [
      { purpose: 'marketing', granted: false, createdAt: 200 },
      { purpose: 'marketing', granted: true, createdAt: 100 }
    ]
    expect(latestConsentByPurpose(records)).toEqual({ marketing: false })
  })

  it('resolves the latest per purpose from the single newest row per purpose', () => {
    // getConsents reads each purpose's newest row directly via by_user_and_purpose_and_created_at
    // (.order('desc').first()), so the helper receives at most one row per purpose. No shared
    // row-count window exists that a busy purpose could push the other purpose's latest grant out of.
    expect(
      latestConsentByPurpose([
        { purpose: 'marketing', granted: false, createdAt: 200 },
        { purpose: 'analytics', granted: true, createdAt: 100 }
      ])
    ).toEqual({ marketing: false, analytics: true })
  })
})
