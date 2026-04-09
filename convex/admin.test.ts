import { describe, it, expect } from 'vitest'
import { validateLimitArgs } from './admin'

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
