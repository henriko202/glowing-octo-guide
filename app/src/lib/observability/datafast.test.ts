import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const sdk = vi.hoisted(() => ({ initDataFast: vi.fn(), deleteCookie: vi.fn() }))
vi.mock('datafast', () => sdk)

const client = { trackScreen: vi.fn(), identify: vi.fn(), shutdown: vi.fn() }

const COOKIES = [
  'datafast_visitor_id',
  'datafast_visitor_first_seen_at',
  'datafast_visitor_session_count',
  'datafast_session_id',
  'datafast_session_start'
]

// A fresh module per test: whether DataFast has started is module state.
async function load() {
  vi.resetModules()
  return import('./datafast')
}

beforeEach(() => {
  vi.clearAllMocks()
  sdk.initDataFast.mockResolvedValue(client)
  vi.stubEnv('PROD', true)
  vi.stubEnv('VITE_DATAFAST_WEBSITE_ID', 'dfid_test')
  vi.stubEnv('VITE_COOKIE_DOMAIN', '.linkintothessi.com')
  // A secret-bearing URL: neither the query nor the fragment may reach DataFast.
  window.history.replaceState(null, '', '/unsubscribe?token=secret#session=secret')
})

afterEach(() => {
  vi.unstubAllEnvs()
  window.history.replaceState(null, '', '/')
})

describe('startDataFast', () => {
  it('initializes once, in cookie mode, on the root domain', async () => {
    const { startDataFast } = await load()
    startDataFast('user_1')
    startDataFast('user_1')
    await vi.waitFor(() => expect(client.identify).toHaveBeenCalled())
    expect(sdk.initDataFast).toHaveBeenCalledTimes(1)
    expect(sdk.initDataFast).toHaveBeenCalledWith({
      websiteId: 'dfid_test',
      domain: 'linkintothessi.com',
      maxQueueSize: 1
    })
  })

  it('sends the first pageview as origin + pathname, then identifies with the bare id', async () => {
    const { startDataFast } = await load()
    startDataFast('user_1')
    await vi.waitFor(() => expect(client.identify).toHaveBeenCalled())
    expect(client.trackScreen).toHaveBeenCalledWith('/unsubscribe', {
      href: `${window.location.origin}/unsubscribe`
    })
    expect(client.identify.mock.calls).toEqual([['user_1']])
    expect(client.trackScreen.mock.invocationCallOrder[0]).toBeLessThan(client.identify.mock.invocationCallOrder[0])
  })

  it('does nothing outside a production build or without the website id', async () => {
    const { startDataFast } = await load()
    vi.stubEnv('PROD', false)
    startDataFast('user_1')
    vi.stubEnv('PROD', true)
    vi.stubEnv('VITE_DATAFAST_WEBSITE_ID', '')
    startDataFast('user_1')
    expect(sdk.initDataFast).not.toHaveBeenCalled()
  })
})

describe('stopDataFast', () => {
  it('deletes the five cookies on the root domain even when DataFast never started', async () => {
    const { stopDataFast } = await load()
    stopDataFast()
    expect(sdk.deleteCookie.mock.calls).toEqual(COOKIES.map(name => [name, 'linkintothessi.com']))
    expect(client.shutdown).not.toHaveBeenCalled()
  })

  it('after a start, deletes the cookies, shuts down, then deletes them again', async () => {
    const { startDataFast, stopDataFast } = await load()
    startDataFast('user_1')
    await vi.waitFor(() => expect(client.identify).toHaveBeenCalled())
    stopDataFast()
    expect(sdk.deleteCookie).toHaveBeenCalledTimes(5)
    await vi.waitFor(() => expect(sdk.deleteCookie).toHaveBeenCalledTimes(10))
    expect(client.shutdown).toHaveBeenCalledTimes(1)
    expect(client.shutdown.mock.invocationCallOrder[0]).toBeLessThan(sdk.deleteCookie.mock.invocationCallOrder[5])
  })

  it('lets a re-grant start DataFast again', async () => {
    const { startDataFast, stopDataFast } = await load()
    startDataFast('user_1')
    await vi.waitFor(() => expect(client.identify).toHaveBeenCalledTimes(1))
    stopDataFast()
    await vi.waitFor(() => expect(sdk.deleteCookie).toHaveBeenCalledTimes(10))
    startDataFast('user_1')
    await vi.waitFor(() => expect(client.identify).toHaveBeenCalledTimes(2))
    expect(sdk.initDataFast).toHaveBeenCalledTimes(2)
  })
})

describe('trackDataFastPageview', () => {
  it('does nothing before DataFast has started', async () => {
    const { trackDataFastPageview } = await load()
    trackDataFastPageview('/feed')
    await Promise.resolve()
    expect(sdk.initDataFast).not.toHaveBeenCalled()
    expect(client.trackScreen).not.toHaveBeenCalled()
  })

  it('sends origin + pathname once started', async () => {
    const { startDataFast, trackDataFastPageview } = await load()
    startDataFast('user_1')
    await vi.waitFor(() => expect(client.identify).toHaveBeenCalled())
    trackDataFastPageview('/feed')
    await vi.waitFor(() =>
      expect(client.trackScreen).toHaveBeenLastCalledWith('/feed', { href: `${window.location.origin}/feed` })
    )
  })
})
