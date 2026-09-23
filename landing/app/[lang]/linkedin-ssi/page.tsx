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
      />
      <Guide
        guide={guide}
        dict={dict}
        lang={lang}
      />
    </>
  )
}
