import { describe, expect, it } from 'vitest'
import { guessCountry } from './guessCountry'

describe('guessCountry', () => {
  it('reads the country from the time zone first', () => {
    expect(guessCountry('America/Sao_Paulo', ['en-US'])).toBe('BR')
    expect(guessCountry('America/Argentina/Buenos_Aires', [])).toBe('AR')
  })

  // The engine's tables use ICU ids (Asia/Calcutta); the IANA alias the OS may report still matches.
  it('matches a zone under either of its names', () => {
    expect(guessCountry('Asia/Calcutta', [])).toBe('IN')
    expect(guessCountry('Asia/Kolkata', [])).toBe('IN')
  })

  it('falls back to the region of the first browser language that has one', () => {
    expect(guessCountry('UTC', ['es', 'es-MX', 'en-US'])).toBe('MX')
    expect(guessCountry('UTC', ['pt-BR'])).toBe('BR')
  })

  it('returns nothing rather than a made-up country', () => {
    expect(guessCountry('UTC', ['en', 'es-419', 'not a tag'])).toBeUndefined()
  })
})
