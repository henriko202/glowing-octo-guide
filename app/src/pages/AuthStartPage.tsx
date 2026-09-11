import { useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import LoadingSpinner from '../components/LoadingSpinner'
import { beginOAuthLogin } from '../lib/oauthStart'

// The single login entry route: generate the PKCE verifier/challenge, then hand off to Convex.
// The run-once latch matters under StrictMode's double effect — a second run would overwrite the
// stored verifier with one whose challenge is not the one being navigated to.
export default function AuthStartPage() {
  const [searchParams] = useSearchParams()
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true
    void beginOAuthLogin({
      plan: searchParams.get('plan') ?? undefined,
      interval: searchParams.get('interval') ?? undefined,
      ref: searchParams.get('ref') ?? undefined
    })
  }, [searchParams])

  return <LoadingSpinner />
}
