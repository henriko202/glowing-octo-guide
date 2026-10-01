import type { Metadata } from 'next'
import type { Locale } from '@/i18n/config'
import { getDictionary } from '@/i18n/getDictionary'
import { pageMetadata } from '@/lib/seo'
import En from './content/en'
import Pt from './content/pt'
import Es from './content/es'
import Guide from './Guide'
import GuideStructuredData from './StructuredData'

const CONTENT = { en: En, pt: Pt, es: Es } as const
const SSI_SOURCE_URL = 'https://business.linkedin.com/sales-solutions/social-selling'

export async function generateMetadata({ params }: { params: Promise<{ lang: Locale }> }): Promise<Metadata> {
  const { lang } = await params
  const guide = CONTENT[lang] ?? En
  return pageMetadata({
    lang,
    path: '/linkedin-ssi',
    title: guide.meta.title,
    ogTitle: guide.meta.ogTitle,
    description: guide.meta.description,
    index: true
  })
}

export default async function LinkedInSsiGuidePage({ params }: { params: Promise<{ lang: Locale }> }) {
  const { lang } = await params
  const guide = CONTENT[lang] ?? En
  const dict = await getDictionary(lang)
  return (
    <>
      <GuideStructuredData
        guide={guide}
        lang={lang}
        authorName={dict.proof.founderName}
        path="/linkedin-ssi"
        published="2026-09-22"
        modified="2026-10-01"
      />
      <Guide
        guide={guide}
        sources={{
          line: dict.ssiExplainer.sourceLine,
          links: [{ label: dict.ssiExplainer.sourceLabel, url: SSI_SOURCE_URL }]
        }}
        dict={dict}
        lang={lang}
      />
    </>
  )
}
