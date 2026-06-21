import { describe, it, expect } from 'vitest'
import { buildPriceMap, resolveTier } from './stripePrices'

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
})
