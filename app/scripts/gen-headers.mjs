// Generates dist/_headers for Cloudflare Workers Static Assets after `vite build`.
// The pre-paint theme-guard inline script in index.html must run before first paint,
// so it can't be an external file — we lock script-src with its SHA-256 hash instead
// of 'unsafe-inline'. The hash is derived from the BUILT index.html so it always matches.
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const DIST = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist')

export function extractInlineScriptHashes(html) {
  const hashes = []
  const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi
  let match
  while ((match = re.exec(html)) !== null) {
    const body = match[1]
    if (body.trim() === '') continue
    hashes.push('sha256-' + createHash('sha256').update(body, 'utf8').digest('base64'))
  }
  return hashes
}

export function buildHeadersContent(scriptHashes) {
  const scriptSrc = ["'self'", ...scriptHashes].join(' ')
  const csp = [
    `default-src 'self'`,
    `script-src ${scriptSrc}`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' https: data:`,
    `frame-src https://www.linkedin.com`,
    `connect-src 'self' https://*.convex.cloud wss://*.convex.cloud https://*.convex.site https://*.stripe.com`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`
  ].join('; ')
  return [
    '/*',
    `  Content-Security-Policy: ${csp}`,
    '  Strict-Transport-Security: max-age=63072000; includeSubDomains; preload',
    '  X-Content-Type-Options: nosniff',
    '  Referrer-Policy: strict-origin-when-cross-origin',
    '  Permissions-Policy: camera=(), microphone=(), geolocation=()',
    ''
  ].join('\n')
}

function main() {
  const html = readFileSync(join(DIST, 'index.html'), 'utf8')
  const hashes = extractInlineScriptHashes(html)
  writeFileSync(join(DIST, '_headers'), buildHeadersContent(hashes))
  console.log(`Wrote dist/_headers with ${hashes.length} script hash(es).`)
}

// Run main() only when executed directly (`node scripts/gen-headers.mjs`), not on import.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main()
