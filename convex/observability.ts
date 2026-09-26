// convex/observability.ts
// Background failures → Sentry on the Convex free plan (see lib/sentry.ts). A scheduled run that throws keeps its
// error in the _scheduled_functions system table, so a sweep every half hour reads one slot of runs and reports each
// failure. A cron run leaves no such row, which is why crons.ts starts every job through `runScheduled`: the job then
// runs as a scheduled function and its failure lands in the same table.
import { makeFunctionReference } from 'convex/server'
import { v } from 'convex/values'
import { internal } from './_generated/api'
import { env, internalAction, internalMutation, internalQuery } from './_generated/server'
import { sendToSentry } from './lib/sentry'

const SLOT_MS = 30 * 60_000
// A run has settled by then: actions time out at 10 minutes and the longest delay anything schedules is 1 minute.
const SETTLE_MS = 15 * 60_000
// ponytail: one page per slot; paginate if a half hour ever holds more scheduled runs than this.
const SLOT_LIMIT = 1000

/**
 * The half hour of creation times a sweep at `now` reports: the last one that ended at least SETTLE_MS ago. Sweeps run
 * on the hour and the half hour, so consecutive sweeps read consecutive slots and each failure is reported once.
 */
export function slotBefore(now: number): { from: number; to: number } {
  const to = Math.floor((now - SETTLE_MS) / SLOT_MS) * SLOT_MS
  return { from: to - SLOT_MS, to }
}

/** Every cron's entry point: schedules the named job with its args, so the job's failure is recorded. */
export const runScheduled = internalMutation({
  args: { fn: v.string(), args: v.any() },
  handler: async (ctx, { fn, args }) => {
    await ctx.scheduler.runAfter(0, makeFunctionReference<'mutation' | 'action'>(fn), args)
  }
})

export const failedRuns = internalQuery({
  args: { from: v.number(), to: v.number() },
  handler: async (ctx, { from, to }) => {
    const runs = await ctx.db.system
      .query('_scheduled_functions')
      .withIndex('by_creation_time', q => q.gte('_creationTime', from).lt('_creationTime', to))
      .take(SLOT_LIMIT)
    if (runs.length === SLOT_LIMIT) console.error('Scheduled-run sweep hit its limit; the rest of the slot was skipped')
    return runs.flatMap(run =>
      run.state.kind === 'failed'
        ? [{ id: run._id, name: run.name, error: run.state.error, completedTime: run.completedTime }]
        : []
    )
  }
})

export const reportFailedRuns = internalAction({
  args: {},
  handler: async ctx => {
    if (!env.SENTRY_DSN) return
    const failures = await ctx.runQuery(internal.observability.failedRuns, slotBefore(Date.now()))
    // One event per function and message, with a count: a job that fails every 5 minutes costs one event per half
    // hour, not six, so it cannot eat the Sentry quota the browser shares.
    const groups = new Map<string, { run: (typeof failures)[number]; message: string; count: number }>()
    for (const run of failures) {
      // The first line is the message; the stack under it is left out, as in every other event. convex-test records
      // a failure without its error, hence the fallback.
      const message = (run.error ?? 'failed').split('\n')[0]
      const group = groups.get(`${run.name}\n${message}`)
      if (group) group.count++
      else groups.set(`${run.name}\n${message}`, { run, message, count: 1 })
    }
    for (const { run, message, count } of groups.values()) {
      await sendToSentry({
        type: 'ScheduledFunctionFailed',
        message,
        transaction: run.name,
        tags: { 'convex.function': run.name, 'convex.scheduled_id': run.id, 'convex.failed_runs': String(count) },
        timestamp: run.completedTime
      })
    }
  }
})
