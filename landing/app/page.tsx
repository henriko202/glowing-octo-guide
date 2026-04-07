import Nav from '../components/Nav'
import Hero from '../components/Hero'
import SSIExplainer from '../components/SSIExplainer'
import StatsBar from '../components/StatsBar'
import HowItWorks from '../components/HowItWorks'
import Features from '../components/Features'
import Testimonials from '../components/Testimonials'
import Pricing from '../components/Pricing'
import FAQ from '../components/FAQ'
import FinalCTA from '../components/FinalCTA'
import Footer from '../components/Footer'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-ink">
      <Nav />
      <Hero />
      <SSIExplainer />
      <StatsBar />
      <HowItWorks />
      <Features />
      <Testimonials />
      <Pricing />
      <FAQ />
      <FinalCTA />
      <Footer />
    </div>
  )
}
