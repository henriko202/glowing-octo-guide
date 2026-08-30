import { ConvexError } from 'convex/values'

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
