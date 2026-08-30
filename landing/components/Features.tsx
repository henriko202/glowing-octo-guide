import type { Dictionary } from '../i18n/getDictionary'

export default function Features({ dict, tiers }: { dict: Dictionary['features']; tiers: Dictionary['tiers'] }) {
  return (
    <section
      id="features"
      className="bg-ink-800 px-6 py-28"
    >
      <div className="mx-auto max-w-5xl">
        <div className="mb-16 text-center">
          <p className="mb-3 text-xs font-medium tracking-widest text-gold-text uppercase">{dict.eyebrow}</p>
          <h2 className="font-display text-4xl font-semibold text-cream md:text-5xl">{dict.headline}</h2>
        </div>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {dict.items.map(f => (
            <div
              key={f.title}
              className="group rounded-2xl border border-cream/[0.08] bg-ink-600 p-7 transition-all duration-300 hover:border-cream/15"
            >
              <div className="mb-5 flex items-start justify-between">
                <span className="text-2xl text-gold-text opacity-70 transition-opacity duration-300 group-hover:opacity-100">
                  {f.icon}
                </span>
                <span className="rounded-full border border-gold/15 px-2.5 py-1 text-xs font-medium text-cream/30 dark:border-cream/10">
                  {tiers[f.tier as keyof typeof tiers]}
                </span>
              </div>
              <h3 className="mb-2 font-display text-xl font-semibold text-cream">{f.title}</h3>
              <p className="text-sm leading-relaxed text-cream/50">{f.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
