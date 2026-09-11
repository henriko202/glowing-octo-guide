import { describe, it, expect } from 'vitest'
import { resolveMotdEnabled, validateMotdInput, MAX_MOTD_BODY_LENGTH } from './motd'

// resolveMotdEnabled is the shared schedule decision: admin create/update/toggle writes and the
// reconcileMotdWindows cron all derive the stored `enabled` flag through it, so getActiveMotd can
// select on `enabled` alone without a wall clock. Boundaries match the old in-query filter:
// startAt inclusive, expiresAt exclusive.
describe('resolveMotdEnabled', () => {
  it('stays off when the requested state is disabled, whatever the window says', () => {
    expect(resolveMotdEnabled({ enabled: false }, 1000)).toBe(false)
    expect(resolveMotdEnabled({ enabled: false, startAt: 500, expiresAt: 2000 }, 1000)).toBe(false)
  })

  it('enables an open-ended MOTD', () => {
    expect(resolveMotdEnabled({ enabled: true }, 1000)).toBe(true)
  })

  it('keeps a future-start MOTD disabled until startAt arrives (inclusive at startAt)', () => {
    expect(resolveMotdEnabled({ enabled: true, startAt: 2000 }, 1000)).toBe(false)
    expect(resolveMotdEnabled({ enabled: true, startAt: 1000 }, 1000)).toBe(true)
  })

  it('disables a MOTD once expiresAt has passed (exclusive at expiresAt)', () => {
    expect(resolveMotdEnabled({ enabled: true, expiresAt: 500 }, 1000)).toBe(false)
    expect(resolveMotdEnabled({ enabled: true, expiresAt: 1000 }, 1000)).toBe(false)
    expect(resolveMotdEnabled({ enabled: true, expiresAt: 1001 }, 1000)).toBe(true)
  })

  it('honors a bounded window covering now', () => {
    expect(resolveMotdEnabled({ enabled: true, startAt: 500, expiresAt: 2000 }, 1000)).toBe(true)
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
