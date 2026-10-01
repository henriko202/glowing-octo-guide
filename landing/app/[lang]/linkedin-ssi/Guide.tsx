import Link from 'next/link'
import { PrimaryCta, SelectedOffer } from '@/components/TrialProvider'
import type { GuideContent } from './content/en'
import type { Dictionary } from '@/i18n/getDictionary'
import type { Locale } from '@/i18n/config'

export type GuideSources = { line: string; links: { label: string; url: string }[] }

const body = 'text-base leading-relaxed text-cream-muted'
const sectionHeading = 'font-display text-2xl font-semibold text-cream md:text-3xl'

// Shared by every guide route (/linkedin-ssi, /linkedin-job-search): the section keys keep the SSI
// guide's names, but each one is only a slot (cards, paragraphs + sources, numbered steps, FAQ).
export default function Guide({
  guide,
  sources,
  dict,
  lang
}: {
  guide: GuideContent
  sources: GuideSources
  dict: Dictionary
  lang: Locale
}) {
  return (
    <main className="bg-ink text-cream">
      <div className="mx-auto max-w-3xl px-6 pt-14 pb-20 md:pt-20">
        <Link
          href={`/${lang}`}
          className="inline-flex min-h-11 items-center text-sm text-cream-muted transition-colors duration-300 hover:text-cream focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold"
        >
          {guide.backHome}
        </Link>

        <header className="mt-6">
          <p className="text-xs font-medium tracking-widest text-gold-text uppercase">{guide.hero.eyebrow}</p>
          <h1 className="mt-4 font-display text-4xl leading-tight font-semibold text-balance text-cream sm:text-5xl">
            {guide.hero.headline}
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-balance text-cream-muted">{guide.hero.intro}</p>
          <p className="mt-4 text-sm text-cream-muted">{guide.hero.updated}</p>
        </header>

        <section className="mt-14 md:mt-16">
          <h2 className={sectionHeading}>{guide.pillars.heading}</h2>
          <p className={`mt-4 ${body}`}>{guide.pillars.intro}</p>
          <ul className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2">
            {guide.pillars.items.map(item => (
              <li
                key={item.title}
                className="border-t border-cream/15 pt-4"
              >
                <h3 className="text-lg font-semibold text-balance text-cream">{item.title}</h3>
                <p className={`mt-2 ${body}`}>{item.body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-14 md:mt-16">
          <h2 className={sectionHeading}>{guide.scoring.heading}</h2>
          {guide.scoring.paragraphs.map(paragraph => (
            <p
              key={paragraph}
              className={`mt-4 ${body}`}
            >
              {paragraph}
            </p>
          ))}
          <p className="mt-6 text-sm text-cream-muted">
            {sources.line}
            {sources.links.map((link, i) => (
              <span key={link.url}>
                {i === 0 ? ' ' : ' · '}
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-4 hover:text-cream focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold"
                >
                  {link.label}
                </a>
              </span>
            ))}
          </p>
        </section>

        <section className="mt-14 md:mt-16">
          <h2 className={sectionHeading}>{guide.improve.heading}</h2>
          <p className={`mt-4 ${body}`}>{guide.improve.intro}</p>
          <ol className="mt-8 space-y-6">
            {guide.improve.steps.map((step, i) => (
              <li
                key={step.title}
                className="flex gap-4"
              >
                <span
                  aria-hidden="true"
                  className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gold/15 font-display text-sm font-semibold text-gold-text"
                >
                  {i + 1}
                </span>
                <div>
                  <h3 className="text-lg font-semibold text-balance text-cream">{step.title}</h3>
                  <p className={`mt-2 ${body}`}>{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-8 rounded-lg border border-cream/15 bg-cream/[0.04] p-4 text-sm leading-relaxed text-cream-muted">
            {guide.improve.note}
          </p>
        </section>

        <section className="mt-14 md:mt-16">
          <h2 className={sectionHeading}>{guide.product.heading}</h2>
          <p className={`mt-4 ${body}`}>{guide.product.body}</p>
          <p className="mt-6">
            <Link
              href={`/${lang}#how-it-works`}
              className="inline-flex min-h-11 items-center text-sm font-medium text-gold-text underline underline-offset-4 hover:text-gold-light focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold"
            >
              {guide.product.linkLabel}
            </Link>
          </p>
        </section>

        <section className="mt-14 md:mt-16">
          <h2 className={sectionHeading}>{guide.faq.heading}</h2>
          <div className="mt-6 divide-y divide-gold">
            {guide.faq.items.map(item => (
              <div
                key={item.q}
                className="py-6"
              >
                <h3 className="text-base font-medium text-balance text-cream">{item.q}</h3>
                <p className={`mt-2 ${body}`}>{item.a}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-16 rounded-2xl border border-cream/10 bg-ink-800 px-6 py-10 text-center md:px-10">
          <h2 className="font-display text-3xl font-semibold text-balance text-cream md:text-4xl">
            {guide.cta.heading}
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-cream-muted">{guide.cta.body}</p>
          <div className="mt-8 flex flex-col items-center gap-3">
            <PrimaryCta
              placement="final"
              loginLabel={dict.hero.loginCta}
              className="inline-flex min-h-11 items-center rounded-full bg-gold px-8 py-4 font-semibold text-on-gold transition-colors hover:bg-gold-light focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold"
            >
              {dict.hero.cta}
            </PrimaryCta>
            <SelectedOffer
              dict={dict.trialOffer}
              lang={lang}
            />
            <p className="text-[13px] leading-relaxed text-cream-muted">{dict.hero.ctaDisclaimer}</p>
            <p className="text-[13px] leading-relaxed text-cream-muted">{dict.hero.ctaTrust}</p>
          </div>
        </section>
      </div>
    </main>
  )
}
