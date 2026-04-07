import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import LoadingSpinner from '../components/LoadingSpinner'

export default function AuthSuccessPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()

  useEffect(() => {
    // Store the server-issued session token, then redirect to feed
    const session = params.get('session')
    if (session) {
      sessionStorage.setItem('sessionToken', session)
    }
    navigate('/feed', { replace: true })
  }, [params, navigate])

  return <LoadingSpinner />
}
