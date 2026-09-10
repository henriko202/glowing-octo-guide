import type { Metadata } from 'next'
import { i18n, type Locale } from '@/i18n/config'
import { OG_LOCALE, SITE_NAME } from '@/lib/site'

// Metadata for the static child pages (legal). The Home layout supplies `metadataBase`, so the
// relative canonical/OpenGraph URLs below resolve to absolute ones. Next replaces the inherited
// `openGraph` object rather than merging it, and `keywords` is inherited unless overridden — so
// both are set explicitly here to keep the legal pages free of the homepage's OG locale/keywords.
export function pageMetadata({
  lang,
  path,
  title,
  description
}: {
  lang: Locale
  path: string
  title: string
  description: string
}): Metadata {
  const languages = {
    ...Object.fromEntries(i18n.locales.map(l => [l, `/${l}${path}`])),
    'x-default': `/${i18n.defaultLocale}${path}`
  }
  return {
    title,
    description,
    keywords: [],
    alternates: { canonical: `/${lang}${path}`, languages },
    openGraph: {
      type: 'website',
      url: `/${lang}${path}`,
      siteName: SITE_NAME,
      title,
      description,
      locale: OG_LOCALE[lang],
      images: [{ url: '/og.png', width: 1200, height: 630, alt: SITE_NAME }]
    },
    twitter: { card: 'summary_large_image', title, description, images: [{ url: '/og.png', alt: SITE_NAME }] }
  }
}
