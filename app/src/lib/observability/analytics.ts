// Product analytics (PostHog). ANALYTICS purpose — strictly consent-gated: PostHog is initialised
// opted-out (no capture, no cookies) and only starts capturing once a logged-in user has granted the
// `analytics` consent (convex/privacy/consent.ts). Withdrawal or sign-out opts back out and resets the
// stored identity. Runs in PROD only and only when VITE_POSTHOG_KEY is set (hard no-op otherwise).
// No session replay (disable_session_recording), no clicked-element text (mask_all_text), no URL secrets
// (custom_personal_data_properties) and no email/PII — users are identified by their opaque Convex user id only.
// Sentry (error monitoring) is the necessary/security path — see sentry.ts.
// syncAnalyticsConsent also starts and stops DataFast web analytics under the same consent — see datafast.ts.
import posthog from 'posthog-js'
import { startDataFast, stopDataFast } from './datafast'

type ConsentMap = { analytics?: boolean; marketing?: boolean } | null | undefined

/**
 * Pure gate: capture analytics only for a logged-in user (non-empty id) who has actively granted the
 * `analytics` consent. Anything else — no user, consent not yet loaded, opted out — is false.
 */
export function shouldCaptureAnalytics(userId: string | undefined, consents: ConsentMap): boolean {
  return typeof userId === 'string' && userId.length > 0 && consents?.analytics === true
}

let initialized = false

export function initPostHog(): void {
  const key = import.meta.env.VITE_POSTHOG_KEY as string | undefined
  if (!import.meta.env.PROD || !key || initialized) return
  posthog.init(key, {
    api_host: (import.meta.env.VITE_POSTHOG_HOST as string | undefined) ?? 'https://eu.i.posthog.com',
    opt_out_capturing_by_default: true, // no capture until analytics consent is granted
    opt_out_persistence_by_default: true, // and no ph_* cookie/localStorage while opted out (persists otherwise)
    disable_session_recording: true, // no session replay
    capture_performance: false, // performance autocapture is not shipped; its observer logged console errors
    capture_pageview: true,
    autocapture: true,
    mask_all_text: true, // autocapture would otherwise send clicked-element text: post snippets, member names
    mask_all_element_attributes: true, // and attribute values (aria-labels carry names too)
    mask_personal_data_properties: true, // mask ad click ids (gclid, fbclid, li_fat_id…) in captured URLs
    custom_personal_data_properties: ['token', 'ref'], // plus /unsubscribe?token= and invite codes
    defaults: '2026-05-30'
  })
  initialized = true
}

/** Reconcile PostHog and DataFast with the current login + consent. Idempotent. */
export function syncAnalyticsConsent(userId: string | undefined, consents: ConsentMap): void {
  const allowed = shouldCaptureAnalytics(userId, consents)
  // `undefined` = consents still loading: leave DataFast alone, or every page load would delete its cookies (and
  // mint a new visitor) before the query resolves.
  if (consents !== undefined) {
    if (allowed && userId) startDataFast(userId)
    else stopDataFast()
  }
  if (!initialized) return
  if (allowed) {
    posthog.opt_in_capturing()
    posthog.identify(userId)
  } else {
    posthog.opt_out_capturing()
    posthog.reset()
  }
}

/**
 * Fire a named product event. No-op until initPostHog has run (dev, or prod without a key).
 * Consent is inherited, not re-checked: syncAnalyticsConsent opts PostHog in and out, and
 * posthog.capture does nothing while opted out. Props carry no PII — ids and enum-ish strings only.
 */
export function captureEvent(name: string, props?: Record<string, string | number | boolean | null>): void {
  if (!initialized) return
  posthog.capture(name, props)
}
