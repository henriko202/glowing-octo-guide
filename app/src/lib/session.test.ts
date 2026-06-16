import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { signOut, beginSignOut, isSignedOut, markSignedOut, clearSignedOut, LANDING_URL } from './session'

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
})
