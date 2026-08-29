import { describe, it, expect } from 'vitest'
import { shouldPredictReaction } from './syncPostsApify'
import type { Id } from '../_generated/dataModel'

const postId = 'p1' as Id<'posts'>

// shouldPredictReaction is the created-vs-existing gate behind backlog/B09: predictReaction must
// fire once for a genuinely new Apify-synced post, and never on a re-sync (update branch) or an
// over-the-weekly-limit insert (queue branch) — those must not burn OpenRouter spend on repeat
// cron ticks.
describe('shouldPredictReaction', () => {
  it('fires on a genuine insert (created=true, real postId)', () => {
    expect(shouldPredictReaction({ postId, created: true })).toBe(true)
  })

  it('does not fire on the update branch (re-sync of an existing URN)', () => {
    expect(shouldPredictReaction({ postId, created: false })).toBe(false)
  })

  it('does not fire on the queue branch (over the weekly limit, no post row created)', () => {
    expect(shouldPredictReaction({ postId: null, created: false })).toBe(false)
  })

  it('does not fire without a postId even if created were somehow true (defensive)', () => {
    expect(shouldPredictReaction({ postId: null, created: true })).toBe(false)
  })
})
