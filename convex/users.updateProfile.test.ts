import { describe, it, expect } from 'vitest'
import { updateProfileHandler, assertCanRefresh } from './users'

function createMockDb() {
  const patches: any[] = []
  return {
    patch: async (id: string, data: any) => {
      patches.push({ id, data })
    },
    _patches: patches
  }
}

describe('updateProfileHandler', () => {
  it('patches valid industry + country (country uppercased)', async () => {
    const db = createMockDb()
    await updateProfileHandler(db as any, 'u1', { industry: '41', country: 'br' })
    expect(db._patches[0].data).toEqual({ industry: '41', country: 'BR' })
  })

  it('rejects an unknown industry code', async () => {
    const db = createMockDb()
    await expect(updateProfileHandler(db as any, 'u1', { industry: 'nope' })).rejects.toThrow(/industry/i)
    expect(db._patches).toHaveLength(0)
  })

  it('rejects an unknown country code', async () => {
    const db = createMockDb()
    await expect(updateProfileHandler(db as any, 'u1', { country: 'ZZ' })).rejects.toThrow(/country/i)
  })

  it('clears a field when passed an empty string', async () => {
    const db = createMockDb()
    await updateProfileHandler(db as any, 'u1', { industry: '' })
    expect('industry' in db._patches[0].data).toBe(true)
    expect(db._patches[0].data.industry).toBeUndefined()
  })

  it('patches a trimmed headline', async () => {
    const db = createMockDb()
    await updateProfileHandler(db as any, 'u1', { headline: '  Senior PM · SaaS  ' })
    expect(db._patches[0].data).toEqual({ headline: 'Senior PM · SaaS' })
  })

  it('clears the headline when passed whitespace only', async () => {
    const db = createMockDb()
    await updateProfileHandler(db as any, 'u1', { headline: '   ' })
    expect('headline' in db._patches[0].data).toBe(true)
    expect(db._patches[0].data.headline).toBeUndefined()
  })

  it('rejects a headline longer than 220 characters', async () => {
    const db = createMockDb()
    await expect(updateProfileHandler(db as any, 'u1', { headline: 'x'.repeat(221) })).rejects.toThrow(/headline/i)
    expect(db._patches).toHaveLength(0)
  })
})

describe('assertCanRefresh', () => {
  it('throws without a public identifier', () => {
    expect(() => assertCanRefresh({}, { apifyProfileScrapeEnabled: true })).toThrow(/LinkedIn profile URL/i)
  })
  it('throws when profile scrape is disabled', () => {
    expect(() => assertCanRefresh({ linkedinPublicIdentifier: 'x' }, {})).toThrow(/unavailable/i)
  })
  it('passes when identifier present and scrape enabled', () => {
    expect(() => assertCanRefresh({ linkedinPublicIdentifier: 'x' }, { apifyProfileScrapeEnabled: true })).not.toThrow()
  })
})
