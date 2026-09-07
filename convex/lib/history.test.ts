import { describe, expect, it } from 'vitest'
import { toHistoryRow } from './history'

const base = { _id: 'i1', kind: 'comment' as const, comment: 'Nice', createdAt: 5 }
const post = {
  _id: 'p1',
  linkedinPostUrn: 'urn:li:share:1',
  sourceUrl: undefined,
  content: '  Hello   world ',
  hidden: false,
  deletedAt: undefined
}

describe('toHistoryRow', () => {
  it('maps a live post with its author and excerpt', () => {
    expect(toHistoryRow(base, post, { name: 'Ana' })).toEqual({
      id: 'i1',
      kind: 'comment',
      reaction: undefined,
      comment: 'Nice',
      createdAt: 5,
      post: {
        id: 'p1',
        linkedinPostUrn: 'urn:li:share:1',
        sourceUrl: undefined,
        excerpt: 'Hello world',
        authorName: 'Ana',
        removed: false
      }
    })
  })
  it('marks hidden or deleted posts removed and falls back to an empty author name', () => {
    expect(toHistoryRow(base, { ...post, hidden: true }, null).post?.removed).toBe(true)
    expect(toHistoryRow(base, { ...post, deletedAt: 1 }, null).post?.removed).toBe(true)
    expect(toHistoryRow(base, post, null).post?.authorName).toBe('')
  })
  it('returns post: null when the post row is gone', () => {
    expect(toHistoryRow(base, null, null).post).toBeNull()
  })
})
