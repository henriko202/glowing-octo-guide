// R22 — daily site-wide ranking snapshot. One bounded pass per window: read the newest interactions and posts,
// tally, write one rankingSnapshots row, keep the newest 4 generations per window (movement + digest lookback).
// DEVIATION from spec §5.6: a single bounded pass with `partial` instead of a cursor chain, see the plan header.
import { internalMutation } from '../_generated/server'
import { v } from 'convex/values'
import type { MutationCtx } from '../_generated/server'
import type { Doc, Id } from '../_generated/dataModel'
import { tallySiteActors, type InteractionRow } from '../lib/interactionGraph'
import { capDistribution, topEntries } from '../lib/ranking'

export const SNAPSHOT_ROW_CEILING = 10_000
// Convex hard-caps arrays at 8,192 elements; one count per distinct active member can pass that. 8,000 leaves
// headroom, and the dropped tail only ever costs an exact position for the lowest-activity members.
export const MAX_DISTRIBUTION = 8_000
const TOP_LIST = 100
const KEEP_GENERATIONS = 4
const DAY = 86_400_000

const WINDOW_MS: Record<'7d' | '30d', number> = { '7d': 7 * DAY, '30d': 30 * DAY }

type SnapshotEntry = { userId: Id<'users'>; count: number; lastAt: number }

function asInteractionRows(rows: Doc<'userInteractions'>[]): InteractionRow[] {
  return rows.map(r => ({
    _creationTime: r._creationTime,
    userId: r.userId,
    authorId: r.authorId,
    postId: r.postId,
    kind: r.kind
  }))
}

async function trimGenerations(ctx: MutationCtx, window: '7d' | '30d'): Promise<void> {
  const all = await ctx.db
    .query('rankingSnapshots')
    .withIndex('by_window_and_generated_at', q => q.eq('window', window))
    .order('desc')
    .collect()
  for (const row of all.slice(KEEP_GENERATIONS)) await ctx.db.delete(row._id)
}

export const rebuildRankingSnapshots = internalMutation({
  args: { window: v.union(v.literal('7d'), v.literal('30d')) },
  handler: async (ctx, { window }) => {
    const now = Date.now()
    const since = now - WINDOW_MS[window]

    const interactionRows = await ctx.db.query('userInteractions').order('desc').take(SNAPSHOT_ROW_CEILING)
    const relevantInteractions = asInteractionRows(interactionRows).filter(r => r._creationTime >= since)
    const interactorMap = tallySiteActors(relevantInteractions, since)

    const postRows = await ctx.db.query('posts').order('desc').take(SNAPSHOT_ROW_CEILING)
    const posterMap = new Map<string, { count: number; lastAt: number }>()
    for (const post of postRows) {
      if (post.publishedAt < since || post.hidden || post.deletedAt !== undefined) continue
      const acc = posterMap.get(post.authorId) ?? { count: 0, lastAt: 0 }
      acc.count += 1
      if (post.publishedAt > acc.lastAt) acc.lastAt = post.publishedAt
      posterMap.set(post.authorId, acc)
    }

    const topInteractors = topEntries(interactorMap, TOP_LIST) as SnapshotEntry[]
    const topPosters = topEntries(posterMap, TOP_LIST) as SnapshotEntry[]
    const interactorCounts = capDistribution(
      [...interactorMap.values()].map(v => v.count).sort((a, b) => b - a),
      MAX_DISTRIBUTION
    )
    const posterCounts = capDistribution(
      [...posterMap.values()].map(v => v.count).sort((a, b) => b - a),
      MAX_DISTRIBUTION
    )
    await ctx.db.insert('rankingSnapshots', {
      window,
      generatedAt: now,
      since,
      topInteractors,
      topPosters,
      interactorCountsDescending: interactorCounts.counts,
      posterCountsDescending: posterCounts.counts,
      partial:
        interactionRows.length === SNAPSHOT_ROW_CEILING ||
        postRows.length === SNAPSHOT_ROW_CEILING ||
        interactorCounts.capped ||
        posterCounts.capped
    })
    await trimGenerations(ctx, window)
  }
})
