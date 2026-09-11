import { describe, it, expect } from 'vitest'
import { emailButton, emailFacts, emailQuote, renderEmailLayout } from './emailLayout'
import { SUPPORT_EMAIL } from './support'
import {
  duplicateSubscriptionCanceledEmail,
  postCapReachedEmail,
  trialConvertedEmail,
  trialEndingEmail,
  trialNearEndEmail
} from './billingEmails'
import {
  deletionCompletedEmail,
  deletionScheduledEmail,
  dormancyWarningEmail,
  exportReadyEmail
} from '../privacy/emails'
import { feedbackReplyEmail } from '../feedback/emails'
import type { BillingLocale } from './checkoutCopy'

const LOCALES: BillingLocale[] = ['en', 'pt', 'es']
const AT = Date.UTC(2026, 8, 30)

describe('renderEmailLayout', () => {
  it('renders a full document with the requested language, wordmark and footer', () => {
    const html = renderEmailLayout({ lang: 'pt', preheader: 'prévia', heading: 'Olá', contentHtml: '' })
    expect(html.startsWith('<!doctype html>')).toBe(true)
    expect(html).toContain('<html lang="pt"')
    expect(html).toContain('Link Into The SSI')
    expect(html).toContain(SUPPORT_EMAIL)
    expect(html).toContain('<h1')
  })

  it('escapes the heading and the preheader', () => {
    const html = renderEmailLayout({
      lang: 'en',
      preheader: 'a & b <script>',
      heading: '<b>Hi</b> & bye',
      contentHtml: ''
    })
    expect(html).toContain('a &amp; b &lt;script&gt;')
    expect(html).toContain('&lt;b&gt;Hi&lt;/b&gt; &amp; bye')
    expect(html).not.toContain('<script>')
  })
})

describe('emailButton', () => {
  it('keeps the href verbatim and escapes the label', () => {
    const href = 'https://app.example/billing?plan=growth&interval=annual&src=cap_email'
    const html = emailButton({ href, label: 'See <plans> & more' })
    expect(html).toContain(`href="${href}"`)
    expect(html).toContain('See &lt;plans&gt; &amp; more')
  })
})

describe('emailFacts', () => {
  it('renders escaped label/value pairs with a separator between rows', () => {
    const html = emailFacts([
      { label: 'Plan', value: 'A & B' },
      { label: 'Price', value: '<$10>' }
    ])
    expect(html).toContain('A &amp; B')
    expect(html).toContain('&lt;$10&gt;')
    expect(html).not.toContain('<$10>')
    expect(html.match(/border-top:1px solid/g)?.length).toBe(1)
  })

  it('returns an empty string for no rows', () => {
    expect(emailFacts([])).toBe('')
  })
})

describe('emailQuote', () => {
  it('escapes the quoted text', () => {
    const html = emailQuote('a & <b>')
    expect(html).toContain('a &amp; &lt;b&gt;')
    expect(html).not.toContain('<b>')
  })
})

describe('every transactional builder renders through the shared shell', () => {
  const billing = [
    ...LOCALES.map(l =>
      trialNearEndEmail(l, {
        made: 1,
        received: 1,
        remaining: 1,
        planName: 'Growth',
        priceLabel: 'x',
        billingUrl: 'https://app.example/billing'
      })
    ),
    ...LOCALES.map(l =>
      trialEndingEmail(l, {
        endsOn: 'x',
        planName: 'Growth',
        priceLabel: 'x',
        billingUrl: 'https://app.example/billing'
      })
    ),
    ...LOCALES.map(l =>
      duplicateSubscriptionCanceledEmail(l, { planName: 'Growth', billingUrl: 'https://app.example/billing' })
    ),
    ...LOCALES.map(l =>
      trialConvertedEmail(l, {
        made: 1,
        received: 1,
        planName: 'Growth',
        priceLabel: 'x',
        recapUrl: 'https://app.example/recap'
      })
    ),
    ...LOCALES.map(l =>
      postCapReachedEmail(l, {
        excerpt: 'x',
        total: 25,
        cap: 25,
        mode: 'upgrade',
        nextPlanName: 'Growth',
        nextCap: 50,
        upgradeUrl: 'https://app.example/billing',
        myPostsUrl: 'https://app.example/my-posts',
        supportEmail: 'contact@example.com'
      })
    )
  ]
  const privacy = [
    ...LOCALES.map(l => exportReadyEmail({ locale: l })),
    ...LOCALES.map(l => deletionScheduledEmail({ locale: l, deletionAt: AT })),
    ...LOCALES.map(l => deletionCompletedEmail({ locale: l })),
    ...LOCALES.map(l => dormancyWarningEmail({ locale: l, deletionAt: AT }))
  ]
  const feedback = LOCALES.map(l => feedbackReplyEmail({ locale: l, replyText: 'ok', originalMessage: 'hi' }))

  it('returns a complete document with the wordmark and a heading', () => {
    for (const m of [...billing, ...privacy, ...feedback]) {
      expect(m.html.startsWith('<!doctype html>')).toBe(true)
      expect(m.html).toContain('Link Into The SSI')
      expect(m.html).toContain('<h1')
    }
  })
})
