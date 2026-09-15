// R22 — personal and site-wide rankings. Personal blocks aggregate the existing log on demand (same 2000-row
// ceiling as the people lists); the site board reads the daily rankingSnapshots. Names are joined at read time and
// banned or opted-out members are dropped there, never at write time.
import { internalQuery, query } from './_generated/server'
import { v } from 'convex/values'
import type { Doc, Id } from './_generated/dataModel'
import { requireAuth } from './lib/auth'
import { RECAP_ROW_CEILING, windowBounds } from './lib/recap'
import { tallyMadeByPerson, tallyReceivedByPerson, type InteractionRow } from './lib/interactionGraph'
import { movement, pickPreviousGeneration, positionOf, rankPositions } from './lib/ranking'
import { toSearchPerson } from './search'

/** Rows shown per site board after banned/opt-out filtering (the snapshot stores up to 100). */
const TOP_LIST = 20

/** Posts read per author when counting their window posts; the 200 cap bounds the read. */
const POSTS_COUNT_CAP = 200

/** The author's visible posts published since `since`, respecting the POSTS_COUNT_CAP bound. */
async function countVisiblePostsSince(
  ctx: Parameters<typeof requireAuth>[0],
  authorId: Id<'users'>,
  since: number
): Promise<number> {
  const posts = await ctx.db
    .query('posts')
    .withIndex('by_author_and_publishedAt', q => q.eq('authorId', authorId).gte('publishedAt', since))
    .order('desc')
    .take(POSTS_COUNT_CAP)
  return posts.filter(p => p.hidden !== true && p.deletedAt === undefined).length
}

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

async function withProfiles<T extends { userId: string }>(
  ctx: Parameters<typeof requireAuth>[0],
  tallies: T[],
  since: number
) {
  const ids = [...new Set(tallies.map(t => t.userId))]
  const users = await Promise.all(ids.map(id => ctx.db.get(id as Id<'users'>)))
  const map = new Map(
    users
      .filter((u): u is Doc<'users'> => u !== null && !u.isBanned && u.deletionScheduledAt === undefined)
      .map(u => [u._id as string, u])
  )
  const visible = tallies.flatMap(t => {
    const user = map.get(t.userId)
    return user ? [{ tally: t, user }] : []
  })
  const postsCounts = await Promise.all(visible.map(({ user }) => countVisiblePostsSince(ctx, user._id, since)))
  return visible.map(({ tally, user }, i) => ({ ...tally, ...toSearchPerson(user), postsCount: postsCounts[i] }))
}

/** Users a board may show: present, not banned, not pending deletion. Returns an id → doc map. */
async function visibleUserMap(ctx: Parameters<typeof requireAuth>[0], ids: Id<'users'>[]) {
  const users = await Promise.all(ids.map(id => ctx.db.get(id)))
  return new Map(
    users
      .filter((u): u is Doc<'users'> => u !== null && !u.isBanned && u.deletionScheduledAt === undefined)
      .map(u => [u._id as string, u])
  )
}

/** Drop banned/pending-deletion/opted-out members from a snapshot list before positions are assigned. */
async function visibleSnapshotList<T extends { userId: Id<'users'> }>(
  ctx: Parameters<typeof requireAuth>[0],
  list: ReadonlyArray<T>
): Promise<T[]> {
  const map = await visibleUserMap(
    ctx,
    list.map(e => e.userId)
  )
  return list.filter(e => {
    const owner = map.get(e.userId as string)
    return owner !== undefined && owner.leaderboardOptOut !== true
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
      received: await withProfiles(ctx, received, since),
      made: await withProfiles(ctx, made, since)
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
      const map = await visibleUserMap(
        ctx,
        list.map(e => e.userId)
      )
      const visible = list.filter(entry => {
        const owner = map.get(entry.userId as string)
        return owner !== undefined && owner.leaderboardOptOut !== true
      })
      // Positions are recomputed over the filtered list, so a hidden member never leaves a gap in the numbering.
      const positions = rankPositions(visible.map(e => e.count))
      return visible.flatMap((entry, i) => {
        const owner = map.get(entry.userId as string)
        if (!owner) return []
        return [
          {
            ...toSearchPerson(owner),
            userId: owner._id as string,
            count: entry.count,
            lastAt: entry.lastAt,
            reactionsReceived: entry.reactionsReceived ?? 0,
            postsTouched: entry.postsTouched ?? 0,
            position: positions[i]
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
    // Reaching the next position means tying the member above, so the gap is their count minus the live count.
    const gapToNext =
      currentPosition !== null && currentPosition > 1
        ? latest.interactorCountsDescending[currentPosition - 2] - countNow
        : null

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
        gapToNext,
        movement: movement(previousPosition, currentPosition),
        optedOut: user.leaderboardOptOut === true
      }
    }
  }
})

/**
 * RCD — the trial near-end email's graph summary: all-time distinct people both directions, received
 * counts, and the member's live 7d board position with the gap to the next place. Reads are bounded to
 * the recap ceiling per side and the newest 7d snapshot; list/self/ai_draft rules are the same pure
 * tallies the people pages use.
 */
export const getTrialGraphSummary = internalQuery({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }) => {
    const user = await ctx.db.get(userId)
    if (!user) return null
    const madeRows = await ctx.db
      .query('userInteractions')
      .withIndex('by_user', q => q.eq('userId', userId))
      .order('desc')
      .take(RECAP_ROW_CEILING)
    const receivedRows = await ctx.db
      .query('userInteractions')
      .withIndex('by_author', q => q.eq('authorId', userId))
      .order('desc')
      .take(RECAP_ROW_CEILING)
    const made = tallyMadeByPerson(toRows(madeRows), 0)
    const received = tallyReceivedByPerson(toRows(receivedRows), 0)
    const latest = (
      await ctx.db
        .query('rankingSnapshots')
        .withIndex('by_window_and_generated_at', q => q.eq('window', '7d'))
        .order('desc')
        .take(1)
    )[0]
    let position: number | null = null
    let gapToNext: number | null = null
    if (latest) {
      const countNow = madeRows.filter(
        r =>
          r._creationTime >= latest.since &&
          r.kind !== 'ai_draft' &&
          (r.authorId === undefined || r.authorId !== userId)
      ).length
      position = countNow > 0 ? positionOf(countNow, latest.interactorCountsDescending) : null
      gapToNext = position !== null && position > 1 ? latest.interactorCountsDescending[position - 2] - countNow : null
    }
    return {
      peopleMade: made.length,
      peopleReceived: received.length,
      receivedReactions: received.reduce((sum, t) => sum + t.reactions, 0),
      receivedComments: received.reduce((sum, t) => sum + t.comments, 0),
      position,
      gapToNext
    }
  }
})

/**
 * RCD — the top three of the newest 7d board, for medal treatment in the UI. Same read-time filters as
 * getSiteRankings (banned / pending deletion / opted out drop before positions are assigned). The
 * member only needs a session; no snapshot yet ⇒ empty arrays.
 */
export const getWeeklyTop = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    await requireAuth(ctx, sessionToken)
    const latest = (
      await ctx.db
        .query('rankingSnapshots')
        .withIndex('by_window_and_generated_at', q => q.eq('window', '7d'))
        .order('desc')
        .take(1)
    )[0]
    if (!latest) return { generatedAt: null, posters: [], interactors: [] }
    const top = async (list: ReadonlyArray<{ userId: Id<'users'> }>) =>
      (await visibleSnapshotList(ctx, list))
        .slice(0, 3)
        .map((e, i) => ({ userId: e.userId as string, position: (i + 1) as 1 | 2 | 3 }))
    return {
      generatedAt: latest.generatedAt,
      posters: await top(latest.topPosters),
      interactors: await top(latest.topInteractors)
    }
  }
})
