import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { useTranslation } from "react-i18next";
import type { Id } from "../../../convex/_generated/dataModel";
import { api } from "../convex";

/** Safe user profile as returned by the getMe query (no token fields) */
interface MeProfile {
  _id: string;
  linkedinId: string;
  name: string;
  headline?: string;
  profilePictureUrl?: string;
  industry?: string;
  country?: string;
  tier: "starter" | "growth" | "pro" | "contact";
  subscriptionStatus: "trialing" | "active" | "canceled" | "past_due" | "none";
  trialEndsAt?: number;
  stripeCustomerId?: string;
  linkedinPublicIdentifier?: string;
  createdAt: number;
}

/** Extract LinkedIn vanityName from a profile URL or bare username */
function extractVanityName(input: string): string | null {
  const trimmed = input.trim();
  try {
    const u = new URL(trimmed);
    const m = u.pathname.match(/^\/in\/([^/?#]+)/);
    return m ? m[1].toLowerCase() : null;
  } catch {
    // Also accept bare vanityNames like "henriko202" or "@henriko202"
    const bare = trimmed.replace(/^@/, "");
    return /^[a-zA-Z0-9-]+$/.test(bare) ? bare.toLowerCase() : null;
  }
}

export default function SettingsPage() {
  const { t } = useTranslation();
  const userId = (sessionStorage.getItem("convexUserId") ?? undefined) as Id<"users"> | undefined;
  const me = useQuery(api.users.getMe, { userId }) as MeProfile | null | undefined;
  const setPublicIdentifier = useMutation(api.users.setPublicIdentifier);

  const [profileUrl, setProfileUrl] = useState("");
  const [identifierSaving, setIdentifierSaving] = useState(false);
  const [identifierSaved, setIdentifierSaved] = useState(false);

  if (!me) {
    return <div style={{ padding: 32, fontFamily: "system-ui, sans-serif" }}>{t("auth.loading")}</div>;
  }

  const isPro = me.tier === "pro" || me.tier === "contact";
  const extractedVanity = extractVanityName(profileUrl);

  async function handleSaveIdentifier() {
    if (!userId || !extractedVanity) return;
    setIdentifierSaving(true);
    try {
      await setPublicIdentifier({ userId, publicIdentifier: extractedVanity });
      setProfileUrl("");
      setIdentifierSaved(true);
      setTimeout(() => setIdentifierSaved(false), 3000);
    } finally {
      setIdentifierSaving(false);
    }
  }

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
          {t("settings.industry")}: {me.industry ?? t("settings.notSet")}
        </p>
        <p style={{ color: "#64748b", fontSize: 14, margin: "4px 0" }}>
          {t("settings.country")}: {me.country ?? t("settings.notSet")}
        </p>
        <p style={{ color: "#94a3b8", fontSize: 12, marginTop: 8, marginBottom: 0 }}>
          {t("settings.profileNote")}
        </p>
      </section>

      {/* LinkedIn identity — required for post ownership verification */}
      <section
        style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 20, marginBottom: 16 }}
      >
        <h2 style={{ fontSize: 16, fontWeight: 600, color: "#0f172a", marginTop: 0, marginBottom: 4 }}>
          LinkedIn Identity
        </h2>
        <p style={{ color: "#64748b", fontSize: 13, marginTop: 0, marginBottom: 12 }}>
          {me.linkedinPublicIdentifier ? (
            <>
              Verified as{" "}
              <a
                href={`https://www.linkedin.com/in/${me.linkedinPublicIdentifier}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "#3b82f6", textDecoration: "none", fontWeight: 600 }}
              >
                {me.linkedinPublicIdentifier}
              </a>
              . Update below if your profile URL changes.
            </>
          ) : (
            "Set your LinkedIn profile URL so we can verify that submitted posts belong to your account."
          )}
        </p>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            type="text"
            value={profileUrl}
            onChange={(e) => setProfileUrl(e.target.value)}
            placeholder={
              me.linkedinPublicIdentifier
                ? `https://www.linkedin.com/in/${me.linkedinPublicIdentifier}`
                : "https://www.linkedin.com/in/your-name"
            }
            style={{
              flex: 1,
              padding: "7px 10px",
              borderRadius: 6,
              border: "1px solid #cbd5e1",
              fontSize: 13,
              outline: "none",
            }}
          />
          <button
            onClick={handleSaveIdentifier}
            disabled={!extractedVanity || identifierSaving}
            style={{
              background: identifierSaved ? "#22c55e" : "#3b82f6",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              padding: "7px 16px",
              fontSize: 13,
              cursor: !extractedVanity || identifierSaving ? "not-allowed" : "pointer",
              opacity: !extractedVanity || identifierSaving ? 0.6 : 1,
              whiteSpace: "nowrap",
              transition: "background 0.2s",
            }}
          >
            {identifierSaved ? "Saved ✓" : identifierSaving ? "Saving…" : "Save"}
          </button>
        </div>
        {profileUrl && !extractedVanity && (
          <p style={{ fontSize: 12, color: "#ef4444", marginTop: 6, marginBottom: 0 }}>
            Couldn't extract a username from that URL. Try: https://www.linkedin.com/in/your-name
          </p>
        )}
        {extractedVanity && (
          <p style={{ fontSize: 12, color: "#64748b", marginTop: 6, marginBottom: 0 }}>
            Will save as: <strong>{extractedVanity}</strong>
          </p>
        )}
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
