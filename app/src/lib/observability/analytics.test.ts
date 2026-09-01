import { describe, it, expect } from 'vitest'
import { shouldCaptureAnalytics } from './analytics'

describe('shouldCaptureAnalytics', () => {
  it('captures only for a logged-in user who granted analytics consent', () => {
    expect(shouldCaptureAnalytics('u1', { analytics: true })).toBe(true)
  })

  it('does not capture when the user opted out of analytics', () => {
    expect(shouldCaptureAnalytics('u1', { analytics: false })).toBe(false)
  })

  it('does not capture when analytics consent is absent (marketing only)', () => {
    expect(shouldCaptureAnalytics('u1', { marketing: true })).toBe(false)
  })

  it('does not capture before consent has loaded', () => {
    expect(shouldCaptureAnalytics('u1', null)).toBe(false)
    expect(shouldCaptureAnalytics('u1', undefined)).toBe(false)
  })

  it('does not capture without a logged-in user, even with consent', () => {
    expect(shouldCaptureAnalytics(undefined, { analytics: true })).toBe(false)
    expect(shouldCaptureAnalytics('', { analytics: true })).toBe(false)
  })
})
