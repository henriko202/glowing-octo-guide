import { SIGN_IN_URL } from '@/lib/links'
import type { Dictionary } from '@/i18n/getDictionary'

export default function Hero({ dict }: { dict: Dictionary['hero'] }) {
  return (
    <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-ink px-6 text-center">
      {/* Radial glow */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(ellipse 80% 60% at 50% 40%, var(--glow-lnblue) 0%, transparent 70%)' }}
      />
      {/* Decorative rings */}
      <div
        className="circle-ring"
        style={{
          width: 560,
          height: 560,
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%) translateY(-40px)'
        }}
      />
      <div
        className="circle-ring"
        style={{
          width: 860,
          height: 860,
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%) translateY(-40px)',
          opacity: 0.5
        }}
      />

      <div className="relative z-10 mx-auto max-w-3xl space-y-8">
        {/* Eyebrow */}
        <div className="inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/5 px-4 py-1.5 text-xs font-medium tracking-widest text-gold-text uppercase">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-gold" />
          {dict.eyebrow}
        </div>

        {/* Outcome-led headline */}
        <h1 className="font-display text-5xl leading-tight font-semibold text-cream md:text-7xl">
          {dict.headlineLine1}
          <br />
          <span className="text-gold-text italic">{dict.headlineLine2}</span>
        </h1>

        {/* Sub-headline: tangible, credible, viable */}
        <div className="mx-auto max-w-xl space-y-3">
          <p className="text-lg leading-relaxed text-cream/70">{dict.subLine1}</p>
          <p className="text-base leading-relaxed text-cream/50">{dict.subLine2}</p>
        </div>

        {/* CTA */}
        <div className="flex flex-col items-center justify-center gap-3 pt-2">
          <a
            href={`${SIGN_IN_URL}?plan=growth&interval=annual`}
            className="group relative rounded-full bg-gold px-8 py-3.5 font-medium text-on-gold shadow-[0_0_32px_rgba(201,150,62,0.35)] transition-all duration-300 hover:bg-gold-light hover:shadow-[0_0_48px_rgba(201,150,62,0.5)]"
          >
            {dict.cta}
            <span className="ml-2 inline-block transition-transform duration-300 group-hover:translate-x-1">→</span>
          </a>
          {/* Click trigger */}
          <p className="text-xs tracking-wide text-cream/40">{dict.ctaDisclaimer}</p>
          {/* Above-fold trust line */}
          <p className="text-sm text-cream-muted">{dict.trustLine}</p>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-10 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2 dark:opacity-30">
        <span className="text-xs tracking-widest text-cream/50 uppercase">{dict.scrollLabel}</span>
        <div className="h-10 w-px bg-gradient-to-b from-cream/40 to-transparent" />
      </div>
    </section>
  )
}
