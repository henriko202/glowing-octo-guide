import { internalMutation } from '../_generated/server'
import { DEFAULTS } from '../lib/planLimits'
import { isUnlimitedFeatured } from '../lib/postLimit'

// One-off normalization after contact's featured cap changed from the 9999 unlimited sentinel to a
// finite 5 (lib/planLimits.ts). Environments seeded before that change still have a CONTACT
// tier-default row (userId undefined) at 9999, which would keep contact members effectively
// unlimited. Patches ONLY tier-default rows still at/above the sentinel — per-user override rows
// are left alone, because an admin may have granted unlimited deliberately.
//
// Idempotent: re-running after the patch finds 5 and changes nothing. Run once per environment that
// was seeded with the old value, after deploying the new code:
//   npx convex run migrations/normalizeContactFeaturedLimit:normalizeContactFeaturedLimit
//   npx convex run migrations/normalizeContactFeaturedLimit:normalizeContactFeaturedLimit --prod
export const normalizeContactFeaturedLimit = internalMutation({
  args: {},
  handler: async ctx => {
    const defaultRows = await ctx.db
      .query('planLimits')
      .withIndex('by_tier', q => q.eq('tier', 'contact'))
      // Pushed into the query, not filtered JS-side over a bounded `.take` — same reasoning as
      // posts.findTierDefaultRow: many per-user override rows share this index value, and a bounded
      // take could push the one true default row past the cap.
      .filter(q => q.eq(q.field('userId'), undefined))
      .collect()

    let updated = 0
    for (const row of defaultRows) {
      // An undefined featuredPerMonth already coalesces to the new 5 via getPlanLimitsHelper, so
      // only rows explicitly carrying the old sentinel (or higher) are patched.
      if (row.featuredPerMonth !== undefined && isUnlimitedFeatured(row.featuredPerMonth)) {
        await ctx.db.patch(row._id, { featuredPerMonth: DEFAULTS.contact.featuredPerMonth })
        updated += 1
      }
    }

    console.log(`normalizeContactFeaturedLimit: ${updated} row(s) updated`)
    return updated
  }
})
