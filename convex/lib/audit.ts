// convex/lib/audit.ts
// Accountability log helper (GDPR Art. 5(2)). Call writeAuditLog from inside any mutation
// handler that has ctx.db; use the logAudit internal mutation from actions via ctx.runMutation.
// NEVER put secrets or raw tokens in `metadata`.
// NOTE: imports the registration generic from 'convex/server' (vitest mock aliases it),
// matching convex/linkedin/auth.ts — NOT './_generated/server'.
import { internalMutationGeneric as internalMutation } from 'convex/server'
import { v } from 'convex/values'

export interface AuditEntry {
  actor: 'user' | 'admin' | 'system'
  actorId?: string
  action: string
  targetUserId?: string
  metadata?: string
}

/** Structural subset of MutationCtx['db'] that writeAuditLog needs. Exported so every call site
 *  shares one shape (and so pure handlers can pass a mock). */
export interface AuditDb {
  insert(table: string, doc: Record<string, unknown>): Promise<string>
}

export async function writeAuditLog(db: AuditDb, entry: AuditEntry): Promise<void> {
  await db.insert('auditLogs', {
    actor: entry.actor,
    actorId: entry.actorId,
    action: entry.action,
    targetUserId: entry.targetUserId,
    metadata: entry.metadata,
    createdAt: Date.now()
  })
}

export const logAudit = internalMutation({
  args: {
    actor: v.union(v.literal('user'), v.literal('admin'), v.literal('system')),
    actorId: v.optional(v.id('users')),
    action: v.string(),
    targetUserId: v.optional(v.id('users')),
    metadata: v.optional(v.string())
  },
  handler: async (ctx, args) => writeAuditLog(ctx.db as unknown as AuditDb, args as unknown as AuditEntry)
})
