import Link from 'next/link'

export default function Footer() {
  return (
    <footer className="border-t border-cream/5 bg-ink-800 px-6 py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 md:flex-row">
        <div className="flex items-center gap-2 text-sm text-cream/40">
          <div className="flex h-4 w-4 items-center justify-center rounded-full border border-gold/40">
            <div className="h-1 w-1 rounded-full bg-gold/60" />
          </div>
          <span>Link Into The SSI</span>
          <span>·</span>
          <span>© {new Date().getFullYear()}</span>
        </div>
        <div className="flex items-center gap-6 text-xs text-cream/30">
          <Link
            href="/privacy"
            className="transition-colors hover:text-cream/60"
          >
            Privacy
          </Link>
          <Link
            href="/terms"
            className="transition-colors hover:text-cream/60"
          >
            Terms
          </Link>
          <a
            href="mailto:hello@linkintothessi.com"
            className="transition-colors hover:text-cream/60"
          >
            Contact
          </a>
        </div>
      </div>
    </footer>
  )
}
