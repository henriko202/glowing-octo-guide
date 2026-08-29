import { describe, it, expect } from 'vitest'
import { isInRefreshWindow } from './tokenRefresh'

const NOW = 1_000_000
const WINDOW = 7 * 24 * 60 * 60 * 1000

describe('isInRefreshWindow', () => {
  it('is true when tokenExpiresAt is inside [now, now+window) and a refresh token is on file', () => {
    expect(isInRefreshWindow({ tokenExpiresAt: NOW + 1000, linkedinRefreshToken: 'r' }, NOW, WINDOW)).toBe(true)
  })

  it('includes the lower bound (now) and excludes the upper bound (now + window)', () => {
    expect(isInRefreshWindow({ tokenExpiresAt: NOW, linkedinRefreshToken: 'r' }, NOW, WINDOW)).toBe(true)
    expect(isInRefreshWindow({ tokenExpiresAt: NOW + WINDOW, linkedinRefreshToken: 'r' }, NOW, WINDOW)).toBe(false)
  })

  it('is false when tokenExpiresAt is already in the past (retention.ts territory, not ours)', () => {
    expect(isInRefreshWindow({ tokenExpiresAt: NOW - 1, linkedinRefreshToken: 'r' }, NOW, WINDOW)).toBe(false)
  })

  it('is false without a refresh token, even inside the expiry window (the common case per B01)', () => {
    expect(isInRefreshWindow({ tokenExpiresAt: NOW + 1000 }, NOW, WINDOW)).toBe(false)
  })

  it('is false when tokenExpiresAt is unset', () => {
    expect(isInRefreshWindow({ linkedinRefreshToken: 'r' }, NOW, WINDOW)).toBe(false)
  })
})
