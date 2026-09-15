import { describe, expect, it } from 'vitest'
import { DIGEST_SPAN_MS, isDigestAddressEnabled, isDigestDue } from './digest'

const NOW = Date.now()

describe('isDigestAddressEnabled', () => {
  it('keeps the postal address unless the flag is exactly "false"', () => {
    expect(isDigestAddressEnabled({})).toBe(true)
    expect(isDigestAddressEnabled({ INCLUDE_DIGEST_ADDRESS: 'true' })).toBe(true)
    expect(isDigestAddressEnabled({ INCLUDE_DIGEST_ADDRESS: 'false' })).toBe(false)
    expect(isDigestAddressEnabled({ INCLUDE_DIGEST_ADDRESS: 'FALSE' })).toBe(true)
    expect(isDigestAddressEnabled({ INCLUDE_DIGEST_ADDRESS: '' })).toBe(true)
  })
})

describe('isDigestDue', () => {
  it('is due when never sent, when 3+ days old and when explicitly enabled', () => {
    expect(isDigestDue({ email: 'a@b.c' }, NOW)).toBe(true)
    expect(isDigestDue({ email: 'a@b.c', lastDigestAt: NOW - DIGEST_SPAN_MS }, NOW)).toBe(true)
    expect(isDigestDue({ email: 'a@b.c', lastDigestAt: NOW - DIGEST_SPAN_MS + 1 }, NOW)).toBe(false)
  })

  it('is never due for disabled, banned, deleting or email-less members', () => {
    expect(isDigestDue({ email: 'a@b.c', digestEmailsEnabled: false }, NOW)).toBe(false)
    expect(isDigestDue({ email: 'a@b.c', isBanned: true }, NOW)).toBe(false)
    expect(isDigestDue({ email: 'a@b.c', deletionScheduledAt: NOW }, NOW)).toBe(false)
    expect(isDigestDue({}, NOW)).toBe(false)
  })
})
