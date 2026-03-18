// convex/crons.ts
// THIS IS THE ONLY FILE Convex reads for scheduled jobs.
// Cron definitions in other files are silently ignored.
import { cronJobs } from 'convex/server'
import { internal } from './_generated/api.js'

const crons = cronJobs()

// ─── Post sync ───────────────────────────────────────────────────────────────
// Runs every hour at :00 — fetches latest LinkedIn posts for all active users
crons.hourly('sync LinkedIn posts', { minuteUTC: 0 }, internal.jobs.syncPosts.syncAllPosts, {})

// ─── Connections sync ─────────────────────────────────────────────────────────
// Runs every day at 03:00 UTC — refreshes 1st-degree connection caches
// (used for feed scoring: mutual connections rank higher)
crons.daily(
  'sync LinkedIn connections',
  { hourUTC: 3, minuteUTC: 0 },
  internal.jobs.syncConnections.syncAllConnections,
  {}
)

export default crons
