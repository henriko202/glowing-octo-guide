// Pure rank maths for R22/R24. Positions are 1-based position numbers: a SMALLER number is a better rank, so a
// positive `movement` means the member climbed. Ties share the best (lowest) position number, e.g. in [9,7,7,5] the
// two 7s both rank 2 and the 5 ranks 4.

const DAY = 86_400_000
const DIGEST_SPAN = 3 * DAY

/** Competition ranking over a descending counts array: [9,7,7,5] -> [1,2,2,4]. */
export function rankPositions(countsDescending: number[]): number[] {
  return countsDescending.map((count, i) => {
    let better = 0
    for (let j = 0; j < i; j += 1) if (countsDescending[j] > count) better += 1
    return better + 1
  })
}

/**
 * Exact 1-based competition position for a count via binary search; null when the count is zero or absent.
 * A live count above every stored count takes position 1: between rebuilds the member can overtake the stored
 * leader, and beating every stored count is at least first place.
 */
export function positionOf(count: number, countsDescending: number[]): number | null {
  if (count <= 0) return null
  if (countsDescending.length === 0 || count > countsDescending[0]) return 1
  let lo = 0
  let hi = countsDescending.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (countsDescending[mid] > count) lo = mid + 1
    else hi = mid
  }
  return lo < countsDescending.length && countsDescending[lo] === count ? lo + 1 : null
}

/** Positive = climbed (position number decreased). Null when either side is unknown. */
export function movement(previousPosition: number | null, currentPosition: number | null): number | null {
  if (previousPosition === null || currentPosition === null) return null
  return previousPosition - currentPosition
}

/** Newest generation at or before `lastDigestAt`, or null when the member was never sent a digest. */
export function pickPreviousGeneration<T extends { generatedAt: number }>(
  generations: T[],
  lastDigestAt: number
): T | null {
  return generations.find(g => g.generatedAt <= lastDigestAt) ?? null
}

/** Half-open [since, until): three days, never further back even when the last send is older. */
export function digestWindow(now: number, lastDigestAt?: number): { since: number; until: number } {
  const floor = now - DIGEST_SPAN
  const since = lastDigestAt !== undefined && lastDigestAt > floor ? lastDigestAt : floor
  return { since, until: now }
}

/** Snapshot ordering: count desc, then newest activity, then id asc; sliced to `limit`. Extra map fields ride along. */
export function topEntries<T extends { count: number; lastAt: number }>(
  map: Map<string, T>,
  limit: number
): Array<{ userId: string } & T> {
  return [...map.entries()]
    .map(([userId, v]) => ({ userId, ...v }))
    .sort(
      (a, b) => b.count - a.count || b.lastAt - a.lastAt || (a.userId < b.userId ? -1 : a.userId > b.userId ? 1 : 0)
    )
    .slice(0, limit)
}

/**
 * Caps a counts distribution at `max` entries — Convex arrays are hard-limited to 8,192 elements, and one entry
 * per distinct active member can exceed that. `capped` says the tail was dropped, so the snapshot flags `partial`
 * and positions beyond the cap correctly read as "no position" (positionOf returns null for an absent count).
 */
export function capDistribution(counts: number[], max: number): { counts: number[]; capped: boolean } {
  return counts.length > max ? { counts: counts.slice(0, max), capped: true } : { counts, capped: false }
}
