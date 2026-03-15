const CONVEX_SITE_URL = import.meta.env.VITE_CONVEX_SITE_URL as string | undefined;
const AUTH_URL = `${CONVEX_SITE_URL ?? "http://localhost:3210"}/auth/linkedin`;

export default function LoginPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f8fafc",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div style={{ maxWidth: 400, width: "100%", padding: 32, textAlign: "center" }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: "#0f172a", marginBottom: 8 }}>
          Link Into The SSI
        </h1>
        <p style={{ color: "#64748b", marginBottom: 32, fontSize: 15 }}>
          Grow your LinkedIn SSI by engaging with your community.
        </p>
        <a
          href={AUTH_URL}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "12px 24px",
            background: "#0077B5",
            color: "#fff",
            borderRadius: 8,
            fontWeight: 600,
            textDecoration: "none",
            fontSize: 15,
          }}
        >
          Sign in with LinkedIn
        </a>
      </div>
    </div>
  );
}
