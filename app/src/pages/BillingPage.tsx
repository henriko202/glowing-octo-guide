import { useQuery, useAction } from "convex/react";
import { api } from "../convex";

const PLANS = [
  {
    id: "starter",
    name: "Starter",
    price: "$5/mo",
    priceId: import.meta.env.VITE_STRIPE_STARTER_PRICE_ID as string | undefined,
    features: ["Basic feed", "3-day free trial", "Manual comments & reactions"],
  },
  {
    id: "growth",
    name: "Growth",
    price: "$15/mo",
    priceId: import.meta.env.VITE_STRIPE_GROWTH_PRICE_ID as string | undefined,
    features: ["Industry + country feed filter", "Auto-set from LinkedIn profile", "Posts visible to all"],
  },
  {
    id: "pro",
    name: "Pro",
    price: "$50/mo",
    priceId: import.meta.env.VITE_STRIPE_PRO_PRICE_ID as string | undefined,
    features: ["Custom industry & country filters", "Control post visibility", "3 featured posts/month"],
  },
];

export default function BillingPage() {
  const me = useQuery(api.users.getMe);
  const createCheckout = useAction(api.billing.createCheckoutSession);

  async function handleUpgrade(priceId: string) {
    try {
      const result = await createCheckout({ priceId });
      if (result?.url) window.location.href = result.url;
    } catch (err: any) {
      alert(`Checkout failed: ${err.message}`);
    }
  }

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 16px", fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: "#0f172a", marginBottom: 8 }}>Subscription</h1>
      <p style={{ color: "#64748b", fontSize: 14, marginBottom: 24 }}>
        Current plan: <strong style={{ textTransform: "capitalize" }}>{me?.tier ?? "..."}</strong>
        {me?.subscriptionStatus === "trialing" && " (trial)"}
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
        {PLANS.map((plan) => {
          const isCurrent = me?.tier === plan.id;
          const priceId = plan.priceId;
          return (
            <div
              key={plan.id}
              style={{
                border: isCurrent ? "2px solid #2563eb" : "1px solid #e2e8f0",
                borderRadius: 12,
                padding: 20,
                background: isCurrent ? "#eff6ff" : "#fff",
              }}
            >
              <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0f172a", marginTop: 0 }}>{plan.name}</h2>
              <p style={{ fontSize: 24, fontWeight: 700, color: "#0f172a", margin: "8px 0 16px" }}>{plan.price}</p>
              <ul style={{ padding: "0 0 0 16px", color: "#64748b", fontSize: 13, marginBottom: 20 }}>
                {plan.features.map((f) => <li key={f} style={{ marginBottom: 4 }}>{f}</li>)}
              </ul>
              {isCurrent ? (
                <p style={{ color: "#2563eb", fontWeight: 600, fontSize: 13, textAlign: "center" }}>Current plan</p>
              ) : (
                <button
                  onClick={() => priceId && handleUpgrade(priceId)}
                  disabled={!priceId}
                  style={{
                    width: "100%",
                    padding: "10px 0",
                    background: "#2563eb",
                    color: "#fff",
                    border: "none",
                    borderRadius: 8,
                    fontWeight: 600,
                    fontSize: 13,
                    cursor: priceId ? "pointer" : "not-allowed",
                    opacity: priceId ? 1 : 0.6,
                  }}
                >
                  Upgrade to {plan.name}
                </button>
              )}
            </div>
          );
        })}

        {/* Enterprise / Contact */}
        <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 20, background: "#fff" }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0f172a", marginTop: 0 }}>Enterprise</h2>
          <p style={{ fontSize: 24, fontWeight: 700, color: "#0f172a", margin: "8px 0 16px" }}>Custom</p>
          <ul style={{ padding: "0 0 0 16px", color: "#64748b", fontSize: 13, marginBottom: 20 }}>
            <li>Everything in Pro</li>
            <li>More featured slots</li>
            <li>Custom onboarding</li>
          </ul>
          <a
            href="mailto:hello@linkintothessi.com"
            style={{
              display: "block",
              textAlign: "center",
              padding: "10px 0",
              border: "1px solid #e2e8f0",
              borderRadius: 8,
              color: "#0f172a",
              fontSize: 13,
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            Contact us
          </a>
        </div>
      </div>
    </div>
  );
}
