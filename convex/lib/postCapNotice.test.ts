import { describe, expect, it } from 'vitest'
import { billingIntervalParam, capNoticeMode, shouldSendCapNotice } from './postCapNotice'

describe('capNoticeMode', () => {
  it('offers the upgrade when the next tier caps higher', () => {
    expect(capNoticeMode('starter', 25, 50)).toBe('upgrade')
    expect(capNoticeMode('growth', 50, 100)).toBe('upgrade')
  })

  it('falls back to the support line when there is no bigger cap one tier up', () => {
    expect(capNoticeMode('pro', 100, undefined)).toBe('proContact')
    expect(capNoticeMode('growth', 50, undefined)).toBe('proContact')
    // A contact-tier style override can leave the next cap equal or smaller — never sell that.
    expect(capNoticeMode('starter', 50, 50)).toBe('proContact')
    expect(capNoticeMode('starter', 50, 30)).toBe('proContact')
  })

  it('tells a contact member their cap is custom', () => {
    expect(capNoticeMode('contact', 9999, undefined)).toBe('contactCustom')
    expect(capNoticeMode('contact', 40, 100)).toBe('contactCustom')
  })
})

describe('shouldSendCapNotice', () => {
  const ok = { email: 'a@b.c', subscriptionStatus: 'active', cancelAtPeriodEnd: false }

  it('sends to a trialing or active member with an email on file', () => {
    expect(shouldSendCapNotice(ok)).toBe(true)
    expect(shouldSendCapNotice({ ...ok, subscriptionStatus: 'trialing', cancelAtPeriodEnd: undefined })).toBe(true)
  })

  it.each(['none', 'past_due', 'canceled', undefined])('skips subscription status %s', status => {
    expect(shouldSendCapNotice({ ...ok, subscriptionStatus: status })).toBe(false)
  })

  it('skips a missing email and a scheduled cancel', () => {
    expect(shouldSendCapNotice({ ...ok, email: undefined })).toBe(false)
    expect(shouldSendCapNotice({ ...ok, email: '' })).toBe(false)
    expect(shouldSendCapNotice({ ...ok, cancelAtPeriodEnd: true })).toBe(false)
  })
})

describe('billingIntervalParam', () => {
  it('maps the Stripe interval onto the billing page query param', () => {
    expect(billingIntervalParam('year')).toBe('annual')
    expect(billingIntervalParam('month')).toBe('monthly')
  })

  it("falls back to annual, the billing page's own default, when the interval is unknown", () => {
    // A monthly fallback here would send a member whose row has not caught up to a different price
    // than the in-app upgrade link and the page's toggle offer them.
    expect(billingIntervalParam(undefined)).toBe('annual')
    expect(billingIntervalParam('week')).toBe('annual')
  })
})
