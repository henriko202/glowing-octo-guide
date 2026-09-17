import Image from 'next/image'
import { FOUNDER_LINKEDIN_URL } from '@/lib/site'
import type { Dictionary } from '@/i18n/getDictionary'

const FOUNDER_PHOTO = '/founder.jpg' // add landing/public/founder.jpg

export default function Proof({ dict }: { dict: Dictionary['proof'] }) {
  return (
    <section
      id="proof"
      className="bg-ink px-6 py-14 md:py-20"
    >
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 text-center">
          <p className="mb-3 text-xs font-medium tracking-widest text-gold-text uppercase">{dict.eyebrow}</p>
          <h2 className="font-display text-4xl font-semibold text-cream md:text-5xl">
            {dict.headlineLine1}
            <br />
            <span className="text-gold-text">{dict.headlineLine2}</span>
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* Founder note */}
          <div className="flex flex-col rounded-2xl border border-cream/[0.08] bg-ink-800 p-6">
            <div className="mb-5 flex items-center gap-4">
              <Image
                src={FOUNDER_PHOTO}
                alt={dict.founderName}
                width={48}
                height={48}
                className="h-12 w-12 rounded-full object-cover"
              />
              <div>
                <a
                  href={FOUNDER_LINKEDIN_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={dict.founderProfileLabel.replace('{{name}}', dict.founderName)}
                  className="text-sm font-medium text-cream underline decoration-cream/30 underline-offset-4 hover:decoration-cream focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold"
                >
                  {dict.founderName}
                </a>
                <p className="text-sm text-cream-muted">{dict.founderRole}</p>
              </div>
            </div>
            <p className="text-base leading-relaxed text-cream-muted">{dict.founderMessage}</p>
          </div>

          <div className="flex flex-col justify-center rounded-2xl border border-gold/20 bg-gold/[0.04] p-6">
            <h3 className="text-xl font-semibold text-cream">{dict.recapLabel}</h3>
            <ul className="mt-4 grid gap-3 text-sm text-cream">
              {dict.recapFields.map(field => (
                <li
                  key={field}
                  className="border-b border-cream/10 pb-3"
                >
                  {field}
                </li>
              ))}
            </ul>
            <p className="mt-4 text-sm leading-relaxed text-cream-muted">{dict.proofCardBody}</p>
            <p className="mt-4 text-sm font-medium text-cream-muted">
              <a
                href="https://www.linkedin.com/sales/ssi"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-4 hover:text-cream focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold"
              >
                {dict.proofCardNote}
              </a>
            </p>
          </div>
        </div>

        {/* Early-access line */}
        <div className="mt-6 flex items-center justify-center">
          <p className="rounded-full border border-gold/30 bg-gold/5 px-5 py-2 text-sm text-gold-text">
            {dict.earlyAccess}
          </p>
        </div>
      </div>
    </section>
  )
}
