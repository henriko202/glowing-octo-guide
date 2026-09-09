import { describe, it, expect } from 'vitest'
import { toSubscriptionStatus, resolveSyncedTier, syncArgs } from './stripe'

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

describe('syncArgs', () => {
  // A `customer.subscription.updated` payload, minus everything these tests do not read.
  const event = (sub: Record<string, unknown>, item: Record<string, unknown> = {}) => ({
    created: 1_700_000_000,
    data: {
      object: {
        id: 'sub_1',
        customer: 'cus_1',
        status: 'active',
        items: { data: [{ price: { id: 'price_x', unit_amount: 1500, currency: 'usd' }, ...item }] },
        ...sub
      }
    }
  })

  // The regression this pins: `current_period_end` moved onto the subscription ITEM in the 2025 API
  // versions. Reading only the subscription left currentPeriodEnd undefined on a modern account, so
  // the member's renewal date and users.subscriptionEndsAt were silently blank. Caught 2026-09-09 by
  // scripts/billing-scenarios.mjs, which had the same fallback and disagreed with the webhook.
  it('reads current_period_end off the ITEM when the subscription omits it', () => {
    expect(syncArgs(event({}, { current_period_end: 1_789_586_703 })).currentPeriodEnd).toBe(1_789_586_703_000)
  })

  it('still reads it off the subscription when it is there', () => {
    expect(syncArgs(event({ current_period_end: 1_700_000_500 })).currentPeriodEnd).toBe(1_700_000_500_000)
  })

  it('prefers the subscription over the item when both are present', () => {
    const both = event({ current_period_end: 1_700_000_500 }, { current_period_end: 1_789_586_703 })
    expect(syncArgs(both).currentPeriodEnd).toBe(1_700_000_500_000)
  })

  it('is undefined when neither carries one, rather than NaN or 0', () => {
    expect(syncArgs(event({})).currentPeriodEnd).toBeUndefined()
  })

  it('carries the schedule id whether Stripe sends it expanded or as a string', () => {
    expect(syncArgs(event({ schedule: 'sub_sched_1' })).stripeScheduleId).toBe('sub_sched_1')
    expect(syncArgs(event({ schedule: { id: 'sub_sched_2' } })).stripeScheduleId).toBe('sub_sched_2')
    expect(syncArgs(event({})).stripeScheduleId).toBeUndefined()
  })
})
