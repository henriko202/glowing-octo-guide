// Single source of truth: Stripe price IDs (monthly + annual) → our tier.
// Pure helpers (buildPriceMap/resolveTier) are unit-tested; the module-level
// ALLOWED_PRICE_IDS / getTierFromPriceId read env once at load.
import { env } from '../_generated/server'
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

const PRICE_MAP = buildPriceMap(env)
export const ALLOWED_PRICE_IDS = new Set(Object.keys(PRICE_MAP))
export function getTierFromPriceId(priceId: string): Tier {
  return resolveTier(PRICE_MAP, priceId)
}

/** Starter price for the downgrade portal flow (backlog/R09): annual stays annual. */
export function starterPriceIdFor(env: Env, interval: string | undefined): string | undefined {
  return interval === 'year' ? env.STRIPE_STARTER_ANNUAL_PRICE_ID : env.STRIPE_STARTER_PRICE_ID
}

/**
 * The billing interval of one of our six prices. A downgrade schedule's second phase needs the
 * TARGET price's interval for its `duration`, and the plan grid can send a monthly member to an
 * annual price — so this cannot be read off the current subscription. `undefined` for anything that
 * is not one of the six, which the caller turns into a refusal rather than a guess.
 */
export function intervalForPriceId(env: Env, priceId: string): 'month' | 'year' | undefined {
  if (!priceId) return undefined
  const annual = [env.STRIPE_STARTER_ANNUAL_PRICE_ID, env.STRIPE_GROWTH_ANNUAL_PRICE_ID, env.STRIPE_PRO_ANNUAL_PRICE_ID]
  if (annual.includes(priceId)) return 'year'
  const monthly = [env.STRIPE_STARTER_PRICE_ID, env.STRIPE_GROWTH_PRICE_ID, env.STRIPE_PRO_PRICE_ID]
  if (monthly.includes(priceId)) return 'month'
  return undefined
}

// backlog/R17 — the one-time $5 "Featured post" Price (Checkout mode: payment). Deliberately NOT
// part of buildPriceMap: it maps to no tier, so it can never enter ALLOWED_PRICE_IDS or resolve
// through getTierFromPriceId. billingNode.purchaseFeaturedPost is its only consumer.
export const FEATURED_POST_PRICE_ID = env.STRIPE_FEATURED_POST_PRICE_ID
