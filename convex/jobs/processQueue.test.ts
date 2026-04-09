import { describe, it, expect } from 'vitest'
import { computeCapacity } from './processQueue'

describe('computeCapacity', () => {
  it('returns positive capacity when under limit', () => {
    expect(computeCapacity(0, 2)).toBe(2)
    expect(computeCapacity(1, 2)).toBe(1)
  })

  it('returns 0 when at or above limit', () => {
    expect(computeCapacity(2, 2)).toBe(0)
    expect(computeCapacity(3, 2)).toBe(0)
  })

  it('never returns negative', () => {
    expect(computeCapacity(5, 1)).toBe(0)
  })
})
