import { type ReactNode, useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useMutation, useQuery } from 'convex/react'
import { api } from './convex'
import i18n from './i18n'
import { pickSeedLanguage } from './i18n/seedLanguage'
import { useLanguageSync } from './hooks/useLanguageSync'
import FeedPage from './pages/FeedPage'
import SettingsPage from './pages/SettingsPage'
import BillingPage from './pages/BillingPage'
import AuthStartPage from './pages/AuthStartPage'
import AuthSuccessPage from './pages/AuthSuccessPage'
import MyPostsPage from './pages/MyPostsPage'
import RecapPage from './pages/RecapPage'
import HistoryPage from './pages/HistoryPage'
import PeoplePage from './pages/PeoplePage'
import RankingsPage from './pages/RankingsPage'
import NotificationsPage from './pages/NotificationsPage'
import AdminPage from './pages/AdminPage'
import RequireAdmin from './components/RequireAdmin'
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
import AnalyticsConsentGate from './components/AnalyticsConsentGate'
import PrivacyDataPage from './pages/PrivacyDataPage'
import UnsubscribePage from './pages/UnsubscribePage'
import { Toaster } from './components/ui/toast'
import DevUserSwitcher from './components/DevUserSwitcher'
import DevEmailTools from './components/DevEmailTools'
import { POLICY_VERSION } from '../../convex/lib/policy'
import { isSignedOut, LANDING_URL } from './lib/session'
import { guessCountry } from './lib/guessCountry'

// Fills an empty country from the browser (lib/guessCountry.ts). Rendered only past every gate in
// RequireAuth, so it runs after the policy and consent screens. The mutation only fills an EMPTY
// country and stops once the member saved their profile, so a repeat call is harmless.
function CountryGuess({ sessionToken, needed }: { sessionToken?: string; needed: boolean }) {
  const fill = useMutation(api.users.fillGuessedCountry)
  useEffect(() => {
    if (!needed || !sessionToken) return
    const country = guessCountry()
    if (country) void fill({ sessionToken, country }).catch(() => {})
  }, [needed, sessionToken, fill])
  return null
}

function RequireAuth({ children }: { children: ReactNode }) {
  const sessionToken = sessionStorage.getItem('sessionToken') ?? undefined
  const me = useQuery(api.users.getMe, { sessionToken })

  useEffect(() => {
    // Not authenticated. A user who explicitly signed out is sent back to the landing site so the
    // sign-out sticks (the persistent signedOut marker survives the return visit); everyone else
    // auto-starts LinkedIn OAuth (one-hop via LinkedIn's SSO).
    if (me === null) {
      if (isSignedOut()) {
        window.location.href = LANDING_URL
      } else {
        // The stored token was rejected (expired or revoked). Drop it before auto-OAuth: the
        // pre-bundle capture in index.html never overwrites an existing token, so a stale one would
        // otherwise loop app -> LinkedIn -> app without ever storing the fresh callback token.
        // /auth/start generates the PKCE verifier/challenge and hands off to Convex.
        sessionStorage.removeItem('sessionToken')
        window.location.assign('/auth/start')
      }
    }
  }, [me])

  useEffect(() => {
    if (me && !me.isBanned) {
      const hasStoredPref = localStorage.getItem('i18nextLng') !== null
      const seed = pickSeedLanguage(me.primaryLocale, ['en', 'pt', 'es'], hasStoredPref)
      if (seed) void i18n.changeLanguage(seed)
    }
  }, [me])

  // After the seed effect: a first-login seed is already applied, so it persists in one write.
  useLanguageSync(me, sessionToken)

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
      <AnalyticsConsentGate
        userId={me._id}
        sessionToken={sessionToken}
      />
      <CountryGuess
        sessionToken={sessionToken}
        needed={!me.country && !me.profileEditedAt}
      />
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
      <DevUserSwitcher />
      <DevEmailTools />
      <ScrollToTop />
      <Routes>
        <Route
          path="/auth/start"
          element={<AuthStartPage />}
        />
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
          path="/recap"
          element={
            <RequireAuth>
              <RecapPage />
            </RequireAuth>
          }
        />
        <Route
          path="/history"
          element={
            <RequireAuth>
              <HistoryPage />
            </RequireAuth>
          }
        />
        <Route
          path="/people"
          element={
            <RequireAuth>
              <PeoplePage />
            </RequireAuth>
          }
        />
        <Route
          path="/rankings"
          element={
            <RequireAuth>
              <RankingsPage />
            </RequireAuth>
          }
        />
        <Route
          path="/notifications"
          element={
            <RequireAuth>
              <NotificationsPage />
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
              <RequireAdmin>
                <AdminPage />
              </RequireAdmin>
            </RequireAuth>
          }
        />
        <Route
          path="/unsubscribe"
          element={<UnsubscribePage />}
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
