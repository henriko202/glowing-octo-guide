// Cookieless, first-party landing funnel beacon. Nothing about the visitor leaves the browser: no
// cookie, no client identifier, no IP or user-agent is sent or stored — only the event name, which
// the backend turns into a per-(UTC day, event) counter. See convex/landingMetrics.ts.
const CONVEX_SITE = process.env.NEXT_PUBLIC_CONVEX_SITE?.trim().replace(/\/+$/, '')

export type CtaPlacement = 'hero' | 'nav' | 'pricing' | 'final'

export type LandingEvent = 'pricing_view' | `cta_click_${CtaPlacement}`

export function trackLandingEvent(event: LandingEvent): void {
  if (!CONVEX_SITE) return
  void fetch(`${CONVEX_SITE}/landing/event`, {
    // text/plain is CORS-safelisted, so the beacon needs no preflight; keepalive lets a click that
    // starts navigation still deliver the request.
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
    body: JSON.stringify({ event }),
    keepalive: true
  }).catch(() => {
    // Fire-and-forget: a failed beacon must never surface anywhere.
  })
}
