// Generates dist/_headers for Cloudflare Workers Static Assets after `vite build`.
// The pre-paint theme-guard inline script in index.html must run before first paint,
// so it can't be an external file — we lock script-src with its SHA-256 hash instead
// of 'unsafe-inline'. The hash is derived from the BUILT index.html so it always matches.
// Newlines are normalized to LF before hashing because the HTML parser rewrites CRLF/CR
// to LF before the browser hashes the script text; hashing a CRLF checkout verbatim would
// emit a hash the browser never computes.
// Third parties the app loads are allowlisted by vendor domain: Cloudflare Web Analytics
// injects its beacon into HTML responses; PostHog loads asset/config scripts and posts
// events; Sentry posts errors, traces, and replay chunks (Session Replay compresses in a
// blob WebWorker). The beacon posts to same-origin /cdn-cgi/rum, covered by connect-src 'self'.
// DataFast posts pageviews to datafa.st; its SDK is bundled, so it needs no script-src entry.
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
    const body = match[1].replace(/\r\n?/g, '\n')
    if (body.trim() === '') continue
    hashes.push('sha256-' + createHash('sha256').update(body, 'utf8').digest('base64'))
  }
  return hashes
}

export function buildHeadersContent(scriptHashes) {
  const quotedHashes = scriptHashes.map(hash => `'${hash}'`)
  const scriptSrc = [
    "'self'",
    ...quotedHashes,
    'https://static.cloudflareinsights.com/beacon.min.js',
    // Cloudflare now serves a versioned `beacon.min.js/v…` path; a trailing slash makes it a prefix match.
    'https://static.cloudflareinsights.com/beacon.min.js/',
    'https://*.posthog.com'
  ].join(' ')
  const csp = [
    `default-src 'self'`,
    `script-src ${scriptSrc}`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' https: data:`,
    `frame-src https://www.linkedin.com`,
    `connect-src 'self' https://*.convex.cloud wss://*.convex.cloud https://*.convex.site https://*.stripe.com https://*.posthog.com https://*.sentry.io https://datafa.st`,
    `worker-src 'self' blob:`,
    `child-src 'self' blob:`,
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
