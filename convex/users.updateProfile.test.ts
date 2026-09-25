import { describe, expect, it } from 'vitest'
import { assertCanRefresh, fillGuessedProfileHandler, MAX_HEADLINE_LENGTH, updateProfileHandler } from './users'

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
    expect(db._patches[0].data).toEqual({ industry: '41', country: 'BR', profileEditedAt: expect.any(Number) })
  })

  // The marker is what stops the automatic guesses: a field the member cleared must stay cleared.
  it('stamps profileEditedAt when industry or country is saved, even as a clear', async () => {
    const db = createMockDb()
    await updateProfileHandler(db as any, 'u1', { country: '' })
    expect(db._patches[0].data.profileEditedAt).toEqual(expect.any(Number))
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

  it('accepts a headline exactly at the max length', async () => {
    const db = createMockDb()
    const atLimit = 'x'.repeat(MAX_HEADLINE_LENGTH)
    await updateProfileHandler(db as any, 'u1', { headline: atLimit })
    expect(db._patches[0].data.headline).toBe(atLimit)
  })

  it('rejects a headline longer than the max length', async () => {
    const db = createMockDb()
    await expect(
      updateProfileHandler(db as any, 'u1', { headline: 'x'.repeat(MAX_HEADLINE_LENGTH + 1) })
    ).rejects.toThrow(/headline/i)
    expect(db._patches).toHaveLength(0)
  })
})

describe('fillGuessedProfileHandler', () => {
  it('fills an empty industry and an empty country (country uppercased)', async () => {
    const db = createMockDb()
    await fillGuessedProfileHandler(db as any, { _id: 'u1' }, { industry: '4', country: 'br' })
    expect(db._patches).toEqual([{ id: 'u1', data: { industry: '4', country: 'BR' } }])
  })

  it('never overwrites a value the member already has', async () => {
    const db = createMockDb()
    await fillGuessedProfileHandler(
      db as any,
      { _id: 'u1', industry: '96', country: 'PT' },
      { industry: '4', country: 'BR' }
    )
    expect(db._patches).toHaveLength(0)
  })

  it('never writes once the member saved the profile form', async () => {
    const db = createMockDb()
    await fillGuessedProfileHandler(db as any, { _id: 'u1', profileEditedAt: 1 }, { industry: '4', country: 'BR' })
    expect(db._patches).toHaveLength(0)
  })

  it('drops a guess that is not a real code', async () => {
    const db = createMockDb()
    await fillGuessedProfileHandler(db as any, { _id: 'u1' }, { industry: '99999', country: 'ZZ' })
    expect(db._patches).toHaveLength(0)
  })
})

describe('assertCanRefresh', () => {
  it('throws without a public identifier', () => {
    expect(() => assertCanRefresh({}, { apifyProfileScrapeEnabled: true })).toThrow(/detect your LinkedIn profile/i)
  })
  it('throws when profile scrape is disabled', () => {
    expect(() => assertCanRefresh({ linkedinPublicIdentifier: 'x' }, {})).toThrow(/unavailable/i)
  })
  it('passes when identifier present and scrape enabled', () => {
    expect(() => assertCanRefresh({ linkedinPublicIdentifier: 'x' }, { apifyProfileScrapeEnabled: true })).not.toThrow()
  })
})
