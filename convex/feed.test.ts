import { describe, it, expect } from 'vitest'
import { buildFeedFilter, toFeedAuthor, isAuthorFeedEligible } from './feed'

describe('buildFeedFilter', () => {
  it('starter: no filters applied', () => {
    const filter = buildFeedFilter({ tier: 'starter', industry: 'tech', country: 'US' })
    expect(filter.applyIndustry).toBe(false)
    expect(filter.applyCountry).toBe(false)
  })

  it('growth: filters by user industry and country', () => {
    const filter = buildFeedFilter({ tier: 'growth', industry: 'tech', country: 'US' })
    expect(filter.applyIndustry).toBe(true)
    expect(filter.applyCountry).toBe(true)
    expect(filter.industries).toEqual(['tech'])
    expect(filter.countries).toEqual(['US'])
  })

  it('pro with overrides: uses provided filter lists', () => {
    const filter = buildFeedFilter({
      tier: 'pro',
      industry: 'tech',
      country: 'US',
      filterIndustries: ['tech', 'finance'],
      filterCountries: ['US', 'GB']
    })
    expect(filter.applyIndustry).toBe(true)
    expect(filter.applyCountry).toBe(true)
    expect(filter.industries).toEqual(['tech', 'finance'])
    expect(filter.countries).toEqual(['US', 'GB'])
  })

  it('pro with no overrides: no filters applied', () => {
    const filter = buildFeedFilter({ tier: 'pro', industry: 'tech', country: 'US' })
    expect(filter.applyIndustry).toBe(false)
    expect(filter.applyCountry).toBe(false)
  })

  it('contact tier: same behavior as pro (respects filterIndustries)', () => {
    const filter = buildFeedFilter({
      tier: 'contact',
      industry: 'tech',
      country: 'US',
      filterIndustries: ['tech'],
      filterCountries: []
    })
    expect(filter.applyIndustry).toBe(true)
    expect(filter.applyCountry).toBe(false)
  })
})

describe('toFeedAuthor', () => {
  it('returns only display fields and strips secrets/internal fields', () => {
    const author = {
      _id: 'u1',
      _creationTime: 0,
      name: 'Jordan',
      headline: 'Engineer',
      profilePictureUrl: 'https://x/y.jpg',
      industry: '4',
      country: 'BR',
      tier: 'pro',
      linkedinId: 'li1',
      linkedinAccessToken: 'secret',
      linkedinRefreshToken: 'secret2',
      tokenExpiresAt: 1,
      isAdmin: true,
      isBanned: true,
      bannedReason: 'x',
      bannedBy: 'admin1',
      bannedAt: 2,
      stripeCustomerId: 'cus_1',
      subscriptionStatus: 'active',
      trialEndsAt: 3,
      linkedinPublicIdentifier: 'jordan'
    } as any
    const safe = toFeedAuthor(author) as Record<string, unknown>
    expect(safe).toEqual({
      _id: 'u1',
      name: 'Jordan',
      headline: 'Engineer',
      profilePictureUrl: 'https://x/y.jpg',
      industry: '4',
      country: 'BR',
      tier: 'pro'
    })
    for (const k of [
      'isAdmin',
      'stripeCustomerId',
      'linkedinId',
      'linkedinAccessToken',
      'isBanned',
      'bannedBy',
      'subscriptionStatus',
      'linkedinPublicIdentifier'
    ]) {
      expect(k in safe).toBe(false)
    }
  })
})

describe('isAuthorFeedEligible', () => {
  it('includes an active author', () => {
    expect(isAuthorFeedEligible({ subscriptionStatus: 'active' })).toBe(true)
  })
  it('excludes a trialing author', () => {
    expect(isAuthorFeedEligible({ subscriptionStatus: 'active', deletionScheduledAt: undefined })).toBe(true)
    expect(isAuthorFeedEligible({ subscriptionStatus: 'trialing' })).toBe(false)
  })
  it('excludes an author pending deletion', () => {
    expect(isAuthorFeedEligible({ subscriptionStatus: 'active', deletionScheduledAt: 123 })).toBe(false)
  })
  it('excludes a missing author', () => {
    expect(isAuthorFeedEligible(null)).toBe(false)
  })
})
