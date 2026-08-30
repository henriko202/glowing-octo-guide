import { SIGN_IN_URL } from '@/lib/links'
import type { Dictionary } from '@/i18n/getDictionary'

export default function FinalCTA({ dict }: { dict: Dictionary['finalCta'] }) {
  return (
    <section className="relative overflow-hidden bg-ink px-6 py-32 text-center">
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(ellipse 60% 50% at 50% 50%, var(--glow-gold) 0%, transparent 70%)' }}
      />
      <div
        className="circle-ring"
        style={{
          width: 500,
          height: 500,
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          borderColor: 'var(--ring-gold)'
        }}
      />
      <div className="relative z-10 mx-auto max-w-xl space-y-6">
        <h2 className="font-display text-5xl font-semibold text-cream md:text-6xl">
          {dict.headlineLine1}
          <br />
          <span className="text-gold-text italic">{dict.headlineLine2}</span>
        </h2>
        <p className="text-base text-cream/50">{dict.subheadline}</p>
        <div className="flex flex-col items-center gap-3">
          <a
            href={`${SIGN_IN_URL}?plan=growth&interval=annual`}
            className="inline-block rounded-full bg-gold px-10 py-4 font-semibold text-on-gold shadow-[0_0_40px_rgba(201,150,62,0.4)] transition-[background-color,box-shadow] duration-300 hover:bg-gold-light hover:shadow-[0_0_60px_rgba(201,150,62,0.55)]"
          >
            {dict.cta} →
          </a>
          <p className="text-sm text-gold-text">{dict.earlyAccess}</p>
        </div>
      </div>
    </section>
  )
}
