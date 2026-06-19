// Pure decision mirroring the insert gate in jobs/syncPosts.upsertPost.
export function isWeeklyLimitReached(recentCount: number, postsPerWeek: number): boolean {
  return recentCount >= postsPerWeek
}
