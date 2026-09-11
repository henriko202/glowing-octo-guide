import { describe, expect, it } from 'vitest'
import {
  countInteractions,
  excerpt,
  excludeSelf,
  floorToHour,
  pickNearCapPost,
  windowBounds,
  windowDays,
  type InteractionLike
} from './recap'

const DAY = 86_400_000
const NOW = 1_800_000_000_000 // arbitrary instant, already exactly on an hour boundary (2027-01-15T08:00:00.000Z)
const T = floorToHour(NOW)

function row(over: Partial<InteractionLike>): InteractionLike {
  return { _creationTime: T - DAY, kind: 'reaction', postId: 'p1', userId: 'u1', authorId: 'a1', ...over }
}

describe('floorToHour', () => {
  it('drops minutes and seconds', () => {
    expect(floorToHour(3_600_000 * 5 + 59_999)).toBe(3_600_000 * 5)
  })
})

describe('windowBounds', () => {
  it('spans 7 or 30 days back and the same span before that', () => {
    expect(windowDays('7d')).toBe(7)
    expect(windowDays('30d')).toBe(30)
    expect(windowBounds('7d', T)).toEqual({ since: T - 7 * DAY, prevSince: T - 14 * DAY, until: T })
    expect(windowBounds('30d', T)).toEqual({ since: T - 30 * DAY, prevSince: T - 60 * DAY, until: T })
  })
})

describe('countInteractions', () => {
  it('is from-inclusive, to-exclusive and counts distinct posts', () => {
    const rows = [
      row({ _creationTime: 100, postId: 'p1' }),
      row({ _creationTime: 150, postId: 'p1', kind: 'comment' }),
      row({ _creationTime: 199, postId: 'p2' }),
      row({ _creationTime: 200, postId: 'p3' }),
      row({ _creationTime: 99, postId: 'p4' })
    ]
    expect(countInteractions(rows, 100, 200)).toEqual({ reactions: 2, comments: 1, drafts: 0, posts: 2, total: 3 })
    expect(countInteractions(rows, 200, Number.POSITIVE_INFINITY)).toEqual({
      reactions: 1,
      comments: 0,
      drafts: 0,
      posts: 1,
      total: 1
    })
    expect(countInteractions([], 0, 1)).toEqual({ reactions: 0, comments: 0, drafts: 0, posts: 0, total: 0 })
  })

  it('files ai_draft rows under drafts, never comments, and counts them in total', () => {
    const rows = [
      row({ _creationTime: 100, postId: 'p1' }),
      row({ _creationTime: 100, postId: 'p1', kind: 'comment' }),
      row({ _creationTime: 100, postId: 'p2', kind: 'ai_draft' }),
      row({ _creationTime: 100, postId: 'p3', kind: 'ai_draft' })
    ]
    expect(countInteractions(rows, 0, 200)).toEqual({ reactions: 1, comments: 1, drafts: 2, posts: 3, total: 4 })
  })
})

describe('excludeSelf', () => {
  it('drops rows where the actor is the author and keeps legacy rows without authorId', () => {
    const rows = [
      row({ userId: 'u1', authorId: 'u1' }),
      row({ userId: 'u2', authorId: 'u1' }),
      row({ userId: 'u1', authorId: undefined })
    ]
    expect(excludeSelf(rows)).toHaveLength(2)
  })
})

describe('excerpt', () => {
  it('collapses whitespace, trims and cuts with an ellipsis', () => {
    expect(excerpt('  hello \n\n world  ')).toBe('hello world')
    const long = 'a'.repeat(200)
    expect(excerpt(long)).toBe('a'.repeat(140) + '…')
    expect(excerpt('short', 10)).toBe('short')
  })
})

describe('pickNearCapPost', () => {
  it('returns the highest-total post inside the 80% band, skipping capped posts', () => {
    const posts = [
      { id: 'low', likeCount: 5, commentCount: 0 },
      { id: 'near', likeCount: 18, commentCount: 3 },
      { id: 'nearer', likeCount: 22, commentCount: 2 },
      { id: 'capped', likeCount: 25, commentCount: 0, interactionLimitReached: true }
    ]
    expect(pickNearCapPost(posts, 25)?.id).toBe('nearer')
    expect(pickNearCapPost([posts[0]], 25)).toBeNull()
    expect(pickNearCapPost([], 25)).toBeNull()
  })

  it('measures a bought post against its plan cap plus its bonus (backlog/R17)', () => {
    // 42 of 25 would be capped; 42 of 25 + 25 = 50 sits inside the 80 % band.
    const bought = { id: 'bought', likeCount: 42, commentCount: 0, interactionCapBonus: 25 }
    expect(pickNearCapPost([bought], 25)?.id).toBe('bought')
  })
})
