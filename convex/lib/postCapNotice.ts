// convex/lib/postCapNotice.ts
// Pure rules for the "your post reached its cap" email (backlog/R20). No I/O — the action in
// notifications.ts reads the data, these functions decide what (if anything) to say.
import type { Tier } from './planLimits'

/**
 * Which closing line the email carries:
 * - `upgrade`: Starter/Growth with a bigger cap one tier up — one checkout deep link.
 * - `proContact`: Pro (nothing above it) or a next tier whose cap is not bigger — the support line.
 * - `contactCustom`: contact tier — the cap is bespoke; the support line says so.
 */
export type CapNoticeMode = 'upgrade' | 'proContact' | 'contactCustom'

export function capNoticeMode(tier: Tier, cap: number, nextCap: number | undefined): CapNoticeMode {
  if (tier === 'contact') return 'contactCustom'
  if (tier === 'pro' || nextCap === undefined || nextCap <= cap) return 'proContact'
  return 'upgrade'
}

/**
 * Only an author who can act on it gets the email: an address on file and a trial or paid plan
 * that is not already scheduled to end. `none`, `past_due` and `canceled` see the card-gate or
 * expired banners in the app instead; a scheduled cancel would read as a retention push, which
 * R20 forbids.
 */
export function shouldSendCapNotice(c: {
  email?: string
  subscriptionStatus?: string
  cancelAtPeriodEnd?: boolean
}): boolean {
  if (!c.email) return false
  if (c.subscriptionStatus !== 'trialing' && c.subscriptionStatus !== 'active') return false
  return !c.cancelAtPeriodEnd
}

/** Stripe stores `year` / `month`; the billing page reads `?interval=annual|monthly`. */
export function billingIntervalParam(priceInterval: string | undefined): 'annual' | 'monthly' {
  return priceInterval === 'year' ? 'annual' : 'monthly'
}
