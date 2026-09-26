import { ConvexError } from 'convex/values'
import type { TFunction } from 'i18next'
import { captureException } from './observability/sentry'

/**
 * Turn a Convex/client error into a short, human-readable message.
 *
 * Convex frames thrown errors for the client, e.g.
 *   "[CONVEX A(posts:submitPost)] [Request ID: abc] Server Error
 *    Uncaught Error: <msg> at handler (../convex/posts.ts:245:19) Called by client"
 * and in production it redacts <msg> entirely — only `ConvexError.data` survives there.
 *
 * Resolution order: structured `ConvexError.data` → the developer message parsed
 * out of the framed dev string → the caller's `fallback`.
 */
export function friendlyError(err: unknown, fallback: string): string {
  // ConvexError carries a structured, production-safe payload.
  if (err instanceof ConvexError) {
    const d = err.data
    if (typeof d === 'string' && d.trim()) return d.trim()
    if (d && typeof d === 'object' && typeof (d as { message?: unknown }).message === 'string') {
      return (d as { message: string }).message
    }
    return fallback
  }

  // Anything else is a failure, not an answer: Sentry gets it with the request ID that finds it in the Convex logs.
  captureException(err)
  if (!(err instanceof Error) || !err.message) return fallback

  let msg = err.message
  // Pull the real message out of "…Server Error Uncaught <X>Error: <msg> …".
  const uncaught = msg.match(/Uncaught (?:\w*Error): ([\s\S]*)/)
  if (uncaught) {
    msg = uncaught[1]
  } else {
    // Production / no "Uncaught" part: drop the "[CONVEX …] … Server Error" frame.
    msg = msg.replace(/^\[CONVEX[\s\S]*?Server Error\s*/, '')
  }
  // Drop the trailing stack frame ("… at handler (path) Called by client") and marker.
  msg = msg
    .replace(/\s+at\s+\S+\s*\([^)]*\)[\s\S]*$/, '')
    .replace(/\s*Called by client\s*$/, '')
    .trim()

  return !msg || msg === 'Server Error' ? fallback : msg
}

/**
 * Turn a prefixed backend limit code (backlog/R08 — WEEKLY_LIMIT:<n>, FEATURED_LIMIT:<n>, same
 * pattern as PAYMENT_REQUIRED:) into localized copy naming the number. Anything else — an
 * already-friendly message, or a code this client doesn't recognize — passes through untouched.
 */
export function mapLimitError(msg: string, t: TFunction): string {
  // Admin-set plan limits (convex/admin.ts's validateLimitArgs) only rejects values below 1 — it
  // never enforces an integer, so postsPerWeek/featuredPerMonth can land here as e.g. "2.5". A
  // \d+-only pattern would then fail to match and leak the raw "WEEKLY_LIMIT:2.5" code to the
  // member instead of localized copy (F7).
  const m = msg.match(/^(WEEKLY_LIMIT|FEATURED_LIMIT):([^:]+)$/)
  if (!m) return msg
  const key = m[1] === 'WEEKLY_LIMIT' ? 'errors.weeklyLimit' : 'errors.featuredLimit'
  return t(key, { limit: Number(m[2]) })
}
