import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from 'convex/react'
import { ConvexError } from 'convex/values'
import { api } from '../convex'
import LoadingSpinner from '../components/LoadingSpinner'
import { captureException } from '../lib/observability/sentry'
import { clearSignedOut } from '../lib/session'
import { OAUTH_VERIFIER_KEY } from '../lib/oauthStart'

// Where a login that can't finish sends a tab without a session: the sign-in error page (outside RequireAuth), which
// explains and lets the member retry. The page reports `cause` to Sentry, so each exit here names its own.
type Cause = 'no_login_code' | 'no_verifier' | 'redeem_failed'
const errorPage = (cause: Cause) => `/auth/error?reason=failed&cause=${cause}`

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
      // A login that can't finish: a tab already holding a session keeps it, anyone else gets the error page.
      // Only clear the explicit sign-out marker when a session token exists — opening /auth/success
      // directly must not erase a deliberate sign-out and let RequireAuth re-login via SSO.
      const leave = (cause: Cause) => {
        if (sessionStorage.getItem('sessionToken')) {
          clearSignedOut()
          navigate('/feed', { replace: true })
        } else {
          navigate(errorPage(cause), { replace: true })
        }
      }

      const code = sessionStorage.getItem('oauthCode')
      const verifier = sessionStorage.getItem(OAUTH_VERIFIER_KEY)
      if (!code || !verifier) {
        // Fail closed without redeeming: a code handed over without its verifier belongs to the
        // browser that started the login, and burning it here would deny that browser its session.
        sessionStorage.removeItem('oauthCode')
        sessionStorage.removeItem(OAUTH_VERIFIER_KEY)
        // No verifier with a code in hand: LinkedIn came back in a tab or browser other than the one that started.
        leave(code ? 'no_verifier' : 'no_login_code')
        return
      }

      // Redeemed even when the tab already holds a session (a member who signed in again from the landing), so the
      // sign-in funnel counts it (convex/authMetrics.ts) and a stale token is replaced without a second LinkedIn trip.
      try {
        const { sessionToken } = await redeem({ code, verifier })
        sessionStorage.setItem('sessionToken', sessionToken)
        sessionStorage.removeItem('oauthCode')
        sessionStorage.removeItem(OAUTH_VERIFIER_KEY)
        clearSignedOut()
        navigate('/feed', { replace: true })
      } catch (err) {
        // A ConvexError is the mutation's answer (expired, already used, or challenge mismatch). Anything else is a
        // fault (network, server), and Sentry gets the error itself.
        if (!(err instanceof ConvexError)) captureException(err)
        sessionStorage.removeItem('oauthCode')
        sessionStorage.removeItem(OAUTH_VERIFIER_KEY)
        leave('redeem_failed')
      }
    })()
  }, [navigate, redeem])

  return <LoadingSpinner />
}
