import { afterEach, describe, expect, it, vi } from 'vitest'
import { ConvexError } from 'convex/values'
import { reportError, reportingThrows, sendToSentry, sentryEndpoint } from './sentry'

const DSN = 'https://abc123@o1.ingest.us.sentry.io/456'

// An envelope is three JSON lines: the envelope header, the item header, the event.
function sent(fetchMock: ReturnType<typeof vi.fn>) {
  expect(fetchMock).toHaveBeenCalledOnce()
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit & { headers: Record<string, string> }]
  const [, item, event] = String(init.body)
    .split('\n')
    .map(line => JSON.parse(line))
  return { url, init, item, event }
}

function stubSentry(status = 200) {
  vi.stubEnv('SENTRY_DSN', DSN)
  const fetchMock = vi.fn(async () => new Response(null, { status }))
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('sentryEndpoint', () => {
  it('turns a DSN into its project envelope endpoint and public key', () => {
    expect(sentryEndpoint(DSN)).toEqual({ url: 'https://o1.ingest.us.sentry.io/api/456/envelope/', key: 'abc123' })
  })

  it('rejects anything that is not a DSN', () => {
    expect(sentryEndpoint('not a url')).toBeNull()
    expect(sentryEndpoint('https://o1.ingest.us.sentry.io/456')).toBeNull()
    expect(sentryEndpoint('https://abc123@o1.ingest.us.sentry.io/')).toBeNull()
  })
})

describe('sendToSentry', () => {
  it('sends nothing while SENTRY_DSN is unset', async () => {
    vi.stubEnv('SENTRY_DSN', '')
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await sendToSentry({ type: 'Error', message: 'boom' })

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('posts one error event to the envelope endpoint, authenticated with the DSN key', async () => {
    const fetchMock = stubSentry()

    await sendToSentry({
      type: 'TypeError',
      message: 'boom',
      transaction: 'posts:submitPost',
      tags: { route: 'GET /x' },
      timestamp: 1_700_000_000_000
    })

    const { url, init, item, event } = sent(fetchMock)
    expect(url).toBe('https://o1.ingest.us.sentry.io/api/456/envelope/')
    expect(init.method).toBe('POST')
    expect(init.headers['X-Sentry-Auth']).toContain('sentry_key=abc123')
    expect(item).toEqual({ type: 'event' })
    expect(event).toMatchObject({
      level: 'error',
      environment: 'production',
      transaction: 'posts:submitPost',
      timestamp: 1_700_000_000,
      tags: { route: 'GET /x' },
      exception: { values: [{ type: 'TypeError', value: 'boom' }] }
    })
  })

  it('scrubs the message before it leaves the deployment', async () => {
    const fetchMock = stubSentry()

    await sendToSentry({ type: 'Error', message: JSON.stringify({ access_token: 'tok-secret', detail: 'bad' }) })

    const { init, event } = sent(fetchMock)
    expect(String(init.body)).not.toContain('tok-secret')
    expect(event.exception.values[0].value).toContain('bad')
  })

  it('never throws, even when Sentry is unreachable or refuses the event', async () => {
    vi.stubEnv('SENTRY_DSN', DSN)
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    await expect(sendToSentry({ type: 'Error', message: 'boom' })).resolves.toBeUndefined()

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 429 })))
    await expect(sendToSentry({ type: 'Error', message: 'boom' })).resolves.toBeUndefined()
    expect(console.error).toHaveBeenCalledTimes(2)
  })
})

describe('reportError', () => {
  const ctx = {
    meta: {
      getFunctionMetadata: async () => ({
        name: 'billingNode:cancelDuplicateSubscription',
        componentPath: '',
        type: 'action',
        visibility: 'internal'
      }),
      getRequestMetadata: async () => ({
        ip: '203.0.113.9',
        userAgent: 'ua-of-the-member',
        requestId: 'req-1',
        scheduledFunctionId: null,
        authToken: 'jwt-of-the-member'
      }),
      getDeploymentMetadata: async () => ({ name: 'whimsical-elk-440', region: null, class: 's16' })
    }
  } as any

  it('tags the function and the request ID, never the member IP, user agent or token', async () => {
    const fetchMock = stubSentry()

    await reportError(ctx, new TypeError('boom'), { stripe_event: 'invoice.payment_failed' })

    const { init, event } = sent(fetchMock)
    expect(event.transaction).toBe('billingNode:cancelDuplicateSubscription')
    expect(event.tags).toMatchObject({
      'convex.function': 'billingNode:cancelDuplicateSubscription',
      'convex.function_type': 'action',
      'convex.request_id': 'req-1',
      stripe_event: 'invoice.payment_failed'
    })
    expect(event.exception.values[0]).toMatchObject({ type: 'TypeError', value: 'boom' })
    for (const secret of ['203.0.113.9', 'ua-of-the-member', 'jwt-of-the-member']) {
      expect(String(init.body)).not.toContain(secret)
    }
  })

  it('names an HTTP route as the transaction', async () => {
    const fetchMock = stubSentry()

    await reportError(ctx, new Error('boom'), { route: 'GET /auth/linkedin' })

    expect(sent(fetchMock).event.transaction).toBe('GET /auth/linkedin')
  })

  it('still reports without a ctx, or when the metadata lookups fail', async () => {
    const fetchMock = stubSentry()
    const broken = {
      meta: {
        getFunctionMetadata: () => Promise.reject(new Error('no metadata')),
        getRequestMetadata: () => Promise.reject(new Error('no metadata'))
      }
    } as any

    await reportError(null, 'Resend send failed: 422', { upstream: 'resend' })
    await reportError(broken, new Error('boom'))

    expect(fetchMock).toHaveBeenCalledTimes(2)
    const first = JSON.parse(String((fetchMock.mock.calls[0] as any)[1].body).split('\n')[2])
    expect(first.exception.values[0]).toMatchObject({ type: 'Error', value: 'Resend send failed: 422' })
    expect(first.tags).toMatchObject({ upstream: 'resend' })
  })

  it('reads nothing from ctx while SENTRY_DSN is unset', async () => {
    vi.stubEnv('SENTRY_DSN', '')
    const lookup = vi.fn()

    await reportError({ meta: { getFunctionMetadata: lookup, getRequestMetadata: lookup } } as any, new Error('boom'))

    expect(lookup).not.toHaveBeenCalled()
  })
})

describe('reportingThrows', () => {
  const ctx = { meta: { getFunctionMetadata: async () => ({ name: 'http' }), getRequestMetadata: async () => ({}) } }
  const tags = (req: string) => ({ route: `GET ${req}` })

  it('passes a result through and reports nothing', async () => {
    const fetchMock = stubSentry()

    const wrapped = reportingThrows(tags, async (_ctx, req: string) => `ok ${req}`)

    await expect(wrapped(ctx as any, '/x')).resolves.toBe('ok /x')

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('reports a thrown error with its tags, then re-throws the same error', async () => {
    const fetchMock = stubSentry()
    const boom = new Error('boom')

    await expect(
      reportingThrows(tags, async () => {
        throw boom
      })(ctx as any, '/unsubscribe')
    ).rejects.toBe(boom)

    expect(sent(fetchMock).event.tags).toMatchObject({ route: 'GET /unsubscribe' })
  })

  it('re-throws a ConvexError without reporting it: that is a deliberate rejection, not a fault', async () => {
    const fetchMock = stubSentry()
    const limit = new ConvexError('Too many sign-in attempts')

    await expect(
      reportingThrows(tags, async () => {
        throw limit
      })(ctx as any, '/auth/linkedin')
    ).rejects.toBe(limit)

    expect(fetchMock).not.toHaveBeenCalled()
  })
})
