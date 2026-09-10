import type { MetadataRoute } from 'next'
import { i18n } from '@/i18n/config'
import { SITE_URL } from '@/lib/site'

const ROUTES = ['', '/privacy', '/terms', '/cookies'] as const

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()
  return i18n.locales.flatMap(locale =>
    ROUTES.map(route => ({
      url: `${SITE_URL}/${locale}${route}`,
      lastModified: now,
      changeFrequency: route === '' ? ('weekly' as const) : ('monthly' as const),
      priority: route === '' ? 1 : 0.3,
      alternates: {
        languages: {
          ...Object.fromEntries(i18n.locales.map(l => [l, `${SITE_URL}/${l}${route}`])),
          'x-default': `${SITE_URL}/${i18n.defaultLocale}${route}`
        }
      }
    }))
  )
}
