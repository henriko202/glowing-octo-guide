import { describe, it, expect } from 'vitest'
import { clampHistoryPageSize } from './interactions'

// listMyInteractions passes the clamped size to .paginate(); the wrapper itself is covered by the
// typecheck + the grep for MAX_HISTORY_PAGE. This pins the bound so the clamp can't be dropped.
describe('clampHistoryPageSize', () => {
  it('caps a page request above the history maximum at 100', () => {
    expect(clampHistoryPageSize(1000)).toBe(100)
    expect(clampHistoryPageSize(101)).toBe(100)
  })

  it('passes a normal page size through unchanged', () => {
    expect(clampHistoryPageSize(20)).toBe(20)
    expect(clampHistoryPageSize(100)).toBe(100)
  })

  it('floors at 1 so a zero/negative request can never ask for an empty page', () => {
    expect(clampHistoryPageSize(0)).toBe(1)
    expect(clampHistoryPageSize(-5)).toBe(1)
  })
})
