// R22 — personal and site-wide rankings. Personal blocks aggregate the existing log on demand (same 2000-row
// ceiling as the people lists); the site board reads the daily rankingSnapshots. Names are joined at read time and
// banned or opted-out members are dropped there, never at write time.
import { query } from './_generated/server'
import { v } from 'convex/values'
import type { Doc, Id } from './_generated/dataModel'
import { requireAuth } from './lib/auth'
import { RECAP_ROW_CEILING, windowBounds } from './lib/recap'
import { tallyMadeByPerson, tallyReceivedByPerson, type InteractionRow } from './lib/interactionGraph'
import { movement, pickPreviousGeneration, positionOf } from './lib/ranking'
import { toSearchPerson } from './search'

/** Rows shown per site board after banned/opt-out filtering (the snapshot stores up to 100). */
const TOP_LIST = 20

function toRows(rows: Doc<'userInteractions'>[]): InteractionRow[] {
  return rows.map(r => ({
    _creationTime: r._creationTime,
    userId: r.userId as string,
    authorId: r.authorId as string | undefined,
    postId: r.postId as string,
    kind: r.kind,
    reaction: r.reaction
  }))
}

async function withProfiles<T extends { userId: string }>(ctx: Parameters<typeof requireAuth>[0], tallies: T[]) {
  const ids = [...new Set(tallies.map(t => t.userId))]
  const users = await Promise.all(ids.map(id => ctx.db.get(id as Id<'users'>)))
  const map = new Map(
    users
      .filter((u): u is Doc<'users'> => u !== null && !u.isBanned && u.deletionScheduledAt === undefined)
      .map(u => [u._id as string, u])
  )
  return tallies.flatMap(t => {
    const user = map.get(t.userId)
    return user ? [{ ...t, ...toSearchPerson(user) }] : []
  })
}

export const getMyRankings = query({
  args: { sessionToken: v.string(), window: v.union(v.literal('7d'), v.literal('30d')), now: v.number() },
  handler: async (ctx, { sessionToken, window, now }) => {
    const user = await requireAuth(ctx, sessionToken)
    const { since } = windowBounds(window, now)
    const receivedRows = await ctx.db
      .query('userInteractions')
      .withIndex('by_author', q => q.eq('authorId', user._id).gte('_creationTime', since))
      .order('desc')
      .take(RECAP_ROW_CEILING)
    const madeRows = await ctx.db
      .query('userInteractions')
      .withIndex('by_user', q => q.eq('userId', user._id).gte('_creationTime', since))
      .order('desc')
      .take(RECAP_ROW_CEILING)
    const received = tallyReceivedByPerson(toRows(receivedRows), since).slice(0, 10)
    const made = tallyMadeByPerson(toRows(madeRows), since).slice(0, 10)
    return {
      window,
      since,
      truncated: receivedRows.length >= RECAP_ROW_CEILING || madeRows.length >= RECAP_ROW_CEILING,
      received: await withProfiles(ctx, received),
      made: await withProfiles(ctx, made)
    }
  }
})

export const getSiteRankings = query({
  args: { sessionToken: v.string(), window: v.union(v.literal('7d'), v.literal('30d')) },
  handler: async (ctx, { sessionToken, window }) => {
    const user = await requireAuth(ctx, sessionToken)
    const generations = await ctx.db
      .query('rankingSnapshots')
      .withIndex('by_window_and_generated_at', q => q.eq('window', window))
      .order('desc')
      .take(4)
    const latest = generations[0]
    if (!latest) {
      return { window, generatedAt: null, partial: false, interactors: [], posters: [], me: null }
    }
    const previous = pickPreviousGeneration([...generations].slice(1), latest.generatedAt - 1)

    // Old generations carry neither enrichment field; the read defaults them to 0 so the UI always has a number.
    async function decorate(
      list: ReadonlyArray<{
        userId: Id<'users'>
        count: number
        lastAt: number
        reactionsReceived?: number
        postsTouched?: number
      }>
    ) {
      const ids = list.map(e => e.userId)
      const users = await Promise.all(ids.map(id => ctx.db.get(id)))
      const map = new Map(
        users
          .filter((u): u is Doc<'users'> => u !== null)
          .filter(u => !u.isBanned && u.deletionScheduledAt === undefined)
          .map(u => [u._id as string, u])
      )
      return list.flatMap(entry => {
        const owner = map.get(entry.userId as string)
        if (!owner || owner.leaderboardOptOut === true) return []
        return [
          {
            ...toSearchPerson(owner),
            userId: owner._id as string,
            count: entry.count,
            lastAt: entry.lastAt,
            reactionsReceived: entry.reactionsReceived ?? 0,
            postsTouched: entry.postsTouched ?? 0
          }
        ]
      })
    }

    const interactors = (await decorate(latest.topInteractors)).slice(0, TOP_LIST)
    const posters = (await decorate(latest.topPosters)).slice(0, TOP_LIST)

    // The board stores identities only for the top 100, so the member's own count for the window is read live from
    // their made interactions (same bounded pattern as getMyRankings). Position then comes from the full counts
    // distribution, which is what makes "you are #87" possible beyond the top 100.
    const myRows = await ctx.db
      .query('userInteractions')
      .withIndex('by_user', q => q.eq('userId', user._id).gte('_creationTime', latest.since))
      .order('desc')
      .take(RECAP_ROW_CEILING)
    const countNow = myRows.filter(
      r => r.kind !== 'ai_draft' && (r.authorId === undefined || r.authorId !== user._id)
    ).length
    const findCount = (list: Doc<'rankingSnapshots'>['topInteractors']) =>
      list.find(e => e.userId === user._id)?.count ?? 0
    const prevCount = previous ? findCount(previous.topInteractors) : 0
    const currentPosition = countNow > 0 ? positionOf(countNow, latest.interactorCountsDescending) : null
    const previousPosition =
      previous && prevCount > 0 ? positionOf(prevCount, previous.interactorCountsDescending) : null

    return {
      window,
      generatedAt: latest.generatedAt,
      partial: latest.partial,
      interactors,
      posters,
      me: {
        id: user._id as string,
        count: countNow,
        position: currentPosition,
        movement: movement(previousPosition, currentPosition),
        optedOut: user.leaderboardOptOut === true
      }
    }
  }
})
