// Pure decision mirroring the insert gate in jobs/syncPosts.upsertPost.
export function isWeeklyLimitReached(recentCount: number, postsPerWeek: number): boolean {
  return recentCount >= postsPerWeek
}

// Pure decision mirroring the quota gate in posts.featurePost.
export function isFeaturedLimitReached(usedCount: number, featuredPerMonth: number): boolean {
  return usedCount >= featuredPerMonth
}

// The UTC calendar-month key ("YYYY-MM") featuredPostUsage rows are keyed by. Deterministic and
// timezone-independent (derives from the UTC calendar date, not the server's local time), so the
// monthly featured-post quota resets at the same instant for every user regardless of where the
// Convex function happens to run. Defaults to now — callers pass an explicit `now` only in tests.
export function currentUtcMonthKey(now: number = Date.now()): string {
  const d = new Date(now)
  const month = String(d.getUTCMonth() + 1).padStart(2, '0')
  return `${d.getUTCFullYear()}-${month}`
}
