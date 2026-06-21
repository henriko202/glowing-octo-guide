import { useQuery } from 'convex/react'
import { api } from '../convex'

// Soft card-gate: mirrors the backend canEngage(). gated ⇔ signed-in, not admin,
// and status is NOT card-backed (none/canceled/past_due). Admins are never gated.
export function useCardGate() {
  const sessionToken = sessionStorage.getItem('sessionToken') ?? undefined
  const me = useQuery(api.users.getMe, sessionToken ? { sessionToken } : 'skip')
  const status = me?.subscriptionStatus
  const isAdmin = (me as { isAdmin?: boolean } | null | undefined)?.isAdmin === true
  const gated = !!me && !isAdmin && status !== 'trialing' && status !== 'active'
  return { gated, isTrialing: status === 'trialing', status, isAdmin, me }
}
