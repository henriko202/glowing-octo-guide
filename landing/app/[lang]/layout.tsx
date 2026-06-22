import type { Metadata } from 'next'
import '../globals.css'
import CookieNotice from '../../components/CookieNotice'
import { getDictionary } from '../../i18n/getDictionary'
import { i18n, type Locale } from '../../i18n/config'

const NO_FLASH = `(function(){try{var m=document.cookie.match(/(?:^|; )theme=([^;]*)/);var p=m?decodeURIComponent(m[1]):'system';var d=p==='dark'||(p!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches);var e=document.documentElement;e.classList.toggle('dark',d);e.style.colorScheme=d?'dark':'light';}catch(e){}})();`

export async function generateStaticParams() {
  return i18n.locales.map(lang => ({ lang }))
}

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang: rawLang } = await params
  const lang = rawLang as Locale
  const dict = await getDictionary(lang)
  return {
    title: dict.meta.title,
    description: dict.meta.description,
    openGraph: { title: dict.meta.ogTitle, description: dict.meta.ogDescription, type: 'website', locale: lang },
    alternates: {
      canonical: `/${lang}`,
      languages: { ...Object.fromEntries(i18n.locales.map(l => [l, `/${l}`])), 'x-default': '/en' }
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
  const lang = rawLang as Locale
  const dict = await getDictionary(lang)
  return (
    <html
      lang={lang}
      className="scroll-smooth"
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
        {children}
        <CookieNotice
          dict={dict.cookieNotice}
          lang={lang}
        />
      </body>
    </html>
  )
}
