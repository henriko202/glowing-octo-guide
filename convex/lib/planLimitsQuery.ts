// convex/lib/planLimitsQuery.ts
// Server-only Convex query wrapper around getPlanLimitsHelper, for actions that cannot read
// ctx.db directly (ctx.runQuery(internal.lib.planLimitsQuery.getPlanLimits, { userId, tier })).
//
// Lives outside lib/planLimits.ts on purpose: the app imports that module's pure constants in
// the browser, and a registered function would pull convex/server into the client bundle.
import { internalQuery } from '../_generated/server'
import { v } from 'convex/values'
import { getPlanLimitsHelper, type PlanLimits } from './planLimits'

export const getPlanLimits = internalQuery({
  args: {
    userId: v.id('users'),
    tier: v.union(v.literal('starter'), v.literal('growth'), v.literal('pro'), v.literal('contact'))
  },
  handler: async (ctx, { userId, tier }): Promise<PlanLimits> => {
    return getPlanLimitsHelper(ctx, userId, tier)
  }
})
