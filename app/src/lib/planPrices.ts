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
  monthly: { starter: 'US$10/mo', growth: 'US$15/mo', pro: 'US$50/mo' },
  annual: { starter: 'US$100/yr', growth: 'US$150/yr', pro: 'US$500/yr' }
}

// backlog/R17 — the one-time featured-post add-on. A label like the rest: Stripe's Price is charged.
export const FEATURED_POST_PRICE = 'US$5'

export function usdLabel(locale: string, label: string): string {
  const short = locale.slice(0, 2).toLowerCase()
  if (short !== 'pt' && short !== 'es') return label
  const units = short === 'es' ? { mo: '/mes', yr: '/año' } : { mo: '/mês', yr: '/ano' }
  return label.replace('US$', 'U$').replace('/mo', units.mo).replace('/yr', units.yr)
}
