// convex/jobs/syncPosts.test.ts
import { describe, it, expect } from 'vitest'
import { isSamePostAuthor } from './syncPosts'

// The cross-author write guard: upsertPost's existing-URN branch must only patch a row when the
// incoming authorId matches the stored authorId.
describe('isSamePostAuthor', () => {
  it('returns true for equal author ids', () => {
    expect(isSamePostAuthor('users_123', 'users_123')).toBe(true)
  })

  it('returns false for different author ids', () => {
    expect(isSamePostAuthor('users_123', 'users_456')).toBe(false)
  })
})
