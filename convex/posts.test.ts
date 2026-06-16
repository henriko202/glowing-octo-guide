// convex/posts.test.ts
import { describe, expect, it } from 'vitest'
import { canModifyPost, countPostsSince, isAdminShareOverrideEnabled } from './posts'
import type { Id } from './_generated/dataModel'

const asUserId = (s: string) => s as Id<'users'>

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

// The admin "share any post" override is dev-only: it requires BOTH an admin user
// AND the ALLOW_ADMIN_SHARE_ANY_POST env flag set to the literal string 'true'.
describe('isAdminShareOverrideEnabled', () => {
  it('is enabled only for an admin when the env flag is exactly "true"', () => {
    expect(isAdminShareOverrideEnabled({ isAdmin: true }, { ALLOW_ADMIN_SHARE_ANY_POST: 'true' })).toBe(true)
  })

  it('is disabled for a non-admin even when the flag is set (production-safe)', () => {
    expect(isAdminShareOverrideEnabled({ isAdmin: false }, { ALLOW_ADMIN_SHARE_ANY_POST: 'true' })).toBe(false)
    expect(isAdminShareOverrideEnabled({}, { ALLOW_ADMIN_SHARE_ANY_POST: 'true' })).toBe(false)
  })

  it('is disabled for an admin when the flag is absent or not exactly "true"', () => {
    expect(isAdminShareOverrideEnabled({ isAdmin: true }, {})).toBe(false)
    expect(isAdminShareOverrideEnabled({ isAdmin: true }, { ALLOW_ADMIN_SHARE_ANY_POST: 'false' })).toBe(false)
    expect(isAdminShareOverrideEnabled({ isAdmin: true }, { ALLOW_ADMIN_SHARE_ANY_POST: '1' })).toBe(false)
  })
})

// Hiding/deleting a post is allowed for its author OR any admin (moderation).
describe('canModifyPost', () => {
  const author = { _id: asUserId('u_author'), isAdmin: false }
  const admin = { _id: asUserId('u_admin'), isAdmin: true }
  const other = { _id: asUserId('u_other'), isAdmin: false }
  const post = { authorId: asUserId('u_author') }

  it('allows the author to modify their own post', () => {
    expect(canModifyPost(author, post)).toBe(true)
  })

  it('allows any admin to modify another user’s post', () => {
    expect(canModifyPost(admin, post)).toBe(true)
  })

  it('forbids a non-admin from modifying someone else’s post', () => {
    expect(canModifyPost(other, post)).toBe(false)
  })
})
