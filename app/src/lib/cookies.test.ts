import { describe, it, expect, beforeEach } from 'vitest'
import { serializeCookie, getCookie, setCookie } from './cookies'

describe('serializeCookie', () => {
  it('builds a host-only cookie string with Path, Max-Age (1yr), SameSite', () => {
    expect(serializeCookie('theme', 'dark', 365)).toBe('theme=dark; Path=/; Max-Age=31536000; SameSite=Lax')
  })
  it('appends Domain when provided', () => {
    expect(serializeCookie('lang', 'pt', 365, '.linkintothessi.com')).toBe(
      'lang=pt; Path=/; Max-Age=31536000; SameSite=Lax; Domain=.linkintothessi.com'
    )
  })
  it('url-encodes the value', () => {
    expect(serializeCookie('x', 'a b;c', 1)).toBe('x=a%20b%3Bc; Path=/; Max-Age=86400; SameSite=Lax')
  })
  it('adds ; Secure when served over HTTPS', () => {
    const originalLocation = window.location
    Object.defineProperty(window, 'location', { value: { protocol: 'https:' }, writable: true, configurable: true })
    try {
      expect(serializeCookie('theme', 'dark', 365)).toContain('; Secure')
    } finally {
      Object.defineProperty(window, 'location', { value: originalLocation, writable: true, configurable: true })
    }
  })
})

describe('getCookie / setCookie round-trip (jsdom)', () => {
  beforeEach(() => {
    // clear any cookies between tests
    document.cookie.split(';').forEach(c => {
      const name = c.split('=')[0].trim()
      if (name) document.cookie = `${name}=; Path=/; Max-Age=0`
    })
  })
  it('reads back a written value', () => {
    setCookie('theme', 'light')
    expect(getCookie('theme')).toBe('light')
  })
  it('returns null for a missing cookie', () => {
    expect(getCookie('nope')).toBeNull()
  })
  it('decodes encoded values', () => {
    setCookie('lang', 'es')
    expect(getCookie('lang')).toBe('es')
  })
})
