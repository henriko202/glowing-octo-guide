// RCD — pure rule for the "your post set a new record" notification. A post must clear the floor, beat the
// author's stored best for that post, and wait out the 7-day cooldown since the last announcement of it.
export const RECORD_FLOOR = 5
export const RECORD_COOLDOWN_MS = 7 * 86_400_000

export function isNewRecord(currentTotal: number, bestTotal: number, now: number, notifiedAt?: number): boolean {
  if (currentTotal < RECORD_FLOOR) return false
  if (currentTotal <= bestTotal) return false
  if (notifiedAt !== undefined && now - notifiedAt <= RECORD_COOLDOWN_MS) return false
  return true
}
