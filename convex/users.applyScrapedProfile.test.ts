import { describe, it, expect } from 'vitest'
import { applyScrapedProfileHandler } from './users'

function createMockDb(existing?: any) {
  const patches: any[] = []
  return {
    get: async (_id: string) => existing ?? null,
    patch: async (id: string, data: any) => {
      patches.push({ id, data })
    },
    _patches: patches
  }
}

describe('applyScrapedProfileHandler', () => {
  it('sets country (uppercased), location and locale when country is empty', async () => {
    const db = createMockDb({ _id: 'u1' })
    await applyScrapedProfileHandler(db as any, {
      userId: 'u1',
      country: 'br',
      location: 'Curitiba, Paraná, Brazil',
      primaryLocale: 'en'
    })
    expect(db._patches).toHaveLength(1)
    expect(db._patches[0].data).toEqual({
      location: 'Curitiba, Paraná, Brazil',
      primaryLocale: 'en',
      country: 'BR'
    })
  })

  it('does NOT overwrite an existing country but still refreshes location/locale', async () => {
    const db = createMockDb({ _id: 'u1', country: 'US' })
    await applyScrapedProfileHandler(db as any, {
      userId: 'u1',
      country: 'br',
      location: 'Curitiba, Paraná, Brazil',
      primaryLocale: 'pt'
    })
    expect(db._patches[0].data).toEqual({
      location: 'Curitiba, Paraná, Brazil',
      primaryLocale: 'pt'
    })
  })

  it('no-ops when nothing is provided', async () => {
    const db = createMockDb({ _id: 'u1' })
    await applyScrapedProfileHandler(db as any, { userId: 'u1' })
    expect(db._patches).toHaveLength(0)
  })

  it('fills headline when the user has none', async () => {
    const db = createMockDb({ _id: 'u1' })
    await applyScrapedProfileHandler(db as any, { userId: 'u1', headline: 'Senior Product Designer' })
    expect(db._patches[0].data).toEqual({ headline: 'Senior Product Designer' })
  })

  it('does NOT overwrite an existing headline but still refreshes location', async () => {
    const db = createMockDb({ _id: 'u1', headline: 'My own title' })
    await applyScrapedProfileHandler(db as any, { userId: 'u1', headline: 'Scraped title', location: 'Lisbon' })
    expect(db._patches[0].data).toEqual({ location: 'Lisbon' })
  })
})
