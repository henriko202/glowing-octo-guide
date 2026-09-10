import { getDictionary } from '@/i18n/getDictionary'
import type { Locale } from '@/i18n/config'
import Nav from '@/components/Nav'
import Hero from '@/components/Hero'
import HowItWorks from '@/components/HowItWorks'
import SSIExplainer from '@/components/SSIExplainer'
import Proof from '@/components/Proof'
import Features from '@/components/Features'
import Pricing from '@/components/Pricing'
import FAQ from '@/components/FAQ'
import FinalCTA from '@/components/FinalCTA'
import Footer from '@/components/Footer'
import StructuredData from '@/components/StructuredData'

export default async function HomePage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang: rawLang } = await params
  const lang = rawLang as Locale
  const dict = await getDictionary(lang)
  return (
    <div className="min-h-screen bg-ink">
      <StructuredData
        dict={dict}
        lang={lang}
      />
      <a
        href="#main-content"
        className="fixed top-2 left-2 z-[60] -translate-y-24 rounded-md bg-gold px-4 py-3 font-semibold text-on-gold focus:translate-y-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
      >
        {dict.nav.skipToContent}
      </a>
      <Nav
        dict={dict.nav}
        themeToggleDict={dict.themeToggle}
        languageSelectorDict={dict.languageSelector}
        lang={lang}
      />
      <main
        id="main-content"
        tabIndex={-1}
      >
        <Hero
          dict={dict.hero}
          offer={dict.trialOffer}
          lang={lang}
        />
        <HowItWorks dict={dict.howItWorks} />
        <Features
          dict={dict.features}
          tiers={dict.tiers}
        />
        <Pricing
          dict={dict.pricing}
          lang={lang}
        />
        <Proof dict={dict.proof} />
        <SSIExplainer dict={dict.ssiExplainer} />
        <FAQ dict={dict.faq} />
        <FinalCTA
          dict={dict.finalCta}
          offer={dict.trialOffer}
          lang={lang}
        />
      </main>
      <Footer
        dict={dict.footer}
        languageSelectorDict={dict.languageSelector}
        lang={lang}
      />
    </div>
  )
}
