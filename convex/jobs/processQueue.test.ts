import { describe, it, expect } from 'vitest'
import { computeCapacity, shouldRescheduleQueue } from './processQueue'

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

// The spin-loop guard: a full batch whose authors are all at their weekly cap makes zero progress
// and must stop instead of rescheduling itself with runAfter(0) until capacity opens.
describe('shouldRescheduleQueue', () => {
  it('reschedules a full batch that made progress', () => {
    expect(shouldRescheduleQueue(true, 1)).toBe(true)
  })

  it('does not reschedule a full batch with zero progress', () => {
    expect(shouldRescheduleQueue(true, 0)).toBe(false)
  })

  it('does not reschedule a partial batch even when it made progress', () => {
    expect(shouldRescheduleQueue(false, 5)).toBe(false)
  })
})
