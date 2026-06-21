import { describe, it, expect } from 'vitest'
import { parseProfileScrapeResult } from './scrapeProfileApify'

const SAMPLE = [
  {
    publicIdentifier: 'henriko202',
    location: {
      linkedinText: 'Curitiba, Paraná, Brazil',
      countryCode: 'BR'
    },
    primaryLocale: { country: 'US', language: 'en' }
  }
]

describe('parseProfileScrapeResult', () => {
  it('maps countryCode → country, linkedinText → location, primaryLocale.language → primaryLocale', () => {
    expect(parseProfileScrapeResult(SAMPLE)).toEqual({
      country: 'BR',
      location: 'Curitiba, Paraná, Brazil',
      primaryLocale: 'en'
    })
  })

  it('returns only the fields present', () => {
    expect(parseProfileScrapeResult([{ location: { countryCode: 'br' } }])).toEqual({ country: 'BR' })
    expect(parseProfileScrapeResult([{ primaryLocale: { language: 'pt' } }])).toEqual({ primaryLocale: 'pt' })
  })

  it('returns {} for empty / non-array / missing fields', () => {
    expect(parseProfileScrapeResult([])).toEqual({})
    expect(parseProfileScrapeResult(undefined)).toEqual({})
    expect(parseProfileScrapeResult([{}])).toEqual({})
  })

  it('extracts a non-empty headline from the dataset item', () => {
    expect(parseProfileScrapeResult([{ headline: 'Senior Product Designer · Fintech' }])).toEqual({
      headline: 'Senior Product Designer · Fintech'
    })
  })

  it('omits headline when blank or absent', () => {
    expect(parseProfileScrapeResult([{ headline: '' }])).toEqual({})
    expect(parseProfileScrapeResult([{ headline: '   ' }])).toEqual({ headline: '   ' })
  })
})
