import { SIGN_IN_URL } from '@/lib/links'
import type { Dictionary } from '@/i18n/getDictionary'

export default function Hero({ dict }: { dict: Dictionary['hero'] }) {
  return (
    <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-ink px-6 pb-24 text-center sm:pb-0 [@media(max-height:720px)]:pt-18 [@media(max-height:720px)]:pb-32 [@media(max-width:640px)_and_(max-height:850px)]:pt-18 [@media(max-width:640px)_and_(max-height:850px)]:pb-32">
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
          transform: 'translate(-50%, -50%)'
        }}
      />
      <div
        className="circle-ring"
        style={{
          width: 860,
          height: 860,
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          opacity: 0.5
        }}
      />

      <div className="relative z-10 mx-auto max-w-3xl space-y-8 [@media(max-height:720px)]:space-y-3 [@media(max-width:640px)_and_(max-height:850px)]:space-y-3">
        {/* Outcome-led headline */}
        <h1 className="font-display text-4xl leading-tight font-semibold text-balance text-cream sm:text-5xl md:text-7xl [@media(max-height:720px)]:text-2xl [@media(max-width:640px)_and_(max-height:850px)]:text-2xl">
          {dict.headlineLine1}
          <br />
          <span className="text-gold-text">{dict.headlineLine2}</span>
        </h1>

        {/* Sub-headline: tangible, credible, viable */}
        <div className="mx-auto max-w-xl space-y-3">
          <p className="text-lg leading-relaxed text-cream/70 [@media(max-height:720px)]:text-base [@media(max-width:640px)_and_(max-height:850px)]:text-base">
            {dict.subLine1}
          </p>
          <p className="text-base leading-relaxed font-medium text-cream-muted">{dict.subLine2}</p>
        </div>

        {/* CTA */}
        <div className="flex flex-col items-center justify-center gap-3 pt-2 [@media(max-height:720px)]:gap-2 [@media(max-height:720px)]:pt-0 [@media(max-width:640px)_and_(max-height:850px)]:gap-2 [@media(max-width:640px)_and_(max-height:850px)]:pt-0">
          <a
            href={`${SIGN_IN_URL}?plan=growth&interval=annual`}
            className="group relative rounded-full bg-gold px-8 py-3.5 font-medium text-on-gold shadow-[0_0_32px_rgba(201,150,62,0.35)] transition-[background-color,box-shadow] duration-300 hover:bg-gold-light hover:shadow-[0_0_48px_rgba(201,150,62,0.5)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold"
          >
            {dict.cta}
            <span className="ml-2 inline-block transition-transform duration-300 group-hover:translate-x-1">→</span>
          </a>
          {/* Click triggers. Safety first: it is this product's top objection ("will this get my
              LinkedIn restricted?"). The cost rule is repeated in pricing.trialNote and the FAQ.
              Both lines must stay clear of the fixed CookieNotice on a first visit, and the
              headline must stay clear of the fixed nav. Two overlays eat the viewport — the nav
              (65px) and the notice — so justify-center must centre inside vh minus both, which is
              what the section's paired pt/pb buy. The failure is vertical, not horizontal (pt/es
              wrap the headline and subLine1 a line longer than en), so every override here is
              keyed to max-height:720px rather than to sm:; CookieNotice tightens on the same query
              because its height is locale-dependent (89px en, 105px pt/es, vs 141/161px untightened)
              and a fixed pb cannot reserve a worst case that varies. Re-measure after any copy or
              spacing change: at 360x640, 375x667 and 375x812, in all three locales, the gap above
              the headline and below this block must both be positive. */}
          <p className="text-[13px] leading-snug font-medium text-cream-muted">{dict.ctaTrust}</p>
          <p className="text-[13px] leading-snug text-cream-muted">{dict.ctaDisclaimer}</p>
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
