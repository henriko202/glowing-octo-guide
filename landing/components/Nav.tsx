"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

export default function Nav() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:5173";

  return (
    <header
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-500 ${
        scrolled ? "bg-ink/90 backdrop-blur-md border-b border-cream/5" : "bg-transparent"
      }`}
    >
      <nav className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-7 h-7 rounded-full border border-gold flex items-center justify-center transition-all group-hover:border-gold-light group-hover:shadow-[0_0_12px_rgba(201,150,62,0.4)]">
            <div className="w-2 h-2 rounded-full bg-gold group-hover:bg-gold-light transition-colors" />
          </div>
          <span className="font-display text-lg font-semibold text-cream tracking-wide">
            Link Into The SSI
          </span>
        </Link>

        <div className="hidden md:flex items-center gap-8">
          <Link href="#how-it-works" className="text-sm text-cream/60 hover:text-cream transition-colors">
            How it works
          </Link>
          <Link href="#features" className="text-sm text-cream/60 hover:text-cream transition-colors">
            Features
          </Link>
          <Link href="/pricing" className="text-sm text-cream/60 hover:text-cream transition-colors">
            Pricing
          </Link>
        </div>

        <a
          href={`${APP_URL}/login`}
          className="px-5 py-2 rounded-full text-sm font-medium border border-gold/60 text-gold hover:bg-gold hover:text-ink transition-all duration-200"
        >
          Join the circle
        </a>
      </nav>
    </header>
  );
}
