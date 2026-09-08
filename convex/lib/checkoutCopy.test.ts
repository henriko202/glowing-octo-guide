import { describe, it, expect } from 'vitest'
import { checkoutSubmitMessage, resolveBillingLocale, stripeCheckoutLocale } from './checkoutCopy'

const LOCALES = ['en', 'pt', 'es'] as const

describe('resolveBillingLocale', () => {
  it('prefers the explicit language, then primaryLocale, then english', () => {
    expect(resolveBillingLocale('pt', 'en')).toBe('pt')
    expect(resolveBillingLocale(undefined, 'es')).toBe('es')
    expect(resolveBillingLocale(undefined, undefined)).toBe('en')
  })
  it('normalises regional and cased tags', () => {
    expect(resolveBillingLocale('pt-BR')).toBe('pt')
    expect(resolveBillingLocale('ES')).toBe('es')
  })
  it('falls through an unsupported language to the next candidate', () => {
    expect(resolveBillingLocale('fr', 'pt')).toBe('pt')
    expect(resolveBillingLocale('fr', 'de')).toBe('en')
  })
})

describe('stripeCheckoutLocale', () => {
  it('maps pt to Stripe pt-BR', () => {
    expect(stripeCheckoutLocale('pt')).toBe('pt-BR')
    expect(stripeCheckoutLocale('en')).toBe('en')
    expect(stripeCheckoutLocale('es')).toBe('es')
  })
})

describe('checkoutSubmitMessage', () => {
  it('states the 50-or-7-days rule in every language on the trial path', () => {
    for (const l of LOCALES) {
      const msg = checkoutSubmitMessage(l, { trial: true, days: 7 })
      expect(msg).toContain('50')
      expect(msg).toContain('7')
      expect(msg.length).toBeGreaterThan(40)
    }
  })
  it('states that billing is today on the no-trial path', () => {
    for (const l of LOCALES) {
      const msg = checkoutSubmitMessage(l, { trial: false, days: 7 })
      expect(msg).not.toContain('50')
      expect(msg.length).toBeGreaterThan(20)
    }
  })
  it('never hedges — the rule is deterministic, not "may"', () => {
    for (const l of LOCALES) {
      for (const trial of [true, false]) {
        const msg = checkoutSubmitMessage(l, { trial, days: 7 }).toLowerCase()
        expect(msg).not.toContain('may end')
        expect(msg).not.toContain('pode terminar')
        expect(msg).not.toContain('puede terminar')
      }
    }
  })
  it('fits Stripe custom_text limit of 1200 characters', () => {
    for (const l of LOCALES) {
      for (const trial of [true, false]) {
        expect(checkoutSubmitMessage(l, { trial, days: 7 }).length).toBeLessThanOrEqual(1200)
      }
    }
  })
  // backlog/R19 — an invited member's checkout states the 14-day trial they actually get.
  it('states the invited 14-day trial when asked', () => {
    for (const l of LOCALES) {
      const msg = checkoutSubmitMessage(l, { trial: true, days: 14 })
      expect(msg).toContain('14')
      expect(msg).toContain('50')
      expect(msg).not.toMatch(/\b7\b/)
    }
  })
})
