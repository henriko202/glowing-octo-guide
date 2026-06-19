import { describe, expect, it } from 'vitest'
import { parseReaction, REACTIONS } from './reactions'

describe('parseReaction', () => {
  it('returns a clean one-word reply verbatim', () => {
    expect(parseReaction('PRAISE')).toBe('PRAISE')
    expect(parseReaction('like')).toBe('LIKE')
    expect(parseReaction('  Empathy \n')).toBe('EMPATHY')
  })
  it('extracts the keyword from a noisy reply', () => {
    expect(parseReaction('Reaction: INTEREST.')).toBe('INTEREST')
    expect(parseReaction('I would react with APPRECIATION here')).toBe('APPRECIATION')
  })
  it('does not false-match LIKE inside another word', () => {
    // "unlikely" contains the substring LIKE; whole-word matching must skip it and pick PRAISE.
    expect(parseReaction('Unlikely, but I would say PRAISE')).toBe('PRAISE')
  })
  it('defaults to LIKE on empty/unknown/garbage', () => {
    expect(parseReaction('')).toBe('LIKE')
    expect(parseReaction('banana')).toBe('LIKE')
    expect(parseReaction(undefined as unknown as string)).toBe('LIKE')
  })
  it('exposes 6 reactions with emoji + label keys', () => {
    expect(REACTIONS).toHaveLength(6)
    expect(REACTIONS.map(r => r.value)).toEqual([
      'LIKE',
      'PRAISE',
      'EMPATHY',
      'INTEREST',
      'APPRECIATION',
      'ENTERTAINMENT'
    ])
  })
})
