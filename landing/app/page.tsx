import Nav from '../components/Nav'
import Hero from '../components/Hero'
import PainBeat from '../components/PainBeat'
import HowItWorks from '../components/HowItWorks'
import SSIExplainer from '../components/SSIExplainer'
import Proof from '../components/Proof'
import Features from '../components/Features'
import Pricing from '../components/Pricing'
import FAQ from '../components/FAQ'
import FinalCTA from '../components/FinalCTA'
import Footer from '../components/Footer'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-ink">
      <Nav />
      <Hero />
      <PainBeat />
      <HowItWorks />
      <SSIExplainer />
      <Proof />
      <Features />
      <Pricing />
      <FAQ />
      <FinalCTA />
      <Footer />
    </div>
  )
}
