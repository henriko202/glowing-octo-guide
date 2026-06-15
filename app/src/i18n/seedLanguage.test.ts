import { describe, it, expect } from 'vitest'
import { pickSeedLanguage } from './seedLanguage'

const SUPPORTED = ['en', 'pt', 'es'] as const

describe('pickSeedLanguage', () => {
  it('returns the mapped language when supported and no stored preference', () => {
    expect(pickSeedLanguage('pt', SUPPORTED, false)).toBe('pt')
    expect(pickSeedLanguage('en-US', SUPPORTED, false)).toBe('en')
    expect(pickSeedLanguage('es_ES', SUPPORTED, false)).toBe('es')
  })

  it('returns null when the user already has a stored preference', () => {
    expect(pickSeedLanguage('pt', SUPPORTED, true)).toBeNull()
  })

  it('returns null for unsupported or missing locales', () => {
    expect(pickSeedLanguage('fr', SUPPORTED, false)).toBeNull()
    expect(pickSeedLanguage(undefined, SUPPORTED, false)).toBeNull()
    expect(pickSeedLanguage('', SUPPORTED, false)).toBeNull()
  })
})
