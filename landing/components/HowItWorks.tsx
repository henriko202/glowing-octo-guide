const STEPS = [
  {
    n: "01",
    title: "Connect your LinkedIn",
    body: "Sign in with LinkedIn in one click. We request only the permissions we need — to read your posts and engage on your behalf.",
  },
  {
    n: "02",
    title: "Engage with your circle",
    body: "Browse posts from professionals in your industry. Comment and react with one click — each interaction is published directly to LinkedIn.",
  },
  {
    n: "03",
    title: "Watch your SSI climb",
    body: "LinkedIn scores you on profile strength, connections, insights, and relationships. Consistent genuine engagement moves all four pillars.",
  },
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="py-28 px-6 bg-ink-800">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-16">
          <p className="text-xs text-gold tracking-widest uppercase font-medium mb-3">Process</p>
          <h2 className="font-display text-4xl md:text-5xl font-semibold text-cream">Simple by design</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          {STEPS.map((step) => (
            <div key={step.n} className="group relative">
              <div className="w-14 h-14 rounded-full border border-cream/15 flex items-center justify-center mb-6 group-hover:border-gold/40 transition-colors">
                <span className="font-display text-xl font-semibold text-cream/40 group-hover:text-gold transition-colors">
                  {step.n}
                </span>
              </div>
              <h3 className="font-display text-2xl font-semibold text-cream mb-3">{step.title}</h3>
              <p className="text-cream/50 text-sm leading-relaxed">{step.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
