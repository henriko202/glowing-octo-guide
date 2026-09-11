import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { webcrypto } from 'node:crypto'
import { beginOAuthLogin, buildOAuthStartUrl, challengeFromVerifier } from './oauthStart'

vi.mock('./session', () => ({ AUTH_URL: 'https://example.convex.site/auth/linkedin' }))

describe('buildOAuthStartUrl', () => {
  it('always includes the challenge', () => {
    expect(buildOAuthStartUrl('chal')).toBe('https://example.convex.site/auth/linkedin?vc=chal')
  })

  it('appends plan/interval/ref when present', () => {
    expect(buildOAuthStartUrl('chal', { plan: 'growth', interval: 'annual', ref: 'k3p9x2ab' })).toBe(
      'https://example.convex.site/auth/linkedin?vc=chal&plan=growth&interval=annual&ref=k3p9x2ab'
    )
  })

  it('omits absent/empty params', () => {
    expect(buildOAuthStartUrl('chal', { plan: '', interval: undefined })).toBe(
      'https://example.convex.site/auth/linkedin?vc=chal'
    )
  })
})

describe('challengeFromVerifier', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('matches the RFC 7636 Appendix B vector', async () => {
    // jsdom's crypto has no subtle; Node's real WebCrypto proves the app-side hashing.
    vi.stubGlobal('crypto', webcrypto)
    await expect(challengeFromVerifier('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).resolves.toBe(
      'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM'
    )
  })
})

describe('beginOAuthLogin', () => {
  const originalLocation = window.location

  beforeEach(() => {
    sessionStorage.clear()
    vi.stubGlobal('crypto', {
      getRandomValues: (array: Uint8Array) => array.fill(7),
      subtle: { digest: vi.fn(async () => new Uint8Array(32).buffer) }
    })
    Object.defineProperty(window, 'location', {
      value: { assign: vi.fn() },
      writable: true,
      configurable: true
    })
  })

  afterEach(() => {
    Object.defineProperty(window, 'location', { value: originalLocation, writable: true, configurable: true })
    vi.unstubAllGlobals()
  })

  it('stores a 43-char verifier and navigates with the derived challenge', async () => {
    await beginOAuthLogin({ plan: 'growth' })

    expect(sessionStorage.getItem('oauthVerifier')).toMatch(/^[A-Za-z0-9_-]{43}$/)
    const assign = vi.mocked(window.location.assign)
    expect(assign).toHaveBeenCalledTimes(1)
    const url = assign.mock.calls[0][0] as string
    expect(url.startsWith('https://example.convex.site/auth/linkedin?vc=')).toBe(true)
    expect(url).toContain('&plan=growth')
  })
})
