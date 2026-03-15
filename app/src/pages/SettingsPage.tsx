import { useQuery } from "convex/react";
import { api } from "../convex";

export default function SettingsPage() {
  const me = useQuery(api.users.getMe);

  if (!me) {
    return <div style={{ padding: 32, fontFamily: "system-ui, sans-serif" }}>Loading...</div>;
  }

  const isPro = me.tier === "pro" || me.tier === "contact";

  return (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: "32px 16px", fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: "#0f172a", marginBottom: 24 }}>Settings</h1>

      <section
        style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 20, marginBottom: 16 }}
      >
        <h2 style={{ fontSize: 16, fontWeight: 600, color: "#0f172a", marginTop: 0, marginBottom: 12 }}>
          Your Profile
        </h2>
        <p style={{ color: "#64748b", fontSize: 14, margin: "4px 0" }}>
          Industry: {(me as any).industry ?? "Not set"}
        </p>
        <p style={{ color: "#64748b", fontSize: 14, margin: "4px 0" }}>
          Country: {(me as any).country ?? "Not set"}
        </p>
        <p style={{ color: "#94a3b8", fontSize: 12, marginTop: 8, marginBottom: 0 }}>
          Profile data is synced automatically from LinkedIn.
        </p>
      </section>

      {isPro ? (
        <section
          style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 20 }}
        >
          <h2 style={{ fontSize: 16, fontWeight: 600, color: "#0f172a", marginTop: 0, marginBottom: 8 }}>
            Who can see your posts
          </h2>
          <p style={{ color: "#64748b", fontSize: 14, marginBottom: 12 }}>
            Restrict which industries and countries can see your posts. Leave empty to show to all users.
          </p>
          <p style={{ color: "#3b82f6", fontSize: 13 }}>
            Filter configuration coming soon.
          </p>
        </section>
      ) : (
        <section
          style={{
            background: "#eff6ff",
            border: "1px solid #bfdbfe",
            borderRadius: 12,
            padding: 20,
          }}
        >
          <p style={{ color: "#1d4ed8", fontSize: 14, margin: 0 }}>
            Upgrade to <strong>Pro</strong> to control who sees your posts.
          </p>
        </section>
      )}
    </div>
  );
}
