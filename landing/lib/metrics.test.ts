import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const fetchMock = vi.fn()

beforeEach(() => {
  // The module reads NEXT_PUBLIC_CONVEX_SITE at module scope, so each test re-imports it fresh
  // after stubbing the env.
  vi.resetModules()
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('trackLandingEvent', () => {
  it('POSTs the event to the Convex site as a keepalive text/plain beacon', async () => {
    vi.stubEnv('NEXT_PUBLIC_CONVEX_SITE', 'https://demo.convex.site/')
    fetchMock.mockResolvedValue(undefined)
    const { trackLandingEvent } = await import('./metrics')

    trackLandingEvent('cta_click_pricing')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith('https://demo.convex.site/landing/event', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      body: JSON.stringify({ event: 'cta_click_pricing' }),
      keepalive: true
    })
  })

  it('sends every frozen event name as the exact JSON body', async () => {
    vi.stubEnv('NEXT_PUBLIC_CONVEX_SITE', 'https://demo.convex.site')
    fetchMock.mockResolvedValue(undefined)
    const { trackLandingEvent } = await import('./metrics')

    trackLandingEvent('pricing_view')
    trackLandingEvent('cta_click_hero')
    trackLandingEvent('cta_click_nav')
    trackLandingEvent('cta_click_final')

    expect(fetchMock.mock.calls.map(([url, init]) => [url, JSON.parse(init.body)])).toEqual([
      ['https://demo.convex.site/landing/event', { event: 'pricing_view' }],
      ['https://demo.convex.site/landing/event', { event: 'cta_click_hero' }],
      ['https://demo.convex.site/landing/event', { event: 'cta_click_nav' }],
      ['https://demo.convex.site/landing/event', { event: 'cta_click_final' }]
    ])
  })

  it('does not fetch when the Convex site is not configured', async () => {
    vi.stubEnv('NEXT_PUBLIC_CONVEX_SITE', '')
    const { trackLandingEvent } = await import('./metrics')

    trackLandingEvent('pricing_view')

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('swallows a rejected beacon', async () => {
    vi.stubEnv('NEXT_PUBLIC_CONVEX_SITE', 'https://demo.convex.site')
    fetchMock.mockRejectedValue(new Error('offline'))
    const { trackLandingEvent } = await import('./metrics')

    expect(() => trackLandingEvent('cta_click_final')).not.toThrow()
    await Promise.resolve()
  })
})
