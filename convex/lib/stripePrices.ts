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
