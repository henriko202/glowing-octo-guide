// Honest, pre-launch proof. No fabricated counts/testimonials.
// FOUNDER: Henriko replaces these placeholder values with the real photo/name/message.
const FOUNDER = {
  name: 'Henriko',
  role: 'Founder · Frontend Specialist (7+ years)',
  photo: '/founder.jpg', // add landing/public/founder.jpg
  message:
    'I’m Henriko, a frontend specialist with 7+ years in the industry. I built Link Into The SSI because good people stay invisible on LinkedIn while the algorithm rewards activity. We launched recently, so you won’t find inflated numbers here. Just the mechanism, real growth in your own SSI, and an honest invitation to be early.'
}

export default function Proof() {
  return (
    <section
      id="proof"
      className="bg-ink px-6 py-28"
    >
      <div className="mx-auto max-w-5xl">
        <div className="mb-16 text-center">
          <p className="mb-3 text-xs font-medium uppercase tracking-widest text-gold">No hype</p>
          <h2 className="font-display text-4xl font-semibold text-cream md:text-5xl">
            We just launched.
            <br />
            <span className="italic text-gold">We won&apos;t inflate the numbers.</span>
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {/* Founder note */}
          <div className="flex flex-col rounded-2xl border border-cream/[0.08] bg-ink-800 p-8 md:col-span-2">
            <div className="mb-5 flex items-center gap-4">
              {/* plain <img> is fine here: founder photo is a known static asset, not user content */}
              <img
                src={FOUNDER.photo}
                alt={FOUNDER.name}
                className="h-12 w-12 rounded-full object-cover"
              />
              <div>
                <p className="text-sm font-medium text-cream">{FOUNDER.name}</p>
                <p className="text-xs text-cream/40">{FOUNDER.role}</p>
              </div>
            </div>
            <p className="text-base leading-relaxed text-cream/70">{FOUNDER.message}</p>
          </div>

          {/* SSI proof: link out to LinkedIn's own SSI page in a new tab. We don't display the score (LinkedIn
              doesn't expose it via API); we point users to the source of truth. */}
          <div className="flex flex-col justify-center rounded-2xl border border-gold/20 bg-gold/[0.04] p-8">
            <p className="font-display text-2xl font-semibold text-cream">The only proof that matters is your own.</p>
            <p className="mt-3 text-sm leading-relaxed text-cream/60">
              See real growth in your SSI number from day one, measured on LinkedIn itself, not by us.
            </p>
            <a
              href="https://www.linkedin.com/sales/ssi"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 text-sm text-gold underline underline-offset-4 hover:text-gold-light"
            >
              Check your current SSI on LinkedIn →
            </a>
          </div>
        </div>

        {/* Early-access line */}
        <div className="mt-10 flex items-center justify-center">
          <p className="rounded-full border border-gold/30 bg-gold/5 px-5 py-2 text-sm text-gold">
            Be one of the first in. Make it count.
          </p>
        </div>
      </div>
    </section>
  )
}
