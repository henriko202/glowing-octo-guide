// convex/lib/fetchWithTimeout.ts
// fetch() with a hard timeout. The Convex runtime's fetch has no default timeout, so a hung or
// slow upstream (LinkedIn, Apify, OpenRouter, Resend) would otherwise block the calling action
// until the platform's own execution ceiling — turning one bad upstream into a wasted, long-running
// (billed) action. This bounds every external call instead.
//
// Uses AbortController + setTimeout (both proven-available in the Convex runtime) rather than the
// newer static AbortSignal.timeout() helper, whose availability in this runtime is unverified.
// The init is spread through unchanged, so callers keep options like redirect:'manual'.
export const DEFAULT_FETCH_TIMEOUT_MS = 15_000

export async function fetchWithTimeout(
  url: string,
  init?: RequestInit,
  timeoutMs: number = DEFAULT_FETCH_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } catch (err) {
    // A timeout aborts the signal; surface a clear, distinct error instead of the opaque AbortError
    // (callers log this, and the message tells operators it was a timeout, not an upstream 4xx/5xx).
    if (controller.signal.aborted) throw new Error(`Request timed out after ${timeoutMs}ms`)
    throw err
  } finally {
    clearTimeout(timer)
  }
}
