import Link from 'next/link'
import type { Dictionary } from '@/i18n/getDictionary'
import type { Locale } from '@/i18n/config'

const SSI_SOURCE_URL = 'https://business.linkedin.com/sales-solutions/social-selling'

export default function SSIExplainer({ dict, lang }: { dict: Dictionary['ssiExplainer']; lang: Locale }) {
  return (
    <section
      id="what-is-ssi"
      className="bg-ink-800 px-6 py-14 md:py-20"
    >
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 text-center">
          <p className="mb-3 text-xs font-medium tracking-widest text-gold-text uppercase">{dict.eyebrow}</p>
          <h2 className="font-display text-4xl font-semibold text-cream md:text-5xl">
            {dict.headlineLine1}
            <br />
            <span className="text-gold-text">{dict.headlineLine2}</span>
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-cream-muted">{dict.intro}</p>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {dict.pillars.map(pillar => (
            <div
              key={pillar.title}
              className="border-t border-cream/15 pt-4"
            >
              <div className="mb-3 flex items-start justify-between">
                <span
                  aria-hidden="true"
                  className="text-xl"
                >
                  {pillar.icon}
                </span>
                <span className="rounded-full bg-cream/[0.08] px-2.5 py-1 text-[13px] font-medium text-cream-muted dark:bg-cream/[0.06]">
                  {pillar.pts} pts
                </span>
              </div>
              <h3 className="mb-2 text-xl font-semibold text-balance text-cream">{pillar.title}</h3>
              <p className="text-base leading-relaxed text-pretty text-cream-muted">{pillar.body}</p>
            </div>
          ))}
        </div>

        <p className="mx-auto mt-10 max-w-2xl text-center text-sm text-cream-muted">
          {dict.sourceLine}{' '}
          <a
            href={SSI_SOURCE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-4 hover:text-cream focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold"
          >
            {dict.sourceLabel}
          </a>
        </p>
        <p className="mt-4 text-center">
          <Link
            href={`/${lang}/linkedin-ssi`}
            className="inline-flex min-h-11 items-center text-sm font-medium text-gold-text underline underline-offset-4 hover:text-gold-light focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold"
          >
            {dict.guideLink}
          </Link>
        </p>
      </div>
    </section>
  )
}
