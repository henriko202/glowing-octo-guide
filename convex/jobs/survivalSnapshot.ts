// convex/jobs/survivalSnapshot.ts
// Nightly rebuild of the admin Survival panel's cohort snapshots (backlog/R18, plan 020).
//
// The panel used to be a live query that re-read ~4 indexed rows per cohort member on every
// reactive invalidation. This job computes the same numbers once a day and writes them to
// survivalSnapshots, so admin.survivalMetrics reads one row. The maths is unchanged — it still
// comes from lib/survival.summarizeCohort / payingByTier; this file only does the page-and-read
// plumbing in an action (actions have no ctx.db).
import { paginationOptsValidator } from 'convex/server'
import { v } from 'convex/values'
import { internalAction, internalMutation, internalQuery } from '../_generated/server'
import { internal } from '../_generated/api'
import type { Id } from '../_generated/dataModel'
import { DAY_MS, payingByTier, returnWindows, summarizeCohort, type CohortRow } from '../lib/survival'
import { findLiveSubscription } from '../lib/trialMilestone'

const PAGE_SIZE = 100

type SubscriptionStatus = 'trialing' | 'active' | 'canceled' | 'past_due' | 'none'
type Tier = 'starter' | 'growth' | 'pro' | 'contact'
type CohortUser = {
  _id: Id<'users'>
  createdAt: number
  subscriptionStatus: SubscriptionStatus
  tier?: Tier
}

// Same-file ctx.runQuery calls hit a TypeScript circularity, so the action annotates the page it
// receives (Convex guideline); this mirrors the pagination result's fields.
type Page<T> = { page: T[]; isDone: boolean; continueCursor: string }

const subscriptionStatusValidator = v.union(
  v.literal('trialing'),
  v.literal('active'),
  v.literal('canceled'),
  v.literal('past_due'),
  v.literal('none')
)

const tierValidator = v.union(v.literal('starter'), v.literal('growth'), v.literal('pro'), v.literal('contact'))

// Only the user fields the cohort logic needs — never the tokens/PII on the full doc.
const cohortUserValidator = v.object({
  _id: v.id('users'),
  createdAt: v.number(),
  subscriptionStatus: subscriptionStatusValidator,
  tier: v.optional(tierValidator)
})

const cohortSummaryValidator = v.object({
  signups: v.number(),
  startedTrial: v.number(),
  activated: v.number(),
  medianMinutesToFirstInteraction: v.union(v.number(), v.null()),
  returnedDay1: v.number(),
  returnedDays2to7: v.number(),
  trialsEnded: v.number(),
  converted: v.number(),
  canceled: v.number(),
  activatedEligible: v.number(),
  returnedDay1Eligible: v.number(),
  returnedDays2to7Eligible: v.number()
})

const payingByTierValidator = v.object({
  starter: v.number(),
  growth: v.number(),
  pro: v.number(),
  contact: v.number()
})

// Exported for testing. Keeps only the rows inside the half-open window (createdAt >= since).
// No early-stop signal is derived here: `createdAt` is a user-recorded signup value, not
// monotonic with the `_creationTime` page order, so a backdated signup can follow an older one
// and the caller must page to `isDone` instead of stopping at the first older row.
export function cohortPageUsers<T extends { createdAt: number }>(page: readonly T[], since: number): T[] {
  return page.filter(u => u.createdAt >= since)
}

// Pages users in `_creationTime` order (newest first) for the cohort walk. This is NOT `createdAt`
// order — see cohortPageUsers.
export const getUsersPage = internalQuery({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, { paginationOpts }) => {
    const result = await ctx.db.query('users').order('desc').paginate(paginationOpts)
    return {
      ...result,
      page: result.page.map(u => ({
        _id: u._id,
        createdAt: u.createdAt,
        subscriptionStatus: u.subscriptionStatus,
        tier: u.tier
      }))
    }
  }
})

// Same per-user reads admin.survivalMetrics used to do inline, kept bounded exactly as before:
// subscriptions take(5), the member's oldest userInteractions row, and one probe per return window.
export const loadCohortRows = internalQuery({
  args: { users: v.array(cohortUserValidator) },
  handler: async (ctx, { users }): Promise<CohortRow[]> => {
    return await Promise.all(
      users.map(async u => {
        const subs = await ctx.db
          .query('subscriptions')
          .withIndex('by_user', q => q.eq('userId', u._id))
          .order('desc')
          .take(5)
        // by_user is ordered by _creationTime, so .first() is the member's OLDEST interaction.
        const first = await ctx.db
          .query('userInteractions')
          .withIndex('by_user', q => q.eq('userId', u._id))
          .first()
        const { day1, days2to7 } = returnWindows(u.createdAt)
        const returnedIn = async ([a, b]: [number, number]): Promise<boolean> =>
          (await ctx.db
            .query('userInteractions')
            .withIndex('by_user', q => q.eq('userId', u._id).gte('_creationTime', a).lt('_creationTime', b))
            .first()) !== null
        return {
          createdAt: u.createdAt,
          subscriptionStatus: u.subscriptionStatus,
          startedTrial: subs.length > 0,
          cancelPending: findLiveSubscription(subs)?.cancelAtPeriodEnd === true,
          firstInteractionAt: first?.createdAt,
          returnedDay1: await returnedIn(day1),
          returnedDays2to7: await returnedIn(days2to7)
        }
      })
    )
  }
})

// Pages users with subscriptionStatus 'active' (the same by_subscription_status index
// users.getActiveSubscribers uses) for the whole-table payingByTier counts.
export const getActiveUsersPage = internalQuery({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, { paginationOpts }) => {
    const result = await ctx.db
      .query('users')
      .withIndex('by_subscription_status', q => q.eq('subscriptionStatus', 'active'))
      .paginate(paginationOpts)
    return {
      ...result,
      page: result.page.map(u => ({ subscriptionStatus: u.subscriptionStatus, tier: u.tier }))
    }
  }
})

// Replaces the window's existing row in one transaction, so a rebuild never leaves two rows behind.
export const writeSnapshot = internalMutation({
  args: {
    days: v.union(v.literal(7), v.literal(28)),
    generatedAt: v.number(),
    since: v.number(),
    cohort: cohortSummaryValidator,
    payingByTier: payingByTierValidator
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('survivalSnapshots')
      .withIndex('by_days', q => q.eq('days', args.days))
      .unique()
    if (existing) await ctx.db.delete(existing._id)
    await ctx.db.insert('survivalSnapshots', args)
  }
})

// Cron entry point. Pages the whole users table per window instead of the old .take(1000) cap;
// filters each page by `createdAt >= since` and keeps walking to `isDone`, because backdated
// signups break the assumption that `createdAt` descends with the `_creationTime` page order.
export const rebuildSurvivalSnapshots = internalAction({
  args: {},
  handler: async ctx => {
    const now = Date.now()

    // payingByTier is not cohort-bound, so page active users once and reuse the counts.
    const activeUsers: { subscriptionStatus: string; tier?: string }[] = []
    let activeCursor: string | null = null
    for (;;) {
      const page: Page<{ subscriptionStatus: string; tier?: string }> = await ctx.runQuery(
        internal.jobs.survivalSnapshot.getActiveUsersPage,
        { paginationOpts: { numItems: PAGE_SIZE, cursor: activeCursor } }
      )
      activeUsers.push(...page.page)
      if (page.isDone) break
      activeCursor = page.continueCursor
    }
    const tierCounts = payingByTier(activeUsers)

    for (const days of [7, 28] as const) {
      const since = now - days * DAY_MS
      const rows: CohortRow[] = []
      let cursor: string | null = null
      for (;;) {
        const page: Page<CohortUser> = await ctx.runQuery(internal.jobs.survivalSnapshot.getUsersPage, {
          paginationOpts: { numItems: PAGE_SIZE, cursor }
        })
        const users = cohortPageUsers(page.page, since)
        if (users.length > 0) {
          const pageRows: CohortRow[] = await ctx.runQuery(internal.jobs.survivalSnapshot.loadCohortRows, { users })
          rows.push(...pageRows)
        }
        if (page.isDone) break
        cursor = page.continueCursor
      }

      const cohort = summarizeCohort(rows, now)
      await ctx.runMutation(internal.jobs.survivalSnapshot.writeSnapshot, {
        days,
        generatedAt: now,
        since,
        cohort,
        payingByTier: tierCounts
      })
    }
  }
})
