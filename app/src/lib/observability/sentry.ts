// Frontend error monitoring (Sentry). Runs in PROD only and only when VITE_SENTRY_DSN is set, so it
// is a hard no-op in dev and in any build without the DSN. Treated as a NECESSARY / security purpose
// (reliability) — it runs regardless of the user's analytics consent — so PII is stripped before an
// event ever leaves the browser: request cookies/headers and any user identity are dropped, and free
// text (message + exception values) is passed through the SAME `scrubError` redactor the backend uses
// on its console.error seams. Product analytics (PostHog) is the consent-gated path — see analytics.ts.
import * as Sentry from '@sentry/react'
import { scrubError } from '../../../../convex/lib/scrubError' // Structural subset of a Sentry event — kept SDK-agnostic so sentryBeforeSend is a pure, unit-testable

// Structural subset of a Sentry event — kept SDK-agnostic so sentryBeforeSend is a pure, unit-testable
// function with no Sentry types in the test. Cast to the SDK's event type only at the init call site.
type ScrubbableEvent = {
  message?: string
  request?: { cookies?: unknown; headers?: unknown; [k: string]: unknown }
  user?: unknown
  exception?: { values?: Array<{ value?: string; [k: string]: unknown }> }
  [k: string]: unknown
}

/**
 * Redact PII from an outbound Sentry event in place. Drops request cookies/headers and any user
 * identity, and runs the message + each exception value through `scrubError` (key-denylist redaction
 * + length cap). ponytail: scrubError redacts by KEY name, so a secret embedded inline in free text
 * (e.g. "failed for foo@bar.com") is NOT masked — add a value-regex pass here if messages carry PII.
 */
export function sentryBeforeSend(event: ScrubbableEvent): ScrubbableEvent {
  if (event.request) {
    delete event.request.cookies
    delete event.request.headers
  }
  delete event.user
  if (typeof event.message === 'string') event.message = scrubError(event.message)
  for (const ex of event.exception?.values ?? []) {
    if (typeof ex.value === 'string') ex.value = scrubError(ex.value)
  }
  return event
}

export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined
  if (!import.meta.env.PROD || !dsn) return

  Sentry.init({
    dsn,
    environment: 'production',
    dataCollection: {
      // To disable sending user data and HTTP bodies, uncomment the lines below. For more info visit:
      // https://docs.sentry.io/platforms/javascript/guides/react/configuration/options/#dataCollection
      // userInfo: false,
      // httpBodies: []
    },
    integrations: [Sentry.browserTracingIntegration(), Sentry.replayIntegration()],
    // Tracing
    tracesSampleRate: 1.0, //  Capture 100% of the transactions
    // Attach `sentry-trace`/`baggage` to every first-party request the app can make: Convex (data
    // plane + HTTP-action site), the origin this bundle is served from (prod custom domain or a
    // Workers preview), any linkintothessi.com host (app + landing), and local dev. Third-party
    // hosts (Sentry, PostHog, Stripe, LinkedIn) are deliberately excluded — tracing them adds
    // nothing and their CORS policies may reject the extra headers.
    tracePropagationTargets: [
      'localhost',
      window.location.origin,
      'linkintothessi.com',
      '.convex.cloud',
      '.convex.site'
    ],
    // Session Replay
    replaysSessionSampleRate: 0.1, // This sets the sample rate at 10%. You may want to change it to 100% while in development and then sample at a lower rate in production.
    replaysOnErrorSampleRate: 1.0, // If you're not already sampling the entire session, change the sample rate to 100% when sampling sessions where errors occur.
    // sentryBeforeSend mutates and returns the same object; the runtime value IS the real event.
    beforeSend: event => sentryBeforeSend(event as unknown as ScrubbableEvent) as unknown as typeof event
  })
}

/** Report a caught error. Safe to call before/without init (Sentry drops the event when uninitialised). */
export function captureException(error: unknown, componentStack?: string | null): void {
  Sentry.captureException(error, componentStack ? { contexts: { react: { componentStack } } } : undefined)
}
