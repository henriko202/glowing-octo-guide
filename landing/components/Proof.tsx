import type { Dictionary } from '@/i18n/getDictionary'

const FOUNDER_PHOTO = '/founder.jpg' // add landing/public/founder.jpg

export default function Proof({ dict }: { dict: Dictionary['proof'] }) {
  return (
    <section
      id="proof"
      className="bg-ink px-6 py-28"
    >
      <div className="mx-auto max-w-5xl">
        <div className="mb-16 text-center">
          <p className="mb-3 text-xs font-medium tracking-widest text-gold-text uppercase">{dict.eyebrow}</p>
          <h2 className="font-display text-4xl font-semibold text-cream md:text-5xl">
            {dict.headlineLine1}
            <br />
            <span className="text-gold-text italic">{dict.headlineLine2}</span>
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {/* Founder note */}
          <div className="flex flex-col rounded-2xl border border-cream/[0.08] bg-ink-800 p-8 md:col-span-2">
            <div className="mb-5 flex items-center gap-4">
              {/* plain <img> is fine here: founder photo is a known static asset, not user content */}
              <img
                src={FOUNDER_PHOTO}
                alt={dict.founderName}
                className="h-12 w-12 rounded-full object-cover"
              />
              <div>
                <p className="text-sm font-medium text-cream">{dict.founderName}</p>
                <p className="text-xs text-cream/40">{dict.founderRole}</p>
              </div>
            </div>
            <p className="text-base leading-relaxed text-cream/70">{dict.founderMessage}</p>
          </div>

          {/* SSI proof: link out to LinkedIn's own SSI page in a new tab. We don't display the score (LinkedIn
              doesn't expose it via API); we point users to the source of truth. */}
          <div className="flex flex-col justify-center rounded-2xl border border-gold/20 bg-gold/[0.04] p-8">
            <p className="font-display text-2xl font-semibold text-cream">{dict.proofCardHeadline}</p>
            <p className="mt-3 text-sm leading-relaxed text-cream/60">{dict.proofCardBody}</p>
            <a
              href="https://www.linkedin.com/sales/ssi"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 text-sm text-gold-text underline underline-offset-4 hover:text-gold-light"
            >
              {dict.proofCardLink} →
            </a>
          </div>
        </div>

        {/* Early-access line */}
        <div className="mt-10 flex items-center justify-center">
          <p className="rounded-full border border-gold/30 bg-gold/5 px-5 py-2 text-sm text-gold-text">
            {dict.earlyAccess}
          </p>
        </div>
      </div>
    </section>
  )
}
