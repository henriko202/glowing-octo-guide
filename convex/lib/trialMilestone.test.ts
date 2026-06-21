import { describe, it, expect } from 'vitest'
import { crossesThreshold, TRIAL_INTERACTION_THRESHOLD } from './trialMilestone'

describe('trialMilestone', () => {
  it('threshold is 50', () => {
    expect(TRIAL_INTERACTION_THRESHOLD).toBe(50)
  })
  it('crosses only on the +1 that reaches 50', () => {
    expect(crossesThreshold(49, 1)).toBe(true)
    expect(crossesThreshold(48, 1)).toBe(false)
    expect(crossesThreshold(50, 1)).toBe(false) // already past — fire once only
    expect(crossesThreshold(0, 1)).toBe(false)
  })
})
