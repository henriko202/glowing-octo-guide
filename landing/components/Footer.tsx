import Link from "next/link";

export default function Footer() {
  return (
    <footer className="bg-ink-800 border-t border-cream/5 py-10 px-6">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-cream/40 text-sm">
          <div className="w-4 h-4 rounded-full border border-gold/40 flex items-center justify-center">
            <div className="w-1 h-1 rounded-full bg-gold/60" />
          </div>
          <span>Link Into The SSI</span>
          <span>·</span>
          <span>© {new Date().getFullYear()}</span>
        </div>
        <div className="flex items-center gap-6 text-cream/30 text-xs">
          <Link href="/privacy" className="hover:text-cream/60 transition-colors">Privacy</Link>
          <Link href="/terms" className="hover:text-cream/60 transition-colors">Terms</Link>
          <a href="mailto:hello@linkintothessi.com" className="hover:text-cream/60 transition-colors">Contact</a>
        </div>
      </div>
    </footer>
  );
}
