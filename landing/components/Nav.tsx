'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'

export default function Nav() {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])

  const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:5173'

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-500 ${
        scrolled ? 'border-b border-cream/5 bg-ink/90 backdrop-blur-md' : 'bg-transparent'
      }`}
    >
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link
          href="/"
          className="group flex items-center gap-2.5"
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-full border border-gold transition-all group-hover:border-gold-light group-hover:shadow-[0_0_12px_rgba(201,150,62,0.4)]">
            <div className="h-2 w-2 rounded-full bg-gold transition-colors group-hover:bg-gold-light" />
          </div>
          <span className="font-display text-lg font-semibold tracking-wide text-cream">Link Into The SSI</span>
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          <Link
            href="#how-it-works"
            className="text-sm text-cream/60 transition-colors hover:text-cream"
          >
            How it works
          </Link>
          <Link
            href="#features"
            className="text-sm text-cream/60 transition-colors hover:text-cream"
          >
            Features
          </Link>
          <Link
            href="/pricing"
            className="text-sm text-cream/60 transition-colors hover:text-cream"
          >
            Pricing
          </Link>
        </div>

        <a
          href={`${APP_URL}`}
          className="rounded-full border border-gold/60 px-5 py-2 text-sm font-medium text-gold transition-all duration-200 hover:bg-gold hover:text-ink"
        >
          Join the circle
        </a>
      </nav>
    </header>
  )
}
