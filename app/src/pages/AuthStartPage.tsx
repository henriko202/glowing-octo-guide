import { useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import LoadingSpinner from '../components/LoadingSpinner'
import { captureException } from '../lib/observability/sentry'
import { beginOAuthLogin } from '../lib/oauthStart'

// The single login entry route: generate the PKCE verifier/challenge, then hand off to Convex.
// The run-once latch matters under StrictMode's double effect — a second run would overwrite the
// stored verifier with one whose challenge is not the one being navigated to.
export default function AuthStartPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true
    beginOAuthLogin({
      plan: searchParams.get('plan') ?? undefined,
      interval: searchParams.get('interval') ?? undefined,
      ref: searchParams.get('ref') ?? undefined
    }).catch((err: unknown) => {
      // The browser could not start the login (blocked sessionStorage, no crypto): nothing was sent to LinkedIn.
      // Report it and show the error page, where a spinner would otherwise turn forever.
      captureException(err)
      void navigate('/auth/error?reason=failed&cause=start_failed', { replace: true })
    })
  }, [searchParams, navigate])

  return <LoadingSpinner />
}
