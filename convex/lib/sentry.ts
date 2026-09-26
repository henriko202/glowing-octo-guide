// convex/lib/sentry.ts
// Backend errors → Sentry on the Convex free plan. Convex's own Exception Reporting is a Pro feature, so the backend
// posts its own events: one fetch to Sentry's envelope endpoint, no SDK. A no-op until SENTRY_DSN is set on the
// deployment (prod only). Only actions and HTTP actions can call it, because it fetches. A query or mutation that
// throws is reported by whoever sees the throw: the browser (app/src/lib/errors.ts) or, for scheduled runs and cron
// jobs, the sweep in convex/observability.ts.
//
// An event carries the error's type, its message through scrubError, and tags naming the function and the request.
// Never the stack (scrubError's rule), and never the member's IP, user agent or auth token, which
// getRequestMetadata() returns alongside the request ID.
import type { ActionMeta } from 'convex/server'
import { ConvexError } from 'convex/values'
import { env } from '../_generated/server'
import { fetchWithTimeout } from './fetchWithTimeout'
import { scrubError } from './scrubError'

// A report can sit in front of a member's redirect (the OAuth callback), so a slow Sentry must not hold it up.
const SEND_TIMEOUT_MS = 3_000

export type SentryTags = Record<string, string | undefined>

export interface SentryEvent {
  /** `type: message` is the issue title in Sentry; `transaction` is the culprit shown under it. */
  type: string
  message: string
  transaction?: string
  tags?: SentryTags
  /** When it failed, in ms. Defaults to now; the sweep passes the run's completion time. */
  timestamp?: number
}

/** `https://<key>@<host>/<project>` → the project's envelope endpoint and public key; null for anything else. */
export function sentryEndpoint(dsn: string): { url: string; key: string } | null {
  try {
    const { protocol, username, host, pathname } = new URL(dsn)
    const project = pathname.slice(1)
    if (!username || !/^\d+$/.test(project)) return null
    return { url: `${protocol}//${host}/api/${project}/envelope/`, key: username }
  } catch {
    return null
  }
}

/** Posts one event. Never throws: a Sentry outage must not fail the work being reported on. */
export async function sendToSentry(event: SentryEvent): Promise<void> {
  const endpoint = env.SENTRY_DSN ? sentryEndpoint(env.SENTRY_DSN) : null
  if (!endpoint) return
  const payload = {
    timestamp: (event.timestamp ?? Date.now()) / 1000,
    platform: 'javascript',
    level: 'error',
    environment: 'production',
    server_name: env.CONVEX_CLOUD_URL,
    transaction: event.transaction,
    tags: event.tags,
    exception: { values: [{ type: event.type, value: scrubError(event.message) }] }
  }
  const envelope = [{ sent_at: new Date().toISOString() }, { type: 'event' }, payload]
    .map(part => JSON.stringify(part))
    .join('\n')
  try {
    const res = await fetchWithTimeout(
      endpoint.url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-sentry-envelope',
          'X-Sentry-Auth': `Sentry sentry_version=7, sentry_key=${endpoint.key}, sentry_client=linkintothessi-convex/1`
        },
        body: envelope
      },
      SEND_TIMEOUT_MS
    )
    if (!res.ok) console.error('Sentry refused an event:', res.status)
  } catch (err) {
    console.error('Sentry send failed:', scrubError(err))
  }
}

/**
 * Reports a caught error from an action or HTTP action, then returns so the catch block can carry on. `ctx` adds the
 * function's name and the request ID, which finds the call's log lines in the Convex dashboard; a helper without a
 * ctx passes null. A `route` tag names an HTTP route as the transaction. Never throws.
 */
export async function reportError(
  ctx: { meta: ActionMeta } | null,
  err: unknown,
  tags: SentryTags = {}
): Promise<void> {
  if (!env.SENTRY_DSN) return
  // Each lookup can fail on its own (convex-test has no request metadata); the event then goes out without that tag.
  const fn = await ctx?.meta.getFunctionMetadata().catch(() => undefined)
  const request = await ctx?.meta.getRequestMetadata().catch(() => undefined)
  await sendToSentry({
    type: err instanceof Error ? err.name : 'Error',
    message: err instanceof Error ? err.message : scrubError(err),
    transaction: tags.route ?? fn?.name,
    tags: {
      'convex.function': fn?.name,
      'convex.function_type': fn?.type,
      'convex.request_id': request?.requestId,
      ...tags
    }
  })
}

/**
 * Wraps a handler so an error it throws is reported, then re-thrown unchanged: the caller still answers the 500 it does
 * today (Convex for an HTTP route; the Stripe component for a webhook, so Stripe retries). A ConvexError is a
 * deliberate rejection, such as a rate limit, not a fault, so it passes through unreported. No webhook handler throws
 * one.
 */
export function reportingThrows<C extends { meta: ActionMeta }, A, R>(
  tags: (arg: A) => SentryTags,
  handler: (ctx: C, arg: A) => Promise<R>
): (ctx: C, arg: A) => Promise<R> {
  return async (ctx, arg) => {
    try {
      return await handler(ctx, arg)
    } catch (err) {
      if (!(err instanceof ConvexError)) await reportError(ctx, err, tags(arg))
      throw err
    }
  }
}
