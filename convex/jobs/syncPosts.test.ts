import { describe, it, expect } from 'vitest'
import { countInWindow } from './syncPosts'

describe('countInWindow', () => {
  const since = 1_000_000

  it('counts posts within the window', () => {
    const posts = [
      { publishedAt: 1_000_001 },
      { publishedAt: 1_000_002 },
      { publishedAt: 999_999 },  // outside window
    ]
    expect(countInWindow(posts, since)).toBe(2)
  })

  it('returns 0 when no posts are in the window', () => {
    const posts = [{ publishedAt: 999_998 }, { publishedAt: 500_000 }]
    expect(countInWindow(posts, since)).toBe(0)
  })

  it('includes the boundary timestamp', () => {
    const posts = [{ publishedAt: 1_000_000 }]  // exactly at boundary
    expect(countInWindow(posts, since)).toBe(1)
  })

  it('returns 0 for empty array', () => {
    expect(countInWindow([], since)).toBe(0)
  })
})
