// convex/privacy/retention.ts
// Data minimization / storage limitation. A daily cron expires LinkedIn tokens, purges old export
// files + audit logs, and flags dormant accounts for deletion (feeding the Phase 2a deletion cron).
// The predicates are pure + unit-tested; the cron orchestrates with bounded batches.
import { action, internalMutation } from '../_generated/server'
import { v } from 'convex/values'
import { internal } from '../_generated/api'
import { sendEmail } from '../lib/email'
import { dormancyWarningEmail } from './emails'

const AUDIT_TTL_MS = 24 * 30 * 24 * 60 * 60 * 1000 // ~24 months
const DORMANCY_MS = 24 * 30 * 24 * 60 * 60 * 1000 // ~24 months
const GRACE_MS = 30 * 24 * 60 * 60 * 1000
const RETENTION_BATCH = 100

export function isTokenExpired(u: { linkedinAccessToken?: string; tokenExpiresAt?: number }, now: number): boolean {
  return !!u.linkedinAccessToken && typeof u.tokenExpiresAt === 'number' && u.tokenExpiresAt < now
}

export function isExportExpired(r: { status: string; expiresAt?: number }, now: number): boolean {
  return r.status === 'ready' && typeof r.expiresAt === 'number' && r.expiresAt < now
}

export function isAuditExpired(a: { createdAt: number }, now: number, ttlMs: number): boolean {
  return a.createdAt < now - ttlMs
}

export function isDormant(
  u: { lastLoginAt?: number; subscriptionStatus?: string; deletionScheduledAt?: number },
  now: number,
  thresholdMs: number
): boolean {
  if (u.deletionScheduledAt) return false
  if (typeof u.lastLoginAt !== 'number') return false
  if (u.subscriptionStatus === 'active' || u.subscriptionStatus === 'trialing') return false
  return now - u.lastLoginAt >= thresholdMs
}

function dayStr(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10)
}

export const enforceDataRetention = internalMutation({
  args: {},
  handler: async ctx => {
    const now = Date.now()

    // 1. Null expired LinkedIn tokens.
    const usersWithTokens = await ctx.db
      .query('users')
      .filter(q => q.neq(q.field('linkedinAccessToken'), undefined))
      .take(RETENTION_BATCH)
    for (const u of usersWithTokens as Array<{
      _id: string
      linkedinAccessToken?: string
      tokenExpiresAt?: number
    }>) {
      if (isTokenExpired(u, now)) {
        await ctx.db.patch(u._id as Parameters<typeof ctx.db.patch>[0], {
          linkedinAccessToken: undefined,
          linkedinRefreshToken: undefined
        })
      }
    }

    // 2. Expire + delete old export files.
    const readyExports = await ctx.db
      .query('dataExportRequests')
      .filter(q => q.eq(q.field('status'), 'ready'))
      .take(RETENTION_BATCH)
    for (const r of readyExports as Array<{
      _id: string
      status: string
      expiresAt?: number
      fileStorageId?: string
    }>) {
      if (isExportExpired(r, now)) {
        if (r.fileStorageId) await ctx.storage.delete(r.fileStorageId as Parameters<typeof ctx.storage.delete>[0])
        await ctx.db.patch(r._id as Parameters<typeof ctx.db.patch>[0], { status: 'expired' })
      }
    }

    // 3. Purge old audit logs.
    const oldAudits = await ctx.db
      .query('auditLogs')
      .withIndex('by_created', q => q.lt('createdAt', now - AUDIT_TTL_MS))
      .take(RETENTION_BATCH)
    for (const a of oldAudits) await ctx.db.delete(a._id)

    // 4. Dormancy: flag long-inactive non-subscribers for deletion (feeds processAccountDeletions).
    const dormancyThreshold = now - DORMANCY_MS
    const candidates = await ctx.db
      .query('users')
      .filter(q =>
        q.and(q.eq(q.field('deletionScheduledAt'), undefined), q.lt(q.field('lastLoginAt'), dormancyThreshold))
      )
      .take(RETENTION_BATCH)
    for (const u of candidates as Array<{
      _id: string
      lastLoginAt?: number
      subscriptionStatus?: string
      deletionScheduledAt?: number
      email?: string
    }>) {
      if (isDormant(u, now, DORMANCY_MS)) {
        const scheduledAt = now + GRACE_MS
        await ctx.db.patch(u._id as Parameters<typeof ctx.db.patch>[0], {
          deletionScheduledAt: scheduledAt,
          deletionReason: 'dormancy'
        })
        const email = u.email
        if (email) {
          await ctx.scheduler.runAfter(0, internal.privacy.retention.sendDormancyWarning, {
            email,
            deletionDate: dayStr(scheduledAt)
          })
        }
      }
    }
  }
})

export const sendDormancyWarning = action({
  args: { email: v.string(), deletionDate: v.string() },
  handler: async (_ctx, { email, deletionDate }) => {
    const m = dormancyWarningEmail(deletionDate)
    await sendEmail({ to: email, subject: m.subject, html: m.html, text: m.text })
  }
})
