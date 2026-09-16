// convex/crons.ts
// THIS IS THE ONLY FILE Convex reads for scheduled jobs.
// Cron definitions in other files are silently ignored.
import { cronJobs } from 'convex/server'
import { internal } from './_generated/api.js'

const crons = cronJobs()

// ─── Post sync ───────────────────────────────────────────────────────────────
// Runs daily at 03:00 UTC — fetches latest LinkedIn posts for all active users.
// Calls the Apify fan-out directly; it self-reschedules page by page (100 users/invocation).
// crons.cron pins a wall-clock time; crons.interval would drift relative to deploy time.
crons.cron('sync LinkedIn posts', '0 3 * * *', internal.jobs.syncPostsApify.syncAllPostsViaApify, {})

// Refresh like/comment counts on ALL feed-eligible posts every 60 minutes via one batched Apify run.
// Dev/local only: the job self-gates on isApifyPostSyncEnabled, so prod (Apify dormant) is untouched.
// crons.interval is fine here — unlike the daily syncs there is no cross-cron ordering to preserve.
crons.interval(
  'refresh feed engagement',
  { minutes: 60 },
  internal.jobs.refreshFeedEngagement.refreshFeedEngagement,
  {}
)

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

// Purge expired login codes every hour (they have a 2-minute TTL).
crons.interval('cleanup expired auth codes', { hours: 1 }, internal.sessions.deleteExpiredAuthCodes, {})

// Hard-delete accounts whose 30-day deletion grace window has elapsed (self-service erasure).
// Batched; reschedules itself when a run fills the batch.
crons.interval('process account deletions', { hours: 24 }, internal.privacy.deletion.processAccountDeletions, {})

// LinkedIn token refresh: renews tokens in the pre-expiry window via the by_token_expiry index.
// Runs every 6h — more frequently than "enforce data retention" below (24h) — so a refreshable
// token is renewed BEFORE retention nulls it as expired. Best-effort/mostly dormant in practice
// (see linkedin/tokenRefresh.ts): the app's current OAuth tier almost never yields a
// refresh_token. Cursor-paginated (mirrors migrations/backfillFeedFields.ts): each 6h tick
// self-reschedules with the cursor until the whole pre-expiry window has been paged through, so
// coverage never depends on per-user refresh success/failure. Called with no args — cursor
// undefined starts a fresh sweep from the front of the window each tick.
crons.interval('refresh LinkedIn tokens', { hours: 6 }, internal.linkedin.tokenRefresh.refreshExpiringTokens, {})

// Data minimization: expire tokens, purge old export files + audit logs, flag dormant accounts.
// Must run AFTER the refresh cron has a chance to act (see above) — retention only clears tokens
// already past expiry, so ordering ensures a refreshable token is renewed first.
crons.interval('enforce data retention', { hours: 24 }, internal.privacy.retention.enforceDataRetention, {})

// ─── Admin survival snapshots ────────────────────────────────────────────────
// Rebuilds the 7- and 28-day cohort snapshots the admin Survival panel reads (backlog/R18).
// Fixed 03:15 UTC, just after the daily post sync, so the numbers are stable and the panel's
// "as of" caption changes at the same time every day.
crons.cron('rebuild survival snapshots', '15 3 * * *', internal.jobs.survivalSnapshot.rebuildSurvivalSnapshots, {})

// ─── Ranking snapshots (R22) ─────────────────────────────────────────────────
// Daily site-wide ranking board, one row per window, keeping the newest 4 generations. 03:30 and 03:35 UTC,
// after the 03:15 survival snapshot, so the boards and the panel move at the same predictable time.
crons.cron('rebuild 7d ranking snapshot', '30 3 * * *', internal.jobs.rankingSnapshot.rebuildRankingSnapshots, {
  window: '7d'
})
crons.cron('rebuild 30d ranking snapshot', '35 3 * * *', internal.jobs.rankingSnapshot.rebuildRankingSnapshots, {
  window: '30d'
})

// ─── 3-day activity digest (R24) ─────────────────────────────────────────────
// Daily sweep at 10:00 UTC; lib/digest.isDigestDue gates each member on the 3-day cadence, so the cron stays a
// simple daily pass. Batches of 50 sends per invocation with self-rescheduling.
crons.cron('send activity digests', '0 10 * * *', internal.jobs.digest.sendDueDigests, {})

// ─── MOTD schedule reconciliation ────────────────────────────────────────────
// Materializes each MOTD's [startAt, expiresAt) window into its `enabled` flag so the viewer
// query (motd.getActiveMotd) stays wall-clock-free. Every 5 minutes: an expired MOTD can linger
// up to one tick, and a reached startAt activates within one tick.
crons.interval('reconcile MOTD windows', { minutes: 5 }, internal.motd.motd.reconcileMotdWindows, {})

export default crons
