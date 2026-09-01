// convex/linkedin/client.ts
// Single seam for authenticated LinkedIn *member-API* calls (api.linkedin.com, Bearer = user token).
// Owns auth + Content-Type + the log-real-error→throw-sanitized policy; callers pass method/path/body,
// an `action` label for the sanitized message, and any per-call headers (X-Restli, Linkedin-Version).
// `soft` lists statuses to return `null` for instead of throwing (e.g. 403 = scope not granted).
import { fetchWithTimeout } from '../lib/fetchWithTimeout'

const BASE = 'https://api.linkedin.com'

export async function callMemberApi(
  accessToken: string,
  req: { method: string; path: string; body?: unknown; headers?: Record<string, string> },
  opts: { action: string; soft?: number[] }
): Promise<Response | null> {
  const res = await fetchWithTimeout(`${BASE}${req.path}`, {
    method: req.method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(req.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...req.headers
    },
    ...(req.body !== undefined ? { body: JSON.stringify(req.body) } : {})
  })
  if (!res.ok) {
    if (opts.soft?.includes(res.status)) return null
    console.error(`LinkedIn ${opts.action} failed: ${res.status}`, await res.text())
    throw new Error(`Failed to ${opts.action}. Please try again.`)
  }
  return res
}
