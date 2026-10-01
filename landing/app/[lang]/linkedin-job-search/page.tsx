import type { Metadata } from 'next'
import type { Locale } from '@/i18n/config'
import { getDictionary } from '@/i18n/getDictionary'
import { pageMetadata } from '@/lib/seo'
import En from './content/en'
import Pt from './content/pt'
import Es from './content/es'
import Guide from '../linkedin-ssi/Guide'
import GuideStructuredData from '../linkedin-ssi/StructuredData'

const CONTENT = { en: En, pt: Pt, es: Es } as const
const PATH = '/linkedin-job-search'

export async function generateMetadata({ params }: { params: Promise<{ lang: Locale }> }): Promise<Metadata> {
  const { lang } = await params
  const guide = CONTENT[lang] ?? En
  return pageMetadata({
    lang,
    path: PATH,
    title: guide.meta.title,
    ogTitle: guide.meta.ogTitle,
    description: guide.meta.description,
    index: true
  })
}

export default async function LinkedInJobSearchGuidePage({ params }: { params: Promise<{ lang: Locale }> }) {
  const { lang } = await params
  const guide = CONTENT[lang] ?? En
  const dict = await getDictionary(lang)
  return (
    <>
      <GuideStructuredData
        guide={guide}
        lang={lang}
        authorName={dict.proof.founderName}
        path={PATH}
        published="2026-10-01"
        modified="2026-10-01"
      />
      <Guide
        guide={guide}
        sources={guide.sources}
        dict={dict}
        lang={lang}
      />
    </>
  )
}
