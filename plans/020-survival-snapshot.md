# Plan 020: Snapshot the admin survival metrics instead of recomputing 4k docs reactively

> **Execution note (2026-09-10):** Implemented in the working tree; verified by `survivalMetrics` reading the single
> `survivalSnapshots` row (`convex/admin.ts:406-418`), the `[7, 28]` nightly rebuild cron, and `SurvivalTab`'s null/
> `generatedAt` states (suites: convex 609 / app 479 / landing 24 / integration 6).

> **Executor instructions**: Follow step by step, run each verification. Honor STOP conditions.
> Update this plan's row in `plans/README.md` when done.
> **Repo rule (`CLAUDE.md`/`AGENTS.md`): NEVER commit or push.** Keep `docs/PLATFORM.md` in sync (Step 5).
>
> **Drift check (run first)**:
>
`git status --porcelain -- convex/admin.ts convex/lib/survival.ts convex/schema.ts convex/crons.ts app/src/components/SurvivalTab.tsx docs/PLATFORM.md`
> Compare the excerpts below. On a mismatch, STOP.

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: LOW-MED. The panel becomes eventually consistent (daily snapshot). Its numbers stop
  changing live, which is acceptable for an admin cohort report but must be documented and shown in
  the UI ("as of <time>").
- **Depends on**: none
- **Category**: perf
- **Planned at**: working tree at commit `ced69ac`, 2026-09-10

## Why this matters

`admin.survivalMetrics` is a reactive query that takes the newest 1000 users and performs roughly four
indexed reads per cohort member (`convex/admin.ts:404-437`), so one execution reads 4-8k documents.
While the Survival tab is open, any interaction or subscription write by any cohort member invalidates
and re-runs it. The `take(1000)` also silently truncates the cohort, so `signups` goes wrong as the
base grows. The code's own comment (`admin.ts:397`) already says "precompute nightly if a 28-day
cohort passes ~1500". This plan does exactly that: a scheduled snapshot the query reads as one row.

## Current state

```ts
// convex/admin.ts:398-439 (abridged)
export const survivalMetrics = query({
  args: { sessionToken: v.string(), days: v.union(v.literal(7), v.literal(28)) },
  handler: async (ctx, { sessionToken, days }) => {
    const admin = await requireAuth(ctx, sessionToken)
    assertAdmin(admin)
    const now = Date.now()
    const since = now - days * DAY_MS
    const users = await ctx.db.query('users').order('desc').take(1000)
    const cohort = users.filter(u => u.createdAt >= since)
    const rows: CohortRow[] = await Promise.all(cohort.map(async u => {
      // subscriptions take(5), first userInteractions .first(), two return-window .first() reads
    }))
    return { days, since, generatedAt: now, cohort: summarizeCohort(rows, now), payingByTier: payingByTier(users) }
  }
})
```

`convex/lib/survival.ts` already provides the pure maths: `CohortRow`, `CohortSummary`,
`summarizeCohort(rows, now)`, `payingByTier(users)`, `returnWindows`. The job must reuse them
unchanged.

## Commands you will need

| Purpose          | Command                        | Expected |
|------------------|--------------------------------|----------|
| Convex tests     | `pnpm --filter convex test`    | all pass |
| App tests        | `pnpm --filter app test`       | all pass |
| Typecheck / lint | `pnpm typecheck` / `pnpm lint` | exit 0   |
| Full gate        | `pnpm verify`                  | exit 0   |

## Scope

**In scope**: `convex/schema.ts`, `convex/jobs/survivalSnapshot.ts` (create), `convex/admin.ts`
(`survivalMetrics` only), `convex/crons.ts`, `app/src/components/SurvivalTab.tsx` (render the null and
`generatedAt` states), matching tests, `docs/PLATFORM.md`. **Out of scope**: `lib/survival.ts` maths, `listUsers`,
retention/deletion behavior, and the
`payingByTier` definition.

## Git workflow

- Branch: `advisor/020-survival-snapshot`. Do NOT commit or push.

## Steps

### Step 1: Add the snapshot table

In `convex/schema.ts`:

```ts
// Nightly admin cohort snapshots (survival panel). One row per window; the query reads one row
// instead of re-reading the whole cohort reactively. See jobs/survivalSnapshot.ts.
survivalSnapshots: defineTable({
  days: v.union(v.literal(7), v.literal(28)),
  generatedAt: v.number(),
  since: v.number(),
  cohort: v.object({
    signups: v.number(),
    startedTrial: v.number(),
    activated: v.number(),
    medianMinutesToFirstInteraction: v.union(v.number(), v.null()),
    returnedDay1: v.number(),
    returnedDays2to7: v.number(),
    trialsEnded: v.number(),
    converted: v.number(),
    canceled: v.number(),
    activatedEligible: v.number(),
    returnedDay1Eligible: v.number(),
    returnedDays2to7Eligible: v.number()
  }),
  payingByTier: v.object({ starter: v.number(), growth: v.number(), pro: v.number(), contact: v.number() })
}).index('by_days', ['days']),
```

**Verify**: `pnpm --filter convex exec tsc --noEmit -p convex/tsconfig.json` exits 0.

### Step 2: Build the snapshot job

Create `convex/jobs/survivalSnapshot.ts`:

- `getUsersPage` internalQuery: `args: { paginationOpts: paginationOptsValidator }`, paginates `users`
  with `.order('desc')` (creation order) and maps each user to the fields the cohort logic needs (`_id`, `createdAt`,
  `subscriptionStatus`, `tier`). Return the pagination result.
- `loadCohortRows` internalQuery or inline in the action: given a page of users, perform the same
  per-user reads as today (`subscriptions` take (5), first `userInteractions`, two return-window
  probes) and return `CohortRow[]`. Keep the reads bounded exactly as the current code.
- `rebuildSurvivalSnapshots` internalAction: for each window (`7`, `28`), page through users (stop
  once `createdAt < since`; order desc means the rest are older), accumulate `CohortRow[]`, call
  `summarizeCohort(rows, now)` and `payingByTier(allActiveUsers)` (read active users via the existing
  `users.getActiveSubscribers`-style indexed path or a dedicated internal query), then
  `runMutation(internal.jobs.survivalSnapshot.writeSnapshot, {...})`.
- `writeSnapshot` internalMutation: replace any existing row for `days` and insert the new one (query by `by_days`,
  delete, insert).

Use `Date.now()` freely in the action (allowed), and store it as `generatedAt`/`since`.

**Verify**: `pnpm --filter convex exec tsc --noEmit -p convex/tsconfig.json` exits 0.

### Step 3: Read the snapshot in `survivalMetrics`

Rewrite the query to:

```ts
const snapshot = await ctx.db.query('survivalSnapshots').withIndex('by_days', q => q.eq('days', days)).unique()
if (!snapshot) return null
return {
  days: snapshot.days,
  since: snapshot.since,
  generatedAt: snapshot.generatedAt,
  cohort: snapshot.cohort,
  payingByTier: snapshot.payingByTier
}
```

No `Date.now()`, no per-user reads, no 1000 cap. Keep the auth + `assertAdmin` gate.

**Verify**: `pnpm --filter convex test` passes; `grep -n "Date.now()" convex/admin.ts` shows no match
inside `survivalMetrics`.

### Step 4: Schedule and surface it

- `convex/crons.ts`:
  `crons.cron('rebuild survival snapshots', '15 3 * * *', internal.jobs.survivalSnapshot.rebuildSurvivalSnapshots, {})`
  (after the daily sync, any stable time is fine).
- `app/src/components/SurvivalTab.tsx`: handle `null` (show "No snapshot yet" empty state) and render
  `generatedAt` as an "as of" caption. The number rendering is otherwise unchanged.
- Update `app` tests that mock `survivalMetrics` if the nullable shape breaks typing.

**Verify**: `pnpm --filter app test` and `pnpm --filter convex test` pass.

### Step 5: Sync `docs/PLATFORM.md`

§12 (Survival panel): the query reads a nightly snapshot; the job is the only place that computes
cohort maths; note the `generatedAt` staleness and remove the "1000 newest users" cap text.

## Test plan

- New tests for `rebuildSurvivalSnapshots`'s pure accumulation step if extracted (page + cohort
  filtering).
- Existing `lib/survival.test.ts` continues to pin the maths.
- A test that `survivalMetrics` returns `null` with no row and the stored shape with one (mock-ctx
  pattern if available; otherwise cover the pure projection).
- Verification: `pnpm verify` all green.

## Done criteria (ALL must hold)

- [x] `pnpm verify` exits 0
- [x] `survivalMetrics` performs no per-user reads and no `Date.now()`
- [x] The 1000 cap is gone; the snapshot job pages the whole cohort
- [x] A cron rebuilds both windows daily
- [x] `SurvivalTab` renders the null and `generatedAt` states
- [x] `docs/PLATFORM.md` §12 updated
- [x] Only in-scope files changed; no commit made
- [x] `plans/README.md` row updated

## STOP conditions

- `SurvivalTab` renders metrics in a way that a nullable query result breaks beyond the described
  changes: report the component shape instead of inventing new UI.
- `users.getActiveSubscribers` (or the equivalent) is itself capped, which would bias `payingByTier`:
  STOP and page it in the job.
- The action's accumulated cohort is large enough to threaten action memory (tens of thousands): STOP
  and switch to an incremental accumulation doc.

## Maintenance notes

- Snapshot numbers are as-of the last cron; the panel says so. If real-time cohort numbers ever
  matter, run the rebuild on demand from the admin UI.
- Reviewer: confirm the snapshot job uses the same `summarizeCohort(rows, now)` semantics as before (eligible
  denominators measured against the job's `now`).
