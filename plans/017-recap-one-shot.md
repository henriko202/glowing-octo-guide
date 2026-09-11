# Plan 017: Make the recap read one-shot instead of a 4k-doc live subscription

> **Executor instructions**: Follow step by step, run each verification. Honor STOP conditions.
> Update this plan's row in `plans/README.md` when done.
> **Repo rule (`CLAUDE.md`/`AGENTS.md`): NEVER commit or push.** Keep `docs/PLATFORM.md` in sync (Step 4).
>
> **Drift check (run first)**:
>
`git status --porcelain -- convex/interactions.ts app/src/pages/RecapPage.tsx app/src/components/CancelInterstitial.tsx app/src/pages/RecapPage.test.tsx app/src/components/CancelInterstitial.test.tsx docs/PLATFORM.md`
> Plan 016 also edits `convex/interactions.ts` (only `listMyInteractions`); preserve that change if it
> landed. Compare the excerpts below. On a mismatch, STOP.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED. The recap stops updating live while the page is open. That is the intended trade-off;
  the test plan pins the new behavior.
- **Depends on**: none
- **Category**: perf
- **Planned at**: working tree at commit `ced69ac`, 2026-09-10

## Why this matters

`getRecap` reads up to 2 x `RECAP_ROW_CEILING` (2,000 each) `userInteractions` rows plus up to 200
posts (`convex/interactions.ts:378-397`; `convex/lib/recap.ts:12-14`). It is a reactive query consumed
by `RecapPage` (`app/src/pages/RecapPage.tsx:72`) and `CancelInterstitial.tsx:57`. Because its read set
covers the viewer's own interactions and the interactions anyone made on their posts, every like or
comment re-runs the full multi-thousand-document read while the page or dialog is open. The page is a
review surface, not a live activity stream, so a one-shot fetch removes the re-run storm at the cost of
live updates while it is open. Reactivity for the History page (paginated) is untouched.

## Current state

```ts
// app/src/pages/RecapPage.tsx:66-74
const [range, setRange] = useState<RecapWindow>('7d')
// Floored to the hour so the query args are stable across renders (one Convex subscription).
const [now] = useState(() => floorToHour(Date.now()))
const recap = useQuery(api.interactions.getRecap, sessionToken ? { sessionToken, window: range, now } : 'skip')
const usage = useQuery(api.posts.getWeeklyUsage, { sessionToken }) as WeeklyUsage | null | undefined
const featuredUsage = useQuery(api.posts.getFeaturedUsage, { sessionToken }) as FeaturedUsage | null | undefined
```

The page's loading contract relies on `recap === undefined` during arg changes (comment at
`RecapPage.tsx:93-95`). Keep that contract: the new hook returns `undefined` while loading.

```ts
// app/src/components/CancelInterstitial.tsx:56-60
const [now] = useState(() => floorToHour(Date.now()))
const recap = useQuery(
  api.interactions.getRecap,
  open && sessionToken ? { sessionToken, window: '30d', now } : 'skip'
)
```

`RecapPage.test.tsx:83-190` mocks `useQuery` returns per query reference; `CancelInterstitial.test.tsx`
does the same. Both must be updated to the new hook.

## Commands you will need

| Purpose          | Command                        | Expected             |
|------------------|--------------------------------|----------------------|
| App tests        | `pnpm --filter app test`       | all pass             |
| Convex tests     | `pnpm --filter convex test`    | all pass (unchanged) |
| Typecheck / lint | `pnpm typecheck` / `pnpm lint` | exit 0               |
| Full gate        | `pnpm verify`                  | exit 0               |

## Scope

**In scope**: a new `app/src/lib/useQueryOnce.ts` (create) plus its test,
`app/src/pages/RecapPage.tsx`, `app/src/components/CancelInterstitial.tsx`,
`app/src/pages/RecapPage.test.tsx`, `app/src/components/CancelInterstitial.test.tsx`,
`docs/PLATFORM.md`. **Out of scope**: `convex/interactions.ts` (the server query stays as-is; the read cost per
execution
is uncapped by this plan), `HistoryPage`, `getWeeklyUsage`/`getFeaturedUsage` calls, and the billing
page's own queries.

## Git workflow

- Branch: `advisor/017-recap-one-shot`. Do NOT commit or push.

## Steps

### Step 1: Add a one-shot query hook

Create `app/src/lib/useQueryOnce.ts`:

```ts
import { useEffect, useState } from 'react'
import { useConvex } from 'convex/react'
import type { FunctionReference } from 'convex/server'

/**
 * One-shot Convex query: fetches when `args` change and resolves once, without subscribing to
 * updates. Use for review surfaces whose result is expensive (getRecap reads thousands of rows) and
 * does not need live updates. Returns undefined while loading, mirroring useQuery's arg-change shape.
 */
export function useQueryOnce<Query extends FunctionReference<'query'>>(
  query: Query,
  args: Query['_args'] | 'skip'
): Query['_returnType'] | undefined {
  const client = useConvex()
  const [result, setResult] = useState<Query['_returnType'] | undefined>(undefined)
  const key = args === 'skip' ? null : JSON.stringify(args)
  useEffect(() => {
    if (key === null) {
      setResult(undefined)
      return
    }
    let cancelled = false
    setResult(undefined)
    void client
      .query(query, args as Query['_args'])
      .then(value => {
        if (!cancelled) setResult(value as Query['_returnType'])
      })
      .catch(() => {
        if (!cancelled) setResult(undefined)
      })
    return () => {
      cancelled = true
    }
  }, [client, query, key])
  return result
}
```

If the generated `FunctionReference` type parameters in this repo's convex version do not expose
`_args`/`_returnType`, type the hook with two generics (`<Args extends Record<string, unknown>, Result>`)
or derive from `client.query`'s signature; do not use `any`.

**Verify**: `pnpm typecheck` exits 0.

### Step 2: Cover the hook

Create `app/src/lib/useQueryOnce.test.ts(x)` with React Testing Library (repo pattern:
`app/src/pages/RecapPage.test.tsx`): renders a probe component; asserts the value arrives after the
promise resolves, that a change of args triggers a second fetch, that `'skip'` fetches nothing, and
that an unmount before resolution does not set state (no act warning).

**Verify**: `pnpm --filter app test` passes including the new test.

### Step 3: Switch `RecapPage`

Replace the `useQuery(api.interactions.getRecap, ...)` call with
`useQueryOnce(api.interactions.getRecap, sessionToken ? { sessionToken, window: range, now } : 'skip')`.
Everything downstream keeps working unchanged because the hook returns `undefined` while loading and
the resolved value shape is identical. Add a comment at the call: one-shot by design (see this plan's
Why), recap refreshes on reopen or range change.

**Verify**: `pnpm --filter app test` passes after updating `RecapPage.test.tsx` mocks from `useQuery`
to `useQueryOnce` (or to the new hook's mock). Keep every existing behavioral assertion.

### Step 4: Switch `CancelInterstitial`

Same replacement for its `getRecap` call. It does not need live updates: it renders numbers while the
dialog is open and the dialog itself is a one-shot decision surface.

**Verify**: `pnpm --filter app test` passes after mock updates.

### Step 5: Sync `docs/PLATFORM.md`

In the recap/history subsection: state that `getRecap` is fetched one-shot (not a live subscription)
because it reads thousands of interaction rows, while History keeps its paginated live query. Note the
UX consequence: recap numbers refresh when the page is (re)opened or the window toggles.

## Test plan

- New hook tests as in Step 2.
- Updated page/component tests keep the existing assertions, proving the data paths are unchanged.
- Manual check (if a dev deployment is available): open Recap, like a post in another tab, confirm the
  recap does not change until reopen/toggle. If no deployment is available, say so in the report.

## Done criteria (ALL must hold)

- [ ] `pnpm verify` exits 0
- [ ] `grep -n "getRecap" app/src/ -r` shows only `useQueryOnce` consumers
- [ ] `grep -n "useQuery(api.interactions.getRecap" app/src/ -r` returns nothing
- [ ] `app/src/lib/useQueryOnce.ts` exists with no `any`
- [ ] `docs/PLATFORM.md` recap subsection updated
- [ ] Only in-scope files changed; no commit made
- [ ] `plans/README.md` row updated

## STOP conditions

- `client.query` does not exist on this `convex/react` version, or its typing cannot be expressed
  without `any`: STOP and report; do not fall back to a `useEffect` that polls.
- A product owner has stated recap must update live: STOP. The alternative is per-user hourly counter
  rows (plan-sized), not a smaller ceiling.
- `RecapPage`'s effect at `:78-82` (analytics `recap_viewed`) fires differently after the change in a
  way that breaks its once-per-window latch: fix the latch, or report if the semantics are unclear.

## Maintenance notes

- If live recap becomes a requirement, replace this with per-user hourly counters maintained in the
  interaction mutations; keep the one-shot hook for the dialog.
- Reviewer: confirm `getRecap`'s server read ceiling is unchanged, and that no other query was
  accidentally converted.
