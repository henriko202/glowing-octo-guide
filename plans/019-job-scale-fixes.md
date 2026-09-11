# Plan 019: Fix the queue spin loop and page the Apify fan-outs

> **Executor instructions**: Follow step by step, run each verification. Honor STOP conditions.
> Update this plan's row in `plans/README.md` when done.
> **Repo rule (`CLAUDE.md`/`AGENTS.md`): NEVER commit or push.** Keep `docs/PLATFORM.md` in sync (Step 5).
>
> **Drift check (run first)**:
>
`git status --porcelain -- convex/jobs/processQueue.ts convex/users.ts convex/jobs/syncPosts.ts convex/jobs/syncPostsApify.ts convex/crons.ts convex/linkedin/parsePostContent.ts docs/PLATFORM.md`
> Compare the excerpts below. On a mismatch, STOP.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED. The fan-out actions run paid Apify tasks; a pagination mistake can skip users or
  double-run a page. Cursor rescheduling mirrors the existing token-refresh pattern.
- **Depends on**: none
- **Category**: perf / correctness
- **Planned at**: working tree at commit `ced69ac`, 2026-09-10

## Why this matters

Four small job-path defects:

1. **Zero-progress reschedule loop.** `processPostQueue` reschedules itself with `runAfter(0)`
   whenever the batch length is 100 (`convex/jobs/processQueue.ts:120-123`), even when zero posts were
   promoted or deleted. If the queue head holds 100+ rows whose authors are still at their weekly cap,
   the cron loops with no delay for up to seven days.
2. **Silent fan-out truncation.** `getActiveSubscribers` and `getUsersWithLinkedin` cap at 500 users
   (`convex/users.ts:36-69`) with only a `console.warn`; the daily sync and the admin "sync all"
   silently skip everyone past the cap.
3. **Same-runtime action hop.** `jobs/syncPosts.syncAllPosts` exists only to re-check a flag and call
   `syncPostsApify.syncAllPostsViaApify`, which checks the same flag again (`convex/jobs/syncPosts.ts:132-143`).
4. **Unvalidated scraper URN.** The Apify path stores `post.shareUrn` raw (`convex/jobs/syncPostsApify.ts:44,53`) while
   the manual path validates against
   `^urn:li:(ugcPost|activity|share):\d+$` in `convex/linkedin/parsePostContent.ts:151` (private
   `URN_RE`).

## Current state

```ts
// convex/jobs/processQueue.ts:26-27,118-123
const batch = await ctx.db.query('postQueue').take(BATCH_SIZE)
if (batch.length === 0) return
// ... per-author promotion loop; `capacity <= 0` rows are skipped ...
// If batch was full, more rows may remain — reschedule immediately
if (batch.length === BATCH_SIZE) {
  await ctx.scheduler.runAfter(0, internal.jobs.processQueue.processPostQueue, {})
}
```

```ts
// convex/users.ts:36-49 (same shape in getUsersWithLinkedin :55-69)
export const getActiveSubscribers = internalQuery({
  args: {},
  handler: async ctx => {
    const SCAN_CAP = 500
    const users = await ctx.db
      .query('users')
      .withIndex('by_subscription_status', q => q.eq('subscriptionStatus', 'active'))
      .take(SCAN_CAP)
    if (users.length === SCAN_CAP) console.warn(`... hit the ${SCAN_CAP}-subscriber cap ...`)
    return users
  }
})
```

`convex/jobs/syncPostsApify.ts:144-147` loops scraped posts into `upsertPost` with
`...apifyPostToUpsertArgs(post, userId, hidden, visibility)`. `convex/linkedin/parsePostContent.ts:151`
defines the private `URN_RE`; `extractPostUrn` uses it for the manual path.

Cursor precedent: `convex/linkedin/tokenRefresh.ts:86-93` reschedules with a cursor until the sweep
completes.

## Commands you will need

| Purpose          | Command                        | Expected |
|------------------|--------------------------------|----------|
| Convex tests     | `pnpm --filter convex test`    | all pass |
| Typecheck / lint | `pnpm typecheck` / `pnpm lint` | exit 0   |
| Full gate        | `pnpm verify`                  | exit 0   |

## Scope

**In scope**: `convex/jobs/processQueue.ts`, `convex/users.ts` (the two internal queries),
`convex/jobs/syncPostsApify.ts`, `convex/jobs/scrapeProfileApify.ts`,
`convex/jobs/syncPosts.ts`, `convex/crons.ts`, `convex/linkedin/parsePostContent.ts` (export a
validator function only), matching tests, `docs/PLATFORM.md`. **Out of scope**: admin "sync now" mutations that call the
fan-outs (they keep working with an
optional cursor), `lib/concurrency.ts`, the Apify actor input, and the per-user fan-out concurrency (5) which stays
as-is.

## Git workflow

- Branch: `advisor/019-job-scale-fixes`. Do NOT commit or push.

## Steps

### Step 1: Track progress in `processPostQueue`

Count promoted and deleted rows in the handler (initialize `let progressed = 0`; increment on
`ctx.db.insert('posts', ...)` and on every `ctx.db.delete` of a queue row). Change the tail to:

```ts
// Reschedule only when this batch made progress; otherwise stop and let the daily cron retry.
// Without this, a saturated queue head whose authors are all at their weekly cap spins forever.
if (batch.length === BATCH_SIZE && progressed > 0) {
  await ctx.scheduler.runAfter(0, internal.jobs.processQueue.processPostQueue, {})
}
```

**Verify**: extend `convex/jobs/processQueue.test.ts` with a pure decision helper if you extract one
(`shouldRescheduleQueue(batchFull, progressed)`), or assert the new logic via the existing test
harness. `pnpm --filter convex test` passes.

### Step 2: Page the two fan-out queries

Convert `getActiveSubscribers` and `getUsersWithLinkedin` to paginated reads:

- Add `paginationOpts: paginationOptsValidator` (import from `convex/server`) to their args.
- Return `.paginate(args.paginationOpts)`:

```ts
return await ctx.db
  .query('users')
  .withIndex('by_subscription_status', q => q.eq('subscriptionStatus', 'active'))
  .paginate(paginationOpts)
```

For `getUsersWithLinkedin`, paginate the full scan then filter `linkedinPublicIdentifier` in JS; a
page may return fewer usable users than `numItems`, which is fine because the cursor still advances.
Remove the 500-cap warnings; keep a comment that the cursor bounds each read.

**Verify**: `pnpm --filter convex exec tsc --noEmit -p convex/tsconfig.json` exits 0.

### Step 3: Consume the pages in the fan-out actions

In `syncAllPostsViaApify` (`convex/jobs/syncPostsApify.ts:161-190`) and
`scrapeAllProfilesViaApify` (`convex/jobs/scrapeProfileApify.ts:90-118`):

- Add `args: { cursor: v.optional(v.string()) }` (or `paginationOpts` built from the cursor).
- Fetch one page (`numItems: 100`), run the existing `settledInBatches` fan-out for that page only,
  aggregate the failed count, then:

```ts
if (!pageResult.isDone) {
  await actionCtx.scheduler.runAfter(0, internal.jobs.syncPostsApify.syncAllPostsViaApify, {
    cursor: pageResult.continueCursor
  })
  return // status is written by the final page
}
```

Write `updateSyncStatus`/`updateProfileScrapeStatus` only on the final page (or accumulate across
pages via the args; simplest is final page only, with a comment). Reset `cursor` to undefined when the
sweep completes.

**Verify**: `pnpm --filter convex test` passes; `grep -n "take(SCAN_CAP)" convex/users.ts` returns
nothing.

### Step 4: Delete the redundant action hop

- Change `convex/crons.ts:12` to call `internal.jobs.syncPostsApify.syncAllPostsViaApify` with `{}`.
- Delete `syncAllPosts` from `convex/jobs/syncPosts.ts` (lines 131-144) and drop its now-unused imports
  (`isApifyPostSyncEnabled`, `internal` if unused).
- Keep the per-user `runAction` hops in the fan-outs, with a comment: per-user action isolation is
  intentional (independent retries and logs); only the same-runtime router hop was redundant.

**Verify**: `grep -rn "syncAllPosts" convex --include=*.ts` shows only the Apify function and the
cron; `pnpm --filter convex test` passes.

### Step 5: Validate scraper URNs before storing

- Export the validator from `convex/linkedin/parsePostContent.ts`:

```ts
export function isValidPostUrn(urn: string): boolean {
  return URN_RE.test(urn)
}
```

- In `syncUserPostsViaApify`'s loop (`convex/jobs/syncPostsApify.ts:143-147`), before calling
  `apifyPostToUpsertArgs`, skip invalid URNs:

```ts
if (!isValidPostUrn(post.shareUrn)) {
  console.warn(`[Apify] dropping post with invalid URN for user ${userId}`)
  continue
}
```

Update the import from `../linkedin/parsePostContent.js` (note the `.js` suffix style used in that
file's imports).

**Verify**: add a unit test for `isValidPostUrn` in `convex/linkedin/parsePostContent.test.ts`
(valid `ugcPost`/`activity`/`share`, invalid host-in-urn, empty, `urn:li:foo:1`).
`pnpm --filter convex test` passes.

### Step 6: Sync `docs/PLATFORM.md`

- §13 cron/jobs: fan-outs are cursor-paginated, one page per invocation with self-reschedule; the
  queue drains only while progressing.
- §10/§13: the Apify path validates the scraper URN with the same shape as the manual path.
- §2 table if it names the deleted router.

## Test plan

- `convex/jobs/processQueue.test.ts`: no-reschedule-when-no-progress decision.
- `convex/linkedin/parsePostContent.test.ts`: `isValidPostUrn` cases.
- Existing Apify job tests must keep passing (`convex/jobs/syncPostsApify.test.ts`,
  `scrapeProfileApify.test.ts`).
- Verification: `pnpm verify` all green.

## Done criteria (ALL must hold)

- [ ] `pnpm verify` exits 0
- [ ] `processPostQueue` reschedules only when `progressed > 0`
- [ ] Both fan-out queries paginate; no `SCAN_CAP` remains
- [ ] Both fan-out actions accept a cursor and self-reschedule until done
- [ ] `syncAllPosts` router deleted; cron calls the Apify action directly
- [ ] Invalid scraper URNs are dropped before `upsertPost`
- [ ] `docs/PLATFORM.md` updated
- [ ] Only in-scope files changed; no commit made
- [ ] `plans/README.md` row updated

## STOP conditions

- The admin "sync all" mutations pass arguments that break with an optional cursor: report the shape.
- A page can return zero filtered users while `isDone` is false in a way that loops (verify cursor
  advances; paginate guarantees it): if not, STOP rather than adding a manual offset.
- The old cap warnings are asserted in tests: update the tests, do not keep dead caps to satisfy them.

## Maintenance notes

- Fan-out status is written only on the final page; an interrupted sweep leaves the previous status
  visible. That is acceptable (the next cron restarts from cursor undefined) and should be noted in
  the code comment.
- Reviewer: confirm the deleted router's kill-switch still runs inside the Apify action before any
  paid work.
