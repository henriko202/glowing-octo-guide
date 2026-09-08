import { describe, it, expect } from 'vitest'
import { buildPriceMap, resolveTier, starterPriceIdFor } from './stripePrices'

const ENV = {
  STRIPE_STARTER_PRICE_ID: 'price_s_m',
  STRIPE_GROWTH_PRICE_ID: 'price_g_m',
  STRIPE_PRO_PRICE_ID: 'price_p_m',
  STRIPE_STARTER_ANNUAL_PRICE_ID: 'price_s_y',
  STRIPE_GROWTH_ANNUAL_PRICE_ID: 'price_g_y',
  STRIPE_PRO_ANNUAL_PRICE_ID: 'price_p_y'
}

describe('stripePrices', () => {
  it('maps every monthly and annual id to its tier', () => {
    const map = buildPriceMap(ENV)
    expect(resolveTier(map, 'price_s_m')).toBe('starter')
    expect(resolveTier(map, 'price_g_y')).toBe('growth')
    expect(resolveTier(map, 'price_p_y')).toBe('pro')
  })

  it('defaults unknown or blank ids to starter', () => {
    const map = buildPriceMap(ENV)
    expect(resolveTier(map, 'price_unknown')).toBe('starter')
    expect(resolveTier(map, '')).toBe('starter')
  })

  it('omits unset env vars from the map (no blank-key collision)', () => {
    const map = buildPriceMap({ STRIPE_GROWTH_PRICE_ID: 'price_g_m' })
    expect(Object.keys(map)).toEqual(['price_g_m'])
    expect(map['']).toBeUndefined()
  })

  it('never maps the one-time featured-post price to a tier (backlog/R17)', () => {
    const map = buildPriceMap({ ...ENV, STRIPE_FEATURED_POST_PRICE_ID: 'price_feat' })
    expect(resolveTier(map, 'price_feat')).toBe('starter') // the "unknown id" default, not a tier of its own
    expect(Object.keys(map)).not.toContain('price_feat')
  })
})

describe('starterPriceIdFor', () => {
  it('picks the annual Starter price only for year, monthly otherwise', () => {
    expect(starterPriceIdFor(ENV, 'year')).toBe('price_s_y')
    expect(starterPriceIdFor(ENV, 'month')).toBe('price_s_m')
    expect(starterPriceIdFor(ENV, undefined)).toBe('price_s_m')
    expect(starterPriceIdFor({}, 'year')).toBeUndefined()
  })
})
