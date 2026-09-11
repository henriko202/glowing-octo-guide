import type { Metadata } from 'next'
import { i18n, type Locale } from '@/i18n/config'
import type { Dictionary } from '@/i18n/getDictionary'
import { OG_LOCALE, SITE_NAME, SITE_URL } from '@/lib/site'

export function homeMetadata({ lang, meta }: { lang: Locale; meta: Dictionary['meta'] }): Metadata {
  return {
    metadataBase: new URL(SITE_URL),
    title: SITE_NAME,
    description: meta.description,
    keywords: meta.keywords,
    applicationName: SITE_NAME,
    category: 'Business',
    alternates: {
      canonical: `/${lang}`,
      languages: {
        ...Object.fromEntries(i18n.locales.map(l => [l, `/${l}`])),
        'x-default': `/${i18n.defaultLocale}`
      }
    },
    openGraph: {
      type: 'website',
      url: `/${lang}`,
      siteName: SITE_NAME,
      title: meta.ogTitle,
      description: meta.ogDescription,
      locale: OG_LOCALE[lang],
      images: [{ url: '/og.png', width: 1200, height: 630, alt: meta.ogTitle }]
    },
    twitter: {
      card: 'summary_large_image',
      title: meta.ogTitle,
      description: meta.ogDescription,
      images: [{ url: '/og.png', alt: meta.ogTitle }]
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-image-preview': 'large',
        'max-snippet': -1,
        'max-video-preview': -1
      }
    }
  }
}

// Metadata for the static child pages (legal). The Home layout supplies `metadataBase`, so the
// relative canonical/OpenGraph URLs below resolve to absolute ones. Next replaces the inherited
// `openGraph` object rather than merging it, and `keywords` is inherited unless overridden — so
// both are set explicitly here to keep the legal pages free of the homepage's OG locale/keywords.
export function pageMetadata({
  lang,
  path,
  ogTitle,
  description
}: {
  lang: Locale
  path: string
  ogTitle: string
  description: string
}): Metadata {
  const languages = {
    ...Object.fromEntries(i18n.locales.map(l => [l, `/${l}${path}`])),
    'x-default': `/${i18n.defaultLocale}${path}`
  }
  return {
    title: SITE_NAME,
    description,
    keywords: [],
    alternates: { canonical: `/${lang}${path}`, languages },
    openGraph: {
      type: 'website',
      url: `/${lang}${path}`,
      siteName: SITE_NAME,
      title: ogTitle,
      description,
      locale: OG_LOCALE[lang],
      images: [{ url: '/og.png', width: 1200, height: 630, alt: SITE_NAME }]
    },
    twitter: { card: 'summary_large_image', title: ogTitle, description, images: [{ url: '/og.png', alt: SITE_NAME }] }
  }
}
