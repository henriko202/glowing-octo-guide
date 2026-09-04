import { describe, expect, it } from 'vitest'
import { buildEngagementUpdates, postScrapeUrl } from './refreshFeedEngagement'
import type { Id } from '../_generated/dataModel'

const p1 = 'p1' as Id<'posts'>
const p2 = 'p2' as Id<'posts'>

describe('postScrapeUrl', () => {
  it('prefers the stored sourceUrl', () => {
    expect(
      postScrapeUrl({ sourceUrl: 'https://www.linkedin.com/posts/x-123-abc/', linkedinPostUrn: 'urn:li:activity:123' })
    ).toBe('https://www.linkedin.com/posts/x-123-abc/')
  })

  it('reconstructs a feed-update URL from the URN when sourceUrl is absent', () => {
    expect(postScrapeUrl({ linkedinPostUrn: 'urn:li:activity:123' })).toBe(
      'https://www.linkedin.com/feed/update/urn:li:activity:123/'
    )
  })
})

describe('buildEngagementUpdates', () => {
  const idByUrn = new Map<string, Id<'posts'>>([
    ['urn:li:activity:1', p1],
    ['urn:li:activity:2', p2]
  ])

  it('maps matched posts to their fresh counts', () => {
    const updates = buildEngagementUpdates(
      [{ type: 'post', shareUrn: 'urn:li:activity:1', engagement: { likes: 10, comments: 3 } }],
      idByUrn
    )
    expect(updates).toEqual([{ postId: p1, likeCount: 10, commentCount: 3 }])
  })

  it('drops non-post items and unmatched URNs', () => {
    const updates = buildEngagementUpdates(
      [
        { type: 'repost', shareUrn: 'urn:li:activity:1', engagement: { likes: 9, comments: 9 } },
        { type: 'post', shareUrn: 'urn:li:activity:999', engagement: { likes: 5, comments: 5 } }
      ],
      idByUrn
    )
    expect(updates).toEqual([])
  })

  it('skips items with no engagement object (never overwrites real counts with 0)', () => {
    const updates = buildEngagementUpdates([{ type: 'post', shareUrn: 'urn:li:activity:2' }], idByUrn)
    expect(updates).toEqual([])
  })
})
