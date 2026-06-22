import type { Dictionary } from '../i18n/getDictionary'

export default function PainBeat({ dict }: { dict: Dictionary['painBeat'] }) {
  return (
    <section
      id="the-problem"
      className="bg-ink-800 px-6 py-28"
    >
      <div className="mx-auto max-w-3xl text-center">
        <p className="mb-3 text-xs font-medium tracking-widest text-gold-text uppercase">{dict.eyebrow}</p>
        <h2 className="font-display text-4xl leading-tight font-semibold text-cream md:text-5xl">
          {dict.headlineLine1}
          <br />
          <span className="text-cream/50 italic">{dict.headlineLine2}</span>
        </h2>
        <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-cream/60">{dict.body}</p>
      </div>
    </section>
  )
}
