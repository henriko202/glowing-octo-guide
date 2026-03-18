const STEPS = [
  {
    n: '01',
    title: 'Connect your LinkedIn',
    body: 'Sign in with LinkedIn in one click. We request only the permissions we need — to read your posts and engage on your behalf.'
  },
  {
    n: '02',
    title: 'Engage with your circle',
    body: 'Browse posts from professionals in your industry. Comment and react with one click — each interaction is published directly to LinkedIn.'
  },
  {
    n: '03',
    title: 'Watch your SSI climb',
    body: 'LinkedIn scores you on profile strength, connections, insights, and relationships. Consistent genuine engagement moves all four pillars.'
  }
]

export default function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="bg-ink-800 px-6 py-28"
    >
      <div className="mx-auto max-w-5xl">
        <div className="mb-16 text-center">
          <p className="mb-3 text-xs font-medium uppercase tracking-widest text-gold">Process</p>
          <h2 className="font-display text-4xl font-semibold text-cream md:text-5xl">Simple by design</h2>
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
      </div>
    </section>
  )
}
