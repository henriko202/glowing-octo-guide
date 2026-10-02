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

  it('forwards the LinkedIn sign-in callback to Convex with its query, instead of serving the SPA', async () => {
    const fetchAsset = vi.fn(async () => new Response('asset'))
    const request = new Request('https://www.app.linkintothessi.com/auth/linkedin/callback?code=AQT%2Bx&state=s-1')

    const response = await worker.fetch(request, { ASSETS: { fetch: fetchAsset } })

    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe(
      'https://whimsical-elk-440.convex.site/auth/linkedin/callback?code=AQT%2Bx&state=s-1'
    )
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(fetchAsset).not.toHaveBeenCalled()
  })
})
