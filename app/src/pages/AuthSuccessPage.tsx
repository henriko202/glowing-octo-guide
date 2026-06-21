import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import LoadingSpinner from '../components/LoadingSpinner'
import { clearSignedOut } from '../lib/session'

export default function AuthSuccessPage() {
  const navigate = useNavigate()

  useEffect(() => {
    // The session token arrives in the URL fragment (#session=...). Fragments are never sent
    // to servers/proxies and don't appear in access logs, unlike query strings.
    const hash = window.location.hash.replace(/^#/, '')
    const params = new URLSearchParams(hash)
    const session = params.get('session')
    const plan = params.get('plan')
    const interval = params.get('interval')
    if (plan) sessionStorage.setItem('chosenPlan', plan)
    if (interval) sessionStorage.setItem('chosenInterval', interval)
    if (session) {
      sessionStorage.setItem('sessionToken', session)
      // A successful login clears the explicit-sign-out marker, so normal auto-redirect resumes.
      clearSignedOut()
      // Scrub the token from the URL bar / history.
      window.history.replaceState(null, '', window.location.pathname)
    }
    navigate('/feed', { replace: true })
  }, [navigate])

  return <LoadingSpinner />
}
