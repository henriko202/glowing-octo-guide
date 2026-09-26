import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from 'convex/react'
import { api } from '../convex'
import LoadingSpinner from '../components/LoadingSpinner'
import { clearSignedOut } from '../lib/session'
import { OAUTH_VERIFIER_KEY } from '../lib/oauthStart'

// Both failures land on the sign-in error page (outside RequireAuth), which explains and lets the member retry.
const ERROR_PAGE = '/auth/error?reason=failed'

export default function AuthSuccessPage() {
  const navigate = useNavigate()
  const redeem = useMutation(api.sessions.redeemAuthCode)
  // StrictMode invokes effects twice; the code is single-use, so redeem must run exactly once.
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true

    // The code/verifier (and plan/interval) were moved into sessionStorage by the inline script in
    // index.html before any bundle ran, so the URL bar is already scrubbed here.
    void (async () => {
      // Already signed in: the capture script ignored the code, so nothing to redeem. Only clear
      // the explicit sign-out marker when a session token exists — opening /auth/success directly
      // must not erase a deliberate sign-out and let RequireAuth re-login via SSO.
      if (sessionStorage.getItem('sessionToken')) {
        clearSignedOut()
        navigate('/feed', { replace: true })
        return
      }

      const code = sessionStorage.getItem('oauthCode')
      const verifier = sessionStorage.getItem(OAUTH_VERIFIER_KEY)
      if (!code || !verifier) {
        // Fail closed without redeeming: a code handed over without its verifier belongs to the
        // browser that started the login, and burning it here would deny that browser its session.
        sessionStorage.removeItem('oauthCode')
        sessionStorage.removeItem(OAUTH_VERIFIER_KEY)
        navigate(ERROR_PAGE, { replace: true })
        return
      }

      try {
        const { sessionToken } = await redeem({ code, verifier })
        sessionStorage.setItem('sessionToken', sessionToken)
        sessionStorage.removeItem('oauthCode')
        sessionStorage.removeItem(OAUTH_VERIFIER_KEY)
        clearSignedOut()
        navigate('/feed', { replace: true })
      } catch {
        // Expired, already used, or challenge mismatch — the member starts over from the error page.
        sessionStorage.removeItem('oauthCode')
        sessionStorage.removeItem(OAUTH_VERIFIER_KEY)
        navigate(ERROR_PAGE, { replace: true })
      }
    })()
  }, [navigate, redeem])

  return <LoadingSpinner />
}
