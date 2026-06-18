// convex/crons.ts
// THIS IS THE ONLY FILE Convex reads for scheduled jobs.
// Cron definitions in other files are silently ignored.
import { cronJobs } from 'convex/server'
import { internal } from './_generated/api.js'

const crons = cronJobs()

// ─── Post sync ───────────────────────────────────────────────────────────────
// Runs daily at 03:00 UTC — fetches latest LinkedIn posts for all active users.
// crons.cron pins a wall-clock time; crons.interval would drift relative to deploy time.
crons.cron('sync LinkedIn posts', '0 3 * * *', internal.jobs.syncPosts.syncAllPosts, {})

// Promote queued posts to the feed when authors regain capacity. Runs daily at 04:00 UTC —
// one hour after the post sync so newly-synced posts are already settled. A fixed cron time keeps
// that 1-hour gap stable (an interval offset like { hours: 25 } would slowly drift the two apart).
crons.cron('process post queue', '0 4 * * *', internal.jobs.processQueue.processPostQueue, {})

// ─── Session & OAuth state cleanup ───────────────────────────────────────────
// Purge expired session tokens every 6 hours to prevent unbounded table growth.
// Each batch removes up to 200 rows; large backlogs are handled across multiple runs.
crons.interval('cleanup expired sessions', { hours: 6 }, internal.sessions.deleteExpiredSessions, {})

// Purge expired OAuth state tokens every hour (they have a 10-minute TTL).
crons.interval('cleanup expired oauth states', { hours: 1 }, internal.sessions.deleteExpiredOAuthStates, {})

// Hard-delete accounts whose 30-day deletion grace window has elapsed (self-service erasure).
// Batched; reschedules itself when a run fills the batch.
crons.interval('process account deletions', { hours: 24 }, internal.privacy.deletion.processAccountDeletions, {})

// Data minimization: expire tokens, purge old export files + audit logs, flag dormant accounts.
crons.interval('enforce data retention', { hours: 24 }, internal.privacy.retention.enforceDataRetention, {})

export default crons
