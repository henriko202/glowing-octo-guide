import { internalMutation } from '../_generated/server'
import { internal } from '../_generated/api'
import { v } from 'convex/values'

// Plan 018 — one-time move of the trial interaction counters off the users row. `users` is read on
// every authenticated request, and for feed authors by getFeed, so patching the counters there
// invalidated every query that read the member on every interaction while trialing. The writers now
// own `trialCounters` (interactions.ts); this migration carries each member's existing counts over
// and clears the legacy fields.
//
// Run once via the Convex dashboard or CLI, AFTER deploying the Step 2 writer switch:
//   npx convex run migrations/moveTrialCounters:moveTrialCounters --prod
//
// Batched + self-rescheduling (mirrors convex/privacy/retention.ts's page pattern) so it never
// `.collect()`s the users table. Idempotent: users whose fields are already cleared are skipped,
// and the counter update + field clear run in the SAME mutation transaction, so a re-run can never
// double-count.
//
// The add-on-merge below can no longer skip a milestone: the writer (interactions.ts) seeds
// `trialCounters` from the legacy fields and clears them in the same transaction, so once a member
// has interacted since the deploy their legacy fields are undefined and this migration skips them.
// A counter row with legacy fields still set cannot occur; the merge only ever runs for a member
// the writer has never touched (where no counter row exists and "add" is a plain insert). Keep ADD,
// never overwrite: a re-run or a race with a concurrent first bump must not lose a count.
const MOVE_BATCH = 100

export const moveTrialCounters = internalMutation({
  args: { cursor: v.optional(v.union(v.string(), v.null())) },
  handler: async (ctx, { cursor }) => {
    const page = await ctx.db.query('users').paginate({ numItems: MOVE_BATCH, cursor: cursor ?? null })

    for (const user of page.page) {
      const legacyMade = user.trialInteractionsMade
      const legacyReceived = user.trialInteractionsReceived
      // Already migrated (or never carried counters): nothing to move.
      if (legacyMade === undefined && legacyReceived === undefined) continue

      const counter = await ctx.db
        .query('trialCounters')
        .withIndex('by_user', q => q.eq('userId', user._id))
        .unique()
      const made = (counter?.made ?? 0) + (legacyMade ?? 0)
      const received = (counter?.received ?? 0) + (legacyReceived ?? 0)
      if (counter) await ctx.db.patch(counter._id, { made, received })
      else await ctx.db.insert('trialCounters', { userId: user._id, made, received })

      await ctx.db.patch(user._id, { trialInteractionsMade: undefined, trialInteractionsReceived: undefined })
    }

    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, internal.migrations.moveTrialCounters.moveTrialCounters, {
        cursor: page.continueCursor
      })
    }
  }
})
