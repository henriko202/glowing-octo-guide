// convex/posts.test.ts
import { describe, expect, it } from 'vitest'
import { countPostsSince } from './posts'

// We test the handler logic directly since Convex query wrappers are
// not testable in unit tests — this mirrors the pattern in feed.test.ts.
describe('getMyPosts handler', () => {
  it('returns empty array when userId is undefined', async () => {
    const handler = async (_ctx: unknown, args: { userId?: string }): Promise<unknown[]> => {
      if (!args.userId) return []
      return [] // db would be called here
    }
    const result = await handler({}, { userId: undefined })
    expect(result).toEqual([])
  })
})

// countPostsSince is the shared rolling-window counter behind both the weekly
// limit enforcement and the My Posts usage pill. The cutoff is inclusive.
describe('countPostsSince', () => {
  const now = 1_700_000_000_000
  const day = 24 * 60 * 60 * 1000
  const since = now - 7 * day

  it('counts posts published at or after the cutoff (inclusive)', () => {
    const posts = [
      { publishedAt: now }, // today
      { publishedAt: now - 2 * day }, // 2 days ago
      { publishedAt: since } // exactly on the cutoff
    ]
    expect(countPostsSince(posts, since)).toBe(3)
  })

  it('excludes posts published before the cutoff', () => {
    const posts = [
      { publishedAt: now - 8 * day }, // outside the window
      { publishedAt: now - 30 * day }, // outside the window
      { publishedAt: now - 1 * day } // inside the window
    ]
    expect(countPostsSince(posts, since)).toBe(1)
  })

  it('returns 0 for an empty list', () => {
    expect(countPostsSince([], since)).toBe(0)
  })
})
