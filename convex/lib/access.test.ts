import { describe, it, expect } from 'vitest'
import { canEngage, assertCanEngage } from './access'

describe('access', () => {
  it('allows engaging only with a card-backed status', () => {
    expect(canEngage('trialing')).toBe(true)
    expect(canEngage('active')).toBe(true)
    expect(canEngage('none')).toBe(false)
    expect(canEngage('canceled')).toBe(false)
    expect(canEngage('past_due')).toBe(false)
  })

  it('assertCanEngage throws PAYMENT_REQUIRED when no card', () => {
    expect(() => assertCanEngage({ subscriptionStatus: 'none' })).toThrow(/PAYMENT_REQUIRED/)
    expect(() => assertCanEngage({ subscriptionStatus: 'trialing' })).not.toThrow()
  })

  it('admins always bypass the gate regardless of status', () => {
    expect(() => assertCanEngage({ subscriptionStatus: 'none', isAdmin: true })).not.toThrow()
    expect(() => assertCanEngage({ subscriptionStatus: 'canceled', isAdmin: true })).not.toThrow()
  })
})
