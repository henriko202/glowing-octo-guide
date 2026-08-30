// landing/components/LanguageSelector.tsx
'use client'
import { usePathname, useRouter } from 'next/navigation'
import { setCookie } from '../lib/cookies'
import { i18n, type Locale } from '../i18n/config'
import type { Dictionary } from '../i18n/getDictionary'

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
    <div className="flex items-center gap-1 text-sm">
      {i18n.locales.map(l => (
        <button
          key={l}
          type="button"
          onClick={() => switchTo(l)}
          aria-label={`${dict.label}: ${dict[l as Locale]}`}
          aria-current={l === lang ? 'true' : undefined}
          className={`rounded px-1.5 py-0.5 uppercase ${
            l === lang ? 'text-gold-text' : 'text-cream/50 hover:text-cream'
          }`}
        >
          {l}
        </button>
      ))}
    </div>
  )
}
