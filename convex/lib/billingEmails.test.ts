import { describe, it, expect } from 'vitest'
import {
  duplicateSubscriptionCanceledEmail,
  formatPriceLabel,
  planName,
  postCapReachedEmail,
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
      ),
      ...LOCALES.map(l =>
        postCapReachedEmail(l, {
          excerpt: 'x',
          total: 25,
          cap: 25,
          planName: 'Starter',
          mode: 'upgrade',
          nextPlanName: 'Growth',
          nextCap: 50,
          upgradeUrl: BILLING_URL,
          myPostsUrl: BILLING_URL,
          supportEmail: 'contact@example.com'
        })
      ),
      ...LOCALES.map(l =>
        postCapReachedEmail(l, {
          excerpt: 'x',
          total: 100,
          cap: 100,
          planName: 'Pro',
          mode: 'proContact',
          myPostsUrl: BILLING_URL,
          supportEmail: 'contact@example.com'
        })
      ),
      ...LOCALES.map(l =>
        postCapReachedEmail(l, {
          excerpt: 'x',
          total: 40,
          cap: 40,
          planName: 'Enterprise',
          mode: 'contactCustom',
          myPostsUrl: BILLING_URL,
          supportEmail: 'contact@example.com'
        })
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

describe('postCapReachedEmail (R20)', () => {
  const base = {
    excerpt: 'Hiring a <senior> engineer & more',
    total: 25,
    cap: 25,
    planName: 'Starter',
    myPostsUrl: 'https://app.example/my-posts',
    supportEmail: 'contact@linkintothessi.com'
  }

  it('names the post’s total in the subject and links My Posts, in every locale', () => {
    for (const l of LOCALES) {
      const m = postCapReachedEmail(l, { ...base, mode: 'proContact' })
      expect(m.subject).toContain('25')
      expect(m.text).toContain(base.myPostsUrl)
      expect(m.html).toContain(`<a href="${base.myPostsUrl}">`)
    }
  })

  // After a Growth → Starter downgrade a post already at 41 flips against a cap of 25. The subject
  // reports what the post collected; only the body sentence about the plan quotes the cap.
  it('reports the post’s own total in the subject when it overshoots the cap, in every locale', () => {
    for (const l of LOCALES) {
      const m = postCapReachedEmail(l, { ...base, total: 41, mode: 'proContact' })
      expect(m.subject).toContain('41')
      expect(m.subject).not.toContain('25')
      expect(m.text).toContain('25') // the plan's cap still appears in the body
    }
  })

  it('escapes the excerpt in the HTML body and quotes it verbatim in the text body', () => {
    const m = postCapReachedEmail('en', { ...base, mode: 'proContact' })
    expect(m.html).toContain('Hiring a &lt;senior&gt; engineer &amp; more')
    expect(m.html).not.toContain('<senior>')
    expect(m.text).toContain('“Hiring a <senior> engineer & more”')
  })

  it('upgrade mode carries the next plan, its cap and the checkout link — and no support line', () => {
    const upgradeUrl = 'https://app.example/billing?plan=growth&interval=annual&src=cap_email'
    const m = postCapReachedEmail('en', { ...base, mode: 'upgrade', nextPlanName: 'Growth', nextCap: 50, upgradeUrl })
    expect(m.text).toContain(`On Growth, your next posts collect up to 50 each: ${upgradeUrl}`)
    expect(m.html).toContain(`<a href="${upgradeUrl}">`)
    expect(m.text).not.toContain(base.supportEmail)
    // The checkout link is the only link: the My Posts line steps aside in this mode.
    expect(m.text).not.toContain(base.myPostsUrl)
    expect(m.html).not.toContain(base.myPostsUrl)
  })

  // Nothing ever un-flips posts.interactionLimitReached (feedRank.computeFeedFields preserves it,
  // syncPosts.applyEngagementCounts is one-way), so upgrading cannot bring THIS post back. The
  // upgrade line must promise future posts and never "keeps"/"continua"/"sigue".
  it('promises the next posts, never this one coming back, in every locale', () => {
    const promisesReturn = {
      en: ['keeps collecting', 'back in the feed', 'returns to the feed'],
      pt: ['continua recebendo', 'volta para o feed', 'volta ao feed'],
      es: ['sigue recibiendo', 'vuelve al feed', 'regresa al feed']
    } as const
    for (const l of LOCALES) {
      const m = postCapReachedEmail(l, {
        ...base,
        mode: 'upgrade',
        nextPlanName: 'Growth',
        nextCap: 50,
        upgradeUrl: 'https://app.example/billing'
      })
      for (const phrase of promisesReturn[l]) expect(m.text.toLowerCase()).not.toContain(phrase)
      expect(m.text).toContain('50')
    }
  })

  it('proContact and contactCustom carry the support address and no checkout link', () => {
    for (const mode of ['proContact', 'contactCustom'] as const) {
      const m = postCapReachedEmail('en', { ...base, mode })
      expect(m.text).toContain(base.supportEmail)
      expect(m.text).not.toContain('/billing')
      expect(m.html).not.toContain('/billing')
    }
    expect(postCapReachedEmail('en', { ...base, mode: 'contactCustom' }).text).toContain('custom cap')
    expect(postCapReachedEmail('en', { ...base, mode: 'proContact' }).text).toContain('higher cap')
  })
})
