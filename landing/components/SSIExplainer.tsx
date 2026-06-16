const PILLARS = [
  {
    icon: '🏆',
    title: 'Establish Your Brand',
    body: 'A complete profile and consistent thought leadership content make you discoverable to the right people.',
    pts: 25
  },
  {
    icon: '🔍',
    title: 'Find the Right People',
    body: "Connecting with decision-makers and peers in your field using LinkedIn's search and recommendations.",
    pts: 25
  },
  {
    icon: '💡',
    title: 'Engage with Insights',
    body: 'Sharing, commenting on, and reacting to content that matters in your industry. Every interaction counts.',
    pts: 25
  },
  {
    icon: '🤝',
    title: 'Build Relationships',
    body: 'Turning connections into genuine professional relationships through consistent, meaningful engagement.',
    pts: 25
  }
]

const IMPACT = [
  {
    value: '45%',
    label: 'more opportunities unlocked by SSI leaders vs. low-scorers',
    source: 'LinkedIn data'
  },
  {
    value: '5×',
    label: 'more profile views for professionals in the top SSI quartile',
    source: 'LinkedIn data'
  },
  {
    value: '+51%',
    label: 'more likely to be contacted by a recruiter with SSI above 70',
    source: 'LinkedIn data'
  }
]

export default function SSIExplainer() {
  return (
    <section
      id="what-is-ssi"
      className="bg-ink px-6 py-28"
    >
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="mb-16 text-center">
          <p className="mb-3 text-xs font-medium uppercase tracking-widest text-gold">Understanding SSI</p>
          <h2 className="font-display text-4xl font-semibold text-cream md:text-5xl">
            Your LinkedIn SSI —
            <br />
            <span className="italic text-gold">the score that determines who finds you</span>
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-cream/60">
            LinkedIn gives every profile a Social Selling Index score from 0–100. It measures how actively you build
            your brand, find the right people, engage with insights, and develop relationships.
          </p>
        </div>

        {/* 4 Pillar cards */}
        <div className="mb-16 grid grid-cols-1 gap-5 md:grid-cols-2">
          {PILLARS.map(pillar => (
            <div
              key={pillar.title}
              className="group rounded-2xl border border-t-2 border-cream/[0.08] border-t-gold/40 bg-ink-800 p-7 transition-all duration-300 hover:border-cream/15 hover:bg-ink-600"
            >
              <div className="mb-5 flex items-start justify-between">
                <span className="text-2xl">{pillar.icon}</span>
                <span className="rounded-full border border-cream/10 px-2.5 py-1 text-xs font-medium text-cream/30">
                  {pillar.pts} pts
                </span>
              </div>
              <h3 className="mb-2 font-display text-xl font-semibold text-cream">{pillar.title}</h3>
              <p className="text-sm leading-relaxed text-cream/50">{pillar.body}</p>
            </div>
          ))}
        </div>

        {/* Impact stats row */}
        <div className="rounded-2xl bg-ink-800 px-8 py-12">
          <div className="grid grid-cols-1 gap-10 text-center md:grid-cols-3 md:gap-0 md:divide-x md:divide-gold/20">
            {IMPACT.map(stat => (
              <div
                key={stat.value}
                className="px-6"
              >
                <p className="font-display text-6xl font-semibold text-gold">{stat.value}</p>
                <p className="mx-auto mt-3 max-w-[180px] text-sm leading-relaxed text-cream/60">{stat.label}</p>
                <p className="mt-2 text-xs text-cream/25">{stat.source}</p>
              </div>
            ))}
          </div>
        </div>

        {/* In-section CTA hook */}
        <div className="mt-12 text-center">
          <a
            href="#how-it-works"
            className="group text-sm text-cream/50 transition-colors hover:text-cream"
          >
            Most professionals score below 50. See how to change that.
            <span className="ml-1.5 inline-block text-gold transition-transform group-hover:translate-x-1">→</span>
          </a>
        </div>
      </div>
    </section>
  )
}
