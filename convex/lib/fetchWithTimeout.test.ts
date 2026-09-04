import { describe, it, expect, afterEach, vi } from 'vitest'
import { fetchWithTimeout } from './fetchWithTimeout'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('fetchWithTimeout', () => {
  it('returns the response when fetch resolves before the timeout', async () => {
    vi.stubGlobal('fetch', async () => new Response('ok', { status: 200 }))
    const res = await fetchWithTimeout('https://example.com', undefined, 1000)
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('ok')
  })

  it('rejects with a timeout error when fetch outlasts the deadline', async () => {
    // Simulate a real fetch: pending until its signal aborts, then rejects.
    vi.stubGlobal(
      'fetch',
      (_url: string, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('aborted')))
        })
    )
    await expect(fetchWithTimeout('https://example.com', undefined, 5)).rejects.toThrow(/timed out/)
  })

  it('propagates a non-timeout fetch error unchanged', async () => {
    vi.stubGlobal('fetch', async () => {
      throw new Error('DNS failure')
    })
    await expect(fetchWithTimeout('https://example.com', undefined, 1000)).rejects.toThrow('DNS failure')
  })

  it('passes init options (e.g. redirect) through to fetch', async () => {
    let seen: RequestInit | undefined
    vi.stubGlobal('fetch', async (_url: string, init?: RequestInit) => {
      seen = init
      return new Response('', { status: 200 })
    })
    await fetchWithTimeout('https://example.com', { redirect: 'manual' }, 1000)
    expect(seen?.redirect).toBe('manual')
    expect(seen?.signal).toBeDefined()
  })
})
