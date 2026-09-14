import { describe, expect, it } from 'vitest'
import { capDistribution, digestWindow, movement, pickPreviousGeneration, positionOf, topEntries } from './ranking'

describe('positionOf', () => {
  it('finds the first index of a count in a descending array', () => {
    expect(positionOf(7, [9, 7, 7, 5])).toBe(2)
    expect(positionOf(9, [9, 7])).toBe(1)
  })

  it('returns null for zero or an absent count', () => {
    expect(positionOf(0, [9, 7])).toBeNull()
    expect(positionOf(4, [9, 7])).toBeNull()
  })
})

describe('movement', () => {
  it('is positive when the position number went down', () => {
    expect(movement(12, 8)).toBe(4)
    expect(movement(8, 12)).toBe(-4)
    expect(movement(8, 8)).toBe(0)
    expect(movement(null, 8)).toBeNull()
    expect(movement(12, null)).toBeNull()
  })
})

describe('pickPreviousGeneration', () => {
  it('picks the newest generation at or before the last digest, null when none', () => {
    const gens = [{ generatedAt: 300 }, { generatedAt: 200 }, { generatedAt: 100 }]
    expect(pickPreviousGeneration(gens, 250)).toEqual({ generatedAt: 200 })
    expect(pickPreviousGeneration(gens, 50)).toBeNull()
  })
})

describe('digestWindow', () => {
  it('spans three days from the last send, or three days back when never sent', () => {
    const now = 10 * 86_400_000
    expect(digestWindow(now, 4 * 86_400_000)).toEqual({ since: 7 * 86_400_000, until: now })
    expect(digestWindow(now, undefined)).toEqual({ since: 7 * 86_400_000, until: now })
  })

  it('never reaches back more than three days even when lastDigestAt is old', () => {
    const now = 100 * 86_400_000
    expect(digestWindow(now, 10 * 86_400_000)).toEqual({ since: 97 * 86_400_000, until: now })
  })
})

describe('topEntries', () => {
  it('sorts by count desc then lastAt desc then id asc and slices', () => {
    const map = new Map([
      ['b', { count: 2, lastAt: 100 }],
      ['a', { count: 2, lastAt: 200 }],
      ['c', { count: 1, lastAt: 300 }]
    ])
    expect(topEntries(map, 2).map(e => e.userId)).toEqual(['a', 'b'])
  })
})

describe('capDistribution', () => {
  it('returns the counts unchanged when at or below the cap', () => {
    expect(capDistribution([5, 3, 1], 3)).toEqual({ counts: [5, 3, 1], capped: false })
    expect(capDistribution([], 3)).toEqual({ counts: [], capped: false })
  })

  it('slices to the cap and flags the drop when above it', () => {
    expect(capDistribution([5, 4, 3, 2], 3)).toEqual({ counts: [5, 4, 3], capped: true })
  })
})
