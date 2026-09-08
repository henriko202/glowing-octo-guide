// Single source of truth: Stripe price IDs (monthly + annual) → our tier.
// Pure helpers (buildPriceMap/resolveTier) are unit-tested; the module-level
// ALLOWED_PRICE_IDS / getTierFromPriceId read process.env once at load.
export type Tier = 'starter' | 'growth' | 'pro'

type Env = Record<string, string | undefined>

export function buildPriceMap(env: Env): Record<string, Tier> {
  const map: Record<string, Tier> = {}
  const add = (id: string | undefined, tier: Tier) => {
    if (id) map[id] = tier
  }
  add(env.STRIPE_STARTER_PRICE_ID, 'starter')
  add(env.STRIPE_GROWTH_PRICE_ID, 'growth')
  add(env.STRIPE_PRO_PRICE_ID, 'pro')
  add(env.STRIPE_STARTER_ANNUAL_PRICE_ID, 'starter')
  add(env.STRIPE_GROWTH_ANNUAL_PRICE_ID, 'growth')
  add(env.STRIPE_PRO_ANNUAL_PRICE_ID, 'pro')
  return map
}

export function resolveTier(map: Record<string, Tier>, priceId: string): Tier {
  if (!priceId || !(priceId in map)) {
    console.error(`resolveTier: unknown/blank priceId "${priceId}" — defaulting to starter`)
    return 'starter'
  }
  return map[priceId]
}

const PRICE_MAP = buildPriceMap(process.env)
export const ALLOWED_PRICE_IDS = new Set(Object.keys(PRICE_MAP))
export function getTierFromPriceId(priceId: string): Tier {
  return resolveTier(PRICE_MAP, priceId)
}

/** Starter price for the downgrade portal flow (backlog/R09): annual stays annual. */
export function starterPriceIdFor(env: Env, interval: string | undefined): string | undefined {
  return interval === 'year' ? env.STRIPE_STARTER_ANNUAL_PRICE_ID : env.STRIPE_STARTER_PRICE_ID
}

// backlog/R17 — the one-time $5 "Featured post" Price (Checkout mode: payment). Deliberately NOT
// part of buildPriceMap: it maps to no tier, so it can never enter ALLOWED_PRICE_IDS or resolve
// through getTierFromPriceId. billingNode.purchaseFeaturedPost is its only consumer.
export const FEATURED_POST_PRICE_ID = process.env.STRIPE_FEATURED_POST_PRICE_ID
