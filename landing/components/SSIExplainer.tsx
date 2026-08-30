import type { Dictionary } from '@/i18n/getDictionary'

export default function SSIExplainer({ dict }: { dict: Dictionary['ssiExplainer'] }) {
  return (
    <section
      id="what-is-ssi"
      className="bg-ink-800 px-6 py-28"
    >
      <div className="mx-auto max-w-5xl">
        <div className="mb-16 text-center">
          <p className="mb-3 text-xs font-medium tracking-widest text-gold-text uppercase">{dict.eyebrow}</p>
          <h2 className="font-display text-4xl font-semibold text-cream md:text-5xl">
            {dict.headlineLine1}
            <br />
            <span className="text-gold-text italic">{dict.headlineLine2}</span>
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-cream/60">{dict.intro}</p>
        </div>

        <div className="mb-16 grid grid-cols-1 gap-5 md:grid-cols-2">
          {dict.pillars.map(pillar => (
            <div
              key={pillar.title}
              className="group rounded-2xl border border-cream/[0.08] bg-ink-600 p-7 transition-all duration-300 hover:border-cream/15"
            >
              <div className="mb-5 flex items-start justify-between">
                <span className="text-2xl">{pillar.icon}</span>
                <span className="rounded-full border border-gold/15 px-2.5 py-1 text-xs font-medium text-cream/30 dark:border-cream/10">
                  {pillar.pts} pts
                </span>
              </div>
              <h3 className="mb-2 font-display text-xl font-semibold text-cream">{pillar.title}</h3>
              <p className="text-sm leading-relaxed text-cream/50">{pillar.body}</p>
            </div>
          ))}
        </div>

        <div className="rounded-2xl bg-ink-600 px-8 py-12">
          <div className="grid grid-cols-1 gap-10 text-center md:grid-cols-3 md:gap-0 md:divide-x md:divide-gold/20">
            {dict.stats.map(stat => (
              <div
                key={stat.value}
                className="px-6"
              >
                <p className="font-display text-6xl font-semibold text-gold-text">{stat.value}</p>
                <p className="mx-auto mt-3 max-w-[180px] text-sm leading-relaxed text-cream/60">{stat.label}</p>
                <p className="mt-2 text-xs text-cream/50 dark:text-cream/25">{stat.source}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
