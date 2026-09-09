// backlog/B07 — the second half of closing the cross-tier downgrade credit gap.
//
// Taking the downgrade off the portal changed what OUR pages build, not what the portal OFFERS. One
// Customer Portal configuration serves every member, and its `subscription_update.products` lists
// all three products and all six prices, so a member who opens "Manage subscription" can pick a
// cheaper tier there, be credited under `always_invoice` (D7), and overwrite the schedule we
// attached. `products` is a property of the CONFIGURATION and cannot vary by member any other way —
// so we keep one configuration per tier, listing that tier and the tiers above it and nothing
// cheaper, and pass the right one when the session is created.
//
// This module holds only the choice. The Stripe calls live in billingNode.ts (a 'use node' action
// file the repo's test setup cannot run); the configurations themselves are created by
// scripts/stripe-provision.mjs, which stamps each one with `metadata.lits_tier`.

/** The tiers that own a portal configuration. `contact` is not a self-serve plan and has none. */
export const PORTAL_TIERS = ['starter', 'growth', 'pro'] as const
export type PortalTier = (typeof PORTAL_TIERS)[number]

/** The metadata key `stripe-provision.mjs` stamps on each configuration, and the lookup key here. */
export const PORTAL_TIER_KEY = 'lits_tier'

/**
 * Which portal configuration a member gets: their own tier's.
 *
 * Every case that is not exactly one of the three known tiers clamps to `pro` — the most restrictive
 * configuration, listing Pro alone. That is the fail-closed direction: a tier we cannot read is a
 * tier whose cheaper neighbours we must not offer. It costs a `contact` or corrupted row the ability
 * to switch plans in the portal home, which is the right trade against re-opening the credit gap.
 *
 * Status is deliberately NOT a parameter. `trialing` and `past_due` get the same configuration as
 * `active`, because the restriction they need is identical — no cheaper tier, ever. The rule that a
 * trial cannot change plan at all is enforced where the member actually clicks (billingNode's two
 * actions), not by handing trials a different portal.
 */
export function portalTierFor(tier?: string): PortalTier {
  return tier === 'starter' || tier === 'growth' ? tier : 'pro'
}

/**
 * The prices a tier's configuration may list: its own, plus every tier above it. Ordered cheapest
 * first so the portal's plan list reads the way the pricing page does.
 *
 * Starter's list is every tier, which is exactly the single configuration that exists today — Starter
 * is the floor, so there is nothing below it to leak. That is why this change is purely additive.
 */
export function tiersOfferedTo(tier: PortalTier): PortalTier[] {
  const from = PORTAL_TIERS.indexOf(tier)
  return PORTAL_TIERS.slice(from)
}
