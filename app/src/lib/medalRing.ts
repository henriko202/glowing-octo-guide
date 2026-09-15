export function medalRing(medal?: 1 | 2 | 3): string | undefined {
  if (medal === 1) return 'ring-2 ring-amber-400'
  if (medal === 2) return 'ring-2 ring-zinc-300'
  if (medal === 3) return 'ring-2 ring-amber-700'
  return undefined
}
