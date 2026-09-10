import { describe, expect, it } from 'vitest'
import en from './dictionaries/en.json'
import pt from './dictionaries/pt.json'
import es from './dictionaries/es.json'

function strings(value: unknown, path = ''): Record<string, string> {
  if (typeof value === 'string') return { [path]: value }
  if (!value || typeof value !== 'object') return {}
  return Object.fromEntries(
    Object.entries(value).flatMap(([key, child]) => Object.entries(strings(child, `${path}.${key}`)))
  )
}

describe('landing translations', () => {
  const english = strings(en)
  it.each([
    ['pt', pt],
    ['es', es]
  ] as const)('%s has every label and interpolation placeholder', (_locale, dictionary) => {
    const translated = strings(dictionary)
    expect(Object.keys(translated).sort()).toEqual(Object.keys(english).sort())
    for (const [path, value] of Object.entries(english)) {
      expect(translated[path].match(/\{\{\w+\}\}/g) ?? []).toEqual(value.match(/\{\{\w+\}\}/g) ?? [])
    }
  })

  it.each([
    ['en', en],
    ['pt', pt],
    ['es', es]
  ] as const)('%s keeps the same trial terms at every decision', (_locale, dictionary) => {
    expect(dictionary.hero.ctaDisclaimer).toBe(dictionary.pricing.trialNote)
    expect(dictionary.finalCta.subheadline).toBe(dictionary.pricing.trialNote)
  })
})
