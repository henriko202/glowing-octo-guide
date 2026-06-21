import type { Doc } from '../_generated/dataModel'

type Status = Doc<'users'>['subscriptionStatus']

// Card-on-file gate: a user may engage (comment / react / submit) only once a card-backed
// trial or paid subscription exists. New users start at 'none' and must add a card first.
export function canEngage(status: Status): boolean {
  return status === 'trialing' || status === 'active'
}

export function assertCanEngage(user: Pick<Doc<'users'>, 'subscriptionStatus' | 'isAdmin'>): void {
  if (user.isAdmin) return // admins always bypass the card gate
  if (!canEngage(user.subscriptionStatus)) {
    // Prefixed so the app can detect this case and show the card-gate (Plan 2C).
    throw new Error('PAYMENT_REQUIRED: Add a payment method to start engaging.')
  }
}
