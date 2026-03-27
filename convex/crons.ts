// convex/crons.ts
// THIS IS THE ONLY FILE Convex reads for scheduled jobs.
// Cron definitions in other files are silently ignored.
import { cronJobs } from 'convex/server'
import { internal } from './_generated/api.js'

const crons = cronJobs()

// ─── Post sync ───────────────────────────────────────────────────────────────
// Runs every hour at :00 — fetches latest LinkedIn posts for all active users
// TODO: when live, change to hourly
crons.daily('sync LinkedIn posts', { hourUTC: 3, minuteUTC: 0 }, internal.jobs.syncPosts.syncAllPosts, {})

export default crons
