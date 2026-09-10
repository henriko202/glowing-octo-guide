import { describe, expect, it, vi } from 'vitest'
import worker from './cloudflare-worker'

describe('app Cloudflare Worker', () => {
  it('permanently redirects app.linkintothessi.com to the same www.app path and query', async () => {
    const fetchAsset = vi.fn(async () => new Response('asset'))
    const request = new Request('https://app.linkintothessi.com/billing?success=true')

    const response = await worker.fetch(request, { ASSETS: { fetch: fetchAsset } })

    expect(response.status).toBe(308)
    expect(response.headers.get('location')).toBe('https://www.app.linkintothessi.com/billing?success=true')
    expect(fetchAsset).not.toHaveBeenCalled()
  })
})
