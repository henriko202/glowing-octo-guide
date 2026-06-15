import { describe, it, expect } from 'vitest'
import { COUNTRY_CODES, INDUSTRIES, isValidCountry, isValidIndustry } from './profileOptions'

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
})
