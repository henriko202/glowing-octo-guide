'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { TrialLink } from './TrialProvider'
import LogoMark from './LogoMark'
import ThemeToggle from './ThemeToggle'
import LanguageSelector from './LanguageSelector'
import type { Dictionary } from '@/i18n/getDictionary'
import type { Locale } from '@/i18n/config'

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
    handler() // sync with the real scroll position on mount — reload can restore a scrolled position before any scroll event fires
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 bg-ink/90 backdrop-blur-md transition-colors duration-300 ${
        scrolled ? 'border-b border-cream/5' : 'border-b border-transparent'
      }`}
    >
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 md:px-6">
        <Link
          href={`/${lang}`}
          aria-label="Link Into The SSI"
          className="group flex min-h-11 min-w-11 shrink-0 items-center gap-2.5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold"
        >
          <LogoMark className="h-6 w-[15px] shrink-0 text-gold transition-[color,filter] duration-300 group-hover:text-gold-light group-hover:drop-shadow-[0_0_6px_rgba(201,150,62,0.45)]" />
          <span className="hidden font-display text-base font-semibold tracking-wide whitespace-nowrap text-cream min-[430px]:inline md:text-lg">
            Link Into The SSI
          </span>
        </Link>

        <div className="hidden items-center gap-6 lg:flex">
          <Link
            href={`/${lang}#how-it-works`}
            className="inline-flex min-h-11 items-center text-sm text-cream-muted transition-colors duration-300 hover:text-cream focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold"
          >
            {dict.howItWorks}
          </Link>
          <Link
            href={`/${lang}#features`}
            className="inline-flex min-h-11 items-center text-sm text-cream-muted transition-colors duration-300 hover:text-cream focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold"
          >
            {dict.features}
          </Link>
          <Link
            href={`/${lang}#pricing`}
            className="inline-flex min-h-11 items-center text-sm text-cream-muted transition-colors duration-300 hover:text-cream focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold"
          >
            {dict.pricing}
          </Link>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href={`/${lang}#pricing`}
            className="inline-flex min-h-11 items-center px-1 text-sm font-medium text-cream hover:text-gold-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold lg:hidden"
          >
            {dict.pricing}
          </Link>
          <LanguageSelector
            dict={languageSelectorDict}
            lang={lang}
          />
          <ThemeToggle dict={themeToggleDict} />
          <TrialLink className="hidden min-h-11 items-center rounded-full border border-gold/60 px-3 py-2 text-sm font-medium whitespace-nowrap text-gold-text transition-colors duration-300 hover:bg-gold hover:text-on-gold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold sm:inline-flex md:px-5">
            {dict.cta}
          </TrialLink>
        </div>
      </nav>
    </header>
  )
}
