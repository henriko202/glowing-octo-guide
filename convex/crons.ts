// convex/crons.ts
// THIS IS THE ONLY FILE Convex reads for scheduled jobs.
// Cron definitions in other files are silently ignored.
import { cronJobs } from 'convex/server'
import { internal } from './_generated/api.js'

const crons = cronJobs()

// ─── Post sync ───────────────────────────────────────────────────────────────
// Runs daily at 3:00 UTC — fetches latest LinkedIn posts for all active users
crons.daily('sync LinkedIn posts', { hourUTC: 3, minuteUTC: 0 }, internal.jobs.syncPosts.syncAllPosts, {})

// Promote queued posts to the feed when authors regain capacity (runs at 4:00 UTC,
// one hour after the post sync so new posts are already settled).
crons.daily('process post queue', { hourUTC: 4, minuteUTC: 0 }, internal.jobs.processQueue.processPostQueue, {})

// ─── Session & OAuth state cleanup ───────────────────────────────────────────
// Purge expired session tokens every 6 hours to prevent unbounded table growth.
// Each batch removes up to 200 rows; large backlogs are handled across multiple runs.
crons.interval('cleanup expired sessions', { hours: 6 }, internal.sessions.deleteExpiredSessions, {})

// Purge expired OAuth state tokens every hour (they have a 10-minute TTL).
crons.interval('cleanup expired oauth states', { hours: 1 }, internal.sessions.deleteExpiredOAuthStates, {})

export default crons
