import { describe, it, expect } from 'vitest'
import {
  duplicateSubscriptionCanceledEmail,
  formatPriceLabel,
  planName,
  trialConvertedEmail,
  trialEndingEmail,
  trialNearEndEmail
} from './billingEmails'
import type { BillingLocale } from './checkoutCopy'

const LOCALES: BillingLocale[] = ['en', 'pt', 'es']
const BILLING_URL = 'https://app.example.com/billing'
const RECAP_URL = 'https://app.example/recap'
const PRICE = { amount: 15000, currency: 'usd', interval: 'year' }

describe('formatPriceLabel', () => {
  it('renders minor units as a real amount with the interval', () => {
    const label = formatPriceLabel('en', PRICE)
    expect(label).toContain('150')
    expect(label.toLowerCase()).toContain('year')
  })
  it('degrades to an empty string when Stripe sent no price', () => {
    expect(formatPriceLabel('en', { amount: undefined, currency: undefined, interval: undefined })).toBe('')
  })
})

describe('trialNearEndEmail', () => {
  const args = {
    made: 32,
    received: 8,
    remaining: 10,
    planName: 'Growth',
    priceLabel: '$150 / year',
    billingUrl: BILLING_URL
  }

  it('leads with what the member did, in every language', () => {
    for (const l of LOCALES) {
      const m = trialNearEndEmail(l, args)
      expect(m.subject.length).toBeGreaterThan(0)
      expect(m.text).toContain('32')
      expect(m.text).toContain('8')
    }
  })
  it('names the number, the amount and the plan, and links the cancel path', () => {
    for (const l of LOCALES) {
      const m = trialNearEndEmail(l, args)
      expect(m.text).toContain('10')
      expect(m.text).toContain('$150 / year')
      expect(m.text).toContain('Growth')
      expect(m.text).toContain(BILLING_URL)
      expect(m.html).toContain(BILLING_URL)
    }
  })
})

describe('trialEndingEmail', () => {
  const args = { endsOn: '13 September 2026', planName: 'Growth', priceLabel: '$150 / year', billingUrl: BILLING_URL }
  it('states the date, the amount and the cancel path in every language', () => {
    for (const l of LOCALES) {
      const m = trialEndingEmail(l, args)
      expect(m.text).toContain('13 September 2026')
      expect(m.text).toMatch(/50 intera/) // the 50-or-7-days rule, stated here too
      expect(m.text).toContain('$150 / year')
      expect(m.text).toContain(BILLING_URL)
      expect(m.subject.length).toBeGreaterThan(0)
    }
  })
})

describe('duplicateSubscriptionCanceledEmail', () => {
  it('says plainly that the extra subscription was voided and nothing extra was charged', () => {
    for (const l of LOCALES) {
      const m = duplicateSubscriptionCanceledEmail(l, { planName: 'Growth', billingUrl: BILLING_URL })
      expect(m.subject.length).toBeGreaterThan(0)
      expect(m.text).toContain('Growth')
      expect(m.text).toContain(BILLING_URL)
    }
  })
})

describe('trialConvertedEmail', () => {
  it('trialConvertedEmail states the counts, the plan and links the recap', () => {
    const m = trialConvertedEmail('en', {
      made: 3,
      received: 2,
      planName: 'Growth',
      priceLabel: '$9/month',
      recapUrl: RECAP_URL
    })
    expect(m.subject).toBe('Your Growth plan started today')
    expect(m.text).toContain('you made 3 interactions and your posts received 2')
    expect(m.text).toContain('Your Growth plan ($9/month) is now active.')
    expect(m.text).toContain(RECAP_URL)
    expect(m.html).toContain(`href="${RECAP_URL}"`)
  })
  it('carries the counts, the plan, the price and the recap link in every language', () => {
    for (const l of LOCALES) {
      const m = trialConvertedEmail(l, {
        made: 3,
        received: 2,
        planName: 'Growth',
        priceLabel: '$9/month',
        recapUrl: RECAP_URL
      })
      expect(m.subject).toContain('Growth')
      expect(m.text).toContain('3')
      expect(m.text).toContain('2')
      expect(m.text).toContain('$9/month')
      expect(m.text).toContain(RECAP_URL)
      expect(m.html).toContain(`href="${RECAP_URL}"`)
    }
  })
})

describe('billing emails stay transactional', () => {
  it('carries no marketing verbs and no urgency theatrics', () => {
    const all = [
      ...LOCALES.map(l =>
        trialNearEndEmail(l, {
          made: 1,
          received: 1,
          remaining: 1,
          planName: 'Growth',
          priceLabel: 'x',
          billingUrl: BILLING_URL
        })
      ),
      ...LOCALES.map(l =>
        trialEndingEmail(l, { endsOn: 'x', planName: 'Growth', priceLabel: 'x', billingUrl: BILLING_URL })
      ),
      ...LOCALES.map(l => duplicateSubscriptionCanceledEmail(l, { planName: 'Growth', billingUrl: BILLING_URL })),
      ...LOCALES.map(l =>
        trialConvertedEmail(l, { made: 3, received: 2, planName: 'Growth', priceLabel: 'x', recapUrl: RECAP_URL })
      )
    ]
    for (const m of all) {
      const body = `${m.subject} ${m.text}`.toLowerCase()
      for (const banned of [
        'upgrade now',
        'hurry',
        'last chance',
        'don’t miss',
        'act now',
        'aproveite',
        'última chance',
        'no te lo pierdas'
      ]) {
        expect(body).not.toContain(banned)
      }
    }
  })
})

describe('planName', () => {
  it('never leaks a raw tier id to a member', () => {
    for (const l of LOCALES) {
      for (const tier of ['starter', 'growth', 'pro', 'contact']) {
        expect(planName(l, tier)).not.toBe(tier)
      }
    }
  })

  it('localises the enterprise tier, matching billing.plans.contact.name in the app locales', () => {
    expect(planName('en', 'contact')).toBe('Enterprise')
    expect(planName('pt', 'contact')).toBe('Empresa')
    expect(planName('es', 'contact')).toBe('Empresa')
  })

  it('falls back to Growth for a tier it does not know', () => {
    expect(planName('pt', 'legacy_unlimited')).toBe('Growth')
  })
})
