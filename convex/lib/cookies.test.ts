import { describe, expect, it } from 'vitest'
import { readCookie } from './cookies'

describe('readCookie', () => {
  it('returns null for a null, undefined, or empty header', () => {
    expect(readCookie(null, 'oauth_nonce')).toBeNull()
    expect(readCookie(undefined, 'oauth_nonce')).toBeNull()
    expect(readCookie('', 'oauth_nonce')).toBeNull()
  })

  it('returns null when the named cookie is absent', () => {
    expect(readCookie('theme=dark; lang=pt', 'oauth_nonce')).toBeNull()
  })

  it('finds the named cookie among several', () => {
    expect(readCookie('theme=dark; oauth_nonce=abc123; lang=pt', 'oauth_nonce')).toBe('abc123')
  })

  it('ignores surrounding whitespace around the name and value', () => {
    expect(readCookie('theme=dark;  oauth_nonce = abc123 ; lang=pt', 'oauth_nonce')).toBe('abc123')
  })

  it('decodes a percent-encoded value', () => {
    expect(readCookie('oauth_nonce=a%2Fb%3Dc', 'oauth_nonce')).toBe('a/b=c')
  })

  it('returns the raw value when percent-encoding is malformed', () => {
    expect(readCookie('oauth_nonce=%', 'oauth_nonce')).toBe('%')
    expect(readCookie('oauth_nonce=%E0%A4%A', 'oauth_nonce')).toBe('%E0%A4%A')
  })

  it('does not match a cookie whose name merely contains the target', () => {
    expect(readCookie('xoauth_nonce=abc', 'oauth_nonce')).toBeNull()
  })

  it('treats extra equals signs as part of the value', () => {
    expect(readCookie('oauth_nonce=a=b', 'oauth_nonce')).toBe('a=b')
  })

  it('skips a malformed part with no equals sign', () => {
    expect(readCookie('broken; oauth_nonce=abc', 'oauth_nonce')).toBe('abc')
  })
})
