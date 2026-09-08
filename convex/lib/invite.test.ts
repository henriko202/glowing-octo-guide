import { describe, expect, it } from 'vitest'
import { firstName, generateInviteCode, INVITE_CODE_RE, isInviteCode } from './invite'

describe('isInviteCode', () => {
  it('accepts exactly eight lowercase alphanumerics', () => {
    expect(isInviteCode('abc12345')).toBe(true)
    expect(isInviteCode('ABC12345')).toBe(false)
    expect(isInviteCode('abc1234')).toBe(false)
    expect(isInviteCode('abc123456')).toBe(false)
    expect(isInviteCode('abc-1234')).toBe(false)
    expect(isInviteCode(undefined)).toBe(false)
    expect(isInviteCode(null)).toBe(false)
    expect(isInviteCode(12345678)).toBe(false)
  })
})

describe('generateInviteCode', () => {
  it('produces a code the validator accepts', () => {
    for (let i = 0; i < 50; i++) expect(generateInviteCode()).toMatch(INVITE_CODE_RE)
  })
  it('maps the random source onto the alphabet deterministically', () => {
    expect(generateInviteCode(() => 0)).toBe('aaaaaaaa')
    expect(generateInviteCode(() => 0.999999)).toBe('99999999')
  })
})

describe('firstName', () => {
  it('takes the first whitespace-separated token', () => {
    expect(firstName('Ana Souza')).toBe('Ana')
    expect(firstName('  Jordan   Maxwell ')).toBe('Jordan')
    expect(firstName('Cher')).toBe('Cher')
    expect(firstName('')).toBe('')
  })
})
