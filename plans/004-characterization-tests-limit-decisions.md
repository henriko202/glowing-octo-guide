# Plan 004: Extract & unit-test the two untested limit decisions

> **Executor instructions**: Follow step by step; run each verification. Honor STOP conditions.
> Update this plan's row in `plans/README.md` when done.
> **Repo rule (`CLAUDE.md`): NEVER commit or push.**
>
> **Drift check (run first)**: `git diff --stat 90a90ad..HEAD -- convex/interactions.ts convex/jobs/syncPosts.ts`
> If either changed since `90a90ad`, compare the excerpts below to the live code before editing.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none (pairs well after 001 so `pnpm verify` exists)
- **Category**: tests
- **Planned at**: commit `90a90ad`, 2026-06-18

## Why this matters

Two pieces of **quota-enforcement logic** decide real product behavior but live inline inside mutation
handlers with **no tests**: (1) when a post's interaction limit flips (removing it from the feed), and
(2) whether a new post is at the weekly limit (reject/queue vs insert). This repo's testing convention
(see `convex/lib/feedRank.ts` + `convex/lib/feedRank.test.ts`, and `convex/jobs/processQueue.ts`
`computeCapacity` + `processQueue.test.ts`) is to **extract pure decision functions and unit-test
them** — it does NOT mock `ctx`. This plan follows that convention: extract the two decisions into pure
helpers, wire the handlers to them, and unit-test the boundaries.

> Note on Stripe: `convex/stripe.ts`'s pure logic (`toSubscriptionStatus`, `getTierFromPriceId`) is
> already extracted and tested in `convex/stripe.test.ts`. Its mutations are thin orchestration with no
> further pure decision to extract, so they are intentionally out of scope here (the repo does not
> unit-test orchestration with a mocked `ctx`).

## Current state

- `convex/interactions.ts` — the limit-flip decision is inline in BOTH `incrementCommentCount` and
  `incrementLikeCount` (lines ~28–43 and ~57–73):
  ```ts
  const total = newCommentCount + post.likeCount          // (or post.commentCount + newLikeCount)
  const author = await ctx.db.get(post.authorId)
  if (author) {
    const limits = await getPlanLimitsHelper(ctx, author._id, author.tier ?? 'starter')
    if (total >= limits.interactionsPerPost && !post.interactionLimitReached) {
      const feed = computeFeedFields({ ...post, interactionLimitReached: true })
      await ctx.db.patch(postId, { interactionLimitReached: true, ...feed })
    }
  }
  ```
- `convex/jobs/syncPosts.ts` — the weekly-limit decision is inline in `upsertPost` (lines ~63–96):
  ```ts
  const recentPosts = await ctx.db.query('posts')
    .withIndex('by_author_and_publishedAt', q => q.eq('authorId', args.authorId).gte('publishedAt', sevenDaysAgo))
    .take(limits.postsPerWeek)
  const recentCount = recentPosts.length
  if (recentCount >= limits.postsPerWeek) { /* queue or throw */ }
  ```
- Convention exemplars to MATCH:
    - Pure helper + test: `convex/jobs/processQueue.ts` `computeCapacity(recentCount, postsPerWeek)` and
      `convex/jobs/processQueue.test.ts` (boundary cases, `describe`/`it`/`expect`).
    - `convex/lib/feedRank.ts` `computeFeedFields` (pure, no DB) + `convex/lib/feedRank.test.ts`.
- Test runner: `convex/vitest.config.ts` aliases `convex/server` to a mock; pure-logic tests import the
  function directly and assert — no `ctx`.

## Commands you will need

| Purpose                   | Command                     | Expected                  |
|---------------------------|-----------------------------|---------------------------|
| Convex tests              | `pnpm --filter convex test` | all pass, incl. new tests |
| Lint                      | `pnpm lint`                 | exit 0                    |
| Typecheck (if 001 landed) | `pnpm typecheck`            | exit 0                    |

## Scope

**In scope**:

- `convex/lib/interactionLimit.ts` (create) + `convex/lib/interactionLimit.test.ts` (create)
- `convex/lib/postLimit.ts` (create) + `convex/lib/postLimit.test.ts` (create)
- `convex/interactions.ts` (wire both increments to the new helper — behavior-preserving)
- `convex/jobs/syncPosts.ts` (wire `upsertPost`'s gate to the new helper — behavior-preserving)
- `docs/PLATFORM.md` §11/§10 — add a one-line note that these decisions are pure helpers (keep canonical doc in sync).

**Out of scope** (do NOT touch): `convex/stripe.ts` and its tests; `computeFeedFields`; any LinkedIn or
feed-query code; the `interactionLimitReached` schema field. Do NOT change observable behavior — the
helpers must return exactly what the inline expressions compute today.

## Git workflow

- Branch: `advisor/004-limit-decision-tests`. Do NOT commit/push.

## Steps

### Step 1: Extract the interaction-limit decision (pure)

Create `convex/lib/interactionLimit.ts`:

```ts
// Pure decision: should a post's interaction limit flip to "reached" on this interaction?
// `reached` is true once total interactions hit the plan cap; the flip only matters if the
// post is not ALREADY marked, so the caller passes `alreadyReached`.
export function hasReachedInteractionLimit(likeCount: number, commentCount: number, interactionsPerPost: number): boolean {
  return likeCount + commentCount >= interactionsPerPost
}
export function shouldFlipInteractionLimit(
  likeCount: number,
  commentCount: number,
  interactionsPerPost: number,
  alreadyReached: boolean
): boolean {
  return hasReachedInteractionLimit(likeCount, commentCount, interactionsPerPost) && !alreadyReached
}
```

Wire `convex/interactions.ts`: replace the inline `total >= limits.interactionsPerPost &&
!post.interactionLimitReached` in BOTH mutations with
`shouldFlipInteractionLimit(newLikeCount /*or post.likeCount*/, post.commentCount /*or newCommentCount*/, limits.interactionsPerPost, post.interactionLimitReached === true)`.
Keep the exact counts each mutation already uses (comment path: `post.likeCount` + `newCommentCount`;
like path: `newLikeCount` + `post.commentCount`).

**Verify**: `pnpm --filter convex test` still passes; `pnpm lint` exits 0.

### Step 2: Test the interaction-limit decision

Create `convex/lib/interactionLimit.test.ts` modeled on `convex/jobs/processQueue.test.ts`. Cover:

- under limit → `false` (e.g. `shouldFlipInteractionLimit(10, 10, 25, false)` → false)
- exactly at limit, not already reached → `true` (`shouldFlipInteractionLimit(12, 13, 25, false)` → true)
- at limit but already reached → `false` (`(20, 5, 25, true)` → false)
- over limit, not already reached → `true`
  **Verify**: `pnpm --filter convex test` passes with the new file.

### Step 3: Extract the weekly-limit decision (pure)

Create `convex/lib/postLimit.ts`:

```ts
// Pure decision mirroring the insert gate in jobs/syncPosts.upsertPost.
export function isWeeklyLimitReached(recentCount: number, postsPerWeek: number): boolean {
  return recentCount >= postsPerWeek
}
```

Wire `convex/jobs/syncPosts.ts`: replace `if (recentCount >= limits.postsPerWeek)` with
`if (isWeeklyLimitReached(recentCount, limits.postsPerWeek))`. No other behavior change.

**Verify**: `pnpm --filter convex test` passes; `pnpm lint` exits 0.

### Step 4: Test the weekly-limit decision

Create `convex/lib/postLimit.test.ts`: under limit → false; exactly at limit → true; over → true;
limit of 1 with 0/1 recent (starter tier edge) → false/true.
**Verify**: `pnpm --filter convex test` passes.

### Step 5: Keep the canonical doc in sync

In `docs/PLATFORM.md`, add a one-line note in §10 (posts pipeline) and §11 (interactions) that the
weekly-limit and interaction-limit decisions are the pure helpers `lib/postLimit.ts` /
`lib/interactionLimit.ts` (mirrors how §11 already references `lib/feedRank.ts`).

## Test plan

- New: `convex/lib/interactionLimit.test.ts` (4+ cases), `convex/lib/postLimit.test.ts` (4+ cases).
- Pattern to follow: `convex/jobs/processQueue.test.ts`.
- Verification: `pnpm --filter convex test` → all pass including the new tests.

## Done criteria (ALL must hold)

- [ ] `pnpm --filter convex test` passes, with the two new test files present and run
- [ ] `pnpm lint` exits 0
- [ ] `pnpm typecheck` exits 0 (if plan 001 has landed; otherwise `pnpm --filter app exec tsc --noEmit` for unaffected
  proof)
- [ ] `interactions.ts` and `syncPosts.ts` use the new helpers; no behavior change (existing tests still pass)
- [ ] Only the in-scope files changed (`git status`)
- [ ] No commit was made
- [ ] `plans/README.md` row for 004 updated

## STOP conditions

- Wiring the helper changes any existing test's outcome → you've altered behavior; revert and report.
- The inline code in `interactions.ts`/`syncPosts.ts` no longer matches the excerpts (drift) → report.

## Maintenance notes

- These helpers are now the single place the limit thresholds are decided — future limit-rule changes
  (e.g. counting reactions separately) edit the helper + its test, not the handlers.
- Reviewer: confirm the comment-path vs like-path count arguments weren't swapped during extraction.
- Deliberately deferred: handler-level integration tests (the repo doesn't mock `ctx`); revisit only if
  the project adopts `convex-test`.
