// convex/lib/planLimits.ts
// Centralized plan-limit lookup helper.
//
// Usage from a mutation/query:
//   import { getPlanLimitsHelper } from './lib/planLimits'
//   const limits = await getPlanLimitsHelper(ctx, userId, tier)
//
// Usage from an action:
//   const limits = await ctx.runQuery(internal.lib.planLimits.getPlanLimits, { userId, tier })

import type { QueryCtx, MutationCtx } from '../_generated/server'
import { internalQuery } from '../_generated/server'
import { v } from 'convex/values'
import type { Id } from '../_generated/dataModel'

type PlanLimits = { interactionsPerPost: number; postsPerWeek: number }

const DEFAULTS: Record<string, PlanLimits> = {
  starter: { interactionsPerPost: 25, postsPerWeek: 1 },
  growth: { interactionsPerPost: 50, postsPerWeek: 2 },
  pro: { interactionsPerPost: 200, postsPerWeek: 5 },
  contact: { interactionsPerPost: 200, postsPerWeek: 5 },
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
  tier: string
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
      }
    }

    // Fall back to the contact tier default row.
    const tierRow = await ctx.db
      .query('planLimits')
      .withIndex('by_tier', q => q.eq('tier', 'contact'))
      .unique()

    if (tierRow) {
      return {
        interactionsPerPost: tierRow.interactionsPerPost,
        postsPerWeek: tierRow.postsPerWeek,
      }
    }

    return DEFAULTS.contact
  }

  // All other tiers: look up by tier.
  const row = await ctx.db
    .query('planLimits')
    .withIndex('by_tier', q =>
      q.eq('tier', tier as 'starter' | 'growth' | 'pro' | 'contact')
    )
    .unique()

  if (row) {
    return {
      interactionsPerPost: row.interactionsPerPost,
      postsPerWeek: row.postsPerWeek,
    }
  }

  // Safety-net fallback.
  return DEFAULTS[tier] ?? DEFAULTS.starter
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
    tier: v.string(),
  },
  handler: async (ctx, { userId, tier }): Promise<PlanLimits> => {
    return getPlanLimitsHelper(ctx, userId, tier)
  },
})
