import type { Locale } from '@/i18n/config'
import En from './content/en'
import Pt from './content/pt'
import Es from './content/es'

const CONTENT = { en: En, pt: Pt, es: Es } as const

export default async function PrivacyPage({ params }: { params: Promise<{ lang: Locale }> }) {
  const { lang } = await params
  const Content = (CONTENT as Record<string, typeof En>)[lang] ?? En
  return <Content lang={lang} />
}
