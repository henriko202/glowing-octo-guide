import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  beginSignOut,
  clearSignedOut,
  isSignedOut,
  LANDING_URL,
  markSignedOut,
  performSignOut,
  signOut
} from './session'
import { syncAnalyticsConsent } from './observability/analytics'

// The real analytics path reads window.location.hostname, which these tests replace with a bare { assign } stub.
vi.mock('./observability/analytics', () => ({ syncAnalyticsConsent: vi.fn() }))

describe('signed-out marker', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })

  it('is not signed out by default', () => {
    expect(isSignedOut()).toBe(false)
  })

  it('markSignedOut / clearSignedOut toggle the persistent marker', () => {
    markSignedOut()
    expect(isSignedOut()).toBe(true)
    clearSignedOut()
    expect(isSignedOut()).toBe(false)
  })

  it('beginSignOut marks the user signed out (set before logout, to win the getMe→null race)', () => {
    beginSignOut()
    expect(isSignedOut()).toBe(true)
  })
})

describe('signOut', () => {
  const originalLocation = window.location

  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })

  afterEach(() => {
    // Restore the real location so we don't pollute other test files that share this worker.
    Object.defineProperty(window, 'location', { value: originalLocation, writable: true, configurable: true })
  })

  it('marks signed out, drops the token, and navigates to the landing site', () => {
    sessionStorage.setItem('sessionToken', 'tok')
    const assign = vi.fn()
    Object.defineProperty(window, 'location', { value: { assign }, writable: true, configurable: true })

    signOut()

    expect(isSignedOut()).toBe(true)
    expect(sessionStorage.getItem('sessionToken')).toBeNull()
    expect(assign).toHaveBeenCalledWith(LANDING_URL)
  })

  it('clears motdDismissed along with the token on sign-out', () => {
    sessionStorage.setItem('sessionToken', 'tok')
    sessionStorage.setItem('motdDismissed', JSON.stringify({ token: 'tok', motdId: 'm1' }))
    const assign = vi.fn()
    Object.defineProperty(window, 'location', { value: { assign }, writable: true, configurable: true })

    signOut()

    expect(localStorage.getItem('signedOut')).toBe('1')
    expect(sessionStorage.getItem('sessionToken')).toBeNull()
    expect(sessionStorage.getItem('motdDismissed')).toBeNull()
  })

  it('turns analytics off (DataFast and PostHog, stored identity included) before leaving for the landing site', () => {
    vi.mocked(syncAnalyticsConsent).mockClear()
    const assign = vi.fn()
    Object.defineProperty(window, 'location', { value: { assign }, writable: true, configurable: true })

    signOut()

    // (no member, no consent) is the withdrawal path: stopDataFast + PostHog opt-out + reset.
    expect(syncAnalyticsConsent).toHaveBeenCalledExactlyOnceWith(undefined, null)
    expect(vi.mocked(syncAnalyticsConsent).mock.invocationCallOrder[0]).toBeLessThan(assign.mock.invocationCallOrder[0])
  })
})

describe('performSignOut', () => {
  it('marks signed out before logout, logs out with the token, then leaves for the landing site', async () => {
    const order: string[] = []
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(k => {
      if (k === 'signedOut') order.push('mark')
    })
    const assign = vi.fn(() => order.push('assign'))
    ;(window as any).location = { assign, href: '/', origin: window.location.origin }
    const logout = vi.fn(async () => {
      order.push('logout')
    })

    await performSignOut(logout, 'tok-1')

    expect(logout).toHaveBeenCalledWith({ sessionToken: 'tok-1' })
    expect(order.indexOf('mark')).toBeLessThan(order.indexOf('logout'))
    expect(order[order.length - 1]).toBe('assign')
    vi.restoreAllMocks()
  })

  it('still leaves even when there is no token', async () => {
    const assign = vi.fn()
    ;(window as any).location = { assign, href: '/', origin: window.location.origin }
    const logout = vi.fn()
    await performSignOut(logout, null)
    expect(logout).not.toHaveBeenCalled()
    expect(assign).toHaveBeenCalled()
  })
})
