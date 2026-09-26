import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import * as Sentry from '@sentry/react'
import { initSentry, sentryBeforeSend } from './sentry'

// Only init is replaced, so a test can read the options initSentry passes it. Everything else is the real SDK.
vi.mock('@sentry/react', async importOriginal => ({
  ...(await importOriginal<typeof import('@sentry/react')>()),
  init: vi.fn()
}))

describe('initSentry', () => {
  beforeAll(() => {
    vi.stubEnv('PROD', true)
    vi.stubEnv('VITE_SENTRY_DSN', 'https://key@o1.ingest.us.sentry.io/1')
    initSentry()
  })
  afterAll(() => vi.unstubAllEnvs())

  // Runs Sentry's own event filter, with the options initSentry passed, over an error carrying `message`.
  function keptBySentry(message: string): boolean {
    const client = { getOptions: () => vi.mocked(Sentry.init).mock.calls[0]?.[0] } as unknown as Sentry.BrowserClient
    const event = { exception: { values: [{ type: 'Error', value: message }] } }
    return Sentry.eventFiltersIntegration().processEvent?.(event, {}, client) !== null
  }

  // The Convex client fails an action in flight with this when its WebSocket drops: the member's network, not a fault.
  it('drops the error an action gets when the connection drops', () => {
    const lost =
      '[CONVEX A(ai/comments:generateComment)] Connection lost while action was in flight\n  Called by client'
    expect(keptBySentry(lost)).toBe(false)
  })

  it('keeps a server error', () => {
    const fault = '[CONVEX A(ai/comments:generateComment)] [Request ID: abc] Server Error\n  Called by client'
    expect(keptBySentry(fault)).toBe(true)
  })
})

describe('sentryBeforeSend', () => {
  it('drops request cookies and headers', () => {
    const out = sentryBeforeSend({
      request: { url: 'https://app.example/feed', cookies: 'sessionToken=abc', headers: { authorization: 'Bearer x' } }
    })
    expect(out.request?.cookies).toBeUndefined()
    expect(out.request?.headers).toBeUndefined()
    expect(out.request?.url).toBe('https://app.example/feed') // non-PII request fields kept
  })

  it('strips a session-bearing fragment from request.url', () => {
    const out = sentryBeforeSend({ request: { url: 'https://app.example/auth/success#session=abc' } })
    expect(out.request?.url).toBe('https://app.example/auth/success')
  })

  it('preserves a fragment without session=', () => {
    const out = sentryBeforeSend({ request: { url: 'https://app.example/feed#top' } })
    expect(out.request?.url).toBe('https://app.example/feed#top')
  })

  it('drops any user identity', () => {
    const out = sentryBeforeSend({ user: { email: 'a@b.com', ip_address: '1.2.3.4' } })
    expect(out.user).toBeUndefined()
  })

  it('redacts sensitive keys in a JSON message via scrubError', () => {
    const out = sentryBeforeSend({ message: '{"access_token":"secret","ok":1}' })
    expect(out.message).toContain('[REDACTED]')
    expect(out.message).not.toContain('secret')
  })

  it('scrubs and length-caps exception values', () => {
    const long = 'x'.repeat(2000)
    const out = sentryBeforeSend({ exception: { values: [{ type: 'Error', value: long }] } })
    expect((out.exception?.values?.[0].value ?? '').length).toBeLessThan(long.length)
  })

  it('is a no-op on an event with nothing to scrub', () => {
    const out = sentryBeforeSend({ level: 'error' })
    expect(out.level).toBe('error')
  })
})
