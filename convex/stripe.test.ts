import { describe, it, expect } from 'vitest'
import { toSubscriptionStatus } from './stripe'

describe('toSubscriptionStatus', () => {
  it('passes through our known access-granting / explicit statuses', () => {
    expect(toSubscriptionStatus('active')).toBe('active')
    expect(toSubscriptionStatus('trialing')).toBe('trialing')
    expect(toSubscriptionStatus('past_due')).toBe('past_due')
    expect(toSubscriptionStatus('canceled')).toBe('canceled')
  })

  it('maps unpaid → past_due', () => {
    expect(toSubscriptionStatus('unpaid')).toBe('past_due')
  })

  it('fails SAFE: incomplete / paused / unknown never become active', () => {
    expect(toSubscriptionStatus('incomplete')).toBe('none')
    expect(toSubscriptionStatus('incomplete_expired')).toBe('none')
    expect(toSubscriptionStatus('paused')).toBe('none')
    expect(toSubscriptionStatus('something_new')).toBe('none')
    expect(toSubscriptionStatus('')).toBe('none')
  })
})
