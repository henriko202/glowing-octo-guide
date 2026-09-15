import { describe, expect, it } from 'vitest'
import { isNewRecord, RECORD_COOLDOWN_MS, RECORD_FLOOR } from './recordPost'

const NOW = 1_800_000_000_000

describe('isNewRecord', () => {
  it('never fires below the floor', () => {
    expect(isNewRecord(RECORD_FLOOR - 1, 0, NOW)).toBe(false)
    expect(isNewRecord(0, 0, NOW)).toBe(false)
  })

  it('fires at the floor on a first record', () => {
    expect(isNewRecord(RECORD_FLOOR, 0, NOW)).toBe(true)
  })

  it('requires strictly beating the stored best', () => {
    expect(isNewRecord(6, 6, NOW)).toBe(false)
    expect(isNewRecord(7, 6, NOW)).toBe(true)
  })

  it('holds the 7-day cooldown and fires once it has passed', () => {
    expect(isNewRecord(9, 8, NOW, NOW - RECORD_COOLDOWN_MS)).toBe(false)
    expect(isNewRecord(9, 8, NOW, NOW - RECORD_COOLDOWN_MS - 1)).toBe(true)
  })

  it('fires without a prior notification stamp', () => {
    expect(isNewRecord(9, 8, NOW, undefined)).toBe(true)
  })
})
