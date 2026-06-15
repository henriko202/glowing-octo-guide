import { describe, it, expect } from 'vitest'
import { checkRateLimit, tryConsumeRateLimit } from './rateLimit'

const DAY_MS = 24 * 60 * 60 * 1000

// Minimal mock ctx: db.query(...).withIndex(...).unique() + patch + insert
function createMockCtx(existing?: any) {
  const inserts: any[] = []
  const patches: any[] = []
  return {
    db: {
      query: () => ({
        withIndex: () => ({ unique: async () => existing ?? null })
      }),
      insert: async (_t: string, d: any) => {
        inserts.push(d)
      },
      patch: async (id: string, d: any) => {
        patches.push({ id, d })
      }
    },
    _inserts: inserts,
    _patches: patches
  } as any
}

describe('checkRateLimit (windowed)', () => {
  it('inserts a fresh counter when none exists', async () => {
    const ctx = createMockCtx()
    await checkRateLimit(ctx, 'u1' as any, 'profile_refresh', 2, DAY_MS, 'day')
    expect(ctx._inserts).toHaveLength(1)
    expect(ctx._inserts[0]).toMatchObject({ action: 'profile_refresh', count: 1 })
  })

  it('increments within the window below the cap', async () => {
    const ctx = createMockCtx({ _id: 'r1', windowStart: Date.now(), count: 1 })
    await checkRateLimit(ctx, 'u1' as any, 'profile_refresh', 2, DAY_MS, 'day')
    expect(ctx._patches[0].d).toEqual({ count: 2 })
  })

  it('throws once the cap is hit within the window', async () => {
    const ctx = createMockCtx({ _id: 'r1', windowStart: Date.now(), count: 2 })
    await expect(checkRateLimit(ctx, 'u1' as any, 'profile_refresh', 2, DAY_MS, 'day')).rejects.toThrow(
      /at most 2 times per day/
    )
  })

  it('resets after the window elapses', async () => {
    const ctx = createMockCtx({ _id: 'r1', windowStart: Date.now() - 2 * DAY_MS, count: 2 })
    await checkRateLimit(ctx, 'u1' as any, 'profile_refresh', 2, DAY_MS, 'day')
    expect(ctx._patches[0].d).toMatchObject({ count: 1 })
  })
})

describe('tryConsumeRateLimit (non-throwing)', () => {
  it('returns true and inserts when no counter exists', async () => {
    const ctx = createMockCtx()
    const allowed = await tryConsumeRateLimit(ctx, 'u1' as any, 'profile_refresh', 2, DAY_MS)
    expect(allowed).toBe(true)
    expect(ctx._inserts[0]).toMatchObject({ action: 'profile_refresh', count: 1 })
  })

  it('returns true and increments below the cap', async () => {
    const ctx = createMockCtx({ _id: 'r1', windowStart: Date.now(), count: 1 })
    const allowed = await tryConsumeRateLimit(ctx, 'u1' as any, 'profile_refresh', 2, DAY_MS)
    expect(allowed).toBe(true)
    expect(ctx._patches[0].d).toEqual({ count: 2 })
  })

  it('returns false WITHOUT incrementing once the cap is reached', async () => {
    const ctx = createMockCtx({ _id: 'r1', windowStart: Date.now(), count: 2 })
    const allowed = await tryConsumeRateLimit(ctx, 'u1' as any, 'profile_refresh', 2, DAY_MS)
    expect(allowed).toBe(false)
    expect(ctx._patches).toHaveLength(0)
  })

  it('returns true and resets after the window elapses', async () => {
    const ctx = createMockCtx({ _id: 'r1', windowStart: Date.now() - 2 * DAY_MS, count: 2 })
    const allowed = await tryConsumeRateLimit(ctx, 'u1' as any, 'profile_refresh', 2, DAY_MS)
    expect(allowed).toBe(true)
    expect(ctx._patches[0].d).toMatchObject({ count: 1 })
  })
})
