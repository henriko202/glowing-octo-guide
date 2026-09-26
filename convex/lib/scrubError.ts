// convex/lib/scrubError.ts
// Pure, dependency-free helper for the backend's existing console.error call sites (B05, minimal
// scope — no Sentinel component). Default-denies sensitive key names and caps total length so a
// chatty upstream payload (an LinkedIn token-exchange body, an OpenRouter response carrying post
// content) can never leak a secret into or blow up Convex's built-in function logs.
//
// Not a Convex function — plain TS util, no args/return validators, no codegen involved.

const MAX_LOGGED_LENGTH = 500
const REDACTED = '[REDACTED]'
const TRUNCATED = '…[TRUNCATED]'
const MAX_DEPTH = 4

// Case-insensitive: matches the key name anywhere it contains one of these fragments, so
// `access_token`, `Authorization`, `refreshToken`, `userEmail`, `apiKey` etc. all redact.
const SENSITIVE_KEY_PATTERN = /token|access|refresh|secret|authorization|email|apikey/i

function scrubValue(value: unknown, depth: number): unknown {
  if (depth > MAX_DEPTH) return '[TRUNCATED]'
  if (value === null || value === undefined) return value
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value
  if (value instanceof Error) {
    // Only name + message — never the stack (file paths / arg values can leak into stacks).
    return { name: value.name, message: value.message }
  }
  if (Array.isArray(value)) return value.map(item => scrubValue(item, depth + 1))
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      out[key] = SENSITIVE_KEY_PATTERN.test(key) ? REDACTED : scrubValue(val, depth + 1)
    }
    return out
  }
  return String(value)
}

// A raw-text context (e.g. `await res.text()` from a failed fetch) is often itself a JSON body —
// parse it so key-based redaction still applies; fall back to the plain string otherwise.
function tryParseJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

/**
 * Redact sensitive key names from `context` (an Error, a string, an object, or any mix thereof)
 * and cap the result to a bounded length. Returns a string safe to pass straight to
 * `console.error` as the logged context, or to Sentry as an event message (lib/sentry.ts).
 */
export function scrubError(context: unknown): string {
  const normalized = typeof context === 'string' ? tryParseJson(context) : context
  const scrubbed = scrubValue(normalized, 0)
  // JSON.stringify(undefined) returns `undefined` (not a string) — fall back to String() so
  // `undefined`/functions/symbols still produce a loggable string instead of throwing below.
  const text = typeof scrubbed === 'string' ? scrubbed : (JSON.stringify(scrubbed) ?? String(scrubbed))
  return text.length > MAX_LOGGED_LENGTH ? text.slice(0, MAX_LOGGED_LENGTH) + TRUNCATED : text
}
