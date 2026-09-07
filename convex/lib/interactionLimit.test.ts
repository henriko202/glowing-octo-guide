import { describe, it, expect } from 'vitest'
import { isNearInteractionLimit, shouldFlipInteractionLimit } from './interactionLimit'

describe('shouldFlipInteractionLimit', () => {
  it('returns false when under limit', () => {
    expect(shouldFlipInteractionLimit(10, 10, 25, false)).toBe(false)
  })

  it('returns true when exactly at limit and not already reached', () => {
    expect(shouldFlipInteractionLimit(12, 13, 25, false)).toBe(true)
  })

  it('returns false when at limit but already reached', () => {
    expect(shouldFlipInteractionLimit(20, 5, 25, true)).toBe(false)
  })

  it('returns true when over limit and not already reached', () => {
    expect(shouldFlipInteractionLimit(20, 10, 25, false)).toBe(true)
  })
})

describe('isNearInteractionLimit', () => {
  it('is true from ceil(80%) of the cap up to cap-1', () => {
    expect(isNearInteractionLimit(19, 0, 25)).toBe(false) // 19 < ceil(20)
    expect(isNearInteractionLimit(20, 0, 25)).toBe(true)
    expect(isNearInteractionLimit(18, 6, 25)).toBe(true) // 24
    expect(isNearInteractionLimit(20, 5, 25)).toBe(false) // capped
  })
  it('is false for a zero or negative cap', () => {
    expect(isNearInteractionLimit(0, 0, 0)).toBe(false)
    expect(isNearInteractionLimit(5, 5, -1)).toBe(false)
  })
})
