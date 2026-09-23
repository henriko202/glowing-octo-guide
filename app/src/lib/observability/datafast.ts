// Web analytics (DataFast), cookie mode. ANALYTICS purpose — strictly consent-gated: started only by
// syncAnalyticsConsent for a signed-in member who granted `analytics` consent, stopped on withdrawal or sign-out.
// Pageviews carry origin + pathname only, never the query or fragment (/auth/success#…, /unsubscribe?token=…).
import { type DataFastWeb, deleteCookie, initDataFast } from 'datafast'

// The five cookies DataFast's cookie mode writes on `.<domain>`. shutdown() leaves them behind.
const COOKIES = [
  'datafast_visitor_id',
  'datafast_visitor_first_seen_at',
  'datafast_visitor_session_count',
  'datafast_session_id',
  'datafast_session_start'
]

let started: Promise<DataFastWeb> | null = null

// Every event carries `domain`, which must match the DataFast website's domain (`linkintothessi.com`).
function rootDomain(): string {
  const configured = (import.meta.env.VITE_COOKIE_DOMAIN as string | undefined)?.trim().replace(/^\./, '')
  return configured || window.location.hostname
}

function pageHref(pathname: string): string {
  return window.location.origin + pathname
}

/** Start DataFast for a consenting member. Idempotent; a no-op outside prod builds or without the website id. */
export function startDataFast(userId: string): void {
  const websiteId = (import.meta.env.VITE_DATAFAST_WEBSITE_ID as string | undefined)?.trim()
  if (!import.meta.env.PROD || !websiteId || started) return
  started = initDataFast({ websiteId, domain: rootDomain(), maxQueueSize: 1 }).then(async client => {
    // Pageview first: identify builds its href from the last screen name ("/Unknown" before any pageview).
    await client.trackScreen(window.location.pathname, { href: pageHref(window.location.pathname) })
    await client.identify(userId)
    return client
  })
}

/** Stop sending and delete the visitor cookies. Safe to call when DataFast never started. */
export function stopDataFast(): void {
  const pending = started
  started = null
  const clearCookies = () => {
    for (const name of COOKIES) deleteCookie(name, rootDomain())
  }
  clearCookies()
  // An init or send still in flight may write the cookies after the first sweep, so sweep again once it's shut down.
  void pending?.then(async client => {
    await client.shutdown()
    clearCookies()
  })
}

/** Send a pageview for a route change. A no-op until startDataFast has run. */
export function trackDataFastPageview(pathname: string): void {
  void started?.then(client => client.trackScreen(pathname, { href: pageHref(pathname) }))
}
