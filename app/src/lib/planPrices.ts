// The display prices every surface quotes — the plan grid, the card gate's no-trial cost line and
// the upgrade-at-limit line. Stripe stays the source of truth for what is actually charged
// (BillingPage's `chargedPrice` reads the webhook snapshot first); these are the client's labels,
// kept in one table so no surface can quote a stale one.

export type Interval = 'monthly' | 'annual'

export function isInterval(i: string | null): i is Interval {
  return i === 'monthly' || i === 'annual'
}

export const PLAN_PRICES: Record<Interval, Record<string, string>> = {
  monthly: { starter: '$5/mo', growth: '$15/mo', pro: '$50/mo' },
  annual: { starter: '$50/yr', growth: '$150/yr', pro: '$500/yr' }
}
