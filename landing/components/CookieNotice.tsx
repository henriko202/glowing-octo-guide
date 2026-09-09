'use client'

import { useState, useSyncExternalStore } from 'react'
import type { Dictionary } from '@/i18n/getDictionary'
import type { Locale } from '@/i18n/config'

const KEY = 'cookieNoticeDismissed'

function subscribe(callback: () => void) {
  window.addEventListener('storage', callback)
  return () => window.removeEventListener('storage', callback)
}

// Client snapshot reads the dismissal flag; the server snapshot reports "dismissed" so nothing
// renders during SSR. useSyncExternalStore hydrates with the server snapshot (matching the server
// HTML) and then re-renders with the client value, avoiding a hydration mismatch, unlike a lazy
// useState initializer.
function getSnapshot(): boolean {
  return localStorage.getItem(KEY) === '1'
}

function getServerSnapshot(): boolean {
  return true
}

export default function CookieNotice({ dict, lang }: { dict: Dictionary['cookieNotice']; lang: Locale }) {
  const dismissedInStorage = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  const [dismissedNow, setDismissedNow] = useState(false)

  if (dismissedInStorage || dismissedNow) return null

  return (
    // This bar is fixed, so its height is dead space the Hero has to reserve (it centres its content
    // between the nav and this notice). The text length varies by locale — es wraps a line more than
    // en — so on short viewports the bar tightens rather than letting the Hero guess a worst-case
    // padding. Keep this query in step with the one in Hero.tsx.
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-cream/10 bg-ink/95 px-6 py-4 text-sm text-cream/80 backdrop-blur [@media(max-height:720px)]:py-2 [@media(max-height:720px)]:text-xs">
      <div className="mx-auto flex max-w-4xl flex-col items-center gap-3 sm:flex-row [@media(max-height:720px)]:gap-2">
        <p className="m-0 flex-1">
          {dict.text}{' '}
          <a
            href={`/${lang}/cookies`}
            className="text-gold-text hover:underline"
          >
            {dict.learnMore}
          </a>
          .
        </p>
        <button
          type="button"
          onClick={() => {
            localStorage.setItem(KEY, '1')
            setDismissedNow(true)
          }}
          className="rounded-md bg-gold px-4 py-2 font-semibold text-on-gold"
        >
          {dict.dismiss}
        </button>
      </div>
    </div>
  )
}
