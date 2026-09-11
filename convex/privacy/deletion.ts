// convex/privacy/deletion.ts
// Right to erasure. cascadeDeleteUser is pure (operates on a narrow db + storage interface) so the
// full multi-table deletion is unit-tested. The registered request/cancel/cron wrappers follow below.
import { env, internalAction, internalMutation, internalQuery, mutation } from '../_generated/server'
import { ConvexError, v } from 'convex/values'
import { internal } from '../_generated/api'
import Stripe from 'stripe'
import { resolveSession } from '../lib/auth'
import { sendEmail } from '../lib/email'
import { deletionScheduledEmail, deletionCompletedEmail } from './emails'
import { type AuditDb, writeAuditLog } from '../lib/audit'
import { resolveBillingLocale } from '../lib/checkoutCopy'
import { checkRateLimit, resetUserRateLimits } from '../lib/rateLimit'

interface CascadeDb {
  query(table: string): {
    withIndex(
      name: string,
      fn: (q: unknown) => unknown
    ): { take(n: number): Promise<Array<Record<string, unknown> & { _id: string }>> }
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
// NOTE: `posts` is handled separately (the posts + orphan-cleanup step in cascadeDeleteUser) so the
// cross-user interaction/state rows that reference a post are deleted before the post itself — a
// plain by-author drain here would leave those rows dangling at a now-deleted post.
const OWNED: Array<{ table: string; index: string; field: string }> = [
  { table: 'postQueue', index: 'by_author', field: 'authorId' },
  { table: 'subscriptions', index: 'by_user', field: 'userId' },
  { table: 'sessions', index: 'by_userId', field: 'userId' },
  // Unredeemed login codes are bearer credentials: erase them with the user (never exported in a DSR).
  { table: 'authCodes', index: 'by_userId', field: 'userId' },
  // NOTE: rate-limit state is NOT here — it lives in the rate-limiter component's isolated tables,
  // which the by-index db drains below can't reach. processAccountDeletions calls resetUserRateLimits
  // on the terminal pass to erase it.
  { table: 'featuredPostUsage', index: 'by_user_id_and_month', field: 'userId' },
  { table: 'planLimits', index: 'by_user', field: 'userId' },
  { table: 'consentRecords', index: 'by_user', field: 'userId' },
  { table: 'userInteractions', index: 'by_user', field: 'userId' },
  { table: 'userPostState', index: 'by_user_and_post', field: 'userId' },
  { table: 'trialCounters', index: 'by_user', field: 'userId' }
]

// Tables with user references that are ANONYMIZED rather than deleted (userId cleared to undefined).
// The cascade loop clears a single field to undefined via { [field]: undefined }. Tables requiring
// multi-field clearing or value replacement would need this structure evolved.
const ANONYMIZED: Array<{ table: string; index: string; field: string }> = [
  { table: 'feedback', index: 'by_user', field: 'userId' }
]

// One cascade pass deletes/anonymizes at most this many rows per owned table — bounded so a single
// mutation stays within Convex's read/write budget even for a user with an unbounded number of posts.
const CASCADE_BATCH = 100

// Posts processed for orphan cleanup per pass. Each post can carry up to CASCADE_BATCH child rows in
// EACH of these tables, so bounding posts-per-pass keeps a pass's writes (POST_ORPHAN_BATCH × child
// tables × CASCADE_BATCH) well under a transaction's limit even for a user whose posts are heavily
// engaged. A prolific user just takes more passes — fine for a background erasure cron.
const POST_ORPHAN_BATCH = 10
// Child tables keyed by postId whose rows may be owned by OTHER users (their reactions/comments on
// this user's posts). Both carry a by_post index for exactly this cleanup (see schema.ts).
const POST_CHILD_TABLES = ['userInteractions', 'userPostState'] as const

/**
 * Deletes / anonymizes up to `batch` rows per owned table for `userId`. Returns `true` only once
 * every table is fully drained — at which point it writes the final system audit row and deletes
 * the user document. Returns `false` when any table still had a full batch (more rows remain), so
 * `processAccountDeletions` reschedules another pass. The user document is the LAST thing deleted,
 * so a half-drained account stays "due" and is re-selected until fully erased. Pure (narrow db +
 * storage interface) so the whole multi-table erasure stays unit-testable.
 */
export async function cascadeDeleteUser(
  db: CascadeDb,
  storage: CascadeStorage,
  userId: string,
  batch: number = CASCADE_BATCH
): Promise<boolean> {
  let moreWork = false

  // 1. Delete export jobs + their stored files first (needs storage cleanup).
  const exports = await db
    .query('dataExportRequests')
    .withIndex('by_user', (q: unknown) => (q as { eq(f: string, v: unknown): unknown }).eq('userId', userId))
    .take(batch)
  for (const e of exports) {
    if (typeof e.fileStorageId === 'string') await storage.delete(e.fileStorageId)
    await db.delete(e._id)
  }
  if (exports.length === batch) moreWork = true

  // 1b. Posts + the cross-user rows that reference them. A reaction/comment ANOTHER user made on this
  // user's post lives in userInteractions/userPostState keyed by postId — rows owned by that other
  // user, so the by-user drains in step 2 never touch them. Delete a post's referencing child rows
  // first; only delete the post once none remain, so a post with more child rows than one pass can
  // drain is fully cleaned across passes before we lose its id to query by. (This user's OWN
  // interaction/state rows are still fully removed by step 2's by-user drains — including rows on
  // posts authored by others.)
  const userPosts = await db
    .query('posts')
    .withIndex('by_author', (q: unknown) => (q as { eq(f: string, v: unknown): unknown }).eq('authorId', userId))
    .take(POST_ORPHAN_BATCH)
  for (const p of userPosts) {
    let postClean = true
    for (const childTable of POST_CHILD_TABLES) {
      const children = await db
        .query(childTable)
        .withIndex('by_post', (q: unknown) => (q as { eq(f: string, v: unknown): unknown }).eq('postId', p._id))
        .take(batch)
      for (const c of children) await db.delete(c._id)
      if (children.length === batch) postClean = false // a full batch ⇒ more child rows remain
    }
    if (postClean) await db.delete(p._id)
    else moreWork = true // leave this post in place; its remaining child rows drain next pass
  }
  if (userPosts.length === POST_ORPHAN_BATCH) moreWork = true

  // 2. Delete all other owned rows.
  for (const { table, index, field } of OWNED) {
    const rows = await db
      .query(table)
      .withIndex(index, (q: unknown) => (q as { eq(f: string, v: unknown): unknown }).eq(field, userId))
      .take(batch)
    for (const r of rows) await db.delete(r._id)
    if (rows.length === batch) moreWork = true
  }

  // 2b. Anonymize feedback rows (clear userId but retain content).
  for (const { table, index, field } of ANONYMIZED) {
    const rows = await db
      .query(table)
      .withIndex(index, (q: unknown) => (q as { eq(f: string, v: unknown): unknown }).eq(field, userId))
      .take(batch)
    for (const r of rows) await db.patch(r._id, { [field]: undefined })
    if (rows.length === batch) moreWork = true
  }

  // 3. Pseudonymize audit rows that target this user (keep action/metadata for accountability).
  const audits = await db
    .query('auditLogs')
    .withIndex('by_target', (q: unknown) => (q as { eq(f: string, v: unknown): unknown }).eq('targetUserId', userId))
    .take(batch)
  for (const a of audits) await db.patch(a._id, { targetUserId: undefined, actorId: undefined })
  if (audits.length === batch) moreWork = true

  // At least one table still had a full batch — more rows remain. Leave the user document in place
  // (it stays "due", so the cron re-selects this account) and signal the caller to reschedule.
  if (moreWork) return false

  // 4. Record the deletion itself (no PII).
  await writeAuditLog(db, { actor: 'system', action: 'account.deleted', metadata: JSON.stringify({ at: Date.now() }) })

  // 5. Delete the user document LAST.
  await db.delete(userId)
  return true
}

const GRACE_MS = 30 * 24 * 60 * 60 * 1000

export const requestAccountDeletion = mutation({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    const user = await resolveSession(ctx, sessionToken) // allow banned users to exercise erasure
    if (!user) throw new ConvexError('Unauthorized')
    if (user.deletionScheduledAt) return { deletionScheduledAt: user.deletionScheduledAt } // idempotent
    await checkRateLimit(ctx, user._id, 'requestAccountDeletion', 3, 24 * 60 * 60 * 1000, 'day')
    const scheduledAt = Date.now() + GRACE_MS
    await ctx.db.patch(user._id, {
      deletionRequestedAt: Date.now(),
      deletionScheduledAt: scheduledAt,
      deletionReason: 'user_request'
    })
    await ctx.runMutation(internal.sessions.deleteAllForUser, { userId: user._id }) // revoke access now
    await writeAuditLog(ctx.db as unknown as AuditDb, {
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
    if (!user) throw new ConvexError('Unauthorized')
    await checkRateLimit(ctx, user._id, 'cancelAccountDeletion', 10)
    await ctx.db.patch(user._id, {
      deletionRequestedAt: undefined,
      deletionScheduledAt: undefined,
      deletionReason: undefined
    })
    await writeAuditLog(ctx.db as unknown as AuditDb, {
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
    const key = env.STRIPE_SECRET_KEY
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
    const target = await ctx.runQuery(internal.privacy.deletion.getDeletionUser, { userId })
    if (target?.email) {
      const m = deletionScheduledEmail({
        locale: resolveBillingLocale(target.language, target.primaryLocale),
        deletionAt: scheduledAt,
        appUrl: env.APP_URL
      })
      await sendEmail({ to: target.email, subject: m.subject, html: m.html, text: m.text })
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

export const getDeletionUser = internalQuery({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }) => {
    const u = await ctx.db.get(userId)
    if (!u) return null
    return { email: u.email ?? null, language: u.language, primaryLocale: u.primaryLocale }
  }
})

// Daily cron: hard-delete accounts past their grace window. Processes ONE account per invocation and
// self-reschedules: cascadeDeleteUser drains a bounded batch of rows per pass and only deletes the
// user document once every table is clear, so a single account with an unbounded number of posts is
// erased across as many passes as it takes — each within one transaction's budget — before the cron
// moves on to the next due account.
export const processAccountDeletions = internalMutation({
  args: {},
  handler: async ctx => {
    const now = Date.now()
    // Indexed range on the leading field of by_deletion_and_last_login. gte(1) skips rows where
    // deletionScheduledAt is unset (undefined sorts before all numbers), so this reads only accounts
    // actually due for deletion — not the whole users table. take(1): the earliest-due account, which
    // keeps being re-selected (its document is deleted last) until it is fully erased.
    const due = await ctx.db
      .query('users')
      .withIndex('by_deletion_and_last_login', q => q.gte('deletionScheduledAt', 1).lte('deletionScheduledAt', now))
      .take(1)
    if (due.length === 0) return

    const user = due[0]
    const email = user.email as string | undefined
    const done = await cascadeDeleteUser(
      ctx.db as unknown as CascadeDb,
      ctx.storage as unknown as CascadeStorage,
      user._id
    )
    if (done) {
      // Erase the user's rate-limit counters from the component's isolated tables (the by-index db
      // drains above can't reach them). Terminal pass only, so this runs once per account.
      await resetUserRateLimits(ctx, user._id)
      if (email) {
        const locale = resolveBillingLocale(user.language, user.primaryLocale)
        await ctx.scheduler.runAfter(0, internal.privacy.deletion.sendDeletionCompleted, { email, locale })
      }
    }
    // Keep going until the due-set is empty: either this account needs more passes (done === false)
    // or there may be further due accounts (done === true).
    await ctx.scheduler.runAfter(0, internal.privacy.deletion.processAccountDeletions, {})
  }
})

export const sendDeletionCompleted = internalAction({
  args: { email: v.string(), locale: v.union(v.literal('en'), v.literal('pt'), v.literal('es')) },
  handler: async (_ctx, { email, locale }) => {
    const m = deletionCompletedEmail({ locale })
    await sendEmail({ to: email, subject: m.subject, html: m.html, text: m.text })
  }
})
