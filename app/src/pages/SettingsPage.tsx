import { useQuery } from "convex/react";
import { useTranslation } from "react-i18next";
import { api } from "../convex";

export default function SettingsPage() {
  const { t } = useTranslation();
  const me = useQuery(api.users.getMe);

  if (!me) {
    return <div style={{ padding: 32, fontFamily: "system-ui, sans-serif" }}>{t("auth.loading")}</div>;
  }

  const isPro = me.tier === "pro" || me.tier === "contact";

  return (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: "32px 16px", fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: "#0f172a", marginBottom: 24 }}>{t("settings.title")}</h1>

      <section
        style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 20, marginBottom: 16 }}
      >
        <h2 style={{ fontSize: 16, fontWeight: 600, color: "#0f172a", marginTop: 0, marginBottom: 12 }}>
          {t("settings.profile")}
        </h2>
        <p style={{ color: "#64748b", fontSize: 14, margin: "4px 0" }}>
          {t("settings.industry")}: {(me as any).industry ?? t("settings.notSet")}
        </p>
        <p style={{ color: "#64748b", fontSize: 14, margin: "4px 0" }}>
          {t("settings.country")}: {(me as any).country ?? t("settings.notSet")}
        </p>
        <p style={{ color: "#94a3b8", fontSize: 12, marginTop: 8, marginBottom: 0 }}>
          {t("settings.profileNote")}
        </p>
      </section>

      {isPro ? (
        <section
          style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 20 }}
        >
          <h2 style={{ fontSize: 16, fontWeight: 600, color: "#0f172a", marginTop: 0, marginBottom: 8 }}>
            {t("settings.visibility")}
          </h2>
          <p style={{ color: "#64748b", fontSize: 14, marginBottom: 12 }}>
            {t("settings.visibilityNote")}
          </p>
          <p style={{ color: "#3b82f6", fontSize: 13 }}>
            {t("settings.visibilityComingSoon")}
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
            {t("settings.upgradePrompt")}
          </p>
        </section>
      )}
    </div>
  );
}
