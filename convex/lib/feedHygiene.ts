// convex/lib/feedHygiene.ts
// Pure rules for backlog/R21: a post the viewer already reacted to or commented on stays in THEIR
// feed for 24 h (done state), then leaves; "Hide now" removes it at once, whether or not they
// interacted. Nothing here touches counts, caps, `inFeed`, search or the author's My Posts — this
// is per-viewer presentation only.

/** How long a handled post stays in the viewer's feed. */
export const INTERACTED_TTL_MS = 24 * 60 * 60 * 1000

/** The `userPostState` fields this module reads. */
export interface ViewerRow {
  reactedAt?: number
  commentedAt?: number
  hiddenAt?: number
}

/** What the card renders for a post the viewer already handled — `null` for an untouched post. */
export interface FeedViewerState {
  reacted: boolean
  commented: boolean
  /** When the post leaves this viewer's feed on its own (ms epoch). */
  hidesAt: number
}

export function lastInteractedAt(row: ViewerRow): number | undefined {
  // No `?? 0` sentinel: Math.max would floor the result at 0 and swallow the missing side.
  if (row.reactedAt === undefined) return row.commentedAt
  if (row.commentedAt === undefined) return row.reactedAt
  return Math.max(row.reactedAt, row.commentedAt)
}

/**
 * `fresh`: never interacted — the normal card. `done`: interacted, inside the window — the done
 * card. `gone`: hidden by the viewer, or the window elapsed — dropped from the page.
 */
export function viewerPostStatus(row: ViewerRow | null, now: number): 'fresh' | 'done' | 'gone' {
  if (!row) return 'fresh'
  if (row.hiddenAt !== undefined) return 'gone'
  const at = lastInteractedAt(row)
  if (at === undefined) return 'fresh'
  return now - at < INTERACTED_TTL_MS ? 'done' : 'gone'
}

export function toFeedViewerState(row: ViewerRow | null): FeedViewerState | null {
  if (!row) return null
  const at = lastInteractedAt(row)
  if (at === undefined) return null
  return {
    reacted: row.reactedAt !== undefined,
    commented: row.commentedAt !== undefined,
    hidesAt: at + INTERACTED_TTL_MS
  }
}
