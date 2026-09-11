import { useEffect, useRef, useState } from 'react'
import { useConvex } from 'convex/react'
import type { FunctionReference } from 'convex/server'

/**
 * One-shot Convex query: fetches when `args` change and resolves once, without subscribing to
 * updates. Use for review surfaces whose result is expensive (getRecap reads thousands of rows) and
 * does not need live updates. Returns `{ data, error }`: `data` is undefined while loading
 * (mirroring useQuery's arg-change shape), and a failed fetch sets `error` instead of rethrowing.
 *
 * The result is keyed by the stringified args, so a key change reads as loading immediately and a
 * stale in-flight fetch can never publish the previous args' value.
 */
export function useQueryOnce<Query extends FunctionReference<'query'>>(
  query: Query,
  args: Query['_args'] | 'skip'
): { data: Query['_returnType'] | undefined; error: Error | null } {
  const client = useConvex()
  const key = args === 'skip' ? null : JSON.stringify(args)
  const [state, setState] = useState<{
    key: string
    data: Query['_returnType'] | undefined
    error: Error | null
  } | null>(null)

  // Latest args for the fetch effect without making the object literal an effect dependency (it is
  // rebuilt every render; `key` is the stable identity). Declared first so it runs before the fetch.
  const argsRef = useRef(args)
  useEffect(() => {
    argsRef.current = args
  }, [args])

  useEffect(() => {
    if (key === null) return
    const currentArgs = argsRef.current
    if (currentArgs === 'skip') return
    let cancelled = false
    void client
      .query(query, currentArgs)
      .then(value => {
        if (!cancelled) setState({ key, data: value, error: null })
      })
      .catch((err: unknown) => {
        if (!cancelled) setState({ key, data: undefined, error: err instanceof Error ? err : new Error(String(err)) })
      })
    return () => {
      cancelled = true
    }
  }, [client, query, key])

  if (state === null || state.key !== key) return { data: undefined, error: null }
  return state
}
