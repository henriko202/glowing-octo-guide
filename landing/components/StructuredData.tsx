import type { Locale } from '@/i18n/config'
import type { Dictionary } from '@/i18n/getDictionary'
import { planPrice } from '@/lib/trial'
import { CONTACT_EMAIL, FOUNDER_LINKEDIN_URL, LOGO_PATH, SITE_NAME, SITE_URL } from '@/lib/site'

const ORG_ID = `${SITE_URL}/#organization`
const SITE_ID = `${SITE_URL}/#website`
const APP_ID = `${SITE_URL}/#app`
const ALT_NAMES = ['LISSI', 'LinkIntoTheSSI']

// One JSON-LD graph per Home page: the product (SoftwareApplication), the company behind it,
// the site entity, and the two answer-shaped blocks (HowTo + FAQ) that AI engines and search
// can extract. Rendered as a server component so it is present in the static HTML.
export default function StructuredData({ dict, lang }: { dict: Dictionary; lang: Locale }) {
  const home = `${SITE_URL}/${lang}`

  const graph = [
    {
      '@type': 'Organization',
      '@id': ORG_ID,
      name: SITE_NAME,
      alternateName: ALT_NAMES,
      slogan: dict.positioning.headline,
      url: SITE_URL,
      logo: `${SITE_URL}${LOGO_PATH}`,
      email: CONTACT_EMAIL,
      founder: { '@type': 'Person', name: dict.proof.founderName, url: FOUNDER_LINKEDIN_URL }
    },
    {
      '@type': 'WebSite',
      '@id': SITE_ID,
      url: SITE_URL,
      name: SITE_NAME,
      alternateName: ALT_NAMES,
      inLanguage: lang,
      publisher: { '@id': ORG_ID }
    },
    {
      '@type': 'SoftwareApplication',
      '@id': APP_ID,
      name: SITE_NAME,
      alternateName: ALT_NAMES,
      url: home,
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      inLanguage: lang,
      description: dict.meta.description,
      keywords: dict.meta.keywords.join(', '),
      featureList: dict.features.items.map(feature => feature.title),
      offers: {
        '@type': 'AggregateOffer',
        priceCurrency: 'USD',
        lowPrice: String(planPrice('starter', 'monthly')),
        highPrice: String(planPrice('pro', 'annual')),
        offerCount: 3
      },
      publisher: { '@id': ORG_ID }
    },
    {
      '@type': 'HowTo',
      name: dict.howItWorks.headline,
      description: dict.meta.description,
      inLanguage: lang,
      step: dict.howItWorks.steps.map((step, i) => ({
        '@type': 'HowToStep',
        position: i + 1,
        name: step.title,
        text: step.body
      }))
    },
    {
      '@type': 'FAQPage',
      inLanguage: lang,
      mainEntity: dict.faq.items.map(item => ({
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
