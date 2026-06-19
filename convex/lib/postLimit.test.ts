import { describe, it, expect } from 'vitest'
import { isWeeklyLimitReached } from './postLimit'

describe('isWeeklyLimitReached', () => {
  it('returns false when under limit', () => {
    expect(isWeeklyLimitReached(1, 3)).toBe(false)
    expect(isWeeklyLimitReached(0, 3)).toBe(false)
  })

  it('returns true when exactly at limit', () => {
    expect(isWeeklyLimitReached(3, 3)).toBe(true)
  })

  it('returns true when over limit', () => {
    expect(isWeeklyLimitReached(5, 3)).toBe(true)
  })

  it('handles starter tier edge: limit of 1', () => {
    expect(isWeeklyLimitReached(0, 1)).toBe(false)
    expect(isWeeklyLimitReached(1, 1)).toBe(true)
  })
})
