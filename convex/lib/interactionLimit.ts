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
