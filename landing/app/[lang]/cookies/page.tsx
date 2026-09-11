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
    path: '/cookies',
    ogTitle: dict.legalMeta.cookies.title,
    description: dict.legalMeta.cookies.description
  })
}

export default async function CookiesPage({ params }: { params: Promise<{ lang: Locale }> }) {
  const { lang } = await params
  const Content = (CONTENT as Record<string, typeof En>)[lang] ?? En
  return <Content lang={lang} />
}
