// Product analytics (PostHog). ANALYTICS purpose — strictly consent-gated: PostHog is initialised
// opted-out (no capture, no cookies) and only starts capturing once a logged-in user has granted the
// `analytics` consent (convex/privacy/consent.ts). Withdrawal or sign-out opts back out and resets the
// stored identity. Runs in PROD only and only when VITE_POSTHOG_KEY is set (hard no-op otherwise).
// No session replay (disable_session_recording) and no email/PII — users are identified by their
// opaque Convex user id only. Sentry (error monitoring) is the necessary/security path — see sentry.ts.
import posthog from 'posthog-js'

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
    opt_out_capturing_by_default: true, // no capture and no cookies until analytics consent is granted
    disable_session_recording: true, // no session replay
    capture_pageview: true,
    autocapture: true
  })
  initialized = true
}

/** Reconcile PostHog capture state with the current login + consent. Idempotent; no-op until init. */
export function syncAnalyticsConsent(userId: string | undefined, consents: ConsentMap): void {
  if (!initialized) return
  if (shouldCaptureAnalytics(userId, consents)) {
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
export function captureEvent(name: string, props?: Record<string, string | number | boolean>): void {
  if (!initialized) return
  posthog.capture(name, props)
}
