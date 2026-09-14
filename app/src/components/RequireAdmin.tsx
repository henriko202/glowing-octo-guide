import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useQuery } from 'convex/react'
import { api } from '../convex'
import LoadingSpinner from './LoadingSpinner'

export default function RequireAdmin({ children }: { children: ReactNode }) {
  const sessionToken = sessionStorage.getItem('sessionToken') ?? undefined
  const isAdmin = useQuery(api.admin.checkIsAdmin, { sessionToken })

  if (isAdmin === undefined) return <LoadingSpinner />
  if (!isAdmin) {
    return (
      <Navigate
        to="/"
        replace
      />
    )
  }
  return <>{children}</>
}
