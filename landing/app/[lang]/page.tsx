import { getDictionary } from '../../i18n/getDictionary'
import type { Locale } from '../../i18n/config'
import Nav from '../../components/Nav'
import Hero from '../../components/Hero'
import PainBeat from '../../components/PainBeat'
import HowItWorks from '../../components/HowItWorks'
import SSIExplainer from '../../components/SSIExplainer'
import Proof from '../../components/Proof'
import Features from '../../components/Features'
import Pricing from '../../components/Pricing'
import FAQ from '../../components/FAQ'
import FinalCTA from '../../components/FinalCTA'
import Footer from '../../components/Footer'

export default async function HomePage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang: rawLang } = await params
  const lang = rawLang as Locale
  const dict = await getDictionary(lang)
  return (
    <div className="min-h-screen bg-ink">
      <Nav
        dict={dict.nav}
        themeToggleDict={dict.themeToggle}
        languageSelectorDict={dict.languageSelector}
        lang={lang}
      />
      <Hero dict={dict.hero} />
      <PainBeat dict={dict.painBeat} />
      <HowItWorks dict={dict.howItWorks} />
      <SSIExplainer dict={dict.ssiExplainer} />
      <Proof dict={dict.proof} />
      <Features
        dict={dict.features}
        tiers={dict.tiers}
      />
      <Pricing dict={dict.pricing} />
      <FAQ dict={dict.faq} />
      <FinalCTA dict={dict.finalCta} />
      <Footer
        dict={dict.footer}
        lang={lang}
      />
    </div>
  )
}
