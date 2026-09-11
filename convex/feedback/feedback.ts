// convex/feedback/feedback.ts
// User feedback: submission (authenticated), admin listing/triage, and admin email replies.
// Replies are stored in the feedbackResponses table (Task 10); each admin reply is a separate row.
import { env, internalAction, internalQuery, mutation, query } from '../_generated/server'
import { ConvexError, v } from 'convex/values'
import { internal } from '../_generated/api'
import { requireAuth } from '../lib/auth'
import { assertAdmin } from '../admin'
import { checkRateLimit } from '../lib/rateLimit'
import { type AuditDb, writeAuditLog } from '../lib/audit'
import { sendEmail } from '../lib/email'
import { feedbackReplyEmail } from './emails'

// 'cancellation' is written only by the cancel interstitial (app CancelInterstitial.tsx); it is
// deliberately NOT in the FeedbackModal picker.
export const FEEDBACK_CATEGORIES = [
  'feature_request',
  'bug',
  'comment',
  'criticism',
  'praise',
  'question',
  'suggestion',
  'other',
  'cancellation'
] as const

export const MAX_FEEDBACK_LENGTH = 4000
export const FEEDBACK_RATE_LIMIT_PER_HOUR = 10

const categoryValidator = v.union(
  v.literal('feature_request'),
  v.literal('bug'),
  v.literal('comment'),
  v.literal('criticism'),
  v.literal('praise'),
  v.literal('question'),
  v.literal('suggestion'),
  v.literal('other'),
  v.literal('cancellation')
)

// Pure validator — exported for unit testing. Returns the trimmed message or throws.
export function validateFeedbackMessage(message: string): string {
  const trimmed = message.trim()
  if (trimmed.length === 0) throw new ConvexError('Feedback message cannot be empty.')
  if (trimmed.length > MAX_FEEDBACK_LENGTH) {
    throw new ConvexError(`Feedback must be ${MAX_FEEDBACK_LENGTH} characters or fewer.`)
  }
  return trimmed
}

export const submitFeedback = mutation({
  args: { sessionToken: v.string(), category: categoryValidator, message: v.string() },
  handler: async (ctx, { sessionToken, category, message }) => {
    const user = await requireAuth(ctx, sessionToken)
    const trimmed = validateFeedbackMessage(message)
    // Admins are exempt from the throttle (mirrors requestDataExport).
    if (!user.isAdmin) {
      await checkRateLimit(ctx, user._id, 'submitFeedback', FEEDBACK_RATE_LIMIT_PER_HOUR)
    }
    await ctx.db.insert('feedback', {
      userId: user._id,
      category,
      message: trimmed,
      status: 'new',
      createdAt: Date.now()
    })
  }
})

// Admin-only. Newest-first, bounded. Enriches each row with submitter name + email
// (null for anonymized rows whose userId was cleared on account deletion).
// Returns { rows, repliesTruncated } — each row carries responses[] (chronological asc); the flag
// tells the tab some reply threads are only partially shown. Replaces the deprecated
// responseText/respondedAt fields.
export const listFeedback = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    const admin = await requireAuth(ctx, sessionToken)
    assertAdmin(admin)
    const rows = await ctx.db.query('feedback').order('desc').take(200)

    // Fetch each item's responses (one bounded indexed read per item — the unavoidable join), then
    // resolve submitter + responder names through a single batched get() per unique id instead of one
    // per row/response. The outer 200 and the per-item read keep the worst case inside the transaction
    // limit; admin surfaces reply threads lazily when a row is expanded in a follow-up, so a partial
    // thread here is acceptable — `repliesTruncated` flags it instead of silently dropping replies.
    // Each read takes 21 so a thread of exactly 20 is not a false positive: the thread is truncated
    // only when a 21st row exists, and the payload carries the first 20.
    const responseRowsByFeedback = await Promise.all(
      rows.map(f =>
        ctx.db
          .query('feedbackResponses')
          .withIndex('by_feedback_id_and_created_at', q => q.eq('feedbackId', f._id))
          .take(21)
      )
    )
    const repliesTruncated = responseRowsByFeedback.some(responses => responses.length === 21)

    const userIds = new Set(rows.map(f => f.userId).filter((id): id is NonNullable<typeof id> => !!id))
    const responderIds = new Set(responseRowsByFeedback.flat().map(r => r.responderId))
    const userDocs = await Promise.all([...userIds].map(id => ctx.db.get(id)))
    const responderDocs = await Promise.all([...responderIds].map(id => ctx.db.get(id)))
    const userMap = new Map(userDocs.filter(u => u !== null).map(u => [u!._id, u!]))
    const responderMap = new Map(responderDocs.filter(u => u !== null).map(u => [u!._id, u!]))

    return {
      rows: rows.map((f, i) => {
        const u = f.userId ? userMap.get(f.userId) : null
        const responses = responseRowsByFeedback[i].slice(0, 20).map(r => ({
          text: r.text,
          createdAt: r.createdAt,
          responderName: responderMap.get(r.responderId)?.name ?? null
        }))
        return {
          _id: f._id,
          category: f.category,
          message: f.message,
          status: f.status,
          createdAt: f.createdAt,
          userName: u?.name ?? null,
          userEmail: u?.email ?? null,
          responses
        }
      }),
      repliesTruncated
    }
  }
})

export const respondToFeedback = mutation({
  args: {
    sessionToken: v.string(),
    feedbackId: v.id('feedback'),
    responseText: v.string(),
    sendEmail: v.boolean()
  },
  handler: async (ctx, { sessionToken, feedbackId, responseText, sendEmail: shouldSendEmail }) => {
    const admin = await requireAuth(ctx, sessionToken)
    assertAdmin(admin)
    const reply = validateFeedbackMessage(responseText)
    const feedback = await ctx.db.get(feedbackId)
    if (!feedback) throw new ConvexError('Feedback not found')

    // Insert a new response row — feedbackResponses is the source of truth for replies.
    const responseId = await ctx.db.insert('feedbackResponses', {
      feedbackId,
      responderId: admin._id,
      text: reply,
      createdAt: Date.now()
    })

    // Update only the status on the feedback row (stop writing legacy response fields).
    await ctx.db.patch(feedbackId, { status: 'responded' })

    await writeAuditLog(ctx.db as unknown as AuditDb, {
      actor: 'admin',
      actorId: admin._id,
      action: 'feedback.responded',
      targetUserId: feedback.userId
    })

    // Email is opt-in per reply.
    if (shouldSendEmail) {
      await ctx.scheduler.runAfter(0, internal.feedback.feedback.sendFeedbackReply, { responseId })
    }
  }
})

export const archiveFeedback = mutation({
  args: { sessionToken: v.string(), feedbackId: v.id('feedback') },
  handler: async (ctx, { sessionToken, feedbackId }) => {
    const admin = await requireAuth(ctx, sessionToken)
    assertAdmin(admin)
    const f = await ctx.db.get(feedbackId)
    if (!f) throw new ConvexError('Feedback not found')
    await ctx.db.patch(feedbackId, { status: 'archived' })
    await writeAuditLog(ctx.db as unknown as AuditDb, {
      actor: 'admin',
      actorId: admin._id,
      action: 'feedback.archived',
      targetUserId: f.userId
    })
  }
})

// Reopen → 'responded' if the item has any responses, else 'new'.
export const reopenFeedback = mutation({
  args: { sessionToken: v.string(), feedbackId: v.id('feedback') },
  handler: async (ctx, { sessionToken, feedbackId }) => {
    const admin = await requireAuth(ctx, sessionToken)
    assertAdmin(admin)
    const f = await ctx.db.get(feedbackId)
    if (!f) throw new ConvexError('Feedback not found')
    // Source of truth: feedbackResponses existence (not the legacy responseText field).
    const hasResponse = await ctx.db
      .query('feedbackResponses')
      .withIndex('by_feedback_id_and_created_at', q => q.eq('feedbackId', feedbackId))
      .first()
    await ctx.db.patch(feedbackId, { status: hasResponse ? 'responded' : 'new' })
    await writeAuditLog(ctx.db as unknown as AuditDb, {
      actor: 'admin',
      actorId: admin._id,
      action: 'feedback.reopened',
      targetUserId: f.userId
    })
  }
})

// Internal: data the reply action needs (action has no ctx.db).
// Replaces getFeedbackForReply — keyed by responseId instead of feedbackId.
export const getReplyData = internalQuery({
  args: { responseId: v.id('feedbackResponses') },
  handler: async (ctx, { responseId }) => {
    const response = await ctx.db.get(responseId)
    if (!response) return null
    const feedback = await ctx.db.get(response.feedbackId)
    if (!feedback) return null
    const u = feedback.userId ? await ctx.db.get(feedback.userId) : null
    return {
      email: u?.email ?? null,
      originalMessage: feedback.message,
      replyText: response.text
    }
  }
})

// Internal: emails the submitter. Best-effort — no email on file ⇒ no-op.
// Replaces sendFeedbackReply({feedbackId}) — keyed by responseId.
export const sendFeedbackReply = internalAction({
  args: { responseId: v.id('feedbackResponses') },
  handler: async (ctx, { responseId }) => {
    const data = await ctx.runQuery(internal.feedback.feedback.getReplyData, { responseId })
    if (!data || !data.email) return
    const m = feedbackReplyEmail({ replyText: data.replyText, originalMessage: data.originalMessage })
    const replyTo = env.FEEDBACK_REPLY_TO
    await sendEmail({
      to: data.email,
      subject: m.subject,
      html: m.html,
      text: m.text,
      ...(replyTo ? { replyTo } : {})
    })
  }
})
