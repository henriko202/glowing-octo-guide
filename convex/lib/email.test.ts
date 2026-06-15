import { describe, it, expect, vi, afterEach } from 'vitest'
import { sendEmail } from './email'

describe('sendEmail', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('no-ops (skipped) when RESEND_API_KEY / EMAIL_FROM are unset', async () => {
    vi.stubEnv('RESEND_API_KEY', '')
    vi.stubEnv('EMAIL_FROM', '')
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const result = await sendEmail({ to: 'a@b.com', subject: 's', html: '<p>x</p>' })

    expect(result.skipped).toBe(true)
    expect(result.sent).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('POSTs to Resend with auth + from header when configured', async () => {
    vi.stubEnv('RESEND_API_KEY', 'key_123')
    vi.stubEnv('EMAIL_FROM', 'noreply@linkintothessi.com')
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ id: 'e1' }) }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await sendEmail({ to: 'a@b.com', subject: 'Hi', html: '<p>x</p>' })

    expect(result.sent).toBe(true)
    expect(fetchMock).toHaveBeenCalledOnce()
    const [url, opts] = fetchMock.mock.calls[0] as [string, any]
    expect(url).toBe('https://api.resend.com/emails')
    expect(opts.headers.Authorization).toBe('Bearer key_123')
    const body = JSON.parse(opts.body)
    expect(body.from).toBe('noreply@linkintothessi.com')
    expect(body.to).toBe('a@b.com')
    expect(body.subject).toBe('Hi')
  })

  it('throws a generic error when Resend responds non-ok', async () => {
    vi.stubEnv('RESEND_API_KEY', 'key_123')
    vi.stubEnv('EMAIL_FROM', 'noreply@linkintothessi.com')
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 422, text: async () => 'bad request' }))
    )

    await expect(sendEmail({ to: 'a@b.com', subject: 's', html: '<p>x</p>' })).rejects.toThrow('Failed to send email')
  })
})
