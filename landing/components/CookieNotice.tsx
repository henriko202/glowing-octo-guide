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
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

function getServerSnapshot(): boolean {
  return true
}

export default function CookieNotice({ dict, lang }: { dict: Dictionary['cookieNotice']; lang: Locale }) {
  const dismissedInStorage = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  const [dismissedNow, setDismissedNow] = useState(false)

  if (dismissedInStorage || dismissedNow) return null

  return (
    <aside
      aria-label={dict.label}
      className="border-t border-cream/10 bg-ink-800 px-6 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-sm text-cream-muted"
    >
      <div className="mx-auto flex max-w-4xl flex-col items-start gap-3 sm:flex-row sm:items-center">
        <p className="m-0 flex-1">
          {dict.text}{' '}
          <a
            href={`/${lang}/cookies`}
            className="text-gold-text hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold"
          >
            {dict.learnMore}
          </a>
          .
        </p>
        <button
          type="button"
          onClick={() => {
            try {
              localStorage.setItem(KEY, '1')
            } catch {
              /* Dismiss for this visit when storage is unavailable. */
            }
            setDismissedNow(true)
          }}
          className="min-h-11 rounded-md bg-gold px-4 py-2 font-semibold text-on-gold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold"
        >
          {dict.dismiss}
        </button>
      </div>
    </aside>
  )
}
