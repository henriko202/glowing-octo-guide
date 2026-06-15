import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { toSubscriptionStatus, getTierFromPriceId } from './stripe'

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

describe('getTierFromPriceId', () => {
  const ENV = { ...process.env }
  beforeEach(() => {
    process.env.STRIPE_STARTER_PRICE_ID = 'price_starter'
    process.env.STRIPE_GROWTH_PRICE_ID = 'price_growth'
    process.env.STRIPE_PRO_PRICE_ID = 'price_pro'
  })
  afterEach(() => {
    process.env = { ...ENV }
  })

  it('maps configured price ids to their tiers', () => {
    expect(getTierFromPriceId('price_starter')).toBe('starter')
    expect(getTierFromPriceId('price_growth')).toBe('growth')
    expect(getTierFromPriceId('price_pro')).toBe('pro')
  })

  it('blank or unknown priceId → starter (safe default)', () => {
    expect(getTierFromPriceId('')).toBe('starter')
    expect(getTierFromPriceId('price_unknown')).toBe('starter')
  })

  it('does NOT collapse a blank priceId into a tier when env vars are unset', () => {
    delete process.env.STRIPE_STARTER_PRICE_ID
    delete process.env.STRIPE_GROWTH_PRICE_ID
    delete process.env.STRIPE_PRO_PRICE_ID
    expect(getTierFromPriceId('')).toBe('starter')
    expect(getTierFromPriceId('anything')).toBe('starter')
  })
})
