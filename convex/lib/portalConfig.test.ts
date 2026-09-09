import { describe, expect, it } from 'vitest'
import { PORTAL_TIERS, portalTierFor, tiersOfferedTo } from './portalConfig'

describe('portalTierFor', () => {
  it('gives each known tier its own configuration', () => {
    expect(portalTierFor('starter')).toBe('starter')
    expect(portalTierFor('growth')).toBe('growth')
    expect(portalTierFor('pro')).toBe('pro')
  })

  // The whole point of the module: an unreadable tier must never be handed a configuration that
  // lists a cheaper plan, because that is the credited downgrade (B07) coming back.
  it('clamps everything else to the most restrictive configuration', () => {
    expect(portalTierFor('contact')).toBe('pro')
    expect(portalTierFor(undefined)).toBe('pro')
    expect(portalTierFor('')).toBe('pro')
    expect(portalTierFor('Growth')).toBe('pro')
    expect(portalTierFor('enterprise')).toBe('pro')
  })
})

describe('tiersOfferedTo', () => {
  it('offers a tier itself and everything above it', () => {
    expect(tiersOfferedTo('starter')).toEqual(['starter', 'growth', 'pro'])
    expect(tiersOfferedTo('growth')).toEqual(['growth', 'pro'])
    expect(tiersOfferedTo('pro')).toEqual(['pro'])
  })

  it('never offers a cheaper tier to anyone', () => {
    const rank = (t: string) => PORTAL_TIERS.indexOf(t as (typeof PORTAL_TIERS)[number])
    for (const tier of PORTAL_TIERS) {
      for (const offered of tiersOfferedTo(tier)) {
        expect(rank(offered)).toBeGreaterThanOrEqual(rank(tier))
      }
    }
  })

  // Starter's configuration is the one that already exists, which is what makes the change additive.
  it('leaves the Starter configuration listing every tier', () => {
    expect(tiersOfferedTo('starter')).toEqual([...PORTAL_TIERS])
  })
})
