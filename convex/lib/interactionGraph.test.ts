import { describe, expect, it } from 'vitest'
import {
  sortTallies,
  tallyMadeByPerson,
  tallyReceivedByPerson,
  tallyReceivedByPost,
  tallySiteActors,
  type InteractionRow
} from './interactionGraph'

const FROM = 1_000

function row(over: Partial<InteractionRow> = {}): InteractionRow {
  return { _creationTime: 2_000, userId: 'me', authorId: 'other', postId: 'p1', kind: 'reaction', ...over }
}

describe('tallyReceivedByPerson', () => {
  it('groups by actor, excludes rows before the window, self and ai_draft', () => {
    const rows = [
      row({ userId: 'ana', kind: 'reaction' }),
      row({ userId: 'ana', kind: 'comment', _creationTime: 3_000 }),
      row({ userId: 'bruno', kind: 'reaction', _creationTime: 4_000 }),
      row({ userId: 'me', authorId: 'me', kind: 'reaction' }), // self, excluded
      row({ userId: 'ana', kind: 'ai_draft' }), // draft, excluded
      row({ userId: 'carla', kind: 'reaction', _creationTime: 500 }) // before window
    ]
    expect(tallyReceivedByPerson(rows, FROM)).toEqual([
      { userId: 'ana', reactions: 1, comments: 1, total: 2, lastAt: 3_000 },
      { userId: 'bruno', reactions: 1, comments: 0, total: 1, lastAt: 4_000 }
    ])
  })
})

describe('tallyMadeByPerson', () => {
  it('groups by author and skips rows without authorId and self rows', () => {
    const rows = [
      row({ userId: 'me', authorId: 'ana' }),
      row({ userId: 'me', authorId: 'ana', kind: 'comment', _creationTime: 3_000 }),
      row({ userId: 'me', authorId: 'bruno', kind: 'reaction', _creationTime: 4_000 }),
      row({ userId: 'me', authorId: undefined }), // legacy row, no counterpart
      row({ userId: 'me', authorId: 'me' }) // self, excluded
    ]
    expect(tallyMadeByPerson(rows, FROM)).toEqual([
      { userId: 'ana', reactions: 1, comments: 1, total: 2, lastAt: 3_000 },
      { userId: 'bruno', reactions: 1, comments: 0, total: 1, lastAt: 4_000 }
    ])
  })
})

describe('tallyReceivedByPost', () => {
  it('groups rows by post with nested actors, newest activity wins ties', () => {
    const rows = [
      row({ userId: 'ana', postId: 'p1', kind: 'reaction' }),
      row({ userId: 'ana', postId: 'p1', kind: 'comment', _creationTime: 3_000 }),
      row({ userId: 'bruno', postId: 'p2', kind: 'reaction', _creationTime: 4_000 })
    ]
    expect(tallyReceivedByPost(rows, FROM)).toEqual([
      {
        postId: 'p1',
        total: 2,
        lastAt: 3_000,
        actors: [{ userId: 'ana', reactions: 1, comments: 1, total: 2, lastAt: 3_000 }]
      },
      {
        postId: 'p2',
        total: 1,
        lastAt: 4_000,
        actors: [{ userId: 'bruno', reactions: 1, comments: 0, total: 1, lastAt: 4_000 }]
      }
    ])
  })
})

describe('tallySiteActors', () => {
  it('counts made interactions per actor, excluding ai_draft and self when detectable', () => {
    const rows = [
      row({ userId: 'ana', authorId: 'bruno' }),
      row({ userId: 'ana', authorId: 'carla', kind: 'comment' }),
      row({ userId: 'bruno', authorId: 'me' }),
      row({ userId: 'ana', authorId: 'ana' }), // self, excluded
      row({ userId: 'bruno', authorId: 'me', kind: 'ai_draft' }) // draft, excluded
    ]
    const map = tallySiteActors(rows, FROM)
    expect(map.get('ana')).toEqual({ count: 2, lastAt: 2_000 })
    expect(map.get('bruno')).toEqual({ count: 1, lastAt: 2_000 })
    expect(map.size).toBe(2)
  })
})

describe('sortTallies', () => {
  it('sorts by total desc, then lastAt desc, then userId asc', () => {
    const sorted = sortTallies([
      { userId: 'b', reactions: 1, comments: 0, total: 1, lastAt: 100 },
      { userId: 'a', reactions: 1, comments: 0, total: 1, lastAt: 100 },
      { userId: 'c', reactions: 1, comments: 0, total: 1, lastAt: 200 }
    ])
    expect(sorted.map(t => t.userId)).toEqual(['c', 'a', 'b'])
  })
})
