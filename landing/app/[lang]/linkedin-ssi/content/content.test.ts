import { describe, expect, it } from 'vitest'
import en from './en'
import pt from './pt'
import es from './es'

describe('linkedin-ssi guide content', () => {
  it.each([
    ['pt', pt],
    ['es', es]
  ] as const)('%s mirrors the English structure section by section', (_locale, guide) => {
    expect(guide.pillars.items).toHaveLength(en.pillars.items.length)
    expect(guide.scoring.paragraphs).toHaveLength(en.scoring.paragraphs.length)
    expect(guide.improve.steps).toHaveLength(en.improve.steps.length)
    expect(guide.faq.items).toHaveLength(en.faq.items.length)
  })

  it.each([
    ['pt', pt],
    ['es', es]
  ] as const)('%s translates the copy instead of shipping English', (_locale, guide) => {
    expect(guide.hero.headline).not.toBe(en.hero.headline)
    expect(guide.meta.description).not.toBe(en.meta.description)
    expect(guide.faq.items.map(item => item.q)).not.toEqual(en.faq.items.map(item => item.q))
  })

  it('keeps a search-result-sized title and description in every locale', () => {
    for (const guide of [en, pt, es]) {
      expect(guide.meta.title.length).toBeLessThanOrEqual(65)
      expect(guide.meta.description.length).toBeGreaterThanOrEqual(110)
      expect(guide.meta.description.length).toBeLessThanOrEqual(165)
    }
  })
})
