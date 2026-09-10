'use client'
import { useEffect, useSyncExternalStore } from 'react'
import { applyTheme, getStoredTheme, resolveTheme, setStoredTheme, type ThemePref } from '@/lib/theme'
import type { Dictionary } from '@/i18n/getDictionary'

const ORDER: ThemePref[] = ['system', 'light', 'dark']

// Re-render the toggle whenever its own click dispatches `themechange` (the only thing that changes pref).
function subscribe(cb: () => void) {
  window.addEventListener('themechange', cb)
  return () => window.removeEventListener('themechange', cb)
}

export default function ThemeToggle({ dict }: { dict: Dictionary['themeToggle'] }) {
  // useSyncExternalStore renders the server snapshot ('system') during SSR and the hydration pass — matching
  // the statically generated HTML, so there is no hydration mismatch — then swaps to the real cookie value
  // post-hydration. (A static page can't read the per-user cookie at build time; this just keeps it warning-free.)
  const pref = useSyncExternalStore<ThemePref>(subscribe, getStoredTheme, () => 'system')

  // While the preference is "system", follow live OS scheme changes (initial paint is the no-flash script's job).
  // Adds a listener and mutates the DOM via applyTheme only — no setState in the effect.
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => applyTheme(resolveTheme(getStoredTheme(), mq.matches))
    onChange() // sync on mount — esp. the <meta theme-color>, which the no-flash script does not set
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const cycle = () => {
    const next = ORDER[(ORDER.indexOf(pref) + 1) % ORDER.length]
    setStoredTheme(next)
    applyTheme(resolveTheme(next, window.matchMedia('(prefers-color-scheme: dark)').matches))
    window.dispatchEvent(new Event('themechange'))
  }

  const label: Record<ThemePref, string> = {
    system: dict.system,
    light: dict.light,
    dark: dict.dark
  }

  return (
    <button
      type="button"
      onClick={cycle}
      aria-label={label[pref]}
      title={label[pref]}
      className="flex h-11 w-11 items-center justify-center rounded-full border border-cream/15 text-cream/70 hover:border-cream/30 hover:text-cream focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
    >
      {pref === 'system' ? (
        <svg
          aria-hidden="true"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect
            x="2"
            y="3"
            width="20"
            height="14"
            rx="2"
          />
          <path d="M8 21h8M12 17v4" />
        </svg>
      ) : pref === 'light' ? (
        <svg
          aria-hidden="true"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle
            cx="12"
            cy="12"
            r="4"
          />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
        </svg>
      ) : (
        <svg
          aria-hidden="true"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  )
}
