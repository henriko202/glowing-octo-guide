import { describe, expect, it, beforeEach } from 'vitest'
import { gatePlan, resolveTargetPlan } from './targetPlan'

describe('resolveTargetPlan', () => {
  beforeEach(() => sessionStorage.clear())

  it('prefers a valid ?plan= param', () => {
    expect(resolveTargetPlan(new URLSearchParams('plan=pro'))).toBe('pro')
  })

  it('falls back to the stashed chosenPlan', () => {
    sessionStorage.setItem('chosenPlan', 'starter')
    expect(resolveTargetPlan(new URLSearchParams(''))).toBe('starter')
  })

  it('defaults to growth when both are absent or invalid', () => {
    expect(resolveTargetPlan(new URLSearchParams('plan=bogus'))).toBe('growth')
    expect(resolveTargetPlan(null)).toBe('growth')
  })
})

describe('gatePlan', () => {
  it('offers the Pro trial whatever was chosen, and the chosen plan once no trial is left', () => {
    const chose = new URLSearchParams('plan=starter')
    expect(gatePlan(chose, true)).toBe('pro')
    expect(gatePlan(chose, false)).toBe('starter')
  })
})
