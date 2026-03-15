import Link from "next/link";

export default function Hero() {
  const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:5173";

  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center text-center px-6 overflow-hidden">
      {/* Radial glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse 80% 60% at 50% 40%, rgba(0,119,181,0.10) 0%, transparent 70%)",
        }}
      />

      {/* Decorative circle rings */}
      <div className="circle-ring" style={{ width: 480, height: 480, top: "50%", left: "50%", transform: "translate(-50%, -50%) translateY(-60px)" }} />
      <div className="circle-ring" style={{ width: 700, height: 700, top: "50%", left: "50%", transform: "translate(-50%, -50%) translateY(-60px)", borderColor: "rgba(201,150,62,0.04)" }} />
      <div className="circle-ring" style={{ width: 960, height: 960, top: "50%", left: "50%", transform: "translate(-50%, -50%) translateY(-60px)", opacity: 0.5 }} />

      <div className="relative z-10 max-w-3xl mx-auto space-y-8">
        {/* Eyebrow */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-gold/30 bg-gold/5 text-gold text-xs font-medium tracking-widest uppercase">
          <span className="w-1.5 h-1.5 rounded-full bg-gold animate-pulse" />
          LinkedIn Growth Community
        </div>

        {/* Headline with slot machine */}
        <h1 className="font-display text-5xl md:text-7xl font-semibold leading-tight text-cream">
          Because your SSI
          <br />
          matters to{" "}
          <span className="slot-container text-gold italic" aria-label="you, recruiters, everyone else">
            <span className="slot-words">
              <span>you</span>
              <span>recruiters</span>
              <span>everyone else</span>
              <span>you</span>
            </span>
          </span>
        </h1>

        {/* Supporting copy */}
        <div className="space-y-3 max-w-xl mx-auto">
          <p className="text-lg text-cream/70 leading-relaxed">
            Increase your SSI organically with real interactions and comments from professionals in your industry.
          </p>
          <p className="text-base text-cream/50 leading-relaxed">
            Automatically surface active recruiters looking for candidates in your area of expertise.
          </p>
        </div>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
          <a
            href={`${APP_URL}/login`}
            className="group relative px-8 py-3.5 rounded-full font-medium text-ink bg-gold hover:bg-gold-light transition-all duration-200 shadow-[0_0_32px_rgba(201,150,62,0.35)] hover:shadow-[0_0_48px_rgba(201,150,62,0.5)]"
          >
            Join the circle — it&apos;s free
            <span className="ml-2 inline-block transition-transform group-hover:translate-x-1">→</span>
          </a>
          <Link href="#how-it-works" className="text-sm text-cream/50 hover:text-cream/80 transition-colors underline underline-offset-4">
            See how it works
          </Link>
        </div>

        <p className="text-xs text-cream/30 tracking-wide">
          3-day free trial · No credit card required
        </p>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 opacity-30">
        <span className="text-xs text-cream/50 tracking-widest uppercase">Scroll</span>
        <div className="w-px h-10 bg-gradient-to-b from-cream/40 to-transparent" />
      </div>
    </section>
  );
}
