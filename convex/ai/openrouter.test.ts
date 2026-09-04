import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { callOpenRouter } from './openrouter'

const okJson = (content: string) =>
  ({ ok: true, json: async () => ({ choices: [{ message: { content } }] }) }) as unknown as Response

describe('callOpenRouter', () => {
  beforeEach(() => {
    process.env.OPENROUTER_API_KEY = 'test-key'
  })
  afterEach(() => {
    delete process.env.OPENROUTER_API_KEY
    delete process.env.OPENROUTER_MODEL
    delete process.env.OPENROUTER_SITE_URL
    delete process.env.OPENROUTER_SITE_NAME
    vi.restoreAllMocks()
  })

  it('posts to OpenRouter with auth, the Gemma model, and privacy-pinned provider routing', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okJson('Hello'))
    vi.stubGlobal('fetch', fetchMock)
    const out = await callOpenRouter([{ role: 'user', content: 'hi' }], { action: 'test' })
    expect(out).toBe('Hello')
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://openrouter.ai/api/v1/chat/completions')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer test-key')
    const body = JSON.parse(init.body as string)
    expect(body.model).toBe('google/gemma-4-26b-a4b-it')
    // Privacy routing must be enforced on every request: zero data retention + no data collection.
    expect(body.provider).toMatchObject({
      data_collection: 'deny',
      zdr: true
    })
  })

  it('honors the OPENROUTER_MODEL override', async () => {
    process.env.OPENROUTER_MODEL = 'google/other-model'
    const fetchMock = vi.fn().mockResolvedValue(okJson('x'))
    vi.stubGlobal('fetch', fetchMock)
    await callOpenRouter([{ role: 'user', content: 'hi' }], { action: 'test' })
    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string).model).toBe('google/other-model')
  })

  it('sends optional attribution headers only when configured', async () => {
    process.env.OPENROUTER_SITE_URL = 'https://linkintothessi.com'
    process.env.OPENROUTER_SITE_NAME = 'Link Into The SSI'
    const fetchMock = vi.fn().mockResolvedValue(okJson('x'))
    vi.stubGlobal('fetch', fetchMock)
    await callOpenRouter([{ role: 'user', content: 'hi' }], { action: 'test' })
    const headers = fetchMock.mock.calls[0][1].headers as Record<string, string>
    expect(headers['HTTP-Referer']).toBe('https://linkintothessi.com')
    expect(headers['X-Title']).toBe('Link Into The SSI')
  })

  it('throws a sanitized error when the API key is missing', async () => {
    delete process.env.OPENROUTER_API_KEY
    await expect(callOpenRouter([{ role: 'user', content: 'x' }], { action: 'predict reaction' })).rejects.toThrow(
      /not configured/i
    )
  })

  it('throws a sanitized error on a non-ok response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 500, text: async () => 'boom' } as unknown as Response)
    )
    await expect(callOpenRouter([{ role: 'user', content: 'x' }], { action: 'generate comment' })).rejects.toThrow(
      /Failed to generate comment/i
    )
  })

  it('throws a distinct misconfigured error on a model-not-found (404) response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 404, text: async () => 'no such model' } as unknown as Response)
    )
    await expect(callOpenRouter([{ role: 'user', content: 'x' }], { action: 'test' })).rejects.toThrow(
      /AI model misconfigured/i
    )
  })

  it('throws on empty content', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okJson('   ')))
    await expect(callOpenRouter([{ role: 'user', content: 'x' }], { action: 'test' })).rejects.toThrow(
      /Failed to test/i
    )
  })
})
