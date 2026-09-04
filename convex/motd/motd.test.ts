import { describe, it, expect } from 'vitest'
import { selectActiveMotd, validateMotdInput, MAX_MOTD_BODY_LENGTH } from './motd'

describe('selectActiveMotd', () => {
  it('returns null when there are no rows', () => {
    expect(selectActiveMotd([], 1000)).toBeNull()
  })

  it('excludes disabled rows', () => {
    expect(selectActiveMotd([{ enabled: false, createdAt: 1 }], 1000)).toBeNull()
  })

  it('returns the newest enabled row within the window', () => {
    const rows = [
      { enabled: true, createdAt: 1 },
      { enabled: true, createdAt: 5 },
      { enabled: true, createdAt: 3 }
    ]
    expect(selectActiveMotd(rows, 1000)?.createdAt).toBe(5)
  })

  it('excludes rows whose startAt is in the future', () => {
    expect(selectActiveMotd([{ enabled: true, createdAt: 1, startAt: 2000 }], 1000)).toBeNull()
  })

  it('excludes rows whose expiresAt has passed', () => {
    expect(selectActiveMotd([{ enabled: true, createdAt: 1, expiresAt: 500 }], 1000)).toBeNull()
  })

  it('includes a row exactly at startAt and strictly before expiresAt', () => {
    const row = { enabled: true, createdAt: 1, startAt: 1000, expiresAt: 2000 }
    expect(selectActiveMotd([row], 1000)).toEqual(row)
  })
})

describe('validateMotdInput', () => {
  it('requires a non-empty English body', () => {
    expect(() => validateMotdInput({ bodies: { pt: 'Olá' } })).toThrow(/English/)
    expect(() => validateMotdInput({ bodies: { en: '   ' } })).toThrow(/English/)
  })

  it('trims bodies and drops empty optional-locale entries', () => {
    expect(validateMotdInput({ bodies: { en: '  hi  ', pt: '   ', es: 'hola' } })).toEqual({
      en: 'hi',
      es: 'hola'
    })
  })

  it('rejects an unsupported locale key', () => {
    expect(() => validateMotdInput({ bodies: { en: 'hi', fr: 'salut' } })).toThrow(/locale/i)
  })

  it('rejects an over-length body', () => {
    const long = 'a'.repeat(MAX_MOTD_BODY_LENGTH + 1)
    expect(() => validateMotdInput({ bodies: { en: long } })).toThrow(/characters or fewer/)
  })

  it('rejects expiresAt on or before startAt', () => {
    expect(() => validateMotdInput({ bodies: { en: 'hi' }, startAt: 1000, expiresAt: 1000 })).toThrow(/after its start/)
    expect(() => validateMotdInput({ bodies: { en: 'hi' }, startAt: 2000, expiresAt: 1000 })).toThrow(/after its start/)
  })

  it('accepts a valid input and returns cleaned bodies', () => {
    expect(validateMotdInput({ bodies: { en: 'hi' }, startAt: 1000, expiresAt: 2000 })).toEqual({ en: 'hi' })
  })
})
