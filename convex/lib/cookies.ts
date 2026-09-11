// convex/lib/cookies.ts
// Minimal request Cookie header parser. Pure and dependency-free so it is unit-testable and safe to
// use inside httpActions (which have no DOM APIs).
export function readCookie(cookieHeader: string | null | undefined, name: string): string | null {
  if (!cookieHeader) return null
  for (const part of cookieHeader.split(';')) {
    const eq = part.indexOf('=')
    if (eq === -1) continue
    if (part.slice(0, eq).trim() !== name) continue
    const raw = part.slice(eq + 1).trim()
    try {
      return decodeURIComponent(raw)
    } catch {
      // A malformed percent-escape must not throw inside an httpAction — return the raw value.
      return raw
    }
  }
  return null
}
