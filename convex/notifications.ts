// R23 — in-app notifications. One row per received reaction/comment, written by interactions.increment*. Read paths
// join the actor and the post at query time; banned recipients are filtered here so the row itself is never lost.
import { internalMutation, mutation, query } from './_generated/server'
import { v } from 'convex/values'
import { paginationOptsValidator } from 'convex/server'
import type { Doc, Id } from './_generated/dataModel'
import { internal } from './_generated/api'
import { requireAuth } from './lib/auth'
import type { Reaction } from './lib/reactions'
import { excerpt } from './lib/recap'
import { stripLoneSurrogates } from './lib/safeText'
// Reused rather than copied: the [1, 100] clamp is identical for every cursor-paginated client-facing list.
import { clampHistoryPageSize } from './interactions'

const MARK_ALL_BATCH = 100
// The bell renders "9+" past nine, so the exact number never needs to exceed the cap.
const UNREAD_BADGE_CAP = 10

interface NotificationRow {
  id: string
  kind: 'reaction' | 'comment' | 'record'
  reaction?: Reaction
  excerpt?: string
  total?: number
  createdAt: number
  readAt?: number
  unread: boolean
  actorId: string
  actorName: string
  actorHeadline?: string
  actorPictureUrl?: string
  postExcerpt: string
  postUrn: string
  postSourceUrl?: string
  removed: boolean
}

function isVisibleActor(actor: Doc<'users'> | null): actor is Doc<'users'> {
  return actor !== null && !actor.isBanned && actor.deletionScheduledAt === undefined
}

async function resolveActors(ctx: Parameters<typeof requireAuth>[0], ids: Id<'users'>[]) {
  const unique = [...new Set(ids.map(id => id as string))]
  const users = await Promise.all(unique.map(id => ctx.db.get(id as Id<'users'>)))
  return new Map(users.filter(isVisibleActor).map(u => [u._id as string, u]))
}

async function resolvePosts(ctx: Parameters<typeof requireAuth>[0], ids: Id<'posts'>[]) {
  const unique = [...new Set(ids.map(id => id as string))]
  const posts = await Promise.all(unique.map(id => ctx.db.get(id as Id<'posts'>)))
  return new Map(posts.filter((p): p is Doc<'posts'> => p !== null).map(p => [p._id as string, p]))
}

function toRow(
  row: Doc<'notifications'>,
  actors: Map<string, Doc<'users'>>,
  posts: Map<string, Doc<'posts'>>
): NotificationRow {
  const actor = actors.get(row.actorId as string)
  const post = posts.get(row.postId as string)
  return {
    id: row._id as string,
    kind: row.kind,
    reaction: row.reaction,
    excerpt: row.excerpt === undefined ? undefined : stripLoneSurrogates(row.excerpt),
    total: row.total,
    createdAt: row.createdAt,
    readAt: row.readAt,
    unread: row.readAt === undefined,
    actorId: row.actorId as string,
    actorName: actor?.name ?? '',
    actorHeadline: actor?.headline,
    actorPictureUrl: actor?.profilePictureUrl,
    postExcerpt: post ? excerpt(post.content) : '',
    postUrn: post?.linkedinPostUrn ?? '',
    postSourceUrl: post?.sourceUrl,
    removed: post === undefined || post.deletedAt !== undefined || post.hidden
  }
}

export const listMine = query({
  args: { sessionToken: v.string(), paginationOpts: paginationOptsValidator },
  handler: async (ctx, { sessionToken, paginationOpts }) => {
    const user = await requireAuth(ctx, sessionToken)
    const page = await ctx.db
      .query('notifications')
      .withIndex('by_recipient_and_created_at', q => q.eq('recipientId', user._id))
      .order('desc')
      .paginate({ ...paginationOpts, numItems: clampHistoryPageSize(paginationOpts.numItems) })
    const [actors, posts] = await Promise.all([
      resolveActors(
        ctx,
        page.page.map(r => r.actorId)
      ),
      resolvePosts(
        ctx,
        page.page.map(r => r.postId)
      )
    ])
    const visible = page.page.filter(r => actors.has(r.actorId as string))
    return { ...page, page: visible.map(r => toRow(r, actors, posts)) }
  }
})

/**
 * Counts only VISIBLE unread rows — the same actor predicate as listMine (actor exists, not banned, not pending
 * deletion) — so a row hidden from the inbox can never light the badge. The result is capped at 10 because the
 * bell renders "9+" past nine. The scan is bounded to one mark-all batch, actor reads are cached per id (one
 * actor commonly owns many rows), and the loop stops as soon as the cap is reached.
 */
export const getUnreadCount = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    const user = await requireAuth(ctx, sessionToken)
    const rows = await ctx.db
      .query('notifications')
      .withIndex('by_recipient_and_read_at', q => q.eq('recipientId', user._id).eq('readAt', undefined))
      .take(MARK_ALL_BATCH)
    const cache = new Map<string, boolean>()
    let count = 0
    for (const row of rows) {
      const actorId = row.actorId as string
      let visible = cache.get(actorId)
      if (visible === undefined) {
        visible = isVisibleActor(await ctx.db.get(row.actorId))
        cache.set(actorId, visible)
      }
      if (!visible) continue
      count += 1
      if (count === UNREAD_BADGE_CAP) break
    }
    return count
  }
})

export const getLatest = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    const user = await requireAuth(ctx, sessionToken)
    // Scan a few rows, not just the newest: listMine drops notifications whose actor is banned or pending
    // deletion, and the toast must join the same read path so a stale row can never surface.
    const rows = await ctx.db
      .query('notifications')
      .withIndex('by_recipient_and_created_at', q => q.eq('recipientId', user._id))
      .order('desc')
      .take(10)
    for (const row of rows) {
      const actor = await ctx.db.get(row.actorId)
      if (!actor || actor.isBanned === true || actor.deletionScheduledAt !== undefined) continue
      const post = await ctx.db.get(row.postId)
      return {
        _id: row._id as string,
        actorId: row.actorId as string,
        actorName: actor.name,
        kind: row.kind,
        total: row.total,
        postUrn: post?.linkedinPostUrn ?? '',
        postSourceUrl: post?.sourceUrl,
        removed: post === null || post.deletedAt !== undefined || post.hidden
      }
    }
    return null
  }
})

export const markRead = mutation({
  args: { sessionToken: v.string(), ids: v.array(v.string()) },
  handler: async (ctx, { sessionToken, ids }) => {
    const user = await requireAuth(ctx, sessionToken)
    const now = Date.now()
    for (const raw of ids.slice(0, MARK_ALL_BATCH)) {
      // Client-supplied ids: normalize before get(), so a malformed or foreign-table id is a no-op instead of a
      // thrown transaction that rolls back valid ids earlier in the array (mirrors posts.ts's normalizeId usage).
      const id = ctx.db.normalizeId('notifications', raw)
      if (!id) continue
      const row = await ctx.db.get(id)
      if (!row || row.recipientId !== user._id || row.readAt !== undefined) continue
      await ctx.db.patch(row._id, { readAt: now })
    }
  }
})

function markAllInternal(ctx: Parameters<typeof requireAuth>[0], userId: Id<'users'>) {
  return ctx.db
    .query('notifications')
    .withIndex('by_recipient_and_read_at', q => q.eq('recipientId', userId).eq('readAt', undefined))
    .take(MARK_ALL_BATCH)
}

/**
 * Marks the caller's unread inbox as read, one bounded batch per transaction. A full batch schedules the continuation
 * (internalMutation, same logic, no auth) so a large backlog drains across transactions instead of risking the
 * single-transaction read/write limit; the public mutation returns immediately either way.
 */
export const markAllReadBatch = internalMutation({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }) => {
    const rows = await markAllInternal(ctx, userId)
    const now = Date.now()
    for (const row of rows) await ctx.db.patch(row._id, { readAt: now })
    if (rows.length === MARK_ALL_BATCH) {
      await ctx.scheduler.runAfter(0, internal.notifications.markAllReadBatch, { userId })
    }
  }
})

export const markAllRead = mutation({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    const user = await requireAuth(ctx, sessionToken)
    const rows = await markAllInternal(ctx, user._id)
    const now = Date.now()
    for (const row of rows) await ctx.db.patch(row._id, { readAt: now })
    if (rows.length === MARK_ALL_BATCH) {
      await ctx.scheduler.runAfter(0, internal.notifications.markAllReadBatch, { userId: user._id })
    }
  }
})
