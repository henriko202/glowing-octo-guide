// R24 — pure digest eligibility. The daily sweep asks this per user; all I/O stays in jobs/digest.ts.
export const DIGEST_SPAN_MS = 3 * 86_400_000

export interface DigestCandidate {
  email?: string
  digestEmailsEnabled?: boolean
  isBanned?: boolean
  deletionScheduledAt?: number
  lastDigestAt?: number
}

/** CAN-SPAM keeps the postal address unless the flag is explicitly 'false'. */
export function isDigestAddressEnabled(envVars: Record<string, string | undefined>): boolean {
  return envVars.INCLUDE_DIGEST_ADDRESS !== 'false'
}

export function isDigestDue(user: DigestCandidate, now: number): boolean {
  if (!user.email) return false
  if (user.digestEmailsEnabled === false) return false
  if (user.isBanned === true) return false
  if (user.deletionScheduledAt !== undefined) return false
  if (user.lastDigestAt !== undefined && user.lastDigestAt > now - DIGEST_SPAN_MS) return false
  return true
}
