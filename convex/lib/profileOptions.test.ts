import { describe, expect, it } from 'vitest'
import {
  COUNTRY_CODES,
  INDUSTRIES,
  industryLabel,
  isValidCountry,
  isValidIndustry,
  parseIndustryCode
} from './profileOptions'

describe('country list', () => {
  it('contains common ISO alpha-2 codes and validates case-insensitively', () => {
    for (const code of ['US', 'BR', 'GB', 'DE', 'JP', 'IN', 'ZA', 'AU']) {
      expect(COUNTRY_CODES).toContain(code)
    }
    expect(COUNTRY_CODES.length).toBeGreaterThanOrEqual(240)
    expect(isValidCountry('br')).toBe(true)
    expect(isValidCountry('BR')).toBe(true)
    expect(isValidCountry('ZZ')).toBe(false)
    expect(isValidCountry('')).toBe(false)
  })

  it('has no duplicate codes', () => {
    expect(new Set(COUNTRY_CODES).size).toBe(COUNTRY_CODES.length)
  })
})

describe('industry list', () => {
  it('is the full taxonomy with unique numeric codes and non-empty labels', () => {
    expect(INDUSTRIES.length).toBeGreaterThanOrEqual(400)
    const codes = INDUSTRIES.map(i => i.code)
    expect(new Set(codes).size).toBe(codes.length)
    for (const { code, label } of INDUSTRIES) {
      expect(code).toMatch(/^\d+$/)
      expect(label.length).toBeGreaterThan(0)
    }
  })

  it('includes labels from across the whole table (completeness guard)', () => {
    const labels = new Set(INDUSTRIES.map(i => i.label))
    for (const required of [
      'Banking',
      'Staffing and Recruiting',
      'Hospitals and Health Care',
      'Software Development',
      'IT Services and IT Consulting',
      'Retail',
      'Real Estate',
      'Telecommunications',
      'Legal Services'
    ]) {
      expect(labels.has(required)).toBe(true)
    }
  })

  it('validates by code', () => {
    expect(isValidIndustry(INDUSTRIES[0].code)).toBe(true)
    expect(isValidIndustry('not-a-code')).toBe(false)
    expect(isValidIndustry('')).toBe(false)
  })

  it('labels a code, and falls back to the code itself when unknown', () => {
    expect(industryLabel('4')).toBe('Software Development')
    expect(industryLabel('99999')).toBe('99999')
  })
})

// The AI industry guess (ai/industry.ts) goes through this parser: only a real code may become a
// profile value, and a NONE reply wins over any number in it (an empty industry beats a wrong one).
describe('parseIndustryCode', () => {
  it('reads a real code out of the reply', () => {
    expect(parseIndustryCode('4')).toBe('4')
    expect(parseIndustryCode(' 96\n')).toBe('96')
    expect(parseIndustryCode('Industry code: 137')).toBe('137')
  })

  it('returns nothing for NONE, an unknown code, or a reply with no code', () => {
    expect(parseIndustryCode('NONE')).toBeUndefined()
    expect(parseIndustryCode('none, closest is 4')).toBeUndefined()
    expect(parseIndustryCode('99999')).toBeUndefined()
    expect(parseIndustryCode('Software Development')).toBeUndefined()
  })
})
