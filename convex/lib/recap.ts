// Pure helpers for the recap page (backlog/R15). Everything here is time-zone free: windows are
// computed from a caller-supplied `now` (the client floors it to the hour so the query args stay
// stable across re-renders and Convex can share the subscription).
import { effectiveInteractionCap, isNearInteractionLimit } from './interactionLimit'

export type RecapWindow = '7d' | '30d'

const HOUR = 3_600_000
const DAY = 86_400_000

/** Hard ceiling on rows read per side per query; the page says so when hit. */
export const RECAP_ROW_CEILING = 2000
/** Posts listed in the plan-usage section (newest first). */
export const RECAP_POST_CEILING = 200
export const EXCERPT_LENGTH = 140

export interface RecapCounts {
  reactions: number
  comments: number
  posts: number // distinct posts touched
  total: number
}

export interface WindowBounds {
  since: number
  prevSince: number
  until: number
}

export interface InteractionLike {
  _creationTime: number
  kind: 'reaction' | 'comment'
  postId: string
  userId: string // always present (userInteractions.userId is required); authorId is the optional one
  authorId?: string
}

export function floorToHour(ms: number): number {
  return Math.floor(ms / HOUR) * HOUR
}

export function windowDays(window: RecapWindow): 7 | 30 {
  return window === '7d' ? 7 : 30
}

export function windowBounds(window: RecapWindow, now: number): WindowBounds {
  const span = windowDays(window) * DAY
  return { since: now - span, prevSince: now - 2 * span, until: now }
}

/** Counts rows with from <= _creationTime < to. */
export function countInteractions(rows: InteractionLike[], from: number, to: number): RecapCounts {
  const posts = new Set<string>()
  let reactions = 0
  let comments = 0
  for (const r of rows) {
    if (r._creationTime < from || r._creationTime >= to) continue
    if (r.kind === 'reaction') reactions += 1
    else comments += 1
    posts.add(r.postId)
  }
  return { reactions, comments, posts: posts.size, total: reactions + comments }
}

/** "Received" never counts what the author did on their own post. */
export function excludeSelf<T extends { userId: string; authorId?: string }>(rows: T[]): T[] {
  return rows.filter(r => r.authorId !== r.userId)
}

export function excerpt(content: string, max = EXCERPT_LENGTH): string {
  const flat = content.replace(/\s+/g, ' ').trim()
  return flat.length > max ? `${flat.slice(0, max)}…` : flat
}

/** The post closest to the cap (highest total inside the nudge band), or null. */
export function pickNearCapPost<
  T extends {
    likeCount: number
    commentCount: number
    interactionLimitReached?: boolean
    interactionCapBonus?: number
  }
>(posts: T[], cap: number): T | null {
  let best: T | null = null
  for (const p of posts) {
    if (p.interactionLimitReached) continue
    const effectiveCap = effectiveInteractionCap(cap, p.interactionCapBonus)
    if (!isNearInteractionLimit(p.likeCount, p.commentCount, effectiveCap)) continue
    if (!best || p.likeCount + p.commentCount > best.likeCount + best.commentCount) best = p
  }
  return best
}
