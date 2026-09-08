// Pure decision: should a post's interaction limit flip to "reached" on this interaction?
// `reached` is true once total interactions hit the plan cap; the flip only matters if the
// post is not ALREADY marked, so the caller passes `alreadyReached`.
export function hasReachedInteractionLimit(
  likeCount: number,
  commentCount: number,
  interactionsPerPost: number
): boolean {
  return likeCount + commentCount >= interactionsPerPost
}

export function shouldFlipInteractionLimit(
  likeCount: number,
  commentCount: number,
  interactionsPerPost: number,
  alreadyReached: boolean
): boolean {
  return hasReachedInteractionLimit(likeCount, commentCount, interactionsPerPost) && !alreadyReached
}

/** From this share of the cap a post is "near" it — the recap shows the upgrade ask (backlog/R15). */
export const UPGRADE_NUDGE_RATIO = 0.8

export function isNearInteractionLimit(likeCount: number, commentCount: number, interactionsPerPost: number): boolean {
  if (interactionsPerPost <= 0) return false
  const total = likeCount + commentCount
  return total >= Math.ceil(interactionsPerPost * UPGRADE_NUDGE_RATIO) && total < interactionsPerPost
}

/**
 * backlog/R17 — the cap a specific post is measured against: its author's plan cap plus the bonus
 * stored on the post when its featured slot was bought. Every site that decides "reached"
 * for an EXISTING post goes through this (interactions.flipCapIfReached, jobs/syncPosts
 * applyEngagementCounts, lib/recap.pickNearCapPost); creation-time checks keep the plan cap.
 */
export function effectiveInteractionCap(planCap: number, bonus: number | undefined): number {
  return planCap + (bonus ?? 0)
}
