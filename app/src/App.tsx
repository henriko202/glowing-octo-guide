import { Routes, Route, Navigate } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "./convex";
import LoginPage from "./pages/LoginPage";
import FeedPage from "./pages/FeedPage";
import SettingsPage from "./pages/SettingsPage";
import BillingPage from "./pages/BillingPage";
import AuthSuccessPage from "./pages/AuthSuccessPage";

// Placeholder pages — implemented in Tasks 12-15
function PlaceholderPage({ name }: { name: string }) {
  return <div style={{ padding: 32 }}>{name} — coming soon</div>;
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const me = useQuery(api.users.getMe);
  if (me === undefined) return <div style={{ padding: 32 }}>Loading...</div>;
  if (me === null) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/auth/success" element={<AuthSuccessPage />} />
      <Route
        path="/feed"
        element={
          <RequireAuth>
            <FeedPage />
          </RequireAuth>
        }
      />
      <Route
        path="/settings"
        element={
          <RequireAuth>
            <SettingsPage />
          </RequireAuth>
        }
      />
      <Route
        path="/billing"
        element={
          <RequireAuth>
            <BillingPage />
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/feed" replace />} />
    </Routes>
  );
}
