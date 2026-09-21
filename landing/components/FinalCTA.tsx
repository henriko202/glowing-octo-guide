import { PrimaryCta, SelectedOffer } from './TrialProvider'
import type { Dictionary } from '@/i18n/getDictionary'
import type { Locale } from '@/i18n/config'

export default function FinalCTA({
  dict,
  offer,
  lang
}: {
  dict: Dictionary['finalCta']
  offer: Dictionary['trialOffer']
  lang: Locale
}) {
  return (
    <section className="bg-ink px-6 py-16 text-center md:py-24">
      <div className="mx-auto max-w-xl space-y-6">
        <h2 className="font-display text-4xl font-semibold text-balance text-cream md:text-5xl">
          {dict.headlineLine1}
          <br />
          <span className="text-gold-text">{dict.headlineLine2}</span>
        </h2>
        <div className="flex flex-col items-center gap-3">
          <PrimaryCta
            placement="final"
            loginLabel={dict.loginCta}
            className="inline-flex min-h-11 items-center rounded-full bg-gold px-8 py-4 font-semibold text-on-gold transition-colors hover:bg-gold-light focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold"
          >
            {dict.cta}
            <span
              aria-hidden="true"
              className="ml-2"
            >
              →
            </span>
          </PrimaryCta>
          <SelectedOffer
            dict={offer}
            lang={lang}
          />
          <p className="text-[13px] leading-relaxed text-cream-muted">{dict.subheadline}</p>
          <p className="text-[13px] leading-relaxed text-cream-muted">{dict.ctaTrust}</p>
        </div>
      </div>
    </section>
  )
}
