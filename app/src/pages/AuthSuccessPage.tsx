import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import LoadingSpinner from '../components/LoadingSpinner'
import { clearSignedOut } from '../lib/session'

export default function AuthSuccessPage() {
  const navigate = useNavigate()

  useEffect(() => {
    // The token (and plan/interval) were moved into sessionStorage by the inline script in
    // index.html before any bundle ran, so the URL bar is already scrubbed here. Only clear the
    // explicit sign-out marker when a session token was actually captured: opening /auth/success
    // directly (no token) must not erase a deliberate sign-out and let RequireAuth re-login via SSO.
    if (sessionStorage.getItem('sessionToken')) clearSignedOut()
    navigate('/feed', { replace: true })
  }, [navigate])

  return <LoadingSpinner />
}
