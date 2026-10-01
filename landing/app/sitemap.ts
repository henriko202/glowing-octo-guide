import type { MetadataRoute } from 'next'
import { i18n } from '@/i18n/config'
import { SITE_URL } from '@/lib/site'

// Only pages we want in search results. The legal pages (/privacy, /terms, /cookies) are reachable
// from the footer but noindexed (see lib/seo.ts), so listing them here would contradict their robots
// tag and invite Search Console "excluded by noindex" noise.
const ROUTES = [
  { path: '', changeFrequency: 'weekly' as const, priority: 1 },
  { path: '/linkedin-ssi', changeFrequency: 'monthly' as const, priority: 0.8 },
  { path: '/linkedin-job-search', changeFrequency: 'monthly' as const, priority: 0.8 }
]

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()
  return i18n.locales.flatMap(locale =>
    ROUTES.map(route => ({
      url: `${SITE_URL}/${locale}${route.path}`,
      lastModified: now,
      changeFrequency: route.changeFrequency,
      priority: route.priority,
      alternates: {
        languages: {
          ...Object.fromEntries(i18n.locales.map(l => [l, `${SITE_URL}/${l}${route.path}`])),
          'x-default': `${SITE_URL}/${i18n.defaultLocale}${route.path}`
        }
      }
    }))
  )
}
