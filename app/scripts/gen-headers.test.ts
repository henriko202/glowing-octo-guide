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
})

describe('buildHeadersContent', () => {
  it('embeds hashes in script-src and includes the hardening headers', () => {
    const out = buildHeadersContent(['sha256-abc'])
    expect(out).toContain("script-src 'self' sha256-abc")
    expect(out).toContain("frame-ancestors 'none'")
    expect(out).toContain('Strict-Transport-Security: max-age=63072000; includeSubDomains; preload')
    expect(out.startsWith('/*')).toBe(true)
  })
})
