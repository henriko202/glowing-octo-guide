import { describe, expect, it } from 'vitest'
import { cohortPageUsers } from './survivalSnapshot'

// Pages arrive in `_creationTime` order, NOT necessarily `createdAt` order: `createdAt` is a
// user-recorded signup value, so a backdated signup can follow an older one. The helper therefore
// only filters the page; the walk continues to `isDone` instead of stopping at the first row
// older than `since`.
describe('cohortPageUsers', () => {
  const since = 1_000

  it('keeps only the rows inside the window', () => {
    expect(cohortPageUsers([{ createdAt: 1_500 }, { createdAt: 1_100 }], since).map(u => u.createdAt)).toEqual([
      1_500, 1_100
    ])
  })

  it('drops older rows without ending the walk (backdated rows may follow)', () => {
    const page = [{ createdAt: 1_200 }, { createdAt: 999 }, { createdAt: 1_100 }]
    expect(cohortPageUsers(page, since).map(u => u.createdAt)).toEqual([1_200, 1_100])
  })

  it('keeps a row exactly at `since` (half-open window)', () => {
    expect(cohortPageUsers([{ createdAt: 1_000 }, { createdAt: 999 }], since)).toEqual([{ createdAt: 1_000 }])
  })

  it('handles an empty page', () => {
    expect(cohortPageUsers([], since)).toEqual([])
  })
})
