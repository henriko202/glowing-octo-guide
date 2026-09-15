// convex/lib/digestOptOut.ts
// R24 — one shared digest opt-out: patch `digestEmailsEnabled` off when it is not already off and append exactly
// one audit row for that change. Used by the internal one-click mutation (jobs/digest.disableDigestByUserId) and
// by the public app-route mutation (users.unsubscribeByToken), so the idempotence + audit rule lives once.
import { writeAuditLog, type AuditDb } from './audit'

/** Narrow db surface the helper needs; satisfies the writeAuditLog seam too. */
export interface DigestOptOutDb extends AuditDb {
  get(id: string): Promise<{ digestEmailsEnabled?: boolean } | null>
  patch(id: string, fields: Record<string, unknown>): Promise<void>
}

/** Returns true when the flag changed (and the audit row was written), false when it was already off or absent. */
export async function disableDigest(db: DigestOptOutDb, userId: string, action: string): Promise<boolean> {
  const user = await db.get(userId)
  if (!user || user.digestEmailsEnabled === false) return false
  await db.patch(userId, { digestEmailsEnabled: false })
  await writeAuditLog(db, { actor: 'user', actorId: userId, action, targetUserId: userId })
  return true
}
