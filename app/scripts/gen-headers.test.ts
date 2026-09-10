import { describe, expect, it } from 'vitest'
import { buildHeadersContent, extractInlineScriptHashes } from './gen-headers.mjs'

describe('extractInlineScriptHashes', () => {
  it('hashes inline scripts and ignores external ones', () => {
    const html =
      '<!doctype html><html><head>' +
      "<script>window.__t='dark'</script>" +
      '</head><body>' +
      '<script type="module" src="/app.js"></script>' +
      '</body></html>'
    expect(extractInlineScriptHashes(html)).toEqual(['sha256-ORwiB/dKZDCqKP3qym/M9HzVt4LfjYBx2NdHJzCndcU='])
  })

  it('skips empty scripts', () => {
    expect(extractInlineScriptHashes('<script>  </script>')).toEqual([])
  })

  it('normalizes CRLF the way the HTML parser does, so the hash matches the browser', () => {
    const lf = '<script>window.__t = 1\nwindow.__u = 2</script>'
    const crlf = '<script>window.__t = 1\r\nwindow.__u = 2</script>'
    expect(extractInlineScriptHashes(crlf)).toEqual(extractInlineScriptHashes(lf))
  })
})

describe('buildHeadersContent', () => {
  it('quotes hashes, allows the vendor origins, and includes the hardening headers', () => {
    const out = buildHeadersContent(['sha256-abc'])
    expect(out).toContain(
      "script-src 'self' 'sha256-abc' https://static.cloudflareinsights.com/beacon.min.js https://*.posthog.com"
    )
    expect(out).toContain(
      "connect-src 'self' https://*.convex.cloud wss://*.convex.cloud https://*.convex.site https://*.stripe.com https://*.posthog.com https://*.sentry.io"
    )
    expect(out).toContain("worker-src 'self' blob:")
    expect(out).toContain("child-src 'self' blob:")
    expect(out).toContain("frame-ancestors 'none'")
    expect(out).toContain('Strict-Transport-Security: max-age=63072000; includeSubDomains; preload')
    expect(out.startsWith('/*')).toBe(true)
  })
})
