const PILLARS = [
  {
    icon: '🏆',
    title: 'Establish your brand',
    body: 'A complete profile and consistent, credible content make you discoverable to the right people.',
    pts: 25
  },
  {
    icon: '🔍',
    title: 'Find the right people',
    body: 'Connect with the decision-makers and peers in your field, not random reach.',
    pts: 25
  },
  {
    icon: '💡',
    title: 'Engage with insight',
    body: 'Comment on and react to what matters in your industry. Every interaction counts.',
    pts: 25
  },
  {
    icon: '🤝',
    title: 'Build relationships',
    body: 'Turn connections into genuine professional relationships through steady engagement.',
    pts: 25
  }
]

const IMPACT = [
  { value: '45%', label: 'more opportunities for SSI leaders vs. low-scorers', source: 'LinkedIn data' },
  { value: '5×', label: 'more profile views in the top SSI quartile', source: 'LinkedIn data' },
  { value: '+51%', label: 'more likely to be contacted by a recruiter with SSI above 70', source: 'LinkedIn data' }
]

export default function SSIExplainer() {
  return (
    <section
      id="what-is-ssi"
      className="bg-ink-800 px-6 py-28"
    >
      <div className="mx-auto max-w-5xl">
        <div className="mb-16 text-center">
          <p className="mb-3 text-xs font-medium uppercase tracking-widest text-gold">Why SSI</p>
          <h2 className="font-display text-4xl font-semibold text-cream md:text-5xl">
            The score that decides
            <br />
            <span className="italic text-gold">who finds you</span>
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-cream/60">
            Your Social Selling Index is LinkedIn&apos;s own 0–100 measure of how findable you are to recruiters and
            peers. Four pillars, 25 points each. Engagement is the fastest one to move.
          </p>
        </div>

        <div className="mb-16 grid grid-cols-1 gap-5 md:grid-cols-2">
          {PILLARS.map(pillar => (
            <div
              key={pillar.title}
              className="group rounded-2xl border border-t-2 border-cream/[0.08] border-t-gold/40 bg-ink-600 p-7 transition-all duration-300 hover:border-cream/15"
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

        <div className="rounded-2xl bg-ink-600 px-8 py-12">
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
      </div>
    </section>
  )
}
