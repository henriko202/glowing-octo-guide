import { internalMutation } from '../_generated/server'
import { buildTierDefaultRow } from '../lib/planLimits'

// Seed mutation to populate the default planLimits rows for each tier. Kept for explicit
// re-seeding (e.g. a fresh environment); no longer a hard prerequisite for the admin
// "update tier default" flow, which self-heals the same way (backlog/B27) — see
// admin.ts's updateTierDefault. Run via the Convex dashboard or CLI:
//   npx convex run migrations/seedPlanLimits:seedPlanLimits --prod
//
// Safe to re-run — skips any tier that already has a default row (no userId). Row values
// come from lib/planLimits.ts's DEFAULTS (single source of truth), so this can't drift
// from the self-heal or the read fallback.
export const seedPlanLimits = internalMutation({
  args: {},
  handler: async ctx => {
    const tiers = ['starter', 'growth', 'pro', 'contact'] as const

    for (const tier of tiers) {
      // Only insert if no default row (no userId) for this tier already exists.
      const tierRows = await ctx.db
        .query('planLimits')
        .withIndex('by_tier', q => q.eq('tier', tier))
        .take(20)
      const existing = tierRows.find(r => r.userId === undefined)

      if (!existing) {
        await ctx.db.insert('planLimits', buildTierDefaultRow(tier))
      }
    }
  }
})
