import { describe, it, expect } from 'vitest'
import { buildTierDefaultRow, DEFAULTS, FEATURED_CAP_BONUS, nextTier } from './planLimits'
import { isUnlimitedFeatured } from './postLimit'

const TIERS = ['starter', 'growth', 'pro', 'contact'] as const

describe('buildTierDefaultRow', () => {
  it('includes every field a tier-default planLimits row needs, for every tier', () => {
    for (const tier of TIERS) {
      const row = buildTierDefaultRow(tier)
      expect(row.tier).toBe(tier)
      expect(typeof row.interactionsPerPost).toBe('number')
      expect(typeof row.postsPerWeek).toBe('number')
      expect(typeof row.featuredPerMonth).toBe('number')
    }
  })

  it('matches DEFAULTS for every tier (backlog/B27 single source of truth)', () => {
    for (const tier of TIERS) {
      expect(buildTierDefaultRow(tier)).toEqual({ tier, ...DEFAULTS[tier] })
    }
  })

  it('never sets userId, so it can never collide with a contact per-user override row', () => {
    for (const tier of TIERS) {
      expect('userId' in buildTierDefaultRow(tier)).toBe(false)
    }
  })
})

describe('DEFAULTS.contact featured cap', () => {
  it('defaults to the finite 5, below the unlimited sentinel, so a default contact member is capped', () => {
    expect(DEFAULTS.contact.featuredPerMonth).toBe(5)
    expect(isUnlimitedFeatured(DEFAULTS.contact.featuredPerMonth)).toBe(false)
  })

  it('leaves the sentinel reachable only as an explicit override, never via the tier default', () => {
    for (const tier of TIERS) {
      expect(isUnlimitedFeatured(buildTierDefaultRow(tier).featuredPerMonth)).toBe(false)
    }
    expect(isUnlimitedFeatured(9999)).toBe(true)
  })
})

describe('nextTier', () => {
  it('climbs the ladder', () => {
    expect(nextTier('starter')).toBe('growth')
    expect(nextTier('growth')).toBe('pro')
  })

  it('returns null at the top so callers render a contact line, never a checkout link', () => {
    expect(nextTier('pro')).toBeNull()
    expect(nextTier('contact')).toBeNull()
  })
})

describe('FEATURED_CAP_BONUS (backlog/R17)', () => {
  it('never lifts a bought post past the next tier’s plain cap — the ladder stays a ladder', () => {
    for (const tier of ['starter', 'growth'] as const) {
      const next = nextTier(tier)
      expect(next).not.toBeNull()
      expect(DEFAULTS[tier].interactionsPerPost + FEATURED_CAP_BONUS[tier]).toBeLessThanOrEqual(
        DEFAULTS[next!].interactionsPerPost
      )
    }
  })

  it('is the fixed table Henriko chose and gives contact nothing to buy', () => {
    expect(FEATURED_CAP_BONUS).toEqual({ starter: 25, growth: 50, pro: 100, contact: 0 })
  })
})
