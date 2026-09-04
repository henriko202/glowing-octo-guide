import { describe, it, expect } from 'vitest'
import { canEngage, assertCanEngage, postCreatedHidden } from './access'

describe('access', () => {
  it('allows engaging only with a card-backed status', () => {
    expect(canEngage('trialing')).toBe(true)
    expect(canEngage('active')).toBe(true)
    expect(canEngage('canceled')).toBe(true) // cancellation never revokes engage access
    expect(canEngage('none')).toBe(false)
    expect(canEngage('past_due')).toBe(false)
  })

  it('assertCanEngage throws PAYMENT_REQUIRED when no card / payment failed', () => {
    expect(() => assertCanEngage({ subscriptionStatus: 'none' })).toThrow(/PAYMENT_REQUIRED/)
    expect(() => assertCanEngage({ subscriptionStatus: 'past_due' })).toThrow(/PAYMENT_REQUIRED/)
    expect(() => assertCanEngage({ subscriptionStatus: 'trialing' })).not.toThrow()
    expect(() => assertCanEngage({ subscriptionStatus: 'canceled' })).not.toThrow()
  })

  it('admins always bypass the gate regardless of status', () => {
    expect(() => assertCanEngage({ subscriptionStatus: 'none', isAdmin: true })).not.toThrow()
    expect(() => assertCanEngage({ subscriptionStatus: 'canceled', isAdmin: true })).not.toThrow()
  })

  it('postCreatedHidden hides posts only for members with no usable card', () => {
    // Shown immediately: any carded member (trialing/active) + the canceled paid-through window.
    expect(postCreatedHidden({ subscriptionStatus: 'trialing' })).toBe(false)
    expect(postCreatedHidden({ subscriptionStatus: 'active' })).toBe(false)
    expect(postCreatedHidden({ subscriptionStatus: 'canceled' })).toBe(false)
    // Created hidden until they gain a card: onboarding ('none'), lapsed payment ('past_due').
    expect(postCreatedHidden({ subscriptionStatus: 'none' })).toBe(true)
    expect(postCreatedHidden({ subscriptionStatus: 'past_due' })).toBe(true)
    // Admins always show.
    expect(postCreatedHidden({ subscriptionStatus: 'none', isAdmin: true })).toBe(false)
  })
})
