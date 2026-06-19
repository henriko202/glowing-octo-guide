import { describe, it, expect } from 'vitest'
import { shouldFlipInteractionLimit } from './interactionLimit'

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
