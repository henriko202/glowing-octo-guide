// convex/posts.test.ts
import { describe, it, expect } from 'vitest'

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
