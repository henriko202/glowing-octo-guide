import { describe, it, expect } from 'vitest'
import { isApifyMasterEnabled, isApifyPostSyncEnabled, isApifyProfileScrapeEnabled } from './apify'

describe('apify gate helpers', () => {
  it('master defaults ON when the flag is absent', () => {
    expect(isApifyMasterEnabled(undefined)).toBe(true)
    expect(isApifyMasterEnabled(null)).toBe(true)
    expect(isApifyMasterEnabled({})).toBe(true)
    expect(isApifyMasterEnabled({ apifyEnabled: false })).toBe(false)
  })

  it('post sync requires master AND the post flag', () => {
    expect(isApifyPostSyncEnabled({ apifySyncEnabled: true })).toBe(true) // master absent ⇒ on
    expect(isApifyPostSyncEnabled({ apifyEnabled: true, apifySyncEnabled: true })).toBe(true)
    expect(isApifyPostSyncEnabled({ apifyEnabled: false, apifySyncEnabled: true })).toBe(false)
    expect(isApifyPostSyncEnabled({ apifySyncEnabled: false })).toBe(false)
    expect(isApifyPostSyncEnabled(null)).toBe(false)
  })

  it('profile scrape requires master AND the profile flag (default off)', () => {
    expect(isApifyProfileScrapeEnabled({})).toBe(false)
    expect(isApifyProfileScrapeEnabled({ apifyProfileScrapeEnabled: true })).toBe(true)
    expect(isApifyProfileScrapeEnabled({ apifyEnabled: false, apifyProfileScrapeEnabled: true })).toBe(false)
  })
})
