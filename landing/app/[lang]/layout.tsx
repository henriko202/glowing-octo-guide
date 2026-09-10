import type { Metadata } from 'next'
import { Cormorant_Garamond, DM_Sans } from 'next/font/google'
import '../globals.css'
import { getDictionary } from '@/i18n/getDictionary'
import { i18n, type Locale } from '@/i18n/config'
import { OG_LOCALE, SITE_NAME, SITE_URL } from '@/lib/site'
import CookieNotice from '@/components/CookieNotice'
import TrialProvider from '@/components/TrialProvider'

// Self-hosted at build time → served from 'self', so the tight CSP needs no font/style host.
const display = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-cormorant',
  display: 'swap'
})
const body = DM_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  variable: '--font-dm-sans',
  display: 'swap'
})

// Applies the theme before first paint, resolving it with the SAME precedence as lib/theme.ts getStoredTheme
// (cookie → localStorage → system) — so the pre-paint theme matches what ThemeToggle's post-hydration effect
// applies. If they diverge (e.g. the pref lives in the localStorage mirror but the cookie was cleared/rejected)
// you get an OS-theme → stored-theme flash ~0.5s after load. A render-blocking stylesheet still lets this inline
// script run before first paint, so no server-side per-theme prerender is needed.
const NO_FLASH = `(function(){try{var m=document.cookie.match(/(?:^|; )theme=([^;]*)/);var v=m?decodeURIComponent(m[1]):null;if(v!=='light'&&v!=='dark'&&v!=='system'){try{v=localStorage.getItem('theme')}catch(_){}}var p=v==='light'||v==='dark'||v==='system'?v:'system';var d=p==='dark'||(p!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches);var e=document.documentElement;e.classList.toggle('dark',d);e.style.colorScheme=d?'dark':'light';}catch(_){}})();`

export async function generateStaticParams() {
  return i18n.locales.map(lang => ({ lang }))
}

function resolveLocale(raw: string): Locale {
  return (i18n.locales as readonly string[]).includes(raw) ? (raw as Locale) : i18n.defaultLocale
}

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang: rawLang } = await params
  const lang = resolveLocale(rawLang)
  const dict = await getDictionary(lang)
  const languages = {
    ...Object.fromEntries(i18n.locales.map(l => [l, `/${l}`])),
    'x-default': `/${i18n.defaultLocale}`
  }
  return {
    metadataBase: new URL(SITE_URL),
    title: dict.meta.title,
    description: dict.meta.description,
    keywords: dict.meta.keywords,
    applicationName: SITE_NAME,
    category: 'Business',
    alternates: { canonical: `/${lang}`, languages },
    openGraph: {
      type: 'website',
      url: `/${lang}`,
      siteName: SITE_NAME,
      title: dict.meta.ogTitle,
      description: dict.meta.ogDescription,
      locale: OG_LOCALE[lang],
      images: [{ url: '/og.png', width: 1200, height: 630, alt: dict.meta.ogTitle }]
    },
    twitter: {
      card: 'summary_large_image',
      title: dict.meta.ogTitle,
      description: dict.meta.ogDescription,
      images: [{ url: '/og.png', alt: dict.meta.ogTitle }]
    },
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1, 'max-video-preview': -1 }
    }
  }
}

export default async function RootLayout({
  children,
  params
}: {
  children: React.ReactNode
  params: Promise<{ lang: string }>
}) {
  const { lang: rawLang } = await params
  const lang = resolveLocale(rawLang)
  const dict = await getDictionary(lang)
  return (
    <html
      lang={lang}
      className={`${display.variable} ${body.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH }} />
        <meta
          name="theme-color"
          content="#0e1320"
        />
      </head>
      <body className="bg-ink font-body text-cream antialiased">
        <TrialProvider>{children}</TrialProvider>
        <CookieNotice
          dict={dict.cookieNotice}
          lang={lang}
        />
      </body>
    </html>
  )
}
