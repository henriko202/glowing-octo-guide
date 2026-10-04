import { LoginLink } from './TrialProvider'
import type { Dictionary } from '@/i18n/getDictionary'

export default function Hero({ dict }: { dict: Dictionary['hero'] }) {
  return (
    <section className="bg-ink px-6 pt-40 pb-16 text-center md:pt-52 md:pb-24">
      <div className="mx-auto max-w-3xl">
        <div className="space-y-6">
          <p className="text-xs font-medium tracking-widest text-gold-text uppercase">{dict.eyebrow}</p>
          <h1 className="font-display text-4xl leading-tight font-semibold text-balance text-cream sm:text-5xl md:text-7xl">
            {dict.headlineLine1}
            <br />
            <span className="text-gold-text">{dict.headlineLine2}</span>
          </h1>
          <p className="mx-auto max-w-xl text-lg leading-relaxed text-cream-muted">{dict.subLine1}</p>
          <p className="text-base leading-relaxed font-medium text-cream">{dict.subLine2}</p>
          <div className="mx-auto max-w-xl space-y-3">
            <LoginLink
              placement="hero"
              className="inline-flex min-h-11 items-center rounded-full bg-gold px-8 py-3.5 font-semibold text-on-gold transition-colors hover:bg-gold-light focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold"
            >
              {dict.loginCta}
              <span
                aria-hidden="true"
                className="ml-2"
              >
                →
              </span>
            </LoginLink>
            <p className="text-[13px] leading-relaxed text-cream-muted">{dict.ctaTrust}</p>
          </div>
        </div>
      </div>
    </section>
  )
}
