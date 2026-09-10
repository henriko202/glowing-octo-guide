// Static security headers for the landing (served at the HTTP layer by the Worker).
// CSP keeps `script-src 'self' 'unsafe-inline'`: the landing renders only static
// dictionary copy (no user input), so the inline-script risk is negligible and the
// pages stay prerendered/cached. The app (which renders untrusted data) uses the
// stricter hashed CSP. Cloudflare Web Analytics (automatic setup) injects its beacon
// into proxied HTML, so script-src allows that exact script URL; the beacon posts to
// same-origin /cdn-cgi/rum, which connect-src 'self' already covers.
// frame-ancestors/HSTS etc. only work as real HTTP headers.
// `next dev` evals every module (eval-source-map devtool + Fast Refresh runtime), so
// dev needs 'unsafe-eval' or the client bundle throws and nothing hydrates. NODE_ENV
// is 'production' under `next build`, so the deployed Worker never gets this relaxation.
const isDev = process.env.NODE_ENV !== 'production'
const CONTENT_SECURITY_POLICY = [
  `default-src 'self'`,
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''} https://static.cloudflareinsights.com/beacon.min.js`,
  `style-src 'self' 'unsafe-inline'`,
  `img-src 'self' https: data:`,
  `connect-src 'self' https://*.convex.cloud https://*.convex.site`,
  `object-src 'none'`,
  `base-uri 'self'`,
  `form-action 'self'`,
  `frame-ancestors 'none'`
].join('; ')

/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: CONTENT_SECURITY_POLICY },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' }
        ]
      }
    ]
  }
}

export default nextConfig
