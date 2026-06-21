'use client'
import { useState } from 'react'
import { SIGN_IN_URL } from '../lib/links'

type Plan = {
  id: string
  name: string
  monthly: number
  description: string
  features: string[]
  cta: string
  highlight: boolean
}

const PLANS: Plan[] = [
  {
    id: 'starter',
    name: 'Starter',
    monthly: 5,
    description: 'Get into the feed and start engaging',
    features: [
      'See the full live feed',
      'Comment & react manually',
      'Mutual connections sorted first',
      '25 interactions counted per post',
      '1 post into the feed / week'
    ],
    cta: 'Start free',
    highlight: false
  },
  {
    id: 'growth',
    name: 'Growth',
    monthly: 15,
    description: 'A targeted feed for faster results',
    features: [
      'Feed filtered to your industry + country',
      'Auto-tuned from your LinkedIn profile',
      'Everything in Starter',
      '50 interactions counted per post',
      '2 posts into the feed / week'
    ],
    cta: 'Start free',
    highlight: true
  },
  {
    id: 'pro',
    name: 'Pro',
    monthly: 50,
    description: 'Maximum reach and control',
    features: [
      'Custom industry + country filters',
      'Control who sees your posts',
      'Everything in Growth',
      '200 interactions counted per post',
      '5 posts into the feed / week'
    ],
    cta: 'Start free',
    highlight: false
  }
]

function priceLabel(plan: Plan, annual: boolean) {
  if (annual) {
    const perMonth = (plan.monthly * 10) / 12
    return { big: `$${plan.monthly * 10}`, period: '/yr', sub: `$${perMonth.toFixed(2)}/mo billed annually` }
  }
  return { big: `$${plan.monthly}`, period: '/mo', sub: '2 months free if you pay annually' }
}

export default function Pricing() {
  const [annual, setAnnual] = useState(true) // default annual

  return (
    <section
      id="pricing"
      className="bg-ink px-6 py-28"
    >
      <div className="mx-auto max-w-6xl">
        <div className="mb-12 text-center">
          <p className="mb-3 text-xs font-medium uppercase tracking-widest text-gold">Pricing</p>
          <h2 className="font-display text-4xl font-semibold text-cream md:text-5xl">
            Invest in your professional brand
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-base text-cream/50">
            Every plan includes the feed. Higher tiers add targeting and control.
          </p>

          {/* Annual / monthly toggle (annual default) */}
          <div className="mt-8 inline-flex items-center gap-3 rounded-full border border-cream/10 bg-ink-800 p-1 text-sm">
            <button
              onClick={() => setAnnual(true)}
              className={`rounded-full px-4 py-1.5 transition-colors ${annual ? 'bg-gold text-ink' : 'text-cream/60 hover:text-cream'}`}
            >
              Annual <span className="text-xs opacity-80">· 2 months free</span>
            </button>
            <button
              onClick={() => setAnnual(false)}
              className={`rounded-full px-4 py-1.5 transition-colors ${!annual ? 'bg-gold text-ink' : 'text-cream/60 hover:text-cream'}`}
            >
              Monthly
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 items-start gap-5 md:grid-cols-3">
          {PLANS.map(plan => {
            const p = priceLabel(plan, annual)
            return (
              <div
                key={plan.id}
                className={`relative flex flex-col rounded-2xl p-7 transition-all duration-300 ${
                  plan.highlight
                    ? 'border border-lnblue bg-lnblue/[0.08] shadow-[0_0_48px_rgba(0,119,181,0.2)] md:-translate-y-3'
                    : 'border border-cream/[0.08] bg-ink-600 hover:border-cream/15'
                }`}
              >
                {plan.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="rounded-full bg-lnblue px-3 py-1 text-xs font-semibold tracking-wide text-cream">
                      Recommended
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
                  <p className="mt-2 text-xs text-gold">{p.sub}</p>
                </div>
                <ul className="mb-8 flex-1 space-y-2.5">
                  {plan.features.map(f => (
                    <li
                      key={f}
                      className="flex items-start gap-2.5 text-sm text-cream/60"
                    >
                      <span className="mt-0.5 flex-shrink-0 text-gold">✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <a
                  href={`${SIGN_IN_URL}?plan=${plan.id}&interval=${annual ? 'annual' : 'monthly'}`}
                  className={`block rounded-xl py-3 text-center text-sm font-semibold transition-all duration-200 ${
                    plan.highlight
                      ? 'bg-lnblue text-cream shadow-[0_0_20px_rgba(0,119,181,0.4)] hover:bg-lnblue-light'
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
          <p className="text-sm text-cream/50">
            Start free. No charge until 50 interactions or 7 days, whichever comes first. Card required, cancel anytime.
          </p>
          <p className="text-sm text-cream/40">
            Teams &amp; agencies: Enterprise from <span className="text-cream/70">$100/mo</span>.{' '}
            <a
              href="mailto:hello@linkintothessi.com"
              className="text-gold underline underline-offset-4 hover:text-gold-light"
            >
              Talk to us
            </a>
          </p>
        </div>
      </div>
    </section>
  )
}
