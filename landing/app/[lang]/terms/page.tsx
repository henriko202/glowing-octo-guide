import type { Metadata } from 'next'
import type { Locale } from '@/i18n/config'
import { getDictionary } from '@/i18n/getDictionary'
import { pageMetadata } from '@/lib/seo'
import En from './content/en'
import Pt from './content/pt'
import Es from './content/es'

const CONTENT = { en: En, pt: Pt, es: Es } as const

export async function generateMetadata({ params }: { params: Promise<{ lang: Locale }> }): Promise<Metadata> {
  const { lang } = await params
  const dict = await getDictionary(lang)
  return pageMetadata({
    lang,
    path: '/terms',
    title: dict.legalMeta.terms.title,
    description: dict.legalMeta.terms.description
  })
}

export default async function TermsPage({ params }: { params: Promise<{ lang: Locale }> }) {
  const { lang } = await params
  const Content = (CONTENT as Record<string, typeof En>)[lang] ?? En
  return <Content lang={lang} />
}
