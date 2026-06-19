import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { callMemberApi } from './client'

describe('callMemberApi', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('ok response: returns the Response and includes Authorization + per-call headers', async () => {
    const mockRes = new Response('{}', { status: 200 })
    vi.mocked(fetch).mockResolvedValue(mockRes)

    const result = await callMemberApi(
      'my-token',
      { method: 'GET', path: '/v2/userinfo', headers: { 'X-Custom': 'yes' } },
      { action: 'get userinfo' }
    )

    expect(result).toBe(mockRes)
    const [, init] = vi.mocked(fetch).mock.calls[0]
    const headers = init?.headers as Record<string, string>
    expect(headers['Authorization']).toBe('Bearer my-token')
    expect(headers['X-Custom']).toBe('yes')
  })

  it('includes Content-Type only when a body is passed', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('{}', { status: 200 }))

    // With body
    await callMemberApi('tok', { method: 'POST', path: '/v2/foo', body: { x: 1 } }, { action: 'foo' })
    const [, initWithBody] = vi.mocked(fetch).mock.calls[0]
    expect((initWithBody?.headers as Record<string, string>)['Content-Type']).toBe('application/json')

    vi.mocked(fetch).mockClear()

    // Without body (GET)
    await callMemberApi('tok', { method: 'GET', path: '/v2/bar' }, { action: 'bar' })
    const [, initNoBody] = vi.mocked(fetch).mock.calls[0]
    expect((initNoBody?.headers as Record<string, string>)['Content-Type']).toBeUndefined()
  })

  it('soft status: returns null and does NOT throw', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('Forbidden', { status: 403 }))

    const result = await callMemberApi(
      'tok',
      { method: 'GET', path: '/v2/ugcPosts' },
      { action: 'fetch posts', soft: [403] }
    )

    expect(result).toBeNull()
  })

  it('non-soft !ok status: throws sanitized message and calls console.error', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('Server error', { status: 500 }))
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(callMemberApi('tok', { method: 'GET', path: '/v2/fail' }, { action: 'do thing' })).rejects.toThrow(
      'Failed to do thing. Please try again.'
    )
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })
})
