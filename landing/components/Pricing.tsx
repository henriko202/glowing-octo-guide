'use client'
import { useEffect, useRef } from 'react'
import { TrialLink, useTrial } from './TrialProvider'
import { trackLandingEvent } from '@/lib/metrics'
import { formatPrice, planPrice } from '@/lib/trial'
import type { Dictionary } from '@/i18n/getDictionary'
import type { Locale } from '@/i18n/config'

export default function Pricing({ dict, lang }: { dict: Dictionary['pricing']; lang: Locale }) {
  const { interval, setInterval } = useTrial()
  const annual = interval === 'annual'
  const sectionRef = useRef<HTMLElement | null>(null)

  // Fires once, when the section is at least a quarter visible: "pricing was seen" must not grow
  // with scroll depth or re-renders, so the observer disconnects after the first intersection.
  useEffect(() => {
    const section = sectionRef.current
    if (!section) return
    const observer = new IntersectionObserver(
      entries => {
        if (entries.some(entry => entry.isIntersecting)) {
          trackLandingEvent('pricing_view')
          observer.disconnect()
        }
      },
      { threshold: 0.25 }
    )
    observer.observe(section)
    return () => observer.disconnect()
  }, [])

  return (
    <section
      id="pricing"
      ref={sectionRef}
      className="bg-ink px-6 py-16 md:py-20"
    >
      <div className="mx-auto max-w-6xl">
        <div className="mb-12 text-center">
          <p className="mb-3 text-xs font-medium tracking-widest text-gold-text uppercase">{dict.eyebrow}</p>
          <h2 className="font-display text-4xl font-semibold text-cream md:text-5xl">{dict.headline}</h2>
          <p className="mx-auto mt-4 max-w-lg text-base leading-relaxed text-cream-muted">{dict.subheadline}</p>

          {/* Annual leads every card as its monthly equivalent, with the annual total and the two
              free months on the line below; monthly sits behind this text link so it never
              competes for the anchor (backlog/R13). The label names where it goes, so it needs no
              aria-pressed; min-h-11 keeps a 44 px target on phones. */}
          <button
            type="button"
            onClick={() => setInterval(annual ? 'monthly' : 'annual')}
            className="mt-8 inline-flex min-h-11 items-center rounded-md px-3 text-sm text-cream-muted underline-offset-4 transition-colors duration-300 hover:text-cream hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
          >
            {annual ? dict.seeMonthly : dict.seeAnnual}
          </button>
        </div>

        <div className="grid grid-cols-1 items-stretch gap-5 md:grid-cols-3">
          {dict.plans.map(plan => {
            const highlight = plan.id === 'growth'
            const amount = planPrice(plan.id, interval)
            const monthlyPrice = annual ? formatPrice(amount / 12, lang, 2) : formatPrice(amount, lang)
            const totalPrice = formatPrice(amount, lang)
            const sub = annual ? dict.annualSubLabel.replace('{{price}}', totalPrice) : dict.monthlySubLabel
            return (
              <div
                key={plan.id}
                className={`relative flex flex-col rounded-2xl p-7 transition-[border-color,box-shadow] duration-300 ${
                  highlight
                    ? 'border border-lnblue bg-lnblue/[0.08] shadow-[0_0_48px_rgba(0,119,181,0.2)]'
                    : 'border border-cream/[0.08] bg-ink-600 hover:border-cream/15'
                }`}
              >
                {highlight && (
                  <div className="absolute -top-3 left-1/2 w-max max-w-[calc(100%-2rem)] -translate-x-1/2">
                    <span className="block rounded-full bg-lnblue px-3 py-1 text-center text-xs font-semibold text-on-lnblue">
                      {dict.recommended}
                    </span>
                  </div>
                )}
                <div className="mb-6">
                  <h3 className="text-xl font-semibold text-cream">{plan.name}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-cream-muted">{plan.description}</p>
                </div>
                <div className="mb-6">
                  <span className="font-display text-4xl font-semibold text-cream">{monthlyPrice}</span>
                  <span className="ml-1 text-sm text-cream-muted">{dict.periodMonth}</span>
                  <p className="mt-2 text-xs text-gold-text">{sub}</p>
                </div>
                {/* The one axis the three plans are compared on (backlog/R13): the number the ladder
                    sells, in body-weight cream so it reads before the checklist. */}
                <p className="mb-5 text-sm font-medium text-cream">{plan.axis}</p>
                <ul className="mb-8 flex-1 space-y-2.5">
                  {plan.features.map(f => (
                    <li
                      key={f}
                      className="flex items-start gap-2.5 text-sm text-cream-muted"
                    >
                      <span
                        aria-hidden="true"
                        className="mt-0.5 flex-shrink-0 text-gold-text"
                      >
                        ✓
                      </span>
                      {f}
                    </li>
                  ))}
                </ul>
                <TrialLink
                  plan={plan.id}
                  placement="pricing"
                  className={`block rounded-xl py-3 text-center text-sm font-semibold transition-[background-color,border-color] duration-300 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold ${
                    highlight
                      ? 'bg-lnblue text-on-lnblue shadow-[0_0_20px_rgba(0,119,181,0.4)] hover:bg-lnblue-hover'
                      : 'border border-cream/15 text-cream hover:border-cream/30 hover:bg-cream/5'
                  }`}
                >
                  {plan.cta}
                </TrialLink>
                <p className="mt-3 text-xs leading-relaxed text-cream-muted">{dict.trialNote}</p>
                <p className="mt-2 text-xs leading-relaxed text-cream-muted">
                  {(annual ? dict.renewalAnnual : dict.renewalMonthly).replace('{{price}}', totalPrice)}
                </p>
              </div>
            )
          })}
        </div>

        {/* Trial framing + Enterprise line */}
        <div className="mt-8 space-y-3 text-center">
          {/* The Enterprise floor follows the toggle, for the same reason the cards do. Quoted
              monthly beside an annual grid it read as "$100" against Starter's "$100/yr" — the
              anchor tier showing the cheapest number on the page, which inverts the ladder R13
              exists to build. Same negotiated floor, quoted in the period being compared; the
              annual form is the page's own ×10 rule (`monthlySubLabel`: 2 months free). */}
          <p className="text-sm text-cream-muted">
            {dict.enterpriseNote}{' '}
            <span className="text-cream/70">{annual ? dict.enterprisePriceYear : dict.enterprisePriceMonth}</span>.{' '}
            <a
              href="mailto:contact@linkintothessi.com"
              className="text-gold-text underline underline-offset-4 hover:text-gold-light focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold"
            >
              {dict.enterpriseCta}
            </a>
          </p>
        </div>
      </div>
    </section>
  )
}
