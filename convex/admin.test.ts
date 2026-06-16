import { describe, it, expect } from 'vitest'
import { validateLimitArgs, assertNotSelfBan, effectiveContactLimits } from './admin'

describe('validateLimitArgs', () => {
  it('passes with valid positive values', () => {
    expect(() => validateLimitArgs(25, 1)).not.toThrow()
    expect(() => validateLimitArgs(1, 1)).not.toThrow()
    expect(() => validateLimitArgs(200, 5)).not.toThrow()
  })

  it('throws when interactionsPerPost < 1', () => {
    expect(() => validateLimitArgs(0, 1)).toThrow('>= 1')
    expect(() => validateLimitArgs(-1, 1)).toThrow('>= 1')
  })

  it('throws when postsPerWeek < 1', () => {
    expect(() => validateLimitArgs(25, 0)).toThrow('>= 1')
    expect(() => validateLimitArgs(25, -5)).toThrow('>= 1')
  })
})

describe('assertNotSelfBan', () => {
  it('throws when an admin targets their own id', () => {
    expect(() => assertNotSelfBan('admin1', 'admin1')).toThrow("can't ban yourself")
  })

  it('does not throw when targeting a different user', () => {
    expect(() => assertNotSelfBan('admin1', 'user2')).not.toThrow()
  })
})

describe('effectiveContactLimits', () => {
  const def = { interactionsPerPost: 200, postsPerWeek: 5 }

  it('uses the override and flags hasOverride when one exists', () => {
    expect(effectiveContactLimits({ interactionsPerPost: 500, postsPerWeek: 10 }, def)).toEqual({
      interactionsPerPost: 500,
      postsPerWeek: 10,
      hasOverride: true
    })
  })

  it('falls back to the contact default (no override) when none exists', () => {
    expect(effectiveContactLimits(undefined, def)).toEqual({
      interactionsPerPost: 200,
      postsPerWeek: 5,
      hasOverride: false
    })
  })

  it('falls back to hardcoded contact defaults when no default row exists', () => {
    expect(effectiveContactLimits(undefined, undefined)).toEqual({
      interactionsPerPost: 200,
      postsPerWeek: 5,
      hasOverride: false
    })
  })
})
