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
  // Gated ≠ never subscribed, so the gate must not promise a trial off `gated` alone:
  // `toSubscriptionStatus` maps Stripe's incomplete/incomplete_expired/paused to 'none' with the
  // subscriptions row already inserted, and admin.setUserSubscriptionStatus can patch a member with
  // rows back to 'none'. Both gate AND are ineligible. Derived once here (BillingPage names it the
  // same) so the three gate surfaces can't drift apart. Optimistic while `me` is undefined.
  return { gated, isTrialing: status === 'trialing', status, isAdmin, me, canTrial: me?.trialEligible !== false }
}
