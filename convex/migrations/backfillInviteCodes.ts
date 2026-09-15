import { internalMutation } from '../_generated/server'
import { internal } from '../_generated/api'
import { v } from 'convex/values'
import { generateInviteCode } from '../lib/invite'

// backlog/R19 follow-up — invite codes are minted lazily (users.getOrCreateInviteCode on the first
// visit to Settings › Invite), so every member who joined before the feature shipped — or who never
// opened Settings — has no code: their shared ?ref= links match no member at signup
// (linkedin/auth.upsertUserHandler drops the code), invitees get the plain 7-day trial, and Settings
// / Rankings show no link for them. This one-off mints a code for every member still missing one.
// It never touches an existing code: links people already shared must keep working.
//
// Run once via the Convex dashboard or CLI:
//   npx convex run migrations/backfillInviteCodes:backfillInviteCodes
//   npx convex run migrations/backfillInviteCodes:backfillInviteCodes --prod
//
// Batched + self-rescheduling (mirrors backfillFeedFields) so it never `.collect()`s the users
// table. Idempotent: only rows whose inviteCode is unset are patched, and by_invite_code is checked
// before each patch, so re-running mints nothing new.
const BACKFILL_BATCH = 100

export const backfillInviteCodes = internalMutation({
  args: { cursor: v.optional(v.union(v.string(), v.null())) },
  handler: async (ctx, { cursor }) => {
    const page = await ctx.db.query('users').paginate({ numItems: BACKFILL_BATCH, cursor: cursor ?? null })

    let minted = 0
    let skipped = 0
    for (const user of page.page) {
      if (user.inviteCode) continue
      // Same collision handling as users.getOrCreateInviteCode: 36^8 codes make a hit a
      // one-in-billions event; retry once, then leave the row for the next run rather than fail
      // the batch (a re-run picks it up again, and patched codes are visible to later iterations
      // in this same transaction).
      let code: string | undefined
      for (let attempt = 0; attempt < 2 && !code; attempt++) {
        const candidate = generateInviteCode()
        const taken = await ctx.db
          .query('users')
          .withIndex('by_invite_code', q => q.eq('inviteCode', candidate))
          .first()
        if (!taken) code = candidate
      }
      if (!code) {
        skipped++
        continue
      }
      await ctx.db.patch(user._id, { inviteCode: code })
      minted++
    }

    if (minted || skipped) console.log(`backfillInviteCodes: ${minted} code(s) minted, ${skipped} skipped this batch`)
    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, internal.migrations.backfillInviteCodes.backfillInviteCodes, {
        cursor: page.continueCursor
      })
    }
  }
})
