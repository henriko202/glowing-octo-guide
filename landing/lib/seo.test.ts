import { describe, expect, it } from 'vitest'
import { i18n } from '../i18n/config'
import { pageMetadata } from './seo'
import { OG_LOCALE } from './site'

describe('pageMetadata', () => {
  it.each(i18n.locales)('%s legal pages self-canonical with matching hreflang and OG locale', lang => {
    const metadata = pageMetadata({ lang, path: '/privacy', title: 'Privacy', description: 'How we handle data.' })
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
    const metadata = pageMetadata({ lang: 'pt', path: '/terms', title: 'T', description: 'D' })
    expect(metadata.alternates?.languages).toMatchObject({ 'x-default': `/${i18n.defaultLocale}/terms` })
  })
})
