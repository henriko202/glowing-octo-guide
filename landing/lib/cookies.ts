// landing/lib/cookies.ts
// SSR-safe cookie I/O for the cross-site theme + language preferences.
// Prod: NEXT_PUBLIC_COOKIE_DOMAIN='.linkintothessi.com' (shared with the app). Dev: unset (host-only).
const COOKIE_DOMAIN = process.env.NEXT_PUBLIC_COOKIE_DOMAIN || undefined

export function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  const escaped = name.replace(/[.$?*|{}()[\]\\/+^]/g, '\\$&')
  const match = document.cookie.match(new RegExp(`(?:^|; )${escaped}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}

export function setCookie(name: string, value: string, days = 365): void {
  if (typeof document === 'undefined') return
  const maxAge = days * 24 * 60 * 60
  const domainPart = COOKIE_DOMAIN ? `; Domain=${COOKIE_DOMAIN}` : ''
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; SameSite=Lax${domainPart}`
}
