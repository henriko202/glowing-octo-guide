// Pure aggregation helpers for the interaction graph (R22). Everything here is time-zone free: windows are
// `_creationTime` ranges computed by the caller, so the queries stay stable across renders. An `ai_draft` is not an
// interaction between people and never counts; a self-interaction never counts on either side.
import type { Reaction } from './reactions'

export interface InteractionRow {
  _creationTime: number
  userId: string
  authorId?: string
  postId: string
  kind: 'reaction' | 'comment' | 'ai_draft'
  reaction?: Reaction
}

export interface CounterpartyTally {
  userId: string
  reactions: number
  comments: number
  total: number
  lastAt: number
  reaction?: Reaction
}

interface Acc {
  reactions: number
  comments: number
  lastAt: number
  reaction?: Reaction
  reactionAt?: number
}

function phase(row: InteractionRow, acc: Acc): void {
  if (row.kind === 'reaction') {
    acc.reactions += 1
    // The UI shows what was sent, so track the newest reaction row's value per counterparty.
    if (acc.reactionAt === undefined || row._creationTime > acc.reactionAt) {
      acc.reaction = row.reaction
      acc.reactionAt = row._creationTime
    }
  } else acc.comments += 1
  if (row._creationTime > acc.lastAt) acc.lastAt = row._creationTime
}

function toTallies(map: Map<string, Acc>): CounterpartyTally[] {
  return [...map.entries()].map(([userId, acc]) => ({
    userId,
    reactions: acc.reactions,
    comments: acc.comments,
    total: acc.reactions + acc.comments,
    lastAt: acc.lastAt,
    reaction: acc.reaction
  }))
}

/** total desc, then most recent activity, then userId asc for a stable tie. */
export function sortTallies(tallies: CounterpartyTally[]): CounterpartyTally[] {
  return [...tallies].sort(
    (a, b) => b.total - a.total || b.lastAt - a.lastAt || (a.userId < b.userId ? -1 : a.userId > b.userId ? 1 : 0)
  )
}

function usable(row: InteractionRow, from: number): boolean {
  return row._creationTime >= from && row.kind !== 'ai_draft'
}

/** "Received": groups by actor, excluding self. */
export function tallyReceivedByPerson(rows: InteractionRow[], from: number): CounterpartyTally[] {
  const map = new Map<string, Acc>()
  for (const row of rows) {
    if (!usable(row, from) || row.userId === row.authorId) continue
    const acc = map.get(row.userId) ?? { reactions: 0, comments: 0, lastAt: 0 }
    phase(row, acc)
    map.set(row.userId, acc)
  }
  return sortTallies(toTallies(map))
}

/** "Made": groups by the post author, excluding self and rows with no author (pre-2026-09-07 legacy rows). */
export function tallyMadeByPerson(rows: InteractionRow[], from: number): CounterpartyTally[] {
  const map = new Map<string, Acc>()
  for (const row of rows) {
    if (!usable(row, from)) continue
    const counterpart = row.authorId
    if (!counterpart || counterpart === row.userId) continue
    const acc = map.get(counterpart) ?? { reactions: 0, comments: 0, lastAt: 0 }
    phase(row, acc)
    map.set(counterpart, acc)
  }
  return sortTallies(toTallies(map))
}

export interface PostTally {
  postId: string
  total: number
  lastAt: number
  actors: CounterpartyTally[]
}

/** Accordion shape: received rows grouped by post, actors nested, posts by total then recency. */
export function tallyReceivedByPost(rows: InteractionRow[], from: number): PostTally[] {
  const byPost = new Map<string, InteractionRow[]>()
  for (const row of rows) {
    if (!usable(row, from) || row.userId === row.authorId) continue
    const list = byPost.get(row.postId) ?? []
    list.push(row)
    byPost.set(row.postId, list)
  }
  const posts: PostTally[] = []
  for (const [postId, list] of byPost) {
    const actors = tallyReceivedByPerson(list, from)
    posts.push({
      postId,
      total: actors.reduce((sum, a) => sum + a.total, 0),
      lastAt: actors.reduce((max, a) => Math.max(max, a.lastAt), 0),
      actors
    })
  }
  return posts.sort((a, b) => b.total - a.total || b.lastAt - a.lastAt || (a.postId < b.postId ? -1 : 1))
}

/**
 * Site-wide actor counts for the snapshot (made side, newest activity for the tie-break). `postsTouched` counts
 * DISTINCT postIds per actor — several interactions on one post are one touched post. The per-actor Set lives only
 * inside this function; callers get plain numbers.
 */
export function tallySiteActors(
  rows: InteractionRow[],
  from: number
): Map<string, { count: number; lastAt: number; postsTouched: number }> {
  const map = new Map<string, { count: number; lastAt: number; postIds: Set<string> }>()
  for (const row of rows) {
    if (!usable(row, from)) continue
    if (row.authorId !== undefined && row.userId === row.authorId) continue
    const acc = map.get(row.userId) ?? { count: 0, lastAt: 0, postIds: new Set<string>() }
    acc.count += 1
    acc.postIds.add(row.postId)
    if (row._creationTime > acc.lastAt) acc.lastAt = row._creationTime
    map.set(row.userId, acc)
  }
  return new Map(
    [...map.entries()].map(([userId, acc]) => [
      userId,
      { count: acc.count, lastAt: acc.lastAt, postsTouched: acc.postIds.size }
    ])
  )
}
