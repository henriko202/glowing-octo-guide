import { describe, it, expect } from 'vitest'
import { setPostVisibilityHandler } from './users'

function createMockDb() {
  const patches: any[] = []
  return {
    patch: async (id: string, data: any) => {
      patches.push({ id, data })
    },
    _patches: patches
  }
}

describe('setPostVisibilityHandler', () => {
  it('patches valid industries + countries (countries uppercased)', async () => {
    const db = createMockDb()
    await setPostVisibilityHandler(db as any, 'u1', 'pro', { industries: ['4', '41'], countries: ['br', 'us'] })
    expect(db._patches[0].data).toEqual({
      defaultVisibilityIndustries: ['4', '41'],
      defaultVisibilityCountries: ['BR', 'US']
    })
  })

  it('allows the contact tier too', async () => {
    const db = createMockDb()
    await expect(
      setPostVisibilityHandler(db as any, 'u1', 'contact', { industries: [], countries: [] })
    ).resolves.toBeUndefined()
  })

  it('rejects starter/growth tiers and no tier at all — server-side gate', async () => {
    const db = createMockDb()
    for (const tier of ['starter', 'growth', undefined]) {
      await expect(setPostVisibilityHandler(db as any, 'u1', tier, { industries: [], countries: [] })).rejects.toThrow(
        /pro or contact/i
      )
    }
    expect(db._patches).toHaveLength(0)
  })

  it('rejects an unknown industry code', async () => {
    const db = createMockDb()
    await expect(
      setPostVisibilityHandler(db as any, 'u1', 'pro', { industries: ['nope'], countries: [] })
    ).rejects.toThrow(/industry/i)
    expect(db._patches).toHaveLength(0)
  })

  it('rejects an unknown country code', async () => {
    const db = createMockDb()
    await expect(
      setPostVisibilityHandler(db as any, 'u1', 'pro', { industries: [], countries: ['ZZ'] })
    ).rejects.toThrow(/country/i)
    expect(db._patches).toHaveLength(0)
  })

  it('clears both lists when passed empty arrays (invariant: empty = visible to everyone)', async () => {
    const db = createMockDb()
    await setPostVisibilityHandler(db as any, 'u1', 'pro', { industries: [], countries: [] })
    expect(db._patches[0].data).toEqual({ defaultVisibilityIndustries: [], defaultVisibilityCountries: [] })
  })
})
