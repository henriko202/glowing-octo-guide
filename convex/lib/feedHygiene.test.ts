import { describe, expect, it } from 'vitest'
import { INTERACTED_TTL_MS, lastInteractedAt, toFeedViewerState, viewerPostStatus } from './feedHygiene'

const NOW = 10_000_000
const H = 3_600_000

describe('INTERACTED_TTL_MS', () => {
  it('is 24 hours', () => {
    expect(INTERACTED_TTL_MS).toBe(24 * H)
  })
})

describe('lastInteractedAt', () => {
  it('is undefined for a row with only a draft', () => {
    expect(lastInteractedAt({})).toBeUndefined()
  })
  it('is the later of reactedAt and commentedAt', () => {
    expect(lastInteractedAt({ reactedAt: 5 })).toBe(5)
    expect(lastInteractedAt({ commentedAt: 7 })).toBe(7)
    expect(lastInteractedAt({ reactedAt: 5, commentedAt: 7 })).toBe(7)
    expect(lastInteractedAt({ reactedAt: 9, commentedAt: 7 })).toBe(9)
  })
})

describe('viewerPostStatus', () => {
  it('is fresh with no row or a row that only holds a draft', () => {
    expect(viewerPostStatus(null, NOW)).toBe('fresh')
    expect(viewerPostStatus({}, NOW)).toBe('fresh')
  })
  it('is done inside the 24 h window and gone once it elapses', () => {
    expect(viewerPostStatus({ reactedAt: NOW - 23 * H }, NOW)).toBe('done')
    expect(viewerPostStatus({ commentedAt: NOW - INTERACTED_TTL_MS + 1 }, NOW)).toBe('done')
    expect(viewerPostStatus({ reactedAt: NOW - INTERACTED_TTL_MS }, NOW)).toBe('gone')
  })
  it('restarts the window from the later interaction', () => {
    expect(viewerPostStatus({ reactedAt: NOW - 30 * H, commentedAt: NOW - 2 * H }, NOW)).toBe('done')
  })
  it('is gone at once when hidden, whatever the timestamps say', () => {
    expect(viewerPostStatus({ reactedAt: NOW - 1, hiddenAt: NOW }, NOW)).toBe('gone')
  })
})

describe('toFeedViewerState', () => {
  it('is null for an untouched post', () => {
    expect(toFeedViewerState(null)).toBeNull()
    expect(toFeedViewerState({})).toBeNull()
  })
  it('reports which actions happened and when the post leaves', () => {
    expect(toFeedViewerState({ reactedAt: 100 })).toEqual({
      reacted: true,
      commented: false,
      hidesAt: 100 + INTERACTED_TTL_MS
    })
    expect(toFeedViewerState({ reactedAt: 100, commentedAt: 300 })).toEqual({
      reacted: true,
      commented: true,
      hidesAt: 300 + INTERACTED_TTL_MS
    })
  })
})
