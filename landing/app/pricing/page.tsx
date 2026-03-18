import Pricing from '../../components/Pricing'
import Nav from '../../components/Nav'

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-ink">
      <Nav />
      <div className="pt-24">
        <Pricing />
      </div>
    </div>
  )
}
