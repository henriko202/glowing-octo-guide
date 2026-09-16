import type { Dictionary } from '@/i18n/getDictionary'

export default function Positioning({ dict }: { dict: Dictionary['positioning'] }) {
  return (
    <section
      id="why-lissi"
      className="bg-ink-800 px-6 py-14 md:py-20"
    >
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 text-center">
          <p className="mb-3 text-xs font-medium tracking-widest text-gold-text uppercase">{dict.eyebrow}</p>
          <h2 className="font-display text-4xl font-semibold text-balance text-cream md:text-5xl">{dict.headline}</h2>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-pretty text-cream-muted">{dict.intro}</p>
        </div>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {dict.points.map(point => (
            <div
              key={point.title}
              className="rounded-2xl border border-gold/20 bg-gold/[0.04] p-5 md:p-6"
            >
              <h3 className="mb-2 text-xl font-semibold text-balance text-cream">{point.title}</h3>
              <p className="text-base leading-relaxed text-pretty text-cream-muted">{point.body}</p>
            </div>
          ))}
        </div>
        <p className="mt-8 text-center text-sm font-medium text-cream">{dict.closing}</p>
      </div>
    </section>
  )
}
