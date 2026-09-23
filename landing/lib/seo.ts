import type { Metadata } from 'next'
import { i18n, type Locale } from '@/i18n/config'
import type { Dictionary } from '@/i18n/getDictionary'
import { OG_LOCALE, SITE_NAME, SITE_URL } from '@/lib/site'

const INDEXABLE_ROBOTS: Metadata['robots'] = {
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

// Legal pages must stay reachable (LinkedIn app review, footer links) but must not compete with the
// landings in search: `follow` keeps them passing link equity, `index: false` keeps them out of the
// results. Without this, Google surfaced /privacy, /terms and /cookies for the brand query with the
// homepage title, crowding out the three landing pages.
const NOINDEX_ROBOTS: Metadata['robots'] = { index: false, follow: true }

export function homeMetadata({ lang, meta }: { lang: Locale; meta: Dictionary['meta'] }): Metadata {
  return {
    metadataBase: new URL(SITE_URL),
    title: meta.title,
    description: meta.description,
    keywords: meta.keywords,
    applicationName: SITE_NAME,
    category: 'Business',
    icons: {
      icon: [
        { url: '/favicon.svg', type: 'image/svg+xml' },
        { url: '/favicon.ico', sizes: 'any' }
      ],
      apple: '/apple-icon.png'
    },
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
    robots: INDEXABLE_ROBOTS
  }
}

// Metadata for the static child pages. Legal pages (the current callers) are noindex by default, so
// a page that forgets to opt in stays out of the index rather than becoming a thin brand SERP
// result. The Home layout supplies `metadataBase`, so the relative canonical/OpenGraph URLs below
// resolve to absolute ones. Next replaces the inherited `openGraph` object rather than merging it,
// and `keywords` is inherited unless overridden, so both are set explicitly here to keep the legal
// pages free of the homepage's OG locale/keywords.
export function pageMetadata({
  lang,
  path,
  title = SITE_NAME,
  ogTitle,
  description,
  index = false
}: {
  lang: Locale
  path: string
  title?: string
  ogTitle: string
  description: string
  index?: boolean
}): Metadata {
  const languages = {
    ...Object.fromEntries(i18n.locales.map(l => [l, `/${l}${path}`])),
    'x-default': `/${i18n.defaultLocale}${path}`
  }
  return {
    title,
    description,
    keywords: [],
    robots: index ? INDEXABLE_ROBOTS : NOINDEX_ROBOTS,
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
