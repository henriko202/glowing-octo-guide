import { describe, expect, it } from 'vitest'
import { PORTAL_TIERS, PORTAL_TRIAL_KEY, portalConfigKeyFor, portalTierFor, tiersOfferedTo } from './portalConfig'

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

// The free-year hole found 2026-09-18: the portal's plan picker is live during a trial
// (continue_trial), and a promotion-code discount is not consumed until the first invoice after the
// trial ends — so a trial member switching to annual made the trial-end invoice annual and 100% off.
describe('portalConfigKeyFor', () => {
  it('sends a trialing member to the trial config, whatever their tier', () => {
    expect(portalConfigKeyFor('growth', 'trialing')).toBe(PORTAL_TRIAL_KEY)
    expect(portalConfigKeyFor('starter', 'trialing')).toBe(PORTAL_TRIAL_KEY)
    expect(portalConfigKeyFor('pro', 'trialing')).toBe(PORTAL_TRIAL_KEY)
    expect(portalConfigKeyFor(undefined, 'trialing')).toBe(PORTAL_TRIAL_KEY)
  })

  it('leaves every other status on its tier configuration, past_due included', () => {
    expect(portalConfigKeyFor('growth', 'active')).toBe('growth')
    expect(portalConfigKeyFor('growth', 'past_due')).toBe('growth')
    expect(portalConfigKeyFor('growth', 'canceled')).toBe('growth')
    expect(portalConfigKeyFor('growth', undefined)).toBe('growth')
    expect(portalConfigKeyFor('mystery', 'active')).toBe('pro')
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
