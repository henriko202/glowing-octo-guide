'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { SIGN_IN_URL } from '@/lib/links'

// backlog/R19 — carries a member's invite code from the landing URL (`?ref=<code>`) into the LinkedIn
// OAuth start, so the app can attribute the new account (convex/http.ts reads `ref`, convex/linkedin/auth.ts
// stamps `referredByCode` on insert only). Renders nothing.
//
// Same shape rule as convex/lib/invite.ts INVITE_CODE_RE, duplicated on purpose: the landing bundle must not
// import from convex/. Keep the two in sync.
const INVITE_CODE_RE = /^[a-z0-9]{8}$/
const KEY = 'ref'

function readRef(): string | null {
  try {
    const fromUrl = new URLSearchParams(window.location.search).get(KEY)
    if (fromUrl && INVITE_CODE_RE.test(fromUrl)) {
      sessionStorage.setItem(KEY, fromUrl)
      return fromUrl
    }
    // A language switch or an in-site link drops the query; the stored code survives the tab.
    const stored = sessionStorage.getItem(KEY)
    return stored && INVITE_CODE_RE.test(stored) ? stored : null
  } catch {
    return null
  }
}

export default function RefCarrier() {
  const pathname = usePathname()
  useEffect(() => {
    const ref = readRef()
    if (!ref) return

    // Every CTA that starts OAuth (lib/links.ts SIGN_IN_URL). `plan`/`interval` on the plan buttons are kept;
    // when NEXT_PUBLIC_CONVEX_SITE is unset the CTAs point at the app root and this matches nothing. The
    // origin check guards both the loose `href*=` substring selector and the document-wide click listener
    // below: only an anchor that actually resolves to the sign-in origin gets the ref appended.
    const stamp = (a: HTMLAnchorElement) => {
      try {
        const url = new URL(a.href)
        if (url.origin !== new URL(SIGN_IN_URL).origin) return
        url.searchParams.set(KEY, ref)
        a.href = url.toString()
      } catch {
        /* a malformed href, or one that isn't the sign-in origin, stays as it was */
      }
    }

    // Eager pass: stamps every matching anchor already on the page for this pathname/mount. Also the
    // only pass a right-click "copy link address" or a middle-click ever sees, since neither fires an
    // ordinary `click` event.
    document.querySelectorAll<HTMLAnchorElement>('a[href*="/auth/linkedin"]').forEach(stamp)

    // Click-time pass: Pricing's plan buttons rebuild their href from local `annual` state on every
    // Monthly/Annual toggle, and that state change doesn't touch `pathname` — so the eager pass's stamp
    // gets silently overwritten by React's re-render the next time a visitor toggles, before they ever
    // click. Re-stamp right before the click is handled; capture phase so this runs before any handler
    // that might navigate.
    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.('a[href*="/auth/linkedin"]')
      if (a) stamp(a as HTMLAnchorElement)
    }
    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [pathname])
  return null
}
