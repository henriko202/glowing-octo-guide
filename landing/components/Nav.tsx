'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { SIGN_IN_URL } from '../lib/links'
import ThemeToggle from './ThemeToggle'
import LanguageSelector from './LanguageSelector'
import type { Dictionary } from '../i18n/getDictionary'
import type { Locale } from '../i18n/config'

export default function Nav({
  dict,
  themeToggleDict,
  languageSelectorDict,
  lang
}: {
  dict: Dictionary['nav']
  themeToggleDict: Dictionary['themeToggle']
  languageSelectorDict: Dictionary['languageSelector']
  lang: Locale
}) {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-500 ${
        scrolled ? 'border-b border-cream/5 bg-ink/90 backdrop-blur-md' : 'bg-transparent'
      }`}
    >
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link
          href={`/${lang}`}
          className="group flex items-center gap-2.5"
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-full border border-gold transition-all group-hover:border-gold-light group-hover:shadow-[0_0_12px_rgba(201,150,62,0.4)]">
            <div className="h-2 w-2 rounded-full bg-gold transition-colors group-hover:bg-gold-light" />
          </div>
          <span className="font-display text-lg font-semibold tracking-wide text-cream">Link Into The SSI</span>
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          <Link
            href={`/${lang}#how-it-works`}
            className="text-sm text-cream/60 transition-colors hover:text-cream"
          >
            {dict.howItWorks}
          </Link>
          <Link
            href={`/${lang}#features`}
            className="text-sm text-cream/60 transition-colors hover:text-cream"
          >
            {dict.features}
          </Link>
          <Link
            href={`/${lang}#pricing`}
            className="text-sm text-cream/60 transition-colors hover:text-cream"
          >
            {dict.pricing}
          </Link>
        </div>

        <div className="flex items-center gap-3">
          <LanguageSelector
            dict={languageSelectorDict}
            lang={lang}
          />
          <ThemeToggle dict={themeToggleDict} />
          <a
            href={`${SIGN_IN_URL}?plan=growth&interval=annual`}
            className="rounded-full border border-gold/60 px-5 py-2 text-sm font-medium text-gold-text transition-all duration-200 hover:bg-gold hover:text-on-gold"
          >
            {dict.cta}
          </a>
        </div>
      </nav>
    </header>
  )
}
