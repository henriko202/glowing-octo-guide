// convex/lib/planLimits.ts
// Centralized plan-limit lookup helper.
//
// Usage from a mutation/query:
//   import { getPlanLimitsHelper } from './lib/planLimits'
//   const limits = await getPlanLimitsHelper(ctx, userId, tier)
//
// Usage from an action:
//   const limits = await ctx.runQuery(internal.lib.planLimits.getPlanLimits, { userId, tier })

import type { MutationCtx, QueryCtx } from '../_generated/server'
import { internalQuery } from '../_generated/server'
import { v } from 'convex/values'
import { UNLIMITED_FEATURED_SENTINEL } from './postLimit'
import type { Id } from '../_generated/dataModel'

export type PlanLimits = { interactionsPerPost: number; postsPerWeek: number; featuredPerMonth: number }

export type Tier = 'starter' | 'growth' | 'pro' | 'contact'

// Featured-post monthly caps (backlog/B07). contact's cap is UNLIMITED_FEATURED_SENTINEL (9999,
// lib/postLimit.ts), a Custom/enterprise sentinel (effectively unlimited) — real enterprise deals
// use the existing per-user planLimits override row (see the contact branch of getPlanLimitsHelper below).
//
// Single source of truth (backlog/B27): exported so migrations/seedPlanLimits.ts and
// admin.ts's updateTierDefault self-heal both build their inserted rows from this same
// object (via buildTierDefaultRow below) instead of keeping their own copies of these
// numbers, which could otherwise silently drift apart.
export const DEFAULTS: Record<Tier, PlanLimits> = {
  starter: { interactionsPerPost: 25, postsPerWeek: 1, featuredPerMonth: 0 },
  growth: { interactionsPerPost: 50, postsPerWeek: 2, featuredPerMonth: 1 },
  pro: { interactionsPerPost: 200, postsPerWeek: 5, featuredPerMonth: 3 },
  contact: { interactionsPerPost: 200, postsPerWeek: 5, featuredPerMonth: UNLIMITED_FEATURED_SENTINEL }
}

export type PlanLimitsDefaultRow = { tier: Tier } & PlanLimits

/**
 * Builds a full tier-default planLimits row (no userId — see the schema comment on
 * planLimits.userId) from DEFAULTS. Every field the schema needs for an insert is
 * present, so this is the one place that can go stale if a future field is added.
 * Used by migrations/seedPlanLimits.ts and admin.ts's updateTierDefault self-heal.
 */
export function buildTierDefaultRow(tier: Tier): PlanLimitsDefaultRow {
  return { tier, ...DEFAULTS[tier] }
}

/**
 * The next tier up the ladder, for "upgrade at the limit" prompts (backlog/R08).
 * Returns null at the top (pro, contact) so callers render a contact/custom-limit
 * line instead of a checkout link — never a plan called "null".
 */
export function nextTier(tier: Tier): 'growth' | 'pro' | null {
  return tier === 'starter' ? 'growth' : tier === 'growth' ? 'pro' : null
}

/**
 * Returns the plan limits for a user given their tier.
 * For the contact tier, first checks for a per-user override row; if none is
 * found it falls back to the contact tier default row.
 * All other tiers are looked up directly by tier.
 * Falls back to hardcoded defaults if the DB row is missing (safety net after
 * seeding — should not happen in production).
 */
export async function getPlanLimitsHelper(
  ctx: QueryCtx | MutationCtx,
  userId: Id<'users'>,
  tier: Tier
): Promise<PlanLimits> {
  if (tier === 'contact') {
    // Check for a per-user override first.
    const userRow = await ctx.db
      .query('planLimits')
      .withIndex('by_user', q => q.eq('userId', userId))
      .unique()

    if (userRow) {
      return {
        interactionsPerPost: userRow.interactionsPerPost,
        postsPerWeek: userRow.postsPerWeek,
        featuredPerMonth: userRow.featuredPerMonth ?? DEFAULTS.contact.featuredPerMonth
      }
    }

    // Fall back to the contact tier default row (no userId).
    // Must filter JS-side because by_tier also matches per-user override rows.
    const contactRows = await ctx.db
      .query('planLimits')
      .withIndex('by_tier', q => q.eq('tier', 'contact'))
      .take(20)
    const tierRow = contactRows.find(r => r.userId === undefined)

    if (tierRow) {
      return {
        interactionsPerPost: tierRow.interactionsPerPost,
        postsPerWeek: tierRow.postsPerWeek,
        featuredPerMonth: tierRow.featuredPerMonth ?? DEFAULTS.contact.featuredPerMonth
      }
    }

    return DEFAULTS.contact
  }

  // All other tiers: look up by tier.
  const row = await ctx.db
    .query('planLimits')
    .withIndex('by_tier', q => q.eq('tier', tier))
    .unique()

  if (row) {
    return {
      interactionsPerPost: row.interactionsPerPost,
      postsPerWeek: row.postsPerWeek,
      featuredPerMonth: row.featuredPerMonth ?? DEFAULTS[tier].featuredPerMonth
    }
  }

  // Safety-net fallback.
  return DEFAULTS[tier]
}

/**
 * Returns a numeric rank for a subscription tier.
 * Used when setting authorTierRank on posts.
 * contact=4, pro=3, growth=2, starter=1, unknown=1
 */
export function tierToRank(tier?: string): number {
  switch (tier) {
    case 'contact':
      return 4
    case 'pro':
      return 3
    case 'growth':
      return 2
    case 'starter':
      return 1
    default:
      return 1
  }
}

/**
 * Internal query so actions can retrieve plan limits via ctx.runQuery.
 * Actions cannot use ctx.db directly, so they delegate here.
 */
export const getPlanLimits = internalQuery({
  args: {
    userId: v.id('users'),
    tier: v.union(v.literal('starter'), v.literal('growth'), v.literal('pro'), v.literal('contact'))
  },
  handler: async (ctx, { userId, tier }): Promise<PlanLimits> => {
    return getPlanLimitsHelper(ctx, userId, tier)
  }
})
