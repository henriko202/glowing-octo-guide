// convex/lib/concurrency.ts
// Bounded-concurrency fan-out. Runs `fn` over `items` in sequential batches of `size`, awaiting each
// batch before starting the next, and never rejects (mirrors Promise.allSettled) so one failing item
// can't sink the rest. Used to cap the Apify per-user fan-outs (jobs/syncPostsApify, jobs/
// scrapeProfileApify) so a large subscriber list can't open an unbounded number of concurrent —
// paid, rate-limited — Apify runs at once.
//
// ponytail: fixed-size batches, not a sliding-window pool — a batch waits for its slowest item
// before the next starts. Upgrade to a pool only if one slow item per batch measurably drags the
// whole fan-out; for a handful of subscribers it never will.
export async function settledInBatches<T, R>(
  items: readonly T[],
  size: number,
  fn: (item: T) => Promise<R>
): Promise<PromiseSettledResult<R>[]> {
  const step = Math.max(1, Math.floor(size)) // guard: size < 1 would make the loop never advance
  const results: PromiseSettledResult<R>[] = []
  for (let i = 0; i < items.length; i += step) {
    results.push(...(await Promise.allSettled(items.slice(i, i + step).map(fn))))
  }
  return results
}
