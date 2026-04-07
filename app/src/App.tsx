import { type ReactNode, useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useQuery } from 'convex/react'
import { api } from './convex'
import FeedPage from './pages/FeedPage'
import SettingsPage from './pages/SettingsPage'
import BillingPage from './pages/BillingPage'
import AuthSuccessPage from './pages/AuthSuccessPage'
import MyPostsPage from './pages/MyPostsPage'
import AdminPage from './pages/AdminPage'
import AppNav from './components/AppNav'
import LoadingSpinner from './components/LoadingSpinner'

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

  if (me === undefined || me === null) return <LoadingSpinner />

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
