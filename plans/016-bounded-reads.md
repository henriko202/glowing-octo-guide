# Plan 016: Bound the history, feedback, and consent reads

> **Executor instructions**: Follow step by step, run each verification. Honor STOP conditions.
> Update this plan's row in `plans/README.md` when done.
> **Repo rule (`CLAUDE.md`/`AGENTS.md`): NEVER commit or push.** Keep `docs/PLATFORM.md` in sync (Step 4).
>
> **Drift check (run first)**:
>
`git status --porcelain -- convex/interactions.ts convex/feedback/feedback.ts convex/privacy/consent.ts app/src/components/FeedbackTab.tsx docs/PLATFORM.md`
> Plans 017 and 018 also edit `convex/interactions.ts`; if they ran first, preserve their changes.
> Compare the excerpts below to the live files. On a mismatch, STOP.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW. Clamps only lower maxima; the feedback truncation flag is additive.
- **Depends on**: none; run before 017 and 018 (shared file, ascending order keeps diffs clean).
- **Category**: perf
- **Planned at**: working tree at commit `ced69ac`, 2026-09-10

## Why this matters

Three reads are either client-controlled or unbounded:

1. `listMyInteractions` passes a client-supplied `paginationOpts` straight to `.paginate()` with no
   clamp, then does two point reads per row (`convex/interactions.ts:443-461`). A caller can request
   thousands of rows in one query. `getFeed` clamps the same validator to 100 (`convex/feed.ts:199`).
2. `listFeedback` takes 500 feedback rows and then performs one `.take(100)` indexed read per row in
   a single query (`convex/feedback/feedback.ts:83-102`): worst case about 50k document reads, past
   the runtime transaction limit, so the admin Feedback tab errors instead of loading.
3. `getConsents` collects the append-only `consentRecords` table with no bound (`convex/privacy/consent.ts:59-63`). The
   current consent is the latest row per purpose, so only a
   handful of rows are needed.

## Current state

```ts
// convex/interactions.ts:443-461
export const listMyInteractions = query({
  args: { sessionToken: v.string(), since: v.number(), paginationOpts: paginationOptsValidator },
  handler: async (ctx, { sessionToken, since, paginationOpts }) => {
    const user = await requireAuth(ctx, sessionToken)
    const result = await ctx.db
      .query('userInteractions')
      .withIndex('by_user', q => q.eq('userId', user._id).gte('_creationTime', since))
      .order('desc')
      .paginate(paginationOpts)
    const page: HistoryRow[] = await Promise.all(
      result.page.map(async row => {
        const post = await ctx.db.get(row.postId)
        const author = post ? await ctx.db.get(post.authorId) : null
        return toHistoryRow(row, post, author)
      })
    )
    return { ...result, page }
  }
})
```

```ts
// convex/feedback/feedback.ts:88-95
const responseRowsByFeedback = await Promise.all(
  rows.map(f =>
    ctx.db.query('feedbackResponses').withIndex('by_feedback', q => q.eq('feedbackId', f._id)).take(100)
  )
)
```

```ts
// convex/privacy/consent.ts:54-65
export const getConsents = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    const user = await resolveSession(ctx, sessionToken)
    if (!user) return null
    const records = await ctx.db.query('consentRecords').withIndex('by_user', q => q.eq('userId', user._id)).collect()
    return latestConsentByPurpose(records)
  }
})
```

`app/src/components/FeedbackTab.tsx:50` subscribes to `listFeedback`. `latestConsentByPurpose`
(`consent.ts:15-26`) keeps the max `createdAt` per purpose from any row list.

## Commands you will need

| Purpose          | Command                        | Expected |
|------------------|--------------------------------|----------|
| Convex tests     | `pnpm --filter convex test`    | all pass |
| App tests        | `pnpm --filter app test`       | all pass |
| Lint / typecheck | `pnpm lint` / `pnpm typecheck` | exit 0   |
| Full gate        | `pnpm verify`                  | exit 0   |

## Scope

**In scope**: `convex/interactions.ts` (only `listMyInteractions`), `convex/feedback/feedback.ts`
(only `listFeedback` and its return shape), `app/src/components/FeedbackTab.tsx` (render the new
truncation flag), `convex/privacy/consent.ts` (only `getConsents`), matching tests,
`docs/PLATFORM.md`. **Out of scope**: `getRecap` (plan 017), trial counters (plan 018), the feedback mutations, and the
recipient-facing History page behavior.

## Git workflow

- Branch: `advisor/016-bounded-reads`. Do NOT commit or push.

## Steps

### Step 1: Clamp and dedupe `listMyInteractions`

Add `const MAX_HISTORY_PAGE = 100` near the other constants. Before `.paginate()`:

```ts
const numItems = Math.min(Math.max(1, paginationOpts.numItems), MAX_HISTORY_PAGE)
const result = await ctx.db
  .query('userInteractions')
  .withIndex('by_user', q => q.eq('userId', user._id).gte('_creationTime', since))
  .order('desc')
  .paginate({ ...paginationOpts, numItems })
```

Then dedupe the joins with maps (mirror `feedback.listFeedback`'s batched `get`):

```ts
const postIds = [...new Set(result.page.map(r => r.postId))]
const posts = await Promise.all(postIds.map(id => ctx.db.get(id)))
const postMap = new Map(posts.filter((p): p is Doc<'posts'> => p !== null).map(p => [p._id, p]))
const authorIds = [...new Set([...postMap.values()].map(p => p.authorId))]
const authors = await Promise.all(authorIds.map(id => ctx.db.get(id)))
const authorMap = new Map(authors.filter((a): a is Doc<'users'> => a !== null).map(a => [a._id, a]))
const page = result.page.map(row => {
  const post = postMap.get(row.postId) ?? null
  return toHistoryRow(row, post, post ? authorMap.get(post.authorId) ?? null : null)
})
return { ...result, page }
```

Keep the spread of `paginationOpts` so optional fields survive (the clamp overrides only `numItems`).

**Verify**: `pnpm --filter convex test` passes; existing History tests still see the same row shapes.

### Step 2: Bound `listFeedback` and flag truncation

In `convex/feedback/feedback.ts`:

- Change the outer read to `.take(200)` and each reply read to `.take(20)`.
- Track whether any reply read returned 20 rows; if so, include `repliesTruncated: true` in the return
  value (return `{ rows, repliesTruncated }` or add the flag to each row; pick one shape and keep
  `FeedbackTab` compiling).
- Add a brief comment: admin surfaces reply lazily when a row is expanded in a follow-up; this bound
  keeps the query inside transaction limits.

In `app/src/components/FeedbackTab.tsx`, render a small note when `repliesTruncated` is set (reuse the
existing hint/empty-state styling; no new component).

**Verify**: `pnpm --filter app test` passes; `pnpm --filter convex test` passes. If existing tests
assert the old array return shape, update them to the new shape (do not keep both).

### Step 3: Bound `getConsents`

Replace the `.collect()` with an ordered, bounded read:

```ts
const records = await ctx.db
  .query('consentRecords')
  .withIndex('by_user', q => q.eq('userId', user._id))
  .order('desc')
  .take(20)
return latestConsentByPurpose(records)
```

The append-only log is untouched; only the read is bounded. The 20 newest rows always contain the
latest grant per purpose because each prompt writes both purposes together.

**Verify**: `pnpm --filter convex test` passes, including any `getConsents` tests.

### Step 4: Sync `docs/PLATFORM.md`

- §11B/History and §12A Feedback: note the page/reply bounds and the truncation flag.
- §13B consent: note the read returns the latest per purpose from a bounded newest-first window.

## Test plan

- `convex/interactions` tests: a page request above 100 is clamped (use the existing mock-ctx pattern
  in `convex/feed.test.ts` or the history tests if present; if none exist, add a pure test only for
  newly extracted logic, and rely on the grep + typecheck for the wrapper).
- `convex/privacy/consent.test.ts`: `getConsents` still returns the latest per purpose with more than
  20 historical rows (extend its mock if the file can exercise collections; otherwise add
  `latestConsentByPurpose` coverage that proves newest-first truncation is safe).
- Verification: `pnpm verify` all green.

## Done criteria (ALL must hold)

- [ ] `pnpm verify` exits 0
- [ ] `grep -n "MAX_HISTORY_PAGE" convex/interactions.ts` finds the clamp and it is used
- [ ] No `.take(100)` remains inside the `listFeedback` per-row loop; outer read is 200
- [ ] `grep -n "collect()" convex/privacy/consent.ts` returns nothing
- [ ] `FeedbackTab` renders the truncation note
- [ ] Only in-scope files changed; no commit made
- [ ] `plans/README.md` row updated

## STOP conditions

- The Feedback tab or History page asserts an exact number of rows in tests in a way the clamp breaks:
  report instead of loosening the clamp.
- `toHistoryRow` depends on data not present in the batched reads (for example a per-row third join):
  report the real shape instead of forcing the dedupe.
- Reply truncation at 20 is too low for real admin usage (check seed fixtures): say so; do not raise it
  without the maintainer's call.

## Maintenance notes

- If reply counts grow, move replies behind their own paginated query per feedback item instead of
  raising the bound.
- Reviewer: confirm `listMyInteractions` still spreads `paginationOpts` and that the clamp applies
  before `.paginate()`.
