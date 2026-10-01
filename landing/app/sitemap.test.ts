import { describe, expect, it } from 'vitest'
import sitemap from './sitemap'
import { i18n } from '@/i18n/config'
import { SITE_URL } from '@/lib/site'

describe('sitemap', () => {
  it('lists only the indexable landing pages for every locale', () => {
    expect(sitemap().map(entry => entry.url)).toEqual(
      i18n.locales.flatMap(locale => [
        `${SITE_URL}/${locale}`,
        `${SITE_URL}/${locale}/linkedin-ssi`,
        `${SITE_URL}/${locale}/linkedin-job-search`
      ])
    )
  })

  it('keeps the noindex legal pages out of the sitemap', () => {
    for (const entry of sitemap()) {
      expect(entry.url).not.toMatch(/\/(privacy|terms|cookies)$/)
    }
  })

  it('carries a self-referencing hreflang set plus x-default on every entry', () => {
    const [home] = sitemap()
    expect(home.alternates?.languages).toEqual({
      en: `${SITE_URL}/en`,
      pt: `${SITE_URL}/pt`,
      es: `${SITE_URL}/es`,
      'x-default': `${SITE_URL}/en`
    })
    const [guide] = sitemap().filter(entry => entry.url.endsWith('/linkedin-ssi'))
    expect(guide.alternates?.languages).toMatchObject({
      en: `${SITE_URL}/en/linkedin-ssi`,
      'x-default': `${SITE_URL}/en/linkedin-ssi`
    })
  })
})
