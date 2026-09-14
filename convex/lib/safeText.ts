// UTF-16 boundary helpers. `slice` and `length` count code units, so a cut between the halves of a
// surrogate pair (an emoji) leaves a lone surrogate — Convex's return-value serialization rejects it
// ("Could not parse return value as json: unexpected end of hex escape") and the whole query fails,
// not just that row. Sanitize user text at the write boundary and truncate defensively on read.
//
// Deliberately regex-free: a lookbehind pattern would sit in the client bundle through lib/recap and
// Safari before 16.4 fails to parse lookbehind at module-eval time.

/** Removes unpaired surrogate halves left behind by a UTF-16 slice (high and low). */
export function stripLoneSurrogates(value: string): string {
  let out = ''
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i)
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(i + 1)
      if (next >= 0xdc00 && next <= 0xdfff) {
        out += value[i] + value[i + 1]
        i += 1
      }
      continue
    }
    if (code >= 0xdc00 && code <= 0xdfff) continue
    out += value[i]
  }
  return out
}

/** Clamps to `max` code units; a cut that would split a surrogate pair backs off one unit instead. */
export function truncateSafely(value: string, max: number): string {
  if (value.length <= max) return value
  const last = value.charCodeAt(max - 1)
  const cut = last >= 0xd800 && last <= 0xdbff ? max - 1 : max
  return value.slice(0, cut)
}
