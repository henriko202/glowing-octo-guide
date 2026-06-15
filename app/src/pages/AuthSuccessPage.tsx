import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import LoadingSpinner from '../components/LoadingSpinner'

export default function AuthSuccessPage() {
  const navigate = useNavigate()

  useEffect(() => {
    // The session token arrives in the URL fragment (#session=...). Fragments are never sent
    // to servers/proxies and don't appear in access logs, unlike query strings.
    const hash = window.location.hash.replace(/^#/, '')
    const session = new URLSearchParams(hash).get('session')
    if (session) {
      sessionStorage.setItem('sessionToken', session)
      // Scrub the token from the URL bar / history.
      window.history.replaceState(null, '', window.location.pathname)
    }
    navigate('/feed', { replace: true })
  }, [navigate])

  return <LoadingSpinner />
}
