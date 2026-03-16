// app/src/components/AppNav.tsx
import { Link, useLocation } from "react-router-dom";

const NAV_LINKS = [
  { path: "/feed", label: "Feed" },
  { path: "/my-posts", label: "My Posts" },
  { path: "/settings", label: "Settings" },
  { path: "/billing", label: "Billing" },
];

export default function AppNav() {
  const { pathname } = useLocation();

  function handleSignOut() {
    sessionStorage.removeItem("convexUserId");
    window.location.href = "/login";
  }

  return (
    <nav
      style={{
        background: "#0f172a",
        borderBottom: "1px solid #1e293b",
        padding: "0 16px",
        display: "flex",
        alignItems: "center",
        gap: 0,
        height: 48,
        fontFamily: "system-ui, sans-serif",
        fontSize: 14,
      }}
    >
      <span
        style={{
          color: "#e2e8f0",
          fontWeight: 700,
          marginRight: 24,
          fontSize: 13,
          letterSpacing: "0.02em",
        }}
      >
        🔗 Link Into The SSI
      </span>
      {NAV_LINKS.map((link) => (
        <Link
          key={link.path}
          to={link.path}
          style={{
            color: pathname === link.path ? "#3b82f6" : "#94a3b8",
            textDecoration: "none",
            padding: "0 12px",
            height: 48,
            display: "flex",
            alignItems: "center",
            borderBottom:
              pathname === link.path ? "2px solid #3b82f6" : "2px solid transparent",
            fontSize: 13,
            fontWeight: pathname === link.path ? 600 : 400,
          }}
        >
          {link.label}
        </Link>
      ))}
      <button
        onClick={handleSignOut}
        style={{
          marginLeft: "auto",
          background: "none",
          border: "none",
          color: "#64748b",
          cursor: "pointer",
          fontSize: 13,
          padding: "0 8px",
        }}
      >
        Sign out
      </button>
    </nav>
  );
}
