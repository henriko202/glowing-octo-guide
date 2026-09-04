import { describe, expect, it } from 'vitest'
import { ConvexError } from 'convex/values'
import { friendlyError } from './errors'

describe('friendlyError', () => {
  it('extracts the developer message from a framed Convex dev error', () => {
    const err = new Error(
      '[CONVEX A(posts:submitPost)] [Request ID: 9c1ce21ea3945ef4] Server Error ' +
        "Uncaught Error: This post doesn't belong to your LinkedIn account. " +
        'at handler (../convex/posts.ts:245:19) Called by client'
    )
    expect(friendlyError(err, 'fallback')).toBe("This post doesn't belong to your LinkedIn account.")
  })

  it('returns ConvexError string data directly', () => {
    expect(friendlyError(new ConvexError('Weekly limit reached'), 'fallback')).toBe('Weekly limit reached')
  })

  it('reads .message from ConvexError object data', () => {
    expect(friendlyError(new ConvexError({ code: 'X', message: 'Nope' }), 'fallback')).toBe('Nope')
  })

  it('falls back on a redacted/empty production error', () => {
    const err = new Error('[CONVEX M(posts:submitPost)] [Request ID: abc] Server Error')
    expect(friendlyError(err, 'fallback')).toBe('fallback')
  })

  it('falls back on non-Error values', () => {
    expect(friendlyError('boom', 'fallback')).toBe('fallback')
    expect(friendlyError(undefined, 'fallback')).toBe('fallback')
  })

  it('preserves a bare sentinel message for startsWith checks', () => {
    const err = new Error(
      '[CONVEX M(interactions:react)] [Request ID: z] Server Error ' +
        'Uncaught Error: PAYMENT_REQUIRED at handler (../convex/interactions.ts:20:11) Called by client'
    )
    expect(friendlyError(err, 'fallback').startsWith('PAYMENT_REQUIRED')).toBe(true)
  })
})
