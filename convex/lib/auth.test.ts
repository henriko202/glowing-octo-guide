import { describe, it, expect } from 'vitest'
import { ConvexError } from 'convex/values'
import { assertNotBanned } from './auth'

describe('assertNotBanned', () => {
  it('does not throw for a user with no ban flag', () => {
    expect(() => assertNotBanned({})).not.toThrow()
    expect(() => assertNotBanned({ isBanned: false })).not.toThrow()
  })

  it('throws "Account suspended" for a banned user', () => {
    expect(() => assertNotBanned({ isBanned: true })).toThrow('Account suspended')
  })

  // ConvexError (not plain Error) so the message survives production redaction.
  it('throws a ConvexError for a banned user', () => {
    expect(() => assertNotBanned({ isBanned: true })).toThrow(ConvexError)
  })
})
