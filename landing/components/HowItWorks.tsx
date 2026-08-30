import type { Dictionary } from '@/i18n/getDictionary'

export default function HowItWorks({ dict }: { dict: Dictionary['howItWorks'] }) {
  return (
    <section
      id="how-it-works"
      className="bg-ink px-6 py-28"
    >
      <div className="mx-auto max-w-5xl">
        <div className="mb-16 text-center">
          <p className="mb-3 text-xs font-medium tracking-widest text-gold-text uppercase">{dict.eyebrow}</p>
          <h2 className="font-display text-4xl font-semibold text-cream md:text-5xl">{dict.headline}</h2>
        </div>
        <div className="grid grid-cols-1 gap-10 md:grid-cols-3">
          {dict.steps.map((step, i) => (
            <div
              key={i}
              className="group relative"
            >
              <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-full border border-gold/20 transition-colors duration-300 group-hover:border-gold/40 dark:border-cream/15">
                <span className="font-display text-xl font-semibold text-cream/60 transition-colors duration-300 group-hover:text-gold-text dark:text-cream/40">
                  {String(i + 1).padStart(2, '0')}
                </span>
              </div>
              <h3 className="mb-3 font-display text-2xl font-semibold text-cream">{step.title}</h3>
              <p className="text-sm leading-relaxed text-cream/70 dark:text-cream/50">{step.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
