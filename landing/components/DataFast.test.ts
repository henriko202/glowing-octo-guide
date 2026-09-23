import { afterEach, describe, expect, it, vi } from 'vitest'
import { landingPageviewHref } from './DataFast'
import nextConfig from '../next.config.js'

// Hermetic under the landing's node test environment: no SDK, no Next runtime.
const sdk = vi.hoisted(() => ({ initDataFast: vi.fn() }))
vi.mock('datafast', () => sdk)
vi.mock('next/navigation', () => ({ usePathname: vi.fn() }))

describe('landingPageviewHref', () => {
  it('drops the ref invite code and the fragment, and keeps the UTM params', () => {
    expect(
      landingPageviewHref(
        'https://www.linkintothessi.com/en?utm_source=linkedin&ref=AbC123&utm_campaign=launch#pricing'
      )
    ).toBe('https://www.linkintothessi.com/en?utm_source=linkedin&utm_campaign=launch')
  })

  it('leaves no dangling ? when ref was the only param', () => {
    expect(landingPageviewHref('https://www.linkintothessi.com/pt?ref=AbC123')).toBe(
      'https://www.linkintothessi.com/pt'
    )
  })

  it('keeps source and via untouched', () => {
    const href = 'https://www.linkintothessi.com/es?source=newsletter&via=partner'
    expect(landingPageviewHref(href)).toBe(href)
  })
})

describe('trackPageview', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('starts cookieless on the root domain and reports the page without ref or fragment', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('NEXT_PUBLIC_DATAFAST_WEBSITE_ID', 'dfid_test')
    vi.stubEnv('NEXT_PUBLIC_COOKIE_DOMAIN', '.linkintothessi.com')
    vi.stubGlobal('window', { location: { href: 'https://www.linkintothessi.com/en?ref=AbC123#pricing' } })
    const trackScreen = vi.fn()
    sdk.initDataFast.mockResolvedValue({ trackScreen })
    // A fresh module: the website id and domain are read at import.
    vi.resetModules()
    const { trackPageview } = await import('./DataFast')

    trackPageview('/en')

    expect(sdk.initDataFast).toHaveBeenCalledWith({
      websiteId: 'dfid_test',
      domain: 'linkintothessi.com',
      cookieless: true,
      maxQueueSize: 1
    })
    await vi.waitFor(() =>
      expect(trackScreen).toHaveBeenCalledWith('/en', { href: 'https://www.linkintothessi.com/en' })
    )
  })
})

describe('the landing Referrer-Policy', () => {
  // The SDK reports document.referrer on each page load's first pageview. A full page load from /en?ref=AbC123 (the
  // cookie notice's plain link, a new tab) would otherwise hand DataFast the invite code as the referrer.
  it('sends only the origin, so the ref invite code never reaches DataFast as a referrer', async () => {
    const config = nextConfig as {
      headers: () => Promise<{ source: string; headers: { key: string; value: string }[] }[]>
    }
    const rules = await config.headers()
    const policy = rules
      .find(rule => rule.source === '/:path*')
      ?.headers.find(header => header.key === 'Referrer-Policy')
    expect(policy?.value).toBe('strict-origin')
  })
})
