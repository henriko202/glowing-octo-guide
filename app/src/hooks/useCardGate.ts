import { useQuery } from 'convex/react'
import { api } from '../convex'

// Soft card-gate: mirrors the backend canEngage(). gated ⇔ signed-in, not admin, and status is NOT
// engage-granting. Engage-granting = trialing / active / canceled — cancellation never revokes
// access (only 'none' and 'past_due' gate). Admins are never gated. Keep in sync with lib/access.ts.
export function useCardGate() {
  const sessionToken = sessionStorage.getItem('sessionToken') ?? undefined
  const me = useQuery(api.users.getMe, sessionToken ? { sessionToken } : 'skip')
  const status = me?.subscriptionStatus
  const isAdmin = (me as { isAdmin?: boolean } | null | undefined)?.isAdmin === true
  const gated = !!me && !isAdmin && status !== 'trialing' && status !== 'active' && status !== 'canceled'
  return { gated, isTrialing: status === 'trialing', status, isAdmin, me }
}
