import { describe, expect, it } from 'vitest'
import { formatPrice, planPrice, trialHref, validReferral } from './trial'

describe('landing trial offer', () => {
  it.each([
    ['starter', 10, 100],
    ['growth', 15, 150],
    ['pro', 50, 500]
  ] as const)('keeps %s monthly and annual offers consistent', (plan, monthly, annual) => {
    expect(planPrice(plan, 'monthly')).toBe(monthly)
    expect(planPrice(plan, 'annual')).toBe(annual)
  })

  it('does not render an unknown plan as a free or invalid price', () => {
    expect(() => planPrice('unknown', 'annual')).toThrow('Unknown plan')
  })

  it('keeps each tier and referral in both billing intervals before any click', () => {
    for (const plan of ['starter', 'growth', 'pro']) {
      for (const interval of ['monthly', 'annual'] as const) {
        const url = new URL(trialHref(plan, interval, 'abc12345'))
        expect(Object.fromEntries(url.searchParams)).toEqual({ plan, interval, ref: 'abc12345' })
      }
    }
  })

  it.each([null, '', 'ABC12345', 'abc1234', 'abc123456', 'abc1234&interval=monthly'])(
    'omits invalid referral %s',
    value => {
      expect(validReferral(value)).toBeNull()
      expect(new URL(trialHref('growth', 'annual', value)).searchParams.has('ref')).toBe(false)
    }
  )

  it('formats fractional prices for the visitor language without changing the currency', () => {
    expect(formatPrice(12.5, 'pt', 2)).toContain('12,50')
    expect(formatPrice(12.5, 'en', 2)).toContain('12.50')
    expect(formatPrice(150, 'es')).toContain('USD')
  })
})
