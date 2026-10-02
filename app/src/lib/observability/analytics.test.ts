import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import posthog from 'posthog-js'
import { initPostHog, shouldCaptureAnalytics, syncAnalyticsConsent } from './analytics'
import { startDataFast, stopDataFast } from './datafast'

vi.mock('./datafast', () => ({ startDataFast: vi.fn(), stopDataFast: vi.fn() }))
vi.mock('posthog-js', () => ({
  default: {
    init: vi.fn(),
    opt_in_capturing: vi.fn(),
    identify: vi.fn(),
    opt_out_capturing: vi.fn(),
    reset: vi.fn(),
    capture: vi.fn()
  }
}))

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

// Tests run without a PostHog key, so these also prove the DataFast half runs while PostHog is off.
describe('syncAnalyticsConsent → DataFast', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('leaves DataFast alone while consents are loading', () => {
    syncAnalyticsConsent('u1', undefined)
    expect(startDataFast).not.toHaveBeenCalled()
    expect(stopDataFast).not.toHaveBeenCalled()
  })

  it('starts DataFast for a member who granted analytics consent', () => {
    syncAnalyticsConsent('u1', { analytics: true })
    expect(startDataFast).toHaveBeenCalledWith('u1')
    expect(stopDataFast).not.toHaveBeenCalled()
  })

  it('stops DataFast when consent is withdrawn, absent, or there is no member', () => {
    syncAnalyticsConsent('u1', { analytics: false })
    syncAnalyticsConsent('u1', null)
    syncAnalyticsConsent(undefined, { analytics: true })
    expect(stopDataFast).toHaveBeenCalledTimes(3)
    expect(startDataFast).not.toHaveBeenCalled()
  })
})

// Last in the file: initPostHog flips the module's `initialized`, after which syncAnalyticsConsent drives the mock.
// It inits once per module, so the tests share one call.
describe('initPostHog', () => {
  beforeAll(() => {
    vi.stubEnv('PROD', true)
    vi.stubEnv('VITE_POSTHOG_KEY', 'phc_test')
    initPostHog()
  })

  afterAll(() => {
    vi.unstubAllEnvs()
  })

  it('keeps PostHog from writing its cookie before analytics consent', () => {
    // posthog-js persists (`ph_<key>_posthog` cookie + localStorage) while opted out unless
    // opt_out_persistence_by_default is set too (posthog-core `_is_persistence_disabled`).
    expect(posthog.init).toHaveBeenCalledWith(
      'phc_test',
      expect.objectContaining({ opt_out_capturing_by_default: true, opt_out_persistence_by_default: true })
    )
  })

  it('keeps clicked-element text and attributes (post snippets, member names) out of autocapture', () => {
    // posthog-js autocapture sends `$el_text` (up to 1024 chars) and attribute values unless both are masked.
    expect(posthog.init).toHaveBeenCalledWith(
      'phc_test',
      expect.objectContaining({ mask_all_text: true, mask_all_element_attributes: true })
    )
  })

  it('records session replay with every text node and input masked', () => {
    // posthog-js replay masks inputs only by default; page text (post snippets, member names) needs the selector.
    const options = vi.mocked(posthog.init).mock.calls[0]?.[1]
    expect(options?.disable_session_recording).toBeUndefined()
    expect(options?.session_recording).toEqual({ maskAllInputs: true, maskTextSelector: '*' })
  })

  it('masks the unsubscribe token and invite codes in captured URLs', () => {
    // posthog-js sends the full `$current_url`, query included; it masks only the params named here (plus its
    // built-in ad click-id list), and only when mask_personal_data_properties is on.
    expect(posthog.init).toHaveBeenCalledWith(
      'phc_test',
      expect.objectContaining({
        mask_personal_data_properties: true,
        custom_personal_data_properties: expect.arrayContaining(['token', 'ref'])
      })
    )
  })

  it('opts PostHog out and clears its stored identity when there is no member (sign-out)', () => {
    vi.mocked(posthog.opt_out_capturing).mockClear()
    vi.mocked(posthog.reset).mockClear()

    syncAnalyticsConsent(undefined, null)

    expect(posthog.opt_out_capturing).toHaveBeenCalledOnce()
    expect(posthog.reset).toHaveBeenCalledOnce()
  })
})
