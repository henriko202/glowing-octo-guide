// Static security headers for the landing (served at the HTTP layer by the Worker).
// CSP keeps `script-src 'self' 'unsafe-inline'`: the landing renders only static
// dictionary copy (no user input), so the inline-script risk is negligible and the
// pages stay prerendered/cached. The app (which renders untrusted data) uses the
// stricter hashed CSP. frame-ancestors/HSTS etc. only work as real HTTP headers.
const CONTENT_SECURITY_POLICY = [
  `default-src 'self'`,
  `script-src 'self' 'unsafe-inline'`,
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
