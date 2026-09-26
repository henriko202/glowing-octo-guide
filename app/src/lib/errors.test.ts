import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ConvexError } from 'convex/values'
import { friendlyError, mapLimitError } from './errors'
import { captureException } from './observability/sentry'

vi.mock('./observability/sentry', () => ({ captureException: vi.fn() }))

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

  describe('reporting', () => {
    beforeEach(() => vi.mocked(captureException).mockClear())

    // Production redacts a plain Error to "Server Error": the member sees the fallback, Sentry keeps the request ID.
    it('reports an error the backend did not choose to throw', () => {
      const err = new Error('[CONVEX A(ai/comments:generateComment)] [Request ID: abc] Server Error')
      friendlyError(err, 'fallback')
      expect(captureException).toHaveBeenCalledTimes(1)
      expect(captureException).toHaveBeenCalledWith(err)
    })

    it('never reports a ConvexError, the answer the backend gives on purpose', () => {
      friendlyError(new ConvexError('WEEKLY_LIMIT:2'), 'fallback')
      expect(captureException).not.toHaveBeenCalled()
    })
  })
})

describe('mapLimitError', () => {
  const t = ((key: string, opts?: { limit?: number }) => `${key}:${opts?.limit}`) as never

  it('maps the weekly-cap code to a localized string with the number', () => {
    expect(mapLimitError('WEEKLY_LIMIT:2', t)).toBe('errors.weeklyLimit:2')
  })

  it('maps the featured-cap code', () => {
    expect(mapLimitError('FEATURED_LIMIT:1', t)).toBe('errors.featuredLimit:1')
  })

  it('passes anything else through untouched', () => {
    expect(mapLimitError('Something else broke', t)).toBe('Something else broke')
  })

  // F7: admin.ts's validateLimitArgs rejects values below 1 but never enforces an integer, so a
  // non-integer plan limit (e.g. postsPerWeek set to 2.5) can reach here — it must still localize,
  // not leak the raw "WEEKLY_LIMIT:2.5" code to the member.
  it('still localizes a non-integer limit value instead of leaking the raw code', () => {
    expect(mapLimitError('WEEKLY_LIMIT:2.5', t)).toBe('errors.weeklyLimit:2.5')
  })
})
