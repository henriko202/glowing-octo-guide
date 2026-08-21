import { describe, it, expect } from 'vitest'
import { toSubscriptionStatus, resolveSyncedTier } from './stripe'

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

describe('resolveSyncedTier', () => {
  it('never changes an admin tier, whatever Stripe reports', () => {
    expect(resolveSyncedTier('pro', true, 'starter')).toBe('pro')
    expect(resolveSyncedTier('contact', true, 'growth')).toBe('contact')
    expect(resolveSyncedTier(undefined, true, 'pro')).toBe(undefined)
  })

  it('lets every non-admin follow Stripe, including contact members changing plan', () => {
    expect(resolveSyncedTier('contact', false, 'pro')).toBe('pro') // contact CAN change plan
    expect(resolveSyncedTier('starter', false, 'pro')).toBe('pro')
    expect(resolveSyncedTier('pro', false, 'starter')).toBe('starter')
    expect(resolveSyncedTier('growth', undefined, 'growth')).toBe('growth')
    expect(resolveSyncedTier(undefined, false, 'starter')).toBe('starter')
  })
})
