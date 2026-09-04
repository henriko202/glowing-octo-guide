import { describe, it, expect } from 'vitest'
import { sentryBeforeSend } from './sentry'

describe('sentryBeforeSend', () => {
  it('drops request cookies and headers', () => {
    const out = sentryBeforeSend({
      request: { url: 'https://app.example/feed', cookies: 'sessionToken=abc', headers: { authorization: 'Bearer x' } }
    })
    expect(out.request?.cookies).toBeUndefined()
    expect(out.request?.headers).toBeUndefined()
    expect(out.request?.url).toBe('https://app.example/feed') // non-PII request fields kept
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
