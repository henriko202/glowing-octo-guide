import Link from 'next/link'

export default function Hero() {
  const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:5173'

  return (
    <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 text-center">
      {/* Radial glow */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse 80% 60% at 50% 40%, rgba(0,119,181,0.10) 0%, transparent 70%)'
        }}
      />

      {/* Decorative circle rings */}
      <div
        className="circle-ring"
        style={{
          width: 480,
          height: 480,
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%) translateY(-60px)'
        }}
      />
      <div
        className="circle-ring"
        style={{
          width: 700,
          height: 700,
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%) translateY(-60px)',
          borderColor: 'rgba(201,150,62,0.04)'
        }}
      />
      <div
        className="circle-ring"
        style={{
          width: 960,
          height: 960,
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%) translateY(-60px)',
          opacity: 0.5
        }}
      />

      <div className="relative z-10 mx-auto max-w-3xl space-y-8">
        {/* Eyebrow */}
        <div className="inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/5 px-4 py-1.5 text-xs font-medium uppercase tracking-widest text-gold">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-gold" />
          LinkedIn Growth Community
        </div>

        {/* Headline with slot machine */}
        <h1 className="font-display text-5xl font-semibold leading-tight text-cream md:text-7xl">
          Because your SSI
          <br />
          matters to{' '}
          <span
            className="slot-container italic text-gold"
            aria-label="you, recruiters, everyone else"
          >
            <span className="slot-words">
              <span>you</span>
              <span>recruiters</span>
              <span>everyone else</span>
              <span>you</span>
            </span>
          </span>
        </h1>

        {/* Supporting copy */}
        <div className="mx-auto max-w-xl space-y-3">
          <p className="text-lg leading-relaxed text-cream/70">
            Increase your SSI organically with real interactions and comments from professionals in your industry.
          </p>
          <p className="text-base leading-relaxed text-cream/50">
            Automatically surface active recruiters looking for candidates in your area of expertise.
          </p>
        </div>

        {/* CTAs */}
        <div className="flex flex-col items-center justify-center gap-4 pt-2 sm:flex-row">
          <a
            href={`${APP_URL}`}
            className="group relative rounded-full bg-gold px-8 py-3.5 font-medium text-ink shadow-[0_0_32px_rgba(201,150,62,0.35)] transition-all duration-200 hover:bg-gold-light hover:shadow-[0_0_48px_rgba(201,150,62,0.5)]"
          >
            Join the circle — it&apos;s free
            <span className="ml-2 inline-block transition-transform group-hover:translate-x-1">→</span>
          </a>
          <Link
            href="#how-it-works"
            className="text-sm text-cream/50 underline underline-offset-4 transition-colors hover:text-cream/80"
          >
            See how it works
          </Link>
        </div>

        <p className="text-xs tracking-wide text-cream/30">3-day free trial · No credit card required</p>
        <p className="text-sm text-cream-muted">Join 500+ professionals already growing their SSI</p>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-10 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2 opacity-30">
        <span className="text-xs uppercase tracking-widest text-cream/50">Scroll</span>
        <div className="h-10 w-px bg-gradient-to-b from-cream/40 to-transparent" />
      </div>
    </section>
  )
}
