import { describe, expect, it } from 'vitest'
import { i18n } from '../i18n/config'
import { homeMetadata, pageMetadata } from './seo'
import { OG_LOCALE, SITE_NAME } from './site'

describe('homeMetadata', () => {
  const meta = { description: 'd', keywords: ['k'], ogTitle: 'Rich title', ogDescription: 'ogd' }

  it('keeps the document title on the brand and the rich title in og/twitter', () => {
    const metadata = homeMetadata({ lang: 'pt', meta })
    expect(metadata.title).toBe(SITE_NAME)
    expect(metadata.openGraph?.title).toBe('Rich title')
    expect(metadata.twitter?.title).toBe('Rich title')
    expect(metadata.alternates?.canonical).toBe('/pt')
    expect(metadata.alternates?.languages).toMatchObject({ 'x-default': '/en' })
  })
})

describe('pageMetadata', () => {
  it.each(i18n.locales)('%s legal pages self-canonical with matching hreflang and OG locale', lang => {
    const metadata = pageMetadata({
      lang,
      path: '/privacy',
      ogTitle: 'Privacy',
      description: 'How we handle data.'
    })
    expect(metadata.title).toBe(SITE_NAME)
    expect(metadata.openGraph?.title).toBe('Privacy')
    expect(metadata.twitter?.title).toBe('Privacy')
    expect(metadata.alternates?.canonical).toBe(`/${lang}/privacy`)
    expect(metadata.alternates?.languages).toEqual({
      en: '/en/privacy',
      pt: '/pt/privacy',
      es: '/es/privacy',
      'x-default': '/en/privacy'
    })
    expect(metadata.keywords).toEqual([])
    expect(metadata.openGraph).toMatchObject({ locale: OG_LOCALE[lang], url: `/${lang}/privacy` })
  })

  it('keeps x-default on the default locale', () => {
    const metadata = pageMetadata({ lang: 'pt', path: '/terms', ogTitle: 'T', description: 'D' })
    expect(metadata.alternates?.languages).toMatchObject({ 'x-default': `/${i18n.defaultLocale}/terms` })
  })
})
