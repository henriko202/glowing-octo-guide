// landing/components/LanguageSelector.tsx
'use client'
import { usePathname, useRouter } from 'next/navigation'
import { setCookie } from '@/lib/cookies'
import { i18n, type Locale } from '@/i18n/config'
import type { Dictionary } from '@/i18n/getDictionary'

export default function LanguageSelector({ dict, lang }: { dict: Dictionary['languageSelector']; lang: Locale }) {
  const router = useRouter()
  const pathname = usePathname()

  const switchTo = (next: Locale) => {
    if (next === lang) return
    setCookie('lang', next) // shared cross-site cookie (Plan 1) — carries the choice to the app
    // Swap the leading /<lang> segment for /<next>, preserving the rest of the path.
    const rest = pathname.replace(new RegExp(`^/(${i18n.locales.join('|')})`), '') || ''
    router.push(`/${next}${rest}`)
    router.refresh()
  }

  return (
    <div className="relative inline-flex items-center">
      <select
        value={lang}
        onChange={e => switchTo(e.target.value as Locale)}
        aria-label={dict.label}
        className="min-h-11 min-w-11 cursor-pointer appearance-none rounded-md border border-cream/15 bg-transparent py-1 pr-7 pl-2.5 text-sm font-medium text-cream/70 uppercase hover:border-cream/30 hover:text-cream focus:outline-none focus-visible:ring-1 focus-visible:ring-gold/40"
      >
        {i18n.locales.map(l => (
          <option
            key={l}
            value={l}
            className="bg-ink-600 text-cream" // the open list's colors; unset, Chrome showed cream on white in dark mode
          >
            {l.toUpperCase()}
          </option>
        ))}
      </select>
      {/* Custom chevron — appearance-none drops the native arrow, which varies wildly across OSes. */}
      <svg
        className="pointer-events-none absolute right-2 h-3 w-3 text-cream/40"
        viewBox="0 0 12 12"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M3 4.5 6 7.5 9 4.5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  )
}
