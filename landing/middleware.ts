import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { i18n } from './i18n/config'

const LANG_COOKIE = 'lang'

function getLocale(request: NextRequest): string {
  const cookie = request.cookies.get(LANG_COOKIE)?.value
  if (cookie && (i18n.locales as readonly string[]).includes(cookie)) return cookie
  const header = request.headers.get('accept-language')
  if (header) {
    for (const part of header.split(',')) {
      const code = part.split(';')[0].trim().toLowerCase()
      const base = code.split('-')[0]
      const hit = i18n.locales.find(l => l === code || l === base)
      if (hit) return hit
    }
  }
  return i18n.defaultLocale
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const hasLocale = i18n.locales.some(l => pathname === `/${l}` || pathname.startsWith(`/${l}/`))
  if (hasLocale) return
  const locale = getLocale(request)
  const url = request.nextUrl.clone()
  url.pathname = `/${locale}${pathname === '/' ? '' : pathname}`
  return NextResponse.redirect(url)
}

export const config = {
  // Skip API, Next internals, and any path with a file extension (static assets).
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)']
}
