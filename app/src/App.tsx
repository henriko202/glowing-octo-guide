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
import AppNav from './components/AppNav'
import LoadingSpinner from './components/LoadingSpinner'
import BannedScreen from './components/BannedScreen'
import CancelDeletionScreen from './components/CancelDeletionScreen'
import PolicyUpdateScreen from './components/PolicyUpdateScreen'
import ConsentPromptScreen from './components/ConsentPromptScreen'
import PrivacyDataPage from './pages/PrivacyDataPage'
import { POLICY_VERSION } from '../../convex/lib/policy'

const CONVEX_SITE_URL = import.meta.env.VITE_CONVEX_SITE as string
const AUTH_URL = `${CONVEX_SITE_URL}/auth/linkedin`

function RequireAuth({ children }: { children: ReactNode }) {
  const sessionToken = sessionStorage.getItem('sessionToken') ?? undefined
  const me = useQuery(api.users.getMe, { sessionToken })

  useEffect(() => {
    if (me === null) {
      // Redirect directly to LinkedIn auth
      window.location.href = AUTH_URL
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

  return (
    <>
      <AppNav />
      {children}
    </>
  )
}

export default function App() {
  return (
    <div className="flex min-h-screen flex-col">
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
