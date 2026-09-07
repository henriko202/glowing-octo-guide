import { describe, it, expect } from 'vitest'
import { buildTierDefaultRow, DEFAULTS, nextTier } from './planLimits'

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
