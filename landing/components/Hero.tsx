import { SelectedOffer, TrialLink } from './TrialProvider'
import type { Dictionary } from '@/i18n/getDictionary'
import type { Locale } from '@/i18n/config'

export default function Hero({
  dict,
  offer,
  lang
}: {
  dict: Dictionary['hero']
  offer: Dictionary['trialOffer']
  lang: Locale
}) {
  return (
    <section className="bg-ink px-6 pt-28 pb-16 text-center md:pt-40 md:pb-24">
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
            <TrialLink className="inline-flex min-h-11 items-center rounded-full bg-gold px-8 py-3.5 font-semibold text-on-gold transition-colors hover:bg-gold-light focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold">
              {dict.cta}
              <span
                aria-hidden="true"
                className="ml-2"
              >
                →
              </span>
            </TrialLink>
            <SelectedOffer
              dict={offer}
              lang={lang}
            />
            <p className="text-[13px] leading-relaxed text-cream-muted">{dict.ctaDisclaimer}</p>
            <p className="text-[13px] leading-relaxed text-cream-muted">{dict.ctaTrust}</p>
          </div>
        </div>
      </div>
    </section>
  )
}
