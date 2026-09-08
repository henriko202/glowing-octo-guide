// The display prices every surface quotes — the plan grid, the card gate's no-trial cost line and
// the upgrade-at-limit line. Stripe stays the source of truth for what is actually charged
// (BillingPage's `chargedPrice` reads the webhook snapshot first); these are the client's labels,
// kept in one table so no surface can quote a stale one.
// Starter is $10 by design — the decoy under Growth (backlog/revenue/R13).

export type Interval = 'monthly' | 'annual'

export function isInterval(i: string | null): i is Interval {
  return i === 'monthly' || i === 'annual'
}

export const PLAN_PRICES: Record<Interval, Record<string, string>> = {
  monthly: { starter: '$10/mo', growth: '$15/mo', pro: '$50/mo' },
  annual: { starter: '$100/yr', growth: '$150/yr', pro: '$500/yr' }
}

// backlog/R17 — the one-time featured-post add-on. A label like the rest: Stripe's Price is charged.
export const FEATURED_POST_PRICE = '$5'
