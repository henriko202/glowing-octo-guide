// convex/privacy/export.ts
// Right of access / data portability. buildExportBundle is pure (assembles + redacts); the export
// reads the user's own rows PER TABLE with pagination (gatherUserTablePage) so a user with an
// unbounded number of posts/interactions can't blow a single query's read limit; the action stores
// the JSON bundle in Convex file storage behind a 7-day owner-only link and emails the user.
import { internalAction, internalMutation, internalQuery, mutation, query } from '../_generated/server'
import { ConvexError, v } from 'convex/values'
import { internal } from '../_generated/api'
import { resolveSession } from '../lib/auth'
import { checkRateLimit } from '../lib/rateLimit'
import { type AuditDb, writeAuditLog } from '../lib/audit'
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
  userPostState?: AnyDoc[]
  trialCounters?: AnyDoc[]
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
    // Per-post state: which posts they reacted to + their saved AI comment drafts.
    userPostState: input.userPostState ?? [],
    // Trial interaction counters (plan 018 — high-churn, kept off the users doc).
    trialCounters: input.trialCounters ?? [],
    // The user is entitled to data ABOUT them, not the internal admin trail — keep the
    // action + when, drop other actors' identifiers and internal fields.
    auditLog: input.audits.map(a => ({ action: a.action, createdAt: a.createdAt, metadata: a.metadata }))
  }
}

// Per-table pagination config for the user-owned tables in the DSR export. Same tables + indexes as
// the erasure cascade's OWNED list (privacy/deletion.ts) — the export reads what erasure deletes.
// `key` is the buildExportBundle field name (differs from the table name for the renamed ones).
// feedbackResponses is gathered separately (keyed by feedbackId, not userId — see below).
const EXPORT_TABLES: Array<{ key: string; table: string; index: string; field: string }> = [
  { key: 'posts', table: 'posts', index: 'by_author', field: 'authorId' },
  { key: 'subscriptions', table: 'subscriptions', index: 'by_user', field: 'userId' },
  { key: 'consents', table: 'consentRecords', index: 'by_user', field: 'userId' },
  { key: 'audits', table: 'auditLogs', index: 'by_target', field: 'targetUserId' },
  { key: 'feedback', table: 'feedback', index: 'by_user', field: 'userId' },
  { key: 'interactions', table: 'userInteractions', index: 'by_user', field: 'userId' },
  { key: 'userPostState', table: 'userPostState', index: 'by_user_and_post', field: 'userId' },
  { key: 'trialCounters', table: 'trialCounters', index: 'by_user', field: 'userId' }
]

const EXPORT_PAGE_SIZE = 500

// Loose db shape for the table-name-parameterized paginated read. Convex's generated ctx.db is
// statically typed per table, so a dynamic-table query needs a narrowed interface (mirrors the
// CascadeDb cast in privacy/deletion.ts).
interface PaginatedDb {
  query(table: string): {
    withIndex(
      name: string,
      fn: (q: { eq(field: string, value: unknown): unknown }) => unknown
    ): { paginate(opts: unknown): Promise<{ page: AnyDoc[]; isDone: boolean; continueCursor: string }> }
  }
}

// The user document alone (bundle profile). Kept separate from the paginated table reads.
export const getExportUser = internalQuery({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }) => ctx.db.get(userId)
})

// One page of a single user-owned table. The action loops this per table with the returned cursor
// until isDone, so no single query reads more than EXPORT_PAGE_SIZE rows — the whole point of the
// pagination refactor (a single unbounded .collect() would fail the export for a very active user).
// Takes the cursor/numItems explicitly rather than a reconstructed `paginationOpts`: the client is
// the action, the server owns the cursor, and rebuilding the opts object field by field drops the
// optional pagination fields (Convex pagination guideline).
export const gatherUserTablePage = internalQuery({
  args: { userId: v.id('users'), table: v.string(), cursor: v.union(v.string(), v.null()), numItems: v.number() },
  handler: async (ctx, { userId, table, cursor, numItems }) => {
    const cfg = EXPORT_TABLES.find(t => t.table === table)
    if (!cfg) throw new Error(`Unknown export table: ${table}`)
    const db = ctx.db as unknown as PaginatedDb
    return await db
      .query(cfg.table)
      .withIndex(cfg.index, q => q.eq(cfg.field, userId))
      .paginate({ cursor, numItems })
  }
})

// Admin replies for the user's feedback items. feedbackResponses is keyed by feedbackId (not
// userId), so it's fetched from the already-collected feedback ids. Both bounds are generous
// headroom over reality (a user has few feedback items; each gets a handful of replies) — a
// truncation here is logged, never silent.
export const gatherFeedbackResponses = internalQuery({
  args: { feedbackIds: v.array(v.id('feedback')) },
  handler: async (ctx, { feedbackIds }) => {
    if (feedbackIds.length > 100) {
      console.warn(`[export] ${feedbackIds.length} feedback items — only the first 100 have replies gathered`)
    }
    const perFeedback = await Promise.all(
      feedbackIds.slice(0, 100).map(fid =>
        ctx.db
          .query('feedbackResponses')
          .withIndex('by_feedback_id_and_created_at', q => q.eq('feedbackId', fid))
          .take(100)
      )
    )
    return perFeedback.flat()
  }
})

export const requestDataExport = mutation({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    const user = await resolveSession(ctx, sessionToken) // allow banned users to exercise access
    if (!user) throw new ConvexError('Unauthorized')
    if (!user.isAdmin) await checkRateLimit(ctx, user._id, 'dataExport', 1, 24 * 60 * 60 * 1000, 'day')
    const requestId = await ctx.db.insert('dataExportRequests', {
      userId: user._id,
      status: 'pending',
      requestedAt: Date.now()
    })
    await writeAuditLog(ctx.db as unknown as AuditDb, {
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
      const user = await ctx.runQuery(internal.privacy.export.getExportUser, { userId })
      if (!user) throw new Error('user not found')

      // Paginate every user-owned table across separate point-in-time queries, so a user with an
      // unbounded number of posts/interactions/post-state rows can't blow a single query's read
      // limit. A failed export leaves the request permanently 'failed' — a missed GDPR access right —
      // so correctness at scale matters more than the extra round-trips.
      const collected: Record<string, AnyDoc[]> = {}
      for (const { key, table } of EXPORT_TABLES) {
        const rows: AnyDoc[] = []
        let cursor: string | null = null
        // Page ceiling (defensive against a non-advancing cursor): 10k pages × 500 = 5M rows.
        for (let page = 0; page < 10_000; page++) {
          const res: { page: AnyDoc[]; isDone: boolean; continueCursor: string } = await ctx.runQuery(
            internal.privacy.export.gatherUserTablePage,
            { userId, table, cursor, numItems: EXPORT_PAGE_SIZE }
          )
          rows.push(...res.page)
          if (res.isDone) break
          cursor = res.continueCursor
        }
        collected[key] = rows
      }

      const feedbackResponses = await ctx.runQuery(internal.privacy.export.gatherFeedbackResponses, {
        feedbackIds: (collected.feedback ?? []).map(f => f._id)
      })

      const bundle = buildExportBundle({
        user,
        posts: collected.posts ?? [],
        subscriptions: collected.subscriptions ?? [],
        consents: collected.consents ?? [],
        audits: collected.audits ?? [],
        feedback: collected.feedback ?? [],
        feedbackResponses,
        interactions: collected.interactions ?? [],
        userPostState: collected.userPostState ?? [],
        trialCounters: collected.trialCounters ?? [],
        exportedAt: Date.now()
      })
      const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' })
      const fileStorageId = await ctx.storage.store(blob)
      await ctx.runMutation(internal.privacy.export.markExportReady, {
        requestId,
        fileStorageId,
        expiresAt: Date.now() + EXPORT_TTL_MS
      })
      const email = user.email as string | undefined
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
  args: { sessionToken: v.string(), now: v.number() },
  handler: async (ctx, { sessionToken, now }) => {
    const user = await resolveSession(ctx, sessionToken)
    if (!user) return null
    const latest = await ctx.db
      .query('dataExportRequests')
      .withIndex('by_user', q => q.eq('userId', user._id))
      .order('desc')
      .first()
    if (!latest) return null
    const expired = latest.expiresAt !== undefined && latest.expiresAt < now
    return { status: expired ? 'expired' : latest.status, requestedAt: latest.requestedAt }
  }
})

export const getExportDownloadUrl = query({
  args: { sessionToken: v.string(), now: v.number() },
  handler: async (ctx, { sessionToken, now }) => {
    const user = await resolveSession(ctx, sessionToken)
    if (!user) throw new ConvexError('Unauthorized')
    const latest = await ctx.db
      .query('dataExportRequests')
      .withIndex('by_user', q => q.eq('userId', user._id))
      .order('desc')
      .first()
    if (!latest || latest.status !== 'ready' || !latest.fileStorageId) return null
    if (latest.expiresAt !== undefined && latest.expiresAt < now) return null
    return await ctx.storage.getUrl(latest.fileStorageId)
  }
})
