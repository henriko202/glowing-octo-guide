import Link from 'next/link'
import LanguageSelector from './LanguageSelector'
import type { Dictionary } from '@/i18n/getDictionary'
import type { Locale } from '@/i18n/config'

export default function Footer({
  dict,
  languageSelectorDict,
  lang
}: {
  dict: Dictionary['footer']
  languageSelectorDict: Dictionary['languageSelector']
  lang: Locale
}) {
  return (
    <footer className="border-t border-cream/5 bg-ink-800 px-6 py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 md:flex-row">
        <div className="flex items-center gap-2 text-sm text-cream-muted">
          <div className="flex h-4 w-4 items-center justify-center rounded-full border border-gold/40">
            <div className="h-1 w-1 rounded-full bg-gold/60" />
          </div>
          <span>Link Into The SSI</span>
          <span>·</span>
          <span>© {new Date().getFullYear()}</span>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-sm text-cream-muted">
          <Link
            href={`/${lang}/privacy`}
            className="transition-colors duration-300 hover:text-cream focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold"
          >
            {dict.privacy}
          </Link>
          <Link
            href={`/${lang}/terms`}
            className="transition-colors duration-300 hover:text-cream focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold"
          >
            {dict.terms}
          </Link>
          <Link
            href={`/${lang}/cookies`}
            className="transition-colors duration-300 hover:text-cream focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold"
          >
            {dict.cookies}
          </Link>
          <a
            href="mailto:contact@linkintothessi.com"
            className="transition-colors duration-300 hover:text-cream focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold"
          >
            {dict.contact}
          </a>
          <LanguageSelector
            dict={languageSelectorDict}
            lang={lang}
          />
        </div>
      </div>
      {dict.easterEgg && <p className="mt-6 text-center text-sm text-cream-muted">{dict.easterEgg}</p>}
    </footer>
  )
}
