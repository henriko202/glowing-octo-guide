import type { Metadata } from 'next'
import './globals.css'
import CookieNotice from '../components/CookieNotice'

export const metadata: Metadata = {
  title: 'Link Into The SSI — Grow Your LinkedIn Influence',
  description: 'Join the circle of professionals growing their LinkedIn SSI organically through real engagement.',
  openGraph: {
    title: 'Link Into The SSI',
    description: 'Grow your LinkedIn SSI organically with real interactions.',
    type: 'website'
  }
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className="scroll-smooth"
    >
      <body className="bg-ink font-body text-cream antialiased">
        {children}
        <CookieNotice />
      </body>
    </html>
  )
}
