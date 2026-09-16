import { describe, expect, it } from 'vitest'
import { SITE_URL } from '@/lib/site'
import { GET } from './route'

describe('GET /robots.txt', () => {
  it('declares one Content-Signal policy inside every crawler group', async () => {
    const response = GET()
    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('text/plain')
    const body = await response.text()
    const signal = 'Content-Signal: ai-train=yes, search=yes, ai-input=yes'

    expect(body.startsWith(`User-Agent: *\n${signal}\nAllow: /`)).toBe(true)
    expect(body.match(new RegExp(signal, 'g'))).toHaveLength(3)
    expect(body).toContain(`User-Agent: Googlebot`)
    expect(body).toContain(`User-Agent: GPTBot`)
    expect(body).toContain(`\n${signal}\nAllow: /`)
    expect(body).toContain(`Sitemap: ${SITE_URL}/sitemap.xml`)
    expect(body).not.toContain('Disallow')
  })
})
