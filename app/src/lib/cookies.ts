// Cross-site cookie I/O for the theme + language preferences. In prod,
// VITE_COOKIE_DOMAIN='.linkintothessi.com' scopes the cookie to the apex so the app
// (www.app.linkintothessi.com) and the landing (www.linkintothessi.com) share one value.
// Unset in dev → a host-only cookie (cross-site sync is a prod-only feature).
const COOKIE_DOMAIN = (import.meta.env.VITE_COOKIE_DOMAIN as string | undefined) || undefined

export function serializeCookie(name: string, value: string, days: number, domain?: string): string {
  const maxAge = days * 24 * 60 * 60
  const domainPart = domain ? `; Domain=${domain}` : ''
  return `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; SameSite=Lax${domainPart}`
}

export function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  const escaped = name.replace(/[.$?*|{}()[\]\\/+^]/g, '\\$&')
  const match = document.cookie.match(new RegExp(`(?:^|; )${escaped}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}

export function setCookie(name: string, value: string, days = 365): void {
  if (typeof document === 'undefined') return
  document.cookie = serializeCookie(name, value, days, COOKIE_DOMAIN)
}
