# Plan 021: Add pagination return validators and rename indexes to match the guidelines

> **Executor instructions**: Follow step by step, run each verification. Honor STOP conditions.
> Update this plan's row in `plans/README.md` when done.
> **Repo rule (`CLAUDE.md`/`AGENTS.md`): NEVER commit or push.** Keep `docs/PLATFORM.md` in sync (Step 4).
>
> **Drift check (run first)**:
> `git status --porcelain -- convex/feed.ts convex/interactions.ts convex/schema.ts docs/PLATFORM.md`
> Plans 015-018 also touch `feed.ts`/`interactions.ts`; if they ran first, preserve their changes.
> Compare the excerpts below. On a mismatch, STOP.

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: MED for the index renames (deploy-time rebuilds; every `withIndex` call site must be
  updated atomically). LOW for validators (additive until they catch a drift).
- **Depends on**: 015-018 recommended (same files, so land this last among query plans).
- **Category**: tech-debt / guideline compliance
- **Planned at**: working tree at commit `ced69ac`, 2026-09-10

## Why this matters

Two Convex-guideline gaps from the audit:

1. **No `returns` validators anywhere in the repo** (grep `returns:` in `convex/**` returns zero
   matches). The guidelines name `paginationResultValidator(itemValidator)` for paginated query
   returns; without it, a projection change that drops a field or returns the wrong id type is only
   caught by the client at runtime.
2. **Index names omit fields.** The guidelines require every index field in the name:
    - `schema.ts:193` `by_feed_rank` on `['inFeed', 'feedRank']` (hides the `inFeed` equality)
    - `schema.ts:381` `by_feedback` on `['feedbackId', 'createdAt']` (hides the range field)
    - `schema.ts:238` `by_user_month` on `['userId', 'month']` (no `_and_`)

## Current state

```ts
// convex/feed.ts:156-182 (public paginated query)
export const getFeed = query({
  args: { paginationOpts: paginationOptsValidator, sessionToken: v.optional(v.string()) },
  handler: async (ctx, { paginationOpts, sessionToken }) => { /* ... */ return fetchFeedPage(...) }
})

// convex/interactions.ts:443-461 (public paginated query)
export const listMyInteractions = query({
  args: { sessionToken: v.string(), since: v.number(), paginationOpts: paginationOptsValidator },
  handler: async (ctx, { sessionToken, since, paginationOpts }) => { /* ... */ return { ...result, page } }
})
```

Index call sites to update:

- `by_feed_rank`: `convex/feed.ts`, `convex/jobs/syncPosts.ts` (`getFeedPostsForRefresh`),
  `convex/lib/feedRank.ts` if it queries it (grep all).
- `by_feedback`: `convex/feedback/feedback.ts`, `convex/privacy/export.ts`.
- `by_user_month`: `convex/posts.ts` (`getFeaturedUsage`, `featurePost`).

`paginationResultValidator` is exported from `convex/server` (guidelines, pagination section).

## Commands you will need

| Purpose          | Command                        | Expected |
|------------------|--------------------------------|----------|
| Convex tests     | `pnpm --filter convex test`    | all pass |
| Typecheck / lint | `pnpm typecheck` / `pnpm lint` | exit 0   |
| Full gate        | `pnpm verify`                  | exit 0   |

## Scope

**In scope**: `convex/feed.ts`, `convex/interactions.ts`, `convex/schema.ts`, every file whose
`withIndex` names change (grep-driven), `docs/PLATFORM.md`. **Out of scope**: adding validators to every function in the
repo (start with the two paginated public
queries; the rest is follow-up), behavior changes, and unrelated indexes.

## Git workflow

- Branch: `advisor/021-validators-and-index-names`. Do NOT commit or push.

## Steps

### Step 1: Define the `getFeed` item validator and return validator

In `convex/feed.ts`, read the full `fetchFeedPage` return mapping (lines ~190-294) and write a
`v.object({ ... })` covering every field the page items actually return, exactly (any extra field
fails validation at runtime; any missing field fails typecheck). Use the generated field types, for
example `v.id('posts')`, `v.optional(...)` for optionals, and reuse `reactionValidator` if a reaction
field is returned. Then:

```ts
export const getFeed = query({
  args: { paginationOpts: paginationOptsValidator, sessionToken: v.optional(v.string()) },
  returns: paginationResultValidator(feedItemValidator),
  handler: /* unchanged */
})
```

`EMPTY_PAGE` must satisfy the validator too (empty `page` is valid).

**Verify**: `pnpm --filter convex exec tsc --noEmit -p convex/tsconfig.json` exits 0, then
`pnpm --filter convex test` passes. Convex validates returns at execution; the tests exercise the
handler through the pure `fetchFeedPage` path, so also run `pnpm lint`.

### Step 2: Add the `listMyInteractions` return validator

Same approach for `HistoryRow` (`convex/interactions.ts`): define `historyRowValidator` from
`toHistoryRow`'s return shape and add `returns: paginationResultValidator(historyRowValidator)`.

**Verify**: typecheck + convex tests pass.

### Step 3: Rename the three indexes

- `by_feed_rank` → `by_in_feed_and_feed_rank`
- `by_feedback` → `by_feedback_id_and_created_at`
- `by_user_month` → `by_user_id_and_month`

Update the schema declarations and every `withIndex('...')` call site in one pass
(`grep -rn "by_feed_rank\|by_feedback\|by_user_month" convex` must return no matches when done).
Do not reorder the fields; the names change only. Every renamed index rebuilds on deploy; pre-launch
that cost is negligible, and each `withIndex` caller must land in the same change.

**Verify**: `pnpm --filter convex exec tsc --noEmit -p convex/tsconfig.json` exits 0;
`grep -rn "by_feed_rank\|by_feedback\b\|by_user_month" convex --include=*.ts` returns nothing;
`pnpm --filter convex test` passes.

### Step 4: Sync `docs/PLATFORM.md`

Update every index name mention (`§5` table reference, `§9` featured usage, `§10`/`§11` feed) and note
the return validators on the two queries in §6 or the relevant sections.

## Test plan

- The validators themselves are exercised by any test that runs the wrapper; the repo's pure-test
  harness does not call query wrappers, so the primary verification is `tsc` plus the runtime
  validator being satisfied by `fetchFeedPage`/`toHistoryRow` outputs. If a dev deployment is
  available, load the feed and History once; if not, say so.
- Index renames are verified by the grep and typecheck.
- Verification: `pnpm verify` all green.

## Done criteria (ALL must hold)

- [ ] `pnpm verify` exits 0
- [ ] `grep -n "returns:" convex/feed.ts convex/interactions.ts` shows both validators
- [ ] `paginationResultValidator` is used in both
- [ ] The three old index names appear nowhere in `convex/`
- [ ] `docs/PLATFORM.md` mentions updated
- [ ] Only in-scope files changed; no commit made
- [ ] `plans/README.md` row updated

## STOP conditions

- The return mapping is not statically expressible (for example it conditionally omits fields in ways
  a single validator cannot represent): STOP and report the exact union, rather than widening to
  `v.any()`.
- An index rename would require changing a query's field order: STOP; that is a behavior change.
- A `withIndex` caller is in a file outside the scope list: include it only if the rename is purely
  mechanical; otherwise STOP and report.

## Maintenance notes

- New paginated queries should follow this pattern; `paginationResultValidator(itemValidator)` is the
  named guideline.
- Index names must include every field; snake_case is the convention already in use for multi-field
  names (`by_author_and_publishedAt` uses camelCase field names, which is acceptable since the name
  mirrors the fields).
- Reviewer: confirm no query silently switched indexes during the rename.
