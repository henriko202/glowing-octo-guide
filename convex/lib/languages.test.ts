import { describe, expect, it } from 'vitest'
import {
  AUTO_LANGUAGE,
  isValidCommentLanguage,
  languageLabel,
  LANGUAGE_CODES,
  resolveCommentLanguage
} from './languages'

describe('comment languages', () => {
  it('includes major languages', () => {
    for (const c of ['en', 'pt', 'es', 'fr', 'de', 'ja', 'zh', 'ar']) expect(LANGUAGE_CODES).toContain(c)
  })
  it('validates codes and the auto sentinel', () => {
    expect(isValidCommentLanguage('en')).toBe(true)
    expect(isValidCommentLanguage(AUTO_LANGUAGE)).toBe(true)
    expect(isValidCommentLanguage('xx')).toBe(false)
    expect(isValidCommentLanguage('')).toBe(false)
  })
  it('resolves: unset/invalid → auto, valid → passthrough', () => {
    expect(resolveCommentLanguage(undefined)).toBe('auto')
    expect(resolveCommentLanguage('')).toBe('auto')
    expect(resolveCommentLanguage('zz')).toBe('auto')
    expect(resolveCommentLanguage('pt')).toBe('pt')
    expect(resolveCommentLanguage('auto')).toBe('auto')
  })
  it('labels a code via Intl, falling back to the raw code', () => {
    expect(languageLabel('pt', 'en')).toMatch(/portuguese/i)
    expect(languageLabel('zz')).toBe('zz')
  })
})
