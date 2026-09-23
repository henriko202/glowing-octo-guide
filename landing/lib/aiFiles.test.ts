import { describe, expect, it } from 'vitest'
import type { Dictionary } from '@/i18n/getDictionary'
import en from '@/i18n/dictionaries/en.json'
import { llmsFullTxt, llmsTxt, pricingMarkdown } from './aiFiles'
import { planPrice } from './trial'

const dict = en as Dictionary

describe('pricingMarkdown', () => {
  it('carries every plan, its price, and the trial terms', () => {
    const markdown = pricingMarkdown(dict)
    for (const plan of dict.pricing.plans) {
      expect(markdown).toContain(`## ${plan.name}`)
    }
    expect(markdown).toContain(`$${planPrice('starter', 'monthly')}/month`)
    expect(markdown).toContain(`$${planPrice('starter', 'annual')}/year billed annually`)
    expect(markdown).toContain(dict.pricing.trialNote)
  })
})

describe('llmsTxt', () => {
  it('states the positioning, the LISSI alias, and links the agent files', () => {
    const text = llmsTxt(dict)
    expect(text).toContain('Link Into The SSI (LISSI) helps you get noticed on LinkedIn')
    expect(text).toContain('LinkIntoTheSSI')
    for (const point of dict.positioning.points) {
      expect(text).toContain(`**${point.title}.**`)
    }
    expect(text).toContain('llms-full.txt')
    expect(text).toContain('pricing.md')
    expect(text).toContain(dict.positioning.closing)
  })
})

describe('llmsFullTxt', () => {
  it('answers the whole page in one file, in every locale-independent section', () => {
    const text = llmsFullTxt(dict)
    expect(text).toContain('# Link Into The SSI: full site content')
    for (const step of dict.howItWorks.steps) {
      expect(text).toContain(step.title)
    }
    for (const item of dict.features.items) {
      expect(text).toContain(item.title)
    }
    for (const item of dict.faq.items) {
      expect(text).toContain(item.q)
      expect(text).toContain(item.a)
    }
    for (const plan of dict.pricing.plans) {
      expect(text).toContain(`### ${plan.name}`)
    }
  })
})
