// convex/privacy/export.ts
// Right of access / data portability. buildExportBundle is pure (assembles + redacts);
// gatherUserData reads the user's own rows; the action stores the JSON bundle in Convex
// file storage behind a 7-day owner-only link and emails the user.
import { internalAction, internalMutation, internalQuery, mutation, query } from '../_generated/server'
import { v } from 'convex/values'
import { internal } from '../_generated/api'
import { resolveSession } from '../lib/auth'
import { checkRateLimit } from '../lib/rateLimit'
import { writeAuditLog } from '../lib/audit'
import { sendEmail } from '../lib/email'
import { exportReadyEmail } from './emails'

const EXPORT_TTL_MS = 7 * 24 * 60 * 60 * 1000

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- bundle assembles heterogeneous rows
type AnyDoc = Record<string, any>

export interface ExportInput {
  user: AnyDoc
  posts: AnyDoc[]
  subscriptions: AnyDoc[]
  consents: AnyDoc[]
  audits: AnyDoc[]
  feedback?: AnyDoc[]
  feedbackResponses?: AnyDoc[]
  interactions?: AnyDoc[]
  exportedAt?: number
}

export function buildExportBundle(input: ExportInput) {
  const { linkedinAccessToken: _at, linkedinRefreshToken: _rt, tokenExpiresAt: _exp, ...profile } = input.user
  return {
    formatVersion: 1 as const,
    exportedAt: input.exportedAt ?? 0,
    profile,
    posts: input.posts,
    subscriptions: input.subscriptions,
    consents: input.consents,
    feedback: input.feedback ?? [],
    feedbackResponses: input.feedbackResponses ?? [],
    // The user's own engagement log (reactions + comments they made on posts).
    interactions: input.interactions ?? [],
    // The user is entitled to data ABOUT them, not the internal admin trail — keep the
    // action + when, drop other actors' identifiers and internal fields.
    auditLog: input.audits.map(a => ({ action: a.action, createdAt: a.createdAt, metadata: a.metadata }))
  }
}

export const gatherUserData = internalQuery({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }) => {
    const user = await ctx.db.get(userId)
    if (!user) return null
    const posts = await ctx.db
      .query('posts')
      .withIndex('by_author', q => q.eq('authorId', userId))
      .collect()
    const subscriptions = await ctx.db
      .query('subscriptions')
      .withIndex('by_user', q => q.eq('userId', userId))
      .collect()
    const consents = await ctx.db
      .query('consentRecords')
      .withIndex('by_user', q => q.eq('userId', userId))
      .collect()
    const audits = await ctx.db
      .query('auditLogs')
      .withIndex('by_target', q => q.eq('targetUserId', userId))
      .collect()
    const feedback = await ctx.db
      .query('feedback')
      .withIndex('by_user', q => q.eq('userId', userId))
      .collect()
    // Gather all admin replies for each of the user's feedback items.
    const feedbackResponseArrays = await Promise.all(
      feedback.map(f =>
        ctx.db
          .query('feedbackResponses')
          .withIndex('by_feedback', q => q.eq('feedbackId', f._id))
          .collect()
      )
    )
    const feedbackResponses = feedbackResponseArrays.flat()
    const interactions = await ctx.db
      .query('userInteractions')
      .withIndex('by_user', q => q.eq('userId', userId))
      .collect()
    return { user, posts, subscriptions, consents, audits, feedback, feedbackResponses, interactions }
  }
})

export const requestDataExport = mutation({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    const user = await resolveSession(ctx, sessionToken) // allow banned users to exercise access
    if (!user) throw new Error('Unauthorized')
    if (!user.isAdmin) await checkRateLimit(ctx, user._id, 'dataExport', 1, 24 * 60 * 60 * 1000, 'day')
    const requestId = await ctx.db.insert('dataExportRequests', {
      userId: user._id,
      status: 'pending',
      requestedAt: Date.now()
    })
    await writeAuditLog(ctx.db as unknown as { insert: (t: string, d: Record<string, unknown>) => Promise<string> }, {
      actor: 'user',
      actorId: user._id,
      action: 'dsr.export_requested',
      targetUserId: user._id
    })
    await ctx.scheduler.runAfter(0, internal.privacy.export.generateExport, { requestId, userId: user._id })
    return { requestId }
  }
})

export const generateExport = internalAction({
  args: { requestId: v.id('dataExportRequests'), userId: v.id('users') },
  handler: async (ctx, { requestId, userId }) => {
    try {
      const data = await ctx.runQuery(internal.privacy.export.gatherUserData, { userId })
      if (!data) throw new Error('user not found')
      const bundle = buildExportBundle({ ...data, exportedAt: Date.now() })
      const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' })
      const fileStorageId = await ctx.storage.store(blob)
      await ctx.runMutation(internal.privacy.export.markExportReady, {
        requestId,
        fileStorageId,
        expiresAt: Date.now() + EXPORT_TTL_MS
      })
      const email = data.user.email as string | undefined
      if (email) {
        const m = exportReadyEmail()
        await sendEmail({ to: email, subject: m.subject, html: m.html, text: m.text })
      }
    } catch (err) {
      console.error('generateExport failed:', err instanceof Error ? err.message : String(err))
      await ctx.runMutation(internal.privacy.export.markExportFailed, { requestId })
    }
  }
})

export const markExportReady = internalMutation({
  args: { requestId: v.id('dataExportRequests'), fileStorageId: v.id('_storage'), expiresAt: v.number() },
  handler: async (ctx, { requestId, fileStorageId, expiresAt }) => {
    await ctx.db.patch(requestId, { status: 'ready', fileStorageId, expiresAt })
  }
})

export const markExportFailed = internalMutation({
  args: { requestId: v.id('dataExportRequests') },
  handler: async (ctx, { requestId }) => {
    await ctx.db.patch(requestId, { status: 'failed' })
  }
})

export const getExportStatus = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    const user = await resolveSession(ctx, sessionToken)
    if (!user) return null
    const latest = await ctx.db
      .query('dataExportRequests')
      .withIndex('by_user', q => q.eq('userId', user._id))
      .order('desc')
      .first()
    if (!latest) return null
    const expired = latest.expiresAt !== undefined && latest.expiresAt < Date.now()
    return { status: expired ? 'expired' : latest.status, requestedAt: latest.requestedAt }
  }
})

export const getExportDownloadUrl = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    const user = await resolveSession(ctx, sessionToken)
    if (!user) throw new Error('Unauthorized')
    const latest = await ctx.db
      .query('dataExportRequests')
      .withIndex('by_user', q => q.eq('userId', user._id))
      .order('desc')
      .first()
    if (!latest || latest.status !== 'ready' || !latest.fileStorageId) return null
    if (latest.expiresAt !== undefined && latest.expiresAt < Date.now()) return null
    return await ctx.storage.getUrl(latest.fileStorageId)
  }
})
