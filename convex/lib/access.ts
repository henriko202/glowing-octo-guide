import { ConvexError } from 'convex/values'
import type { Doc } from '../_generated/dataModel'

type Status = Doc<'users'>['subscriptionStatus']

// Card-on-file gate: a user may engage (comment / react / submit) once a card-backed trial or
// paid subscription exists — and access is never revoked by CANCELLATION (a canceled member keeps
// engaging; only their own posts stop showing once their paid period ends, see feed.ts). New users
// start at 'none' and must add a card first; a failed payment ('past_due') blocks until it clears.
export function canEngage(status: Status): boolean {
  return status === 'trialing' || status === 'active' || status === 'canceled'
}

export function assertCanEngage(user: Pick<Doc<'users'>, 'subscriptionStatus' | 'isAdmin'>): void {
  if (user.isAdmin) return // admins always bypass the card gate
  if (!canEngage(user.subscriptionStatus)) {
    // Prefixed so the app can detect this case and show the card-gate (Plan 2C).
    throw new ConvexError('PAYMENT_REQUIRED: Add a payment method to start engaging.')
  }
}

// A newly-submitted post is created HIDDEN only for members with no usable card — i.e. who can't
// engage ('none' new members, 'past_due' lapsed payment). Carded members (trialing/active) and the
// canceled-but-paid-through window post visibly (Plan 2B: a card on file ⇒ posts visible); admins
// always show. A hidden post is revealed the moment the member gains a card, via
// stripe.syncUserSubscription (unhideHidden: canEngage). Lets a brand-new 'none' member add their
// onboarding first post — hidden — before subscribing.
export function postCreatedHidden(user: Pick<Doc<'users'>, 'subscriptionStatus' | 'isAdmin'>): boolean {
  if (user.isAdmin) return false
  return !canEngage(user.subscriptionStatus)
}
