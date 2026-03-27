import { Routes, Route, Navigate } from 'react-router-dom'
import { useQuery } from 'convex/react'
import type { Id } from '../../convex/_generated/dataModel'
import { api } from './convex'
import LoginPage from './pages/LoginPage'
import FeedPage from './pages/FeedPage'
import SettingsPage from './pages/SettingsPage'
import BillingPage from './pages/BillingPage'
import AuthSuccessPage from './pages/AuthSuccessPage'
import MyPostsPage from './pages/MyPostsPage'
import AdminPage from './pages/AdminPage'
import AppNav from './components/AppNav'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const userId = (sessionStorage.getItem('convexUserId') ?? undefined) as Id<'users'> | undefined
  const me = useQuery(api.users.getMe, { userId })
  if (me === undefined) return <div style={{ padding: 32, fontFamily: 'system-ui, sans-serif' }}>Loading…</div>
  if (me === null)
    return (
      <Navigate
        to="/login"
        replace
      />
    )
  return (
    <>
      <AppNav />
      {children}
    </>
  )
}

export default function App() {
  return (
    <Routes>
      <Route
        path="/login"
        element={<LoginPage />}
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
  )
}
