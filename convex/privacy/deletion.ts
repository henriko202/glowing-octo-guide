// convex/privacy/deletion.ts
// Right to erasure. cascadeDeleteUser is pure (operates on a narrow db + storage interface) so the
// full multi-table deletion is unit-tested. The registered request/cancel/cron wrappers follow below.
import { internalAction, internalMutation, internalQuery, mutation } from '../_generated/server'
import { v } from 'convex/values'
import { internal } from '../_generated/api'
import Stripe from 'stripe'
import { resolveSession } from '../lib/auth'
import { sendEmail } from '../lib/email'
import { deletionScheduledEmail, deletionCompletedEmail } from './emails'
import { writeAuditLog } from '../lib/audit'

interface CascadeDb {
  query(table: string): {
    withIndex(
      name: string,
      fn: (q: unknown) => unknown
    ): { collect(): Promise<Array<Record<string, unknown> & { _id: string }>> }
  }
  get(id: string): Promise<(Record<string, unknown> & { _id: string }) | null>
  patch(id: string, fields: Record<string, unknown>): Promise<void>
  insert(table: string, doc: Record<string, unknown>): Promise<string>
  delete(id: string): Promise<void>
}
interface CascadeStorage {
  delete(storageId: string): Promise<void>
}

// Tables owned by a user and the index used to find their rows (first index field = userId-like).
const OWNED: Array<{ table: string; index: string; field: string }> = [
  { table: 'posts', index: 'by_author', field: 'authorId' },
  { table: 'postQueue', index: 'by_author', field: 'authorId' },
  { table: 'subscriptions', index: 'by_user', field: 'userId' },
  { table: 'sessions', index: 'by_userId', field: 'userId' },
  { table: 'rateLimits', index: 'by_user_and_action', field: 'userId' },
  { table: 'featuredPostUsage', index: 'by_user_month', field: 'userId' },
  { table: 'planLimits', index: 'by_user', field: 'userId' },
  { table: 'consentRecords', index: 'by_user', field: 'userId' }
]

export async function cascadeDeleteUser(db: CascadeDb, storage: CascadeStorage, userId: string): Promise<void> {
  // 1. Delete export jobs + their stored files first (needs storage cleanup).
  const exports = [
    ...(await db
      .query('dataExportRequests')
      .withIndex('by_user', (q: unknown) => (q as { eq(f: string, v: unknown): unknown }).eq('userId', userId))
      .collect())
  ]
  for (const e of exports) {
    if (typeof e.fileStorageId === 'string') await storage.delete(e.fileStorageId)
    await db.delete(e._id)
  }

  // 2. Delete all other owned rows.
  for (const { table, index, field } of OWNED) {
    const rows = [
      ...(await db
        .query(table)
        .withIndex(index, (q: unknown) => (q as { eq(f: string, v: unknown): unknown }).eq(field, userId))
        .collect())
    ]
    for (const r of rows) await db.delete(r._id)
  }

  // 3. Pseudonymize audit rows that target this user (keep action/metadata for accountability).
  const audits = [
    ...(await db
      .query('auditLogs')
      .withIndex('by_target', (q: unknown) => (q as { eq(f: string, v: unknown): unknown }).eq('targetUserId', userId))
      .collect())
  ]
  for (const a of audits) await db.patch(a._id, { targetUserId: undefined, actorId: undefined })

  // 4. Record the deletion itself (no PII).
  await writeAuditLog(db, { actor: 'system', action: 'account.deleted', metadata: JSON.stringify({ at: Date.now() }) })

  // 5. Delete the user document LAST.
  await db.delete(userId)
}

const GRACE_MS = 30 * 24 * 60 * 60 * 1000
const DELETION_BATCH = 50

function formatDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10) // YYYY-MM-DD
}

export const requestAccountDeletion = mutation({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    const user = await resolveSession(ctx, sessionToken) // allow banned users to exercise erasure
    if (!user) throw new Error('Unauthorized')
    if (user.deletionScheduledAt) return { deletionScheduledAt: user.deletionScheduledAt } // idempotent
    const scheduledAt = Date.now() + GRACE_MS
    await ctx.db.patch(user._id, {
      deletionRequestedAt: Date.now(),
      deletionScheduledAt: scheduledAt,
      deletionReason: 'user_request'
    })
    await ctx.runMutation(internal.sessions.deleteAllForUser, { userId: user._id }) // revoke access now
    await writeAuditLog(ctx.db as unknown as CascadeDb, {
      actor: 'user',
      actorId: user._id,
      action: 'dsr.deletion_requested',
      targetUserId: user._id
    })
    await ctx.scheduler.runAfter(0, internal.privacy.deletion.onDeletionRequested, { userId: user._id, scheduledAt })
    return { deletionScheduledAt: scheduledAt }
  }
})

export const cancelAccountDeletion = mutation({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    const user = await resolveSession(ctx, sessionToken)
    if (!user) throw new Error('Unauthorized')
    await ctx.db.patch(user._id, {
      deletionRequestedAt: undefined,
      deletionScheduledAt: undefined,
      deletionReason: undefined
    })
    await writeAuditLog(ctx.db as unknown as CascadeDb, {
      actor: 'user',
      actorId: user._id,
      action: 'dsr.deletion_cancelled',
      targetUserId: user._id
    })
  }
})

// Internal: cancel the user's Stripe subscriptions immediately (stop billing during grace) and
// send the "deletion scheduled" email. Best-effort; failures are logged, never block the flow.
export const onDeletionRequested = internalAction({
  args: { userId: v.id('users'), scheduledAt: v.number() },
  handler: async (ctx, { userId, scheduledAt }) => {
    const subs = await ctx.runQuery(internal.privacy.deletion.listUserSubscriptions, { userId })
    const key = process.env.STRIPE_SECRET_KEY
    if (key) {
      const stripe = new Stripe(key)
      for (const s of subs as Array<{ stripeSubscriptionId?: string; status?: string }>) {
        if (s.stripeSubscriptionId && s.status !== 'canceled') {
          try {
            await stripe.subscriptions.cancel(s.stripeSubscriptionId)
          } catch (err) {
            console.error('Stripe cancel failed for', s.stripeSubscriptionId, err instanceof Error ? err.message : err)
          }
        }
      }
    }
    const email = await ctx.runQuery(internal.privacy.deletion.getUserEmail, { userId })
    if (email) {
      const m = deletionScheduledEmail(formatDate(scheduledAt))
      await sendEmail({ to: email, subject: m.subject, html: m.html, text: m.text })
    }
  }
})

export const listUserSubscriptions = internalQuery({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }) =>
    ctx.db
      .query('subscriptions')
      .withIndex('by_user', q => q.eq('userId', userId))
      .collect()
})

export const getUserEmail = internalQuery({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }) => {
    const u = await ctx.db.get(userId)
    return u?.email ?? null
  }
})

// Daily cron: hard-delete accounts past their grace window. Batched + self-rescheduling.
export const processAccountDeletions = internalMutation({
  args: {},
  handler: async ctx => {
    const now = Date.now()
    const due = await ctx.db
      .query('users')
      .filter(q => q.and(q.neq(q.field('deletionScheduledAt'), undefined), q.lte(q.field('deletionScheduledAt'), now)))
      .take(DELETION_BATCH)
    for (const user of due) {
      const email = user.email as string | undefined
      await cascadeDeleteUser(ctx.db as unknown as CascadeDb, ctx.storage as unknown as CascadeStorage, user._id)
      if (email) await ctx.scheduler.runAfter(0, internal.privacy.deletion.sendDeletionCompleted, { email })
    }
    if (due.length === DELETION_BATCH) {
      await ctx.scheduler.runAfter(0, internal.privacy.deletion.processAccountDeletions, {})
    }
  }
})

export const sendDeletionCompleted = internalAction({
  args: { email: v.string() },
  handler: async (_ctx, { email }) => {
    const m = deletionCompletedEmail()
    await sendEmail({ to: email, subject: m.subject, html: m.html, text: m.text })
  }
})
