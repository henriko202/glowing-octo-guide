import { describe, expect, it } from 'vitest'
import { stripLoneSurrogates, truncateSafely } from './safeText'

describe('stripLoneSurrogates', () => {
  it('removes a lone high surrogate left by a UTF-16 cut', () => {
    expect(stripLoneSurrogates(`ab${'\uD83D'}`)).toBe('ab')
  })

  it('removes a lone low surrogate', () => {
    expect(stripLoneSurrogates(`${'\uDE00'}ab`)).toBe('ab')
  })

  it('keeps a valid surrogate pair intact', () => {
    expect(stripLoneSurrogates(`a${'😀'}b`)).toBe(`a${'😀'}b`)
  })
})

describe('truncateSafely', () => {
  it('backs off one code unit instead of splitting a surrogate pair', () => {
    expect(truncateSafely(`${'a'.repeat(139)}😀tail`, 140)).toBe('a'.repeat(139))
    expect(truncateSafely(`${'a'.repeat(138)}😀tail`, 140)).toBe(`${'a'.repeat(138)}😀`)
  })

  it('returns a value at or under the limit unchanged', () => {
    expect(truncateSafely('abc', 3)).toBe('abc')
  })
})
