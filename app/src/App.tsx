import { type ReactNode, useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useQuery } from 'convex/react'
import { api } from './convex'
import i18n from './i18n'
import { pickSeedLanguage } from './i18n/seedLanguage'
import FeedPage from './pages/FeedPage'
import SettingsPage from './pages/SettingsPage'
import BillingPage from './pages/BillingPage'
import AuthSuccessPage from './pages/AuthSuccessPage'
import MyPostsPage from './pages/MyPostsPage'
import AdminPage from './pages/AdminPage'
import AppShell from './components/shell/AppShell'
import ScrollToTop from './components/ScrollToTop'
import Motd from './components/Motd'
import ReconnectBanner from './components/ReconnectBanner'
import FeedbackButton from './components/FeedbackButton'
import LoadingSpinner from './components/LoadingSpinner'
import BannedScreen from './components/BannedScreen'
import CancelDeletionScreen from './components/CancelDeletionScreen'
import PolicyUpdateScreen from './components/PolicyUpdateScreen'
import ConsentPromptScreen from './components/ConsentPromptScreen'
import FirstPostPromptScreen from './components/FirstPostPromptScreen'
import PrivacyDataPage from './pages/PrivacyDataPage'
import { Toaster } from './components/ui/toast'
import { POLICY_VERSION } from '../../convex/lib/policy'
import { AUTH_URL, LANDING_URL, isSignedOut } from './lib/session'

function RequireAuth({ children }: { children: ReactNode }) {
  const sessionToken = sessionStorage.getItem('sessionToken') ?? undefined
  const me = useQuery(api.users.getMe, { sessionToken })

  useEffect(() => {
    // Not authenticated. A user who explicitly signed out is sent back to the landing site so the
    // sign-out sticks (the persistent signedOut marker survives the return visit); everyone else
    // auto-starts LinkedIn OAuth (one-hop via LinkedIn's SSO).
    if (me === null) {
      window.location.href = isSignedOut() ? LANDING_URL : AUTH_URL
    }
  }, [me])

  useEffect(() => {
    if (me && !me.isBanned) {
      const hasStoredPref = localStorage.getItem('i18nextLng') !== null
      const seed = pickSeedLanguage(me.primaryLocale, ['en', 'pt', 'es'], hasStoredPref)
      if (seed) void i18n.changeLanguage(seed)
    }
  }, [me])

  if (me === undefined || me === null) return <LoadingSpinner />

  if (me.isBanned) return <BannedScreen reason={me.bannedReason ?? undefined} />

  if (me.deletionScheduledAt) return <CancelDeletionScreen deletionScheduledAt={me.deletionScheduledAt} />

  if (me.acknowledgedPolicyVersion !== POLICY_VERSION) return <PolicyUpdateScreen />

  if (!me.consentPromptedAt) return <ConsentPromptScreen />

  // Prompt every new member for their first post — even before they add a card. The post is
  // created hidden (postCreatedHidden) and the screen funnels non-subscribers to billing.
  if (!me.firstPostPromptedAt) return <FirstPostPromptScreen />

  return (
    <AppShell>
      <Motd />
      <ReconnectBanner />
      {children}
      <FeedbackButton />
    </AppShell>
  )
}

export default function App() {
  return (
    <div className="flex min-h-screen flex-col">
      <Toaster />
      <ScrollToTop />
      <Routes>
        <Route
          path="/auth/success"
          element={<AuthSuccessPage />}
        />
        <Route
          path="/feed"
          element={
            <RequireAuth>
              <FeedPage />
            </RequireAuth>
          }
        />
        <Route
          path="/my-posts"
          element={
            <RequireAuth>
              <MyPostsPage />
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
          path="/privacy-data"
          element={
            <RequireAuth>
              <PrivacyDataPage />
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
        <Route
          path="/admin"
          element={
            <RequireAuth>
              <AdminPage />
            </RequireAuth>
          }
        />
        <Route
          path="*"
          element={
            <Navigate
              to="/feed"
              replace
            />
          }
        />
      </Routes>
    </div>
  )
}
