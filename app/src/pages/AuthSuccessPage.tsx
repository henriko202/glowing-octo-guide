import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import LoadingSpinner from '../components/LoadingSpinner'

export default function AuthSuccessPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()

  useEffect(() => {
    // Store userId for session tracking, then redirect to feed
    const userId = params.get('userId')
    if (userId) {
      sessionStorage.setItem('convexUserId', userId)
    }
    navigate('/feed', { replace: true })
  }, [params, navigate])

  return <LoadingSpinner />
}
