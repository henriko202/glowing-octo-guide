const STEPS = [
  {
    n: '01',
    title: 'Connect LinkedIn',
    body: 'Sign in with LinkedIn and land in a feed of professionals in your field, everyone posting under their own identity. Nothing automated.'
  },
  {
    n: '02',
    title: 'Engage where it counts',
    body: 'React and comment on the posts that matter in your field. Every genuine interaction feeds all four SSI pillars: brand, network, insight, and relationships.'
  },
  {
    n: '03',
    title: 'Recruiters start finding you',
    body: 'As your SSI climbs, you surface in more searches and feeds, so the right people reach you first.'
  }
]

export default function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="bg-ink px-6 py-28"
    >
      <div className="mx-auto max-w-5xl">
        <div className="mb-16 text-center">
          <p className="mb-3 text-xs font-medium uppercase tracking-widest text-gold">How it works</p>
          <h2 className="font-display text-4xl font-semibold text-cream md:text-5xl">Get found in three steps</h2>
        </div>
        <div className="grid grid-cols-1 gap-10 md:grid-cols-3">
          {STEPS.map(step => (
            <div
              key={step.n}
              className="group relative"
            >
              <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-full border border-cream/15 transition-colors group-hover:border-gold/40">
                <span className="font-display text-xl font-semibold text-cream/40 transition-colors group-hover:text-gold">
                  {step.n}
                </span>
              </div>
              <h3 className="mb-3 font-display text-2xl font-semibold text-cream">{step.title}</h3>
              <p className="text-sm leading-relaxed text-cream/50">{step.body}</p>
            </div>
          ))}
        </div>
        {/* Network-effect line */}
        <p className="mt-14 text-center font-display text-xl italic text-gold/80">
          The more professionals join, the more relevant your feed becomes.
        </p>
      </div>
    </section>
  )
}
