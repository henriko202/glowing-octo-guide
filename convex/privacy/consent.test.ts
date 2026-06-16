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
})
