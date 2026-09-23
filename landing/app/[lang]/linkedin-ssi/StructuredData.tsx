import type { Locale } from '@/i18n/config'
import type { GuideContent } from './content/en'
import { FOUNDER_LINKEDIN_URL, SITE_NAME, SITE_URL } from '@/lib/site'

const ORG_ID = `${SITE_URL}/#organization`

// Mirrors the "Last updated" line in the copy. Bump both together when the guide is edited, so the
// structured data keeps reporting the real revision date instead of the last deploy.
const PUBLISHED = '2026-09-22'

// One JSON-LD graph per guide page: the Article that names the guide, a BreadcrumbList back to the
// locale home, and the FAQ block AI engines and search can extract. Server component, so it is
// present in the static HTML.
export default function GuideStructuredData({
  guide,
  lang,
  authorName
}: {
  guide: GuideContent
  lang: Locale
  authorName: string
}) {
  const url = `${SITE_URL}/${lang}/linkedin-ssi`

  const graph = [
    {
      '@type': 'Article',
      '@id': `${url}#article`,
      headline: guide.meta.title,
      description: guide.meta.description,
      inLanguage: lang,
      datePublished: PUBLISHED,
      dateModified: PUBLISHED,
      image: `${SITE_URL}/og.png`,
      mainEntityOfPage: url,
      author: { '@type': 'Person', name: authorName, url: FOUNDER_LINKEDIN_URL },
      publisher: { '@id': ORG_ID }
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: SITE_NAME, item: `${SITE_URL}/${lang}` },
        { '@type': 'ListItem', position: 2, name: guide.meta.title, item: url }
      ]
    },
    {
      '@type': 'FAQPage',
      inLanguage: lang,
      mainEntity: guide.faq.items.map(item => ({
        '@type': 'Question',
        name: item.q,
        acceptedAnswer: { '@type': 'Answer', text: item.a }
      }))
    }
  ]

  const json = JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replace(/</g, '\\u003c')
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: json }}
    />
  )
}
