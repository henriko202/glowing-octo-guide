'use client'
import { useState } from 'react'
import { SIGN_IN_URL } from '../lib/links'
import type { Dictionary } from '../i18n/getDictionary'

type PlanEntry = Dictionary['pricing']['plans'][number]

const MONTHLY_PRICES: Record<string, number> = {
  starter: 5,
  growth: 15,
  pro: 50
}

function priceLabel(plan: PlanEntry, annual: boolean, dict: Dictionary['pricing']) {
  const monthly = MONTHLY_PRICES[plan.id] ?? 0
  if (annual) {
    const perMonth = (monthly * 10) / 12
    const sub = dict.annualSubLabel.replace('{{perMonth}}', `$${perMonth.toFixed(2)}`)
    return { big: `$${monthly * 10}`, period: dict.periodYear, sub }
  }
  return { big: `$${monthly}`, period: dict.periodMonth, sub: dict.monthlySubLabel }
}

export default function Pricing({ dict }: { dict: Dictionary['pricing'] }) {
  const [annual, setAnnual] = useState(true) // default annual

  return (
    <section
      id="pricing"
      className="bg-ink px-6 py-28"
    >
      <div className="mx-auto max-w-6xl">
        <div className="mb-12 text-center">
          <p className="mb-3 text-xs font-medium tracking-widest text-gold-text uppercase">{dict.eyebrow}</p>
          <h2 className="font-display text-4xl font-semibold text-cream md:text-5xl">{dict.headline}</h2>
          <p className="mx-auto mt-4 max-w-lg text-base text-cream/50">{dict.subheadline}</p>

          {/* Annual / monthly toggle (annual default) */}
          <div className="mt-8 inline-flex items-center gap-3 rounded-full border border-cream/10 bg-ink-800 p-1 text-sm">
            <button
              onClick={() => setAnnual(true)}
              className={`rounded-full px-4 py-1.5 transition-colors ${annual ? 'bg-gold text-on-gold' : 'text-cream/60 hover:text-cream'}`}
            >
              {dict.toggleAnnual} <span className="text-xs opacity-80">{dict.toggleAnnualSuffix}</span>
            </button>
            <button
              onClick={() => setAnnual(false)}
              className={`rounded-full px-4 py-1.5 transition-colors ${!annual ? 'bg-gold text-on-gold' : 'text-cream/60 hover:text-cream'}`}
            >
              {dict.toggleMonthly}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 items-start gap-5 md:grid-cols-3">
          {dict.plans.map(plan => {
            const highlight = plan.id === 'growth'
            const p = priceLabel(plan, annual, dict)
            return (
              <div
                key={plan.id}
                className={`relative flex flex-col rounded-2xl p-7 transition-all duration-300 ${
                  highlight
                    ? 'border border-lnblue bg-lnblue/[0.08] shadow-[0_0_48px_rgba(0,119,181,0.2)] md:-translate-y-3'
                    : 'border border-cream/[0.08] bg-ink-600 hover:border-cream/15'
                }`}
              >
                {highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="rounded-full bg-lnblue px-3 py-1 text-xs font-semibold tracking-wide text-on-lnblue">
                      {dict.recommended}
                    </span>
                  </div>
                )}
                <div className="mb-6">
                  <h3 className="font-display text-xl font-semibold text-cream">{plan.name}</h3>
                  <p className="mt-1 text-sm text-cream/40">{plan.description}</p>
                </div>
                <div className="mb-6">
                  <span className="font-display text-4xl font-semibold text-cream">{p.big}</span>
                  <span className="ml-1 text-sm text-cream/40">{p.period}</span>
                  <p className="mt-2 text-xs text-gold-text">{p.sub}</p>
                </div>
                <ul className="mb-8 flex-1 space-y-2.5">
                  {plan.features.map(f => (
                    <li
                      key={f}
                      className="flex items-start gap-2.5 text-sm text-cream/60"
                    >
                      <span className="mt-0.5 flex-shrink-0 text-gold-text">✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <a
                  href={`${SIGN_IN_URL}?plan=${plan.id}&interval=${annual ? 'annual' : 'monthly'}`}
                  className={`block rounded-xl py-3 text-center text-sm font-semibold transition-all duration-200 ${
                    highlight
                      ? 'bg-lnblue text-on-lnblue shadow-[0_0_20px_rgba(0,119,181,0.4)] hover:bg-lnblue-light'
                      : 'border border-cream/15 text-cream hover:border-cream/30 hover:bg-cream/5'
                  }`}
                >
                  {plan.cta}
                </a>
              </div>
            )
          })}
        </div>

        {/* Trial framing + Enterprise line */}
        <div className="mt-8 space-y-3 text-center">
          <p className="text-sm text-cream/50">{dict.trialNote}</p>
          <p className="text-sm text-cream/40">
            {dict.enterpriseNote} <span className="text-cream/70">{dict.enterprisePrice}</span>.{' '}
            <a
              href="mailto:hello@linkintothessi.com"
              className="text-gold-text underline underline-offset-4 hover:text-gold-light"
            >
              {dict.enterpriseCta}
            </a>
          </p>
        </div>
      </div>
    </section>
  )
}
