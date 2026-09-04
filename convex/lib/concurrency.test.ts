import { describe, it, expect } from 'vitest'
import { settledInBatches } from './concurrency'

describe('settledInBatches', () => {
  it('runs every item and preserves input order in the results', async () => {
    const results = await settledInBatches([1, 2, 3, 4, 5], 2, async n => n * 10)
    expect(results.map(r => (r.status === 'fulfilled' ? r.value : null))).toEqual([10, 20, 30, 40, 50])
  })

  it('never rejects — a failing item becomes a rejected result, the rest still run', async () => {
    const results = await settledInBatches([1, 2, 3], 2, async n => {
      if (n === 2) throw new Error('boom')
      return n
    })
    expect(results.map(r => r.status)).toEqual(['fulfilled', 'rejected', 'fulfilled'])
  })

  it('caps concurrency to `size` — never more than `size` items run at once', async () => {
    let active = 0
    let peak = 0
    await settledInBatches([1, 2, 3, 4, 5, 6, 7], 3, async () => {
      active++
      peak = Math.max(peak, active)
      await Promise.resolve() // yield so overlapping calls accumulate before any resolves
      active--
    })
    expect(peak).toBeLessThanOrEqual(3)
  })

  it('treats size < 1 as 1 instead of looping forever', async () => {
    const results = await settledInBatches([1, 2], 0, async n => n)
    expect(results).toHaveLength(2)
  })
})
