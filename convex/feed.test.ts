import { describe, it, expect } from 'vitest'
import { buildFeedFilter } from './feed'

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
