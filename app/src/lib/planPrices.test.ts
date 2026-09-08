import { describe, expect, it } from 'vitest'
import { FEATURED_POST_PRICE, PLAN_PRICES } from './planPrices'

const amount = (label: string) => Number(label.replace(/[^0-9.]/g, ''))

describe('PLAN_PRICES', () => {
  it('prices Starter at $10/mo and $100/yr (backlog/R13 decoy ladder)', () => {
    expect(PLAN_PRICES.monthly.starter).toBe('$10/mo')
    expect(PLAN_PRICES.annual.starter).toBe('$100/yr')
  })

  it('prices every annual plan at 10 × monthly — the "2 months free" promise', () => {
    for (const plan of Object.keys(PLAN_PRICES.monthly)) {
      expect(amount(PLAN_PRICES.annual[plan])).toBe(amount(PLAN_PRICES.monthly[plan]) * 10)
    }
  })
})

describe('FEATURED_POST_PRICE', () => {
  it('is the $5 label every add-on surface quotes (backlog/R17)', () => {
    expect(FEATURED_POST_PRICE).toBe('$5')
  })
})
