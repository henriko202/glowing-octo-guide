const FEATURES = [
  {
    icon: "⊙",
    title: "Your industry, front and center",
    body: "Growth and Pro members see posts from their own industry first — no noise from unrelated sectors.",
    tier: "Growth+",
  },
  {
    icon: "⇅",
    title: "Mutual connections first",
    body: "Posts from LinkedIn users you already know appear at the top of your feed. The circle reinforces itself.",
    tier: "All tiers",
  },
  {
    icon: "★",
    title: "Featured posts",
    body: "Pin up to 3 of your posts per month to the top of every member's feed. Maximum visibility when it counts.",
    tier: "Pro",
  },
  {
    icon: "⊕",
    title: "Recruiter radar",
    body: "Active recruiters searching in your domain are surfaced automatically. Be seen by the right people.",
    tier: "Coming soon",
  },
];

export default function Features() {
  return (
    <section id="features" className="py-28 px-6 bg-ink">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-16">
          <p className="text-xs text-gold tracking-widest uppercase font-medium mb-3">Platform</p>
          <h2 className="font-display text-4xl md:text-5xl font-semibold text-cream">Built for deliberate growth</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {FEATURES.map((f) => (
            <div key={f.title} className="group p-7 rounded-2xl border border-cream/[0.08] bg-ink-800 hover:border-cream/15 hover:bg-ink-600 transition-all duration-300">
              <div className="flex items-start justify-between mb-5">
                <span className="text-2xl text-gold opacity-70 group-hover:opacity-100 transition-opacity">{f.icon}</span>
                <span className="text-xs text-cream/30 font-medium px-2.5 py-1 rounded-full border border-cream/10">{f.tier}</span>
              </div>
              <h3 className="font-display text-xl font-semibold text-cream mb-2">{f.title}</h3>
              <p className="text-cream/50 text-sm leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
