// R24 — daily digest sweep. A daily pass over `users` filtered by lib/digest.isDigestDue, batches of 50 sends per
// invocation with self-rescheduling (jobs/syncPostsApify.ts pattern). The 3-day cadence (not Stripe-style per-user
// scheduling) keeps the job idempotent and easy to debug. `lastDigestAt` is stamped only after a send that did not
// throw; when the email provider is unconfigured the sweep sends nothing and stamps nothing.
import { internalAction, internalMutation, internalQuery } from '../_generated/server'
import { v } from 'convex/values'
import { paginationOptsValidator } from 'convex/server'
import { env } from '../_generated/server'
import type { ActionCtx } from '../_generated/server'
import type { Doc, Id } from '../_generated/dataModel'
import { internal } from '../_generated/api'
import { sendEmail } from '../lib/email'
import type { EmailContent } from '../lib/email'
import { digestEmail, digestFeatureNote, type DigestInput } from '../lib/digestEmails'
import { isDigestDue } from '../lib/digest'
import { digestWindow, movement, pickPreviousGeneration, positionOf } from '../lib/ranking'
import { signUnsubscribeToken } from '../lib/unsubscribeToken'
import { resolveBillingLocale } from '../lib/checkoutCopy'
import { disableDigest, type DigestOptOutDb } from '../lib/digestOptOut'
import { SUPPORT_EMAIL } from '../lib/support'
import { tallyMadeByPerson, tallyReceivedByPerson, type InteractionRow } from '../lib/interactionGraph'
import { RECAP_ROW_CEILING } from '../lib/recap'
import { scrubError } from '../lib/scrubError'
import { settledInBatches } from '../lib/concurrency'

const PAGE_SIZE = 50
// Resend throttles per second, so keep the fan-out small: 5 members in flight (each up to three dependent
// sub-requests) stays well under the provider limit while draining a 50-member page in ~10 waves instead of
// 50 serial round-trips.
const DIGEST_SEND_CONCURRENCY = 5
const DIGEST_WINDOW = '7d' as const // site board window used in the email; the personal numbers use the 3-day window

export const getUsersPage = internalQuery({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, { paginationOpts }) => ctx.db.query('users').paginate(paginationOpts)
})

/** Re-read one user immediately before the send so an unsubscribe that lands mid-sweep wins over the page read. */
export const getUserForSend = internalQuery({
  args: { userId: v.id('users') },
  handler: (ctx, { userId }) => ctx.db.get(userId)
})

export const disableDigestByUserId = internalMutation({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }) => {
    await disableDigest(ctx.db as unknown as DigestOptOutDb, userId, 'digest_unsubscribed_email')
  }
})

export const markDigestSent = internalMutation({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }) => {
    await ctx.db.patch(userId, { lastDigestAt: Date.now() })
  }
})

export const getDigestData = internalQuery({
  args: { userId: v.id('users'), lastDigestAt: v.optional(v.number()), now: v.number() },
  handler: async (ctx, { userId, lastDigestAt, now }) => {
    const { since } = digestWindow(now, lastDigestAt)
    const rows = await ctx.db
      .query('userInteractions')
      .withIndex('by_user', q => q.eq('userId', userId).gte('_creationTime', since))
      .order('desc')
      .take(RECAP_ROW_CEILING)
    const receivedRows = await ctx.db
      .query('userInteractions')
      .withIndex('by_author', q => q.eq('authorId', userId).gte('_creationTime', since))
      .order('desc')
      .take(RECAP_ROW_CEILING)
    const toRows = (list: Doc<'userInteractions'>[]): InteractionRow[] =>
      list.map(r => ({
        _creationTime: r._creationTime,
        userId: r.userId as string,
        authorId: r.authorId as string | undefined,
        postId: r.postId as string,
        kind: r.kind
      }))
    const made = tallyMadeByPerson(toRows(rows), since)
    const received = tallyReceivedByPerson(toRows(receivedRows), since)
    const generations = await ctx.db
      .query('rankingSnapshots')
      .withIndex('by_window_and_generated_at', q => q.eq('window', DIGEST_WINDOW))
      .order('desc')
      .take(4)
    const latest = generations[0]
    const previous =
      latest && lastDigestAt !== undefined ? pickPreviousGeneration(generations.slice(1), lastDigestAt) : null
    // The board stores identities only for the top 100; the digest reads the member's own board-window count live,
    // the same way getSiteRankings does, so a member outside the top 100 still gets an exact position.
    let countNow = 0
    if (latest) {
      const boardRows = await ctx.db
        .query('userInteractions')
        .withIndex('by_user', q => q.eq('userId', userId).gte('_creationTime', latest.since))
        .order('desc')
        .take(RECAP_ROW_CEILING)
      countNow = boardRows.filter(
        r => r.kind !== 'ai_draft' && (r.authorId === undefined || r.authorId !== userId)
      ).length
    }
    const findCount = (list: NonNullable<typeof latest>['topInteractors']) =>
      list.find(e => e.userId === userId)?.count ?? 0
    const prevCount = previous ? findCount(previous.topInteractors) : 0
    const currentPosition = latest && countNow > 0 ? positionOf(countNow, latest.interactorCountsDescending) : null
    const prevPosition = previous && prevCount > 0 ? positionOf(prevCount, previous.interactorCountsDescending) : null
    // Reaching the next position means tying the member above, so the gap is their count minus the live count.
    const gapToNext =
      latest && currentPosition !== null && currentPosition > 1
        ? latest.interactorCountsDescending[currentPosition - 2] - countNow
        : null
    const siteTotalInteractions = latest ? latest.interactorCountsDescending.reduce((sum, count) => sum + count, 0) : 0
    const siteActiveMembers = latest ? latest.interactorCountsDescending.length : 0
    const topReceived = received.slice(0, 3).map(t => ({ userId: t.userId as Id<'users'>, count: t.total }))
    const topMade = made.slice(0, 3).map(t => ({ userId: t.userId as Id<'users'>, count: t.total }))
    const siteTopPosters = latest ? latest.topPosters.slice(0, 3).map(e => ({ userId: e.userId, count: e.count })) : []
    const siteTopInteractors = latest
      ? latest.topInteractors.slice(0, 3).map(e => ({ userId: e.userId, count: e.count }))
      : []
    const listedIds = [
      ...new Set([...topReceived, ...topMade, ...siteTopPosters, ...siteTopInteractors].map(e => e.userId as string))
    ]
    const listedUsers = await Promise.all(listedIds.map(id => ctx.db.get(id as Id<'users'>)))
    const listed = new Map(
      listedUsers
        .filter((u): u is Doc<'users'> => u !== null && !u.isBanned && u.deletionScheduledAt === undefined)
        .map(u => [u._id as string, u])
    )
    const shown = <T extends { userId: Id<'users'> }>(list: T[], dropOptedOut: boolean): T[] =>
      list.filter(e => {
        const user = listed.get(e.userId as string)
        return user !== undefined && !(dropOptedOut && user.leaderboardOptOut === true)
      })
    return {
      since,
      made: {
        reactions: made.reduce((s, t) => s + t.reactions, 0),
        comments: made.reduce((s, t) => s + t.comments, 0)
      },
      received: {
        reactions: received.reduce((s, t) => s + t.reactions, 0),
        comments: received.reduce((s, t) => s + t.comments, 0)
      },
      topReceived: shown(topReceived, false),
      topMade: shown(topMade, false),
      siteTopPosters: shown(siteTopPosters, true),
      siteTopInteractors: shown(siteTopInteractors, true),
      siteTotalInteractions,
      siteActiveMembers,
      myPosition: currentPosition,
      gapToNext,
      movement: movement(prevPosition, currentPosition)
    }
  }
})

/** Resolve the display names for a digest in one small mutation-free pass. */
export const getDisplayNames = internalQuery({
  args: { userIds: v.array(v.id('users')) },
  handler: async (ctx, { userIds }) => {
    const users = await Promise.all(userIds.map(id => ctx.db.get(id)))
    return users.flatMap(u => (u ? [{ id: u._id as string, name: u.name }] : []))
  }
})

export const sendDueDigests = internalAction({
  args: { cursor: v.optional(v.string()) },
  handler: async (ctx, { cursor }) => {
    const secret = env.UNSUBSCRIBE_SECRET
    const appUrl = env.APP_URL ?? 'http://localhost:5173'
    // The one-click unsubscribe endpoint is a Convex HTTP action: it lives on the .convex.site origin, not APP_URL.
    const siteUrl = env.CONVEX_SITE_URL
    if (!secret) {
      console.error('[digest] UNSUBSCRIBE_SECRET unset — sweep skipped rather than sending without opt-out')
      return
    }
    const now = Date.now()
    const page = await ctx.runQuery(internal.jobs.digest.getUsersPage, {
      paginationOpts: { numItems: PAGE_SIZE, cursor: cursor ?? null }
    })
    const due = page.page.filter(user => isDigestDue(user, now))
    // Bounded fan-out (the jobs/syncPostsApify settledInBatches pattern): settledInBatches never rejects, and the
    // per-user try/catch still isolates a bad recipient (provider error, corrupt row) so it cannot abort the sweep —
    // the cursor continuation below has to run, or the same failed page restarts the next day and starves every
    // later member.
    await settledInBatches(due, DIGEST_SEND_CONCURRENCY, async user => {
      try {
        await settleDigest(ctx, user, { now, secret, appUrl, siteUrl })
      } catch (error) {
        console.error('[digest] send failed', scrubError({ userId: user._id, error }))
      }
    })
    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, internal.jobs.digest.sendDueDigests, { cursor: page.continueCursor })
    }
  }
})

/** The composed digest plus what the caller needs to decide whether to send it. */
export interface DigestComposition {
  message: EmailContent
  total: number
  headers: { 'List-Unsubscribe': string; 'List-Unsubscribe-Post': string }
}

/**
 * Builds one member's digest email — window data, display names, app/site URLs, signed unsubscribe token and the
 * rendered message. Shared by the daily sweep and the dev-only test tool (`convex/dev.ts`), so a manual send
 * exercises the exact production composition. The empty-digest policy stays with the caller: the sweep skips at
 * `total === 0`, while the dev tool sends anyway so the fallback subject (`subjectEmpty`) can be exercised.
 */
export async function composeDigest(
  ctx: ActionCtx,
  user: Doc<'users'>,
  ctxArgs: { now: number; secret: string; appUrl: string; siteUrl: string }
): Promise<DigestComposition> {
  const data = await ctx.runQuery(internal.jobs.digest.getDigestData, {
    userId: user._id,
    lastDigestAt: user.lastDigestAt,
    now: ctxArgs.now
  })
  const total = data.made.reactions + data.made.comments + data.received.reactions + data.received.comments
  const names = await ctx.runQuery(internal.jobs.digest.getDisplayNames, {
    userIds: [
      ...data.topReceived.map(e => e.userId),
      ...data.topMade.map(e => e.userId),
      ...data.siteTopPosters.map(e => e.userId),
      ...data.siteTopInteractors.map(e => e.userId)
    ]
  })
  const nameOf = (id: string) => names.find(n => n.id === id)?.name ?? ''
  const token = await signUnsubscribeToken(user._id as string, ctxArgs.secret)
  const locale = resolveBillingLocale(user.language, user.primaryLocale)
  // The footer link is the human path and lives on the app (a localized page); the RFC 8058 one-click target must
  // stay on Convex because a mail client POSTs to it and the SPA cannot receive a POST.
  const unsubscribeUrl = `${ctxArgs.appUrl}/unsubscribe?token=${token}`
  const oneClickUrl = `${ctxArgs.siteUrl.replace(/\/$/, '')}/unsubscribe/digest?token=${token}`
  const input: DigestInput = {
    name: user.name,
    since: data.since,
    receivedReactions: data.received.reactions,
    receivedComments: data.received.comments,
    madeReactions: data.made.reactions,
    madeComments: data.made.comments,
    topReceived: data.topReceived.map(e => ({ name: nameOf(e.userId), count: e.count })),
    topMade: data.topMade.map(e => ({ name: nameOf(e.userId), count: e.count })),
    siteTopPosters: data.siteTopPosters.map(e => ({ name: nameOf(e.userId), count: e.count })),
    siteTopInteractors: data.siteTopInteractors.map(e => ({ name: nameOf(e.userId), count: e.count })),
    siteTotalInteractions: data.siteTotalInteractions,
    siteActiveMembers: data.siteActiveMembers,
    myPosition: data.myPosition,
    movement: data.movement,
    featureNote: digestFeatureNote(ctxArgs.now, locale),
    peopleUrl: `${ctxArgs.appUrl}/people`,
    rankingsUrl: `${ctxArgs.appUrl}/rankings`,
    unsubscribeUrl,
    settingsUrl: `${ctxArgs.appUrl}/settings`,
    supportEmail: SUPPORT_EMAIL,
    includePostalAddress: true
  }
  return {
    message: digestEmail(locale, input),
    total,
    headers: {
      'List-Unsubscribe': `<${oneClickUrl}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'
    }
  }
}

async function settleDigest(
  ctx: ActionCtx,
  user: Doc<'users'>,
  ctxArgs: { now: number; secret: string; appUrl: string; siteUrl: string }
): Promise<void> {
  // The sweep filtered a page read earlier; an unsubscribe (or ban, or deletion request) can land while this
  // member waits in the send loop. Re-read now and let isDigestDue decide: opt-out wins over the queued send.
  const fresh = await ctx.runQuery(internal.jobs.digest.getUserForSend, { userId: user._id })
  if (!fresh || !isDigestDue(fresh, ctxArgs.now)) return
  const { message, total, headers } = await composeDigest(ctx, fresh, ctxArgs)
  if (total === 0) return // empty digest is spam; skip until there is something to report
  const result = await sendEmail({
    to: fresh.email!,
    subject: message.subject,
    html: message.html,
    text: message.text,
    headers
  })
  if (result.sent) await ctx.runMutation(internal.jobs.digest.markDigestSent, { userId: fresh._id })
}
