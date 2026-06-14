import { internalMutation } from '../_generated/server'

// One-time seed mutation to populate the default planLimits rows for each tier.
// Run once via the Convex dashboard or CLI:
//   npx convex run migrations/seedPlanLimits:seedPlanLimits --prod
//
// Safe to re-run — skips any tier that already has a default row (no userId).
export const seedPlanLimits = internalMutation({
  args: {},
  handler: async (ctx) => {
    const defaults: Array<{
      tier: 'starter' | 'growth' | 'pro' | 'contact'
      interactionsPerPost: number
      postsPerWeek: number
    }> = [
      { tier: 'starter', interactionsPerPost: 25,  postsPerWeek: 1 },
      { tier: 'growth',  interactionsPerPost: 50,  postsPerWeek: 2 },
      { tier: 'pro',     interactionsPerPost: 200, postsPerWeek: 5 },
      { tier: 'contact', interactionsPerPost: 200, postsPerWeek: 5 },
    ]

    for (const row of defaults) {
      // Only insert if no default row (no userId) for this tier already exists.
      const tierRows = await ctx.db
        .query('planLimits')
        .withIndex('by_tier', (q) => q.eq('tier', row.tier))
        .take(20)
      const existing = tierRows.find(r => r.userId === undefined)

      if (!existing) {
        await ctx.db.insert('planLimits', {
          tier: row.tier,
          interactionsPerPost: row.interactionsPerPost,
          postsPerWeek: row.postsPerWeek,
          // userId intentionally omitted — this is the tier default
        })
      }
    }
  },
})
