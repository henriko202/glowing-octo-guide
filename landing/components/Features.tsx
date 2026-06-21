const FEATURES = [
  {
    icon: '⊙',
    title: 'Your industry, front and center',
    body: 'Growth and Pro members see posts from their own field first, so you engage where it moves your SSI.',
    tier: 'Growth+'
  },
  {
    icon: '✎',
    title: 'Comment with confidence',
    body: 'Get a suggested reaction and a draft comment in your own voice, so you engage in seconds instead of overthinking it.',
    tier: 'All tiers'
  },
  {
    icon: '◈',
    title: 'Control your reach',
    body: 'Choose who sees your posts with industry and country targeting. Maximum visibility when it counts.',
    tier: 'Pro'
  }
]

export default function Features() {
  return (
    <section
      id="features"
      className="bg-ink-800 px-6 py-28"
    >
      <div className="mx-auto max-w-5xl">
        <div className="mb-16 text-center">
          <p className="mb-3 text-xs font-medium uppercase tracking-widest text-gold">Platform</p>
          <h2 className="font-display text-4xl font-semibold text-cream md:text-5xl">Built for deliberate growth</h2>
        </div>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {FEATURES.map(f => (
            <div
              key={f.title}
              className="group rounded-2xl border border-cream/[0.08] bg-ink-600 p-7 transition-all duration-300 hover:border-cream/15"
            >
              <div className="mb-5 flex items-start justify-between">
                <span className="text-2xl text-gold opacity-70 transition-opacity group-hover:opacity-100">
                  {f.icon}
                </span>
                <span className="rounded-full border border-cream/10 px-2.5 py-1 text-xs font-medium text-cream/30">
                  {f.tier}
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
