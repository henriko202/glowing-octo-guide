import { describe, it, expect } from 'vitest'
import { extractVanityName } from './linkedinProfile'

describe('extractVanityName', () => {
  it('extracts the slug from a full profile URL', () => {
    expect(extractVanityName('https://www.linkedin.com/in/henriko202')).toBe('henriko202')
  })

  it('lowercases the slug', () => {
    expect(extractVanityName('https://www.linkedin.com/in/Henri-Durand')).toBe('henri-durand')
  })

  it('ignores query string and trailing path', () => {
    expect(extractVanityName('https://www.linkedin.com/in/jane-doe/?utm=x')).toBe('jane-doe')
  })

  it('accepts a bare username', () => {
    expect(extractVanityName('henriko202')).toBe('henriko202')
  })

  it('accepts an @-prefixed username', () => {
    expect(extractVanityName('@Henriko202')).toBe('henriko202')
  })

  it('trims surrounding whitespace', () => {
    expect(extractVanityName('  henriko202  ')).toBe('henriko202')
  })

  it('returns null for an unparseable value', () => {
    expect(extractVanityName('not a name!')).toBeNull()
  })

  it('returns null for empty input', () => {
    expect(extractVanityName('')).toBeNull()
  })

  // Align with the server's accepted format (users.setPublicIdentifier): 3–100 chars.
  // Anything outside that range must be rejected so the Save button never enables on a value
  // the server will throw on.
  it('returns null for a slug shorter than 3 chars (bare)', () => {
    expect(extractVanityName('ab')).toBeNull()
  })

  it('returns null for a slug shorter than 3 chars (URL)', () => {
    expect(extractVanityName('https://www.linkedin.com/in/ab')).toBeNull()
  })

  it('returns null for a slug longer than 100 chars', () => {
    expect(extractVanityName('a'.repeat(101))).toBeNull()
  })

  it('accepts the 3-char and 100-char boundaries', () => {
    expect(extractVanityName('abc')).toBe('abc')
    expect(extractVanityName('a'.repeat(100))).toBe('a'.repeat(100))
  })
})
