'use client'

import { type DataFastWeb, initDataFast } from 'datafast'
import { usePathname } from 'next/navigation'
import { useEffect } from 'react'

// Web analytics (DataFast), cookieless: every visitor, no cookie, no banner (the SDK keeps its session id in
// sessionStorage). Inert outside production builds and until NEXT_PUBLIC_DATAFAST_WEBSITE_ID is set.
const WEBSITE_ID = process.env.NEXT_PUBLIC_DATAFAST_WEBSITE_ID?.trim()
// Every event carries `domain`, which must match the DataFast website's domain (`linkintothessi.com`), not this
// page's `www.` host. Unset (dev) ⇒ the SDK's default, the page's host.
const DOMAIN = process.env.NEXT_PUBLIC_COOKIE_DOMAIN?.trim().replace(/^\./, '') || undefined

let client: Promise<DataFastWeb> | undefined

/** The href we report: the page URL minus the `ref` invite code (it identifies a member) and the fragment. */
export function landingPageviewHref(href: string): string {
  const url = new URL(href)
  url.searchParams.delete('ref')
  url.hash = ''
  return url.toString()
}

export function trackPageview(pathname: string): void {
  if (!WEBSITE_ID || process.env.NODE_ENV !== 'production') return
  client ??= initDataFast({ websiteId: WEBSITE_ID, domain: DOMAIN, cookieless: true, maxQueueSize: 1 })
  const href = landingPageviewHref(window.location.href)
  void client.then(c => c.trackScreen(pathname, { href }))
}

export default function DataFast() {
  const pathname = usePathname()
  useEffect(() => {
    trackPageview(pathname)
  }, [pathname])
  return null
}
