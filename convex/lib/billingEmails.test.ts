import { describe, it, expect } from 'vitest'
import {
  duplicateSubscriptionCanceledEmail,
  formatPriceLabel,
  planName,
  planWithPrice,
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
  it('writes the dollar as U$ in pt/es and keeps the en symbol', () => {
    expect(formatPriceLabel('pt', PRICE)).toBe('U$150 / ano')
    expect(formatPriceLabel('es', PRICE)).toBe('U$150 / año')
    expect(formatPriceLabel('en', PRICE)).toBe('$150 / year')
    expect(formatPriceLabel('pt', { amount: 1250, currency: 'usd', interval: 'month' })).toBe('U$12,50 / mês')
  })
})

describe('planWithPrice', () => {
  it('appends the price label in parentheses when there is one', () => {
    expect(planWithPrice('Growth', '$150 / year')).toBe('Growth ($150 / year)')
  })
  it('drops the parentheses entirely when the label is empty or only whitespace', () => {
    expect(planWithPrice('Growth', '')).toBe('Growth')
    expect(planWithPrice('Growth', '   ')).toBe('Growth')
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

describe('trialNearEndEmail (trial graph)', () => {
  const base = {
    made: 47,
    received: 14,
    remaining: 3,
    planName: 'Growth',
    priceLabel: '$150 / year',
    billingUrl: BILLING_URL
  }
  const graph = { peopleMade: 9, peopleReceived: 7, receivedReactions: 14, receivedComments: 0 }

  it('states the made graph and the received reactions, in every language', () => {
    const m = {
      en: trialNearEndEmail('en', { ...base, ...graph }),
      pt: trialNearEndEmail('pt', { ...base, ...graph }),
      es: trialNearEndEmail('es', { ...base, ...graph })
    }
    expect(m.en.text).toContain('47 interactions with 9 people, 14 reactions on your posts.')
    expect(m.pt.text).toContain('47 interações com 9 pessoas, 14 reações nas suas publicações.')
    expect(m.es.text).toContain('47 interacciones con 9 personas, 14 reacciones en tus publicaciones.')
  })

  it('states the position and the gap to the next place when present, in every language', () => {
    const args = { ...base, ...graph, position: 8, gapToNext: 2 }
    expect(trialNearEndEmail('en', args).text).toContain('You are #8 on the weekly board.')
    expect(trialNearEndEmail('en', args).text).toContain('2 interactions from #7.')
    expect(trialNearEndEmail('pt', args).text).toContain('Você está em #8 no ranking semanal.')
    expect(trialNearEndEmail('pt', args).text).toContain('A 2 interações do #7.')
    expect(trialNearEndEmail('es', args).text).toContain('Estás en el puesto #8 del ranking semanal.')
    expect(trialNearEndEmail('es', args).text).toContain('A 2 interacciones del #7.')
  })

  it('singularizes the gap and handles a comments-only received side', () => {
    const m = trialNearEndEmail('en', {
      ...base,
      made: 1,
      peopleMade: 1,
      receivedReactions: 0,
      receivedComments: 3,
      position: 2,
      gapToNext: 1
    })
    expect(m.text).toContain('1 interaction with 1 person, 3 comments on your posts.')
    expect(m.text).toContain('1 interaction from #1.')
  })

  it('omits the graph, the position and the gap when the summary has nothing to say', () => {
    const m = trialNearEndEmail('en', base)
    expect(m.text).not.toContain('interactions with')
    expect(m.text).not.toContain('weekly board')
    expect(m.text).not.toContain('reactions on your posts')
    expect(m.text).not.toContain('from #')
  })

  it('singularizes the near-end counts in every language', () => {
    for (const l of LOCALES) {
      const m = trialNearEndEmail(l, { ...base, made: 1, received: 1, remaining: 1 })
      expect(m.text).not.toContain('1 interações')
      expect(m.text).not.toContain('1 interacciones')
    }
    const en = trialNearEndEmail('en', { ...base, made: 1, received: 1, remaining: 1 })
    expect(en.text).toContain('1 interaction made')
    expect(en.text).toContain('after 1 more interaction,')
  })

  it('keeps the remaining-interaction and plan-start facts alongside the graph', () => {
    const m = trialNearEndEmail('en', { ...base, ...graph, position: 8, gapToNext: 2 })
    expect(m.text).toContain('starts after 3 more interactions')
    expect(m.text).toContain('Cancel before then')
    expect(m.text).not.toMatch(/end(s)? at trial|no longer|stop(s)? working/i)
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
  it('keeps singular interaction counts in pt', () => {
    const m = trialConvertedEmail('pt', {
      made: 1,
      received: 1,
      planName: 'Growth',
      priceLabel: '$9/month',
      recapUrl: RECAP_URL
    })
    expect(m.text).toContain('você fez 1 interação')
    expect(m.text).toContain('receberam 1 interação')
    expect(m.text).not.toContain('1 interações')
  })
})

describe('emails without a price snapshot', () => {
  it('trialNearEndEmail names the plan with no empty parentheses, in every locale', () => {
    for (const l of LOCALES) {
      const m = trialNearEndEmail(l, {
        made: 32,
        received: 8,
        remaining: 10,
        planName: 'Growth',
        priceLabel: '',
        billingUrl: BILLING_URL
      })
      expect(m.text).toContain('Growth')
      expect(m.text).not.toContain('()')
      expect(m.html).toContain('Growth')
      expect(m.html).not.toContain('()')
    }
  })
  it('trialEndingEmail names the plan with no empty parentheses, in every locale', () => {
    for (const l of LOCALES) {
      const m = trialEndingEmail(l, {
        endsOn: '13 September 2026',
        planName: 'Growth',
        priceLabel: '',
        billingUrl: BILLING_URL
      })
      expect(m.text).toContain('Growth')
      expect(m.text).not.toContain('()')
      expect(m.html).toContain('Growth')
      expect(m.html).not.toContain('()')
    }
  })
  it('trialConvertedEmail names the plan with no empty parentheses, in every locale', () => {
    for (const l of LOCALES) {
      const m = trialConvertedEmail(l, {
        made: 3,
        received: 2,
        planName: 'Growth',
        priceLabel: '',
        recapUrl: RECAP_URL
      })
      expect(m.text).toContain('Growth')
      expect(m.text).not.toContain('()')
      expect(m.html).toContain('Growth')
      expect(m.html).not.toContain('()')
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
          billingUrl: BILLING_URL,
          peopleMade: 1,
          peopleReceived: 1,
          receivedReactions: 1,
          receivedComments: 1,
          position: 8,
          gapToNext: 2
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
    myPostsUrl: 'https://app.example/my-posts',
    supportEmail: 'contact@linkintothessi.com'
  }

  it('names the post’s total in the subject and links My Posts, in every locale', () => {
    for (const l of LOCALES) {
      const m = postCapReachedEmail(l, { ...base, mode: 'proContact' })
      expect(m.subject).toContain('25')
      expect(m.text).toContain(base.myPostsUrl)
      expect(m.html).toContain(`href="${base.myPostsUrl}"`)
    }
  })

  // After a Growth → Starter downgrade a post already at 41 flips against a cap of 25. The subject
  // reports what the post collected; the body quotes the cap it hit, with no plan attribution — a
  // bought post's cap includes its R17 bonus, so naming a plan there would sometimes be false.
  it('reports the post’s own total in the subject when it overshoots the cap, in every locale', () => {
    for (const l of LOCALES) {
      const m = postCapReachedEmail(l, { ...base, total: 41, mode: 'proContact' })
      expect(m.subject).toContain('41')
      expect(m.subject).not.toContain('25')
      expect(m.text).toContain('25') // the cap it hit still appears in the body
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
    expect(m.html).toContain(`href="${upgradeUrl}"`)
    expect(m.text).not.toContain(base.supportEmail)
    // The checkout link is the only link: the My Posts line steps aside in this mode.
    expect(m.text).not.toContain(base.myPostsUrl)
    expect(m.html).not.toContain(base.myPostsUrl)
  })

  // An upgrade alone never un-flips posts.interactionLimitReached (feedRank.computeFeedFields
  // preserves it, syncPosts.applyEngagementCounts is one-way) — only a featured-post purchase does
  // (lib/featuredPurchase.purchasedFeaturePatch), so upgrading cannot bring THIS post back. The
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

  it('states the author’s board position and gap after the cap line, in every locale', () => {
    const args = { ...base, mode: 'proContact' as const, position: 8, gapToNext: 2 }
    expect(postCapReachedEmail('en', args).text).toContain('You are #8 on the weekly board, 2 interactions from #7.')
    expect(postCapReachedEmail('pt', args).text).toContain('Você está em #8 no ranking semanal, a 2 interações do #7.')
    expect(postCapReachedEmail('es', args).text).toContain(
      'Estás en el puesto #8 del ranking semanal, a 2 interacciones del #7.'
    )
    const m = postCapReachedEmail('en', args)
    expect(m.text.indexOf('left the feed')).toBeLessThan(m.text.indexOf('weekly board'))
    expect(m.html).toContain('weekly board')
  })

  it('drops the gap clause when there is no gap and the sentence entirely when unranked', () => {
    const ranked = postCapReachedEmail('en', { ...base, mode: 'proContact', position: 8, gapToNext: null })
    expect(ranked.text).toContain('You are #8 on the weekly board.')
    expect(ranked.text).not.toContain('from #7')
    const unranked = postCapReachedEmail('en', { ...base, mode: 'proContact', position: null, gapToNext: null })
    expect(unranked.text).not.toContain('weekly board')
    expect(unranked.html).not.toContain('weekly board')
    expect(postCapReachedEmail('en', { ...base, mode: 'proContact' }).text).not.toContain('weekly board')
  })

  it('singularizes the gap to the next place', () => {
    const m = postCapReachedEmail('en', { ...base, mode: 'proContact', position: 7, gapToNext: 1 })
    expect(m.text).toContain('You are #7 on the weekly board, 1 interaction from #6.')
  })
})
