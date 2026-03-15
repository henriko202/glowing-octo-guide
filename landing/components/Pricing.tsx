const PLANS = [
  {
    id: "starter",
    name: "Starter",
    price: "$5",
    period: "/mo",
    trial: "3-day free trial",
    description: "Get started and start engaging",
    features: ["Access the full post feed", "Manual commenting and reactions", "Mutual connections sorted first", "Posts hidden during trial"],
    cta: "Start free trial",
    href: null,
    highlight: false,
  },
  {
    id: "growth",
    name: "Growth",
    price: "$15",
    period: "/mo",
    description: "Targeted feed for faster results",
    features: ["Everything in Starter", "Feed filtered to your industry", "Feed filtered to your country", "Auto-set from your LinkedIn profile"],
    cta: "Get Growth",
    href: null,
    highlight: true,
  },
  {
    id: "pro",
    name: "Pro",
    price: "$50",
    period: "/mo",
    description: "Maximum visibility and control",
    features: ["Everything in Growth", "Custom industry + country filters", "Control who sees your posts", "3 featured posts per month"],
    cta: "Get Pro",
    href: null,
    highlight: false,
  },
  {
    id: "contact",
    name: "Enterprise",
    price: "Custom",
    period: "",
    description: "Tailored for teams and agencies",
    features: ["Everything in Pro", "More featured post slots", "Custom targeting", "Dedicated onboarding"],
    cta: "Contact us",
    href: "mailto:hello@linkintothessi.com",
    highlight: false,
  },
];

export default function Pricing() {
  const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:5173";

  return (
    <section id="pricing" className="py-28 px-6 bg-ink-800">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <p className="text-xs text-gold tracking-widest uppercase font-medium mb-3">Pricing</p>
          <h2 className="font-display text-4xl md:text-5xl font-semibold text-cream">Invest in your professional brand</h2>
          <p className="mt-4 text-cream/50 text-base max-w-lg mx-auto">
            Every tier unlocks the feed and the community. Higher tiers unlock precision.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={`relative rounded-2xl p-7 flex flex-col transition-all duration-300 ${
                plan.highlight
                  ? "border border-lnblue bg-lnblue/[0.08] shadow-[0_0_48px_rgba(0,119,181,0.2)]"
                  : "border border-cream/[0.08] bg-ink-600 hover:border-cream/15"
              }`}
            >
              {plan.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="px-3 py-1 rounded-full bg-lnblue text-cream text-xs font-semibold tracking-wide">
                    Most popular
                  </span>
                </div>
              )}
              <div className="mb-6">
                <h3 className="font-display text-xl font-semibold text-cream">{plan.name}</h3>
                <p className="text-cream/40 text-sm mt-1">{plan.description}</p>
              </div>
              <div className="mb-6">
                <span className="font-display text-4xl font-semibold text-cream">{plan.price}</span>
                {plan.period && <span className="text-cream/40 text-sm ml-1">{plan.period}</span>}
                {"trial" in plan && plan.trial && (
                  <p className="text-xs text-gold mt-2">{plan.trial}</p>
                )}
              </div>
              <ul className="space-y-2.5 mb-8 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-cream/60">
                    <span className="text-gold mt-0.5 flex-shrink-0">✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <a
                href={plan.href ?? `${APP_URL}/login`}
                className={`block text-center py-3 rounded-xl text-sm font-semibold transition-all duration-200 ${
                  plan.highlight
                    ? "bg-lnblue text-cream hover:bg-lnblue-light shadow-[0_0_20px_rgba(0,119,181,0.4)]"
                    : plan.id === "contact"
                    ? "border border-gold/40 text-gold hover:bg-gold/10"
                    : "border border-cream/15 text-cream hover:border-cream/30 hover:bg-cream/5"
                }`}
              >
                {plan.cta}
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
