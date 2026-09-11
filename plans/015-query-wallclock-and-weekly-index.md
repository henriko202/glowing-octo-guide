# Plan 015: Remove wall-clock reads from query handlers and fix the weekly-count index

> **Executor instructions**: Follow step by step, run each verification. Honor STOP conditions.
> Update this plan's row in `plans/README.md` when done.
> **Repo rule (`CLAUDE.md`/`AGENTS.md`): NEVER commit or push.** Keep `docs/PLATFORM.md` in sync (Step 5).
>
> **Drift check (run first)**:
>
`git status --porcelain -- convex/search.ts convex/motd/motd.ts convex/privacy/export.ts convex/posts.ts convex/jobs/syncPosts.ts app/src/pages/MyPostsPage.tsx app/src/components/shell/CommandPalette.tsx app/src/components/Motd.tsx app/src/pages/PrivacyPage.tsx docs/PLATFORM.md`
> Compare the excerpts below to the live files. On a mismatch, STOP.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW-MED. Client-supplied `now` changes cache keys and rollover timing; feed semantics stay
  untouched.
- **Depends on**: none (plan 020 removes the survival query's wall clock separately)
- **Category**: perf / correctness
- **Planned at**: working tree at commit `ced69ac`, 2026-09-10

## Why this matters

Convex guidelines forbid `Date.now()` inside query handlers: queries are not re-run because time
advances, so time-derived results go stale, and wall-clock reads defeat query-cache reuse. The audit
found these query sites: `search.ts:46`, `motd/motd.ts:74`, `privacy/export.ts:237,253`,
`posts.ts:141` (`getWeeklyUsage`) and `:174` (via `currentUtcMonthKey()`), plus `admin.ts:404`
(plan 020) and `lib/auth.ts:28` (a deliberate security exception, documented below). Separately, the
weekly post count uses the `by_author` index (creation-time order) while enforcement uses
`by_author_and_publishedAt` (`jobs/syncPosts.ts:69-72`), so the My Posts pill and the submit pre-check
can disagree with the authoritative check; `docs/PLATFORM.md:2357` already claims the correct index.

## Current state

- `convex/search.ts:33-47` reads `Date.now()` inside the handler (`:46`) and passes it to
  `searchPostsAndPeople(ctx, viewer, { text, now: Date.now() })`.
- `convex/motd/motd.ts:64-77` selects with `selectActiveMotd(enabledRows, Date.now())`.
- `convex/privacy/export.ts:226-256`: `getExportStatus` computes `expired` with `Date.now()` (`:237`)
  and `getExportDownloadUrl` checks expiry with `Date.now()` (`:253`).
- `convex/posts.ts:106-152`:

```ts
export const countRecentPosts = internalQuery({
  args: { authorId: v.id('users'), since: v.number() },
  handler: async (ctx, { authorId, since }) => {
    const posts = await ctx.db.query('posts').withIndex('by_author', q => q.eq('authorId', authorId)).order('desc').take(20)
    return countPostsSince(posts, since)
  }
})
export const getWeeklyUsage = query({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, { sessionToken }) => {
    // ... requireAuth ...
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
    const posts = await ctx.db.query('posts').withIndex('by_author', q => q.eq('authorId', user._id)).order('desc').take(20)
    return { postsThisWeek: countPostsSince(posts, sevenDaysAgo), postsPerWeek: limits.postsPerWeek }
  }
})
```

- `convex/posts.ts:66-94` `getMyPosts` takes 500 by `by_author` then `.sort((a,b) => b.publishedAt - a.publishedAt)`.
- `convex/posts.ts:160-184` `getFeaturedUsage` calls `currentUtcMonthKey()` (defaults to `Date.now()`).

Client call sites: `app/src/pages/MyPostsPage.tsx` (weekly/featured usage), `app/src/components/Motd.tsx`
(`getActiveMotd`), `app/src/pages/PrivacyPage.tsx` likely (export status/download; grep to confirm),
`app/src/components/shell/CommandPalette.tsx` (search).

**Documented exceptions to leave alone**:

- `convex/feed.ts:180,292`: product-documented staleness (`docs/PLATFORM.md:2814`). Add a one-line note
  in `docs/PLATFORM.md` that this is a deliberate exception to the guideline.
- `convex/lib/auth.ts:28`: the session expiry check MUST use server time; a client-supplied `now`
  would let a caller extend a session. Keep `Date.now()` and document it as a security exception.
- `convex/interactions.ts:117` `getEngageablePost` is an `internalQuery` called from actions, not a
  subscribing query. Verify with grep; only fix if it is reachable from a client-subscribed query.

## Commands you will need

| Purpose      | Command                     | Expected |
|--------------|-----------------------------|----------|
| Convex tests | `pnpm --filter convex test` | all pass |
| App tests    | `pnpm --filter app test`    | all pass |
| Typecheck    | `pnpm typecheck`            | exit 0   |
| Full gate    | `pnpm verify`               | exit 0   |

## Scope

**In scope**: `convex/search.ts`, `convex/motd/motd.ts`, `convex/privacy/export.ts`, `convex/posts.ts`,
`convex/jobs/syncPosts.ts` (only the insert-branch count if it needs the new arg), the app files that
call the changed queries (`MyPostsPage.tsx`, `Motd.tsx`, `CommandPalette.tsx`, the privacy/DSR page that
reads export status), matching tests, `docs/PLATFORM.md`. **Out of scope**: `convex/feed.ts`, `convex/lib/auth.ts`,
`convex/admin.ts` (plan 020), the MOTD admin
mutations.

## Git workflow

- Branch: `advisor/015-query-wallclock-and-weekly-index`. Do NOT commit or push.

## Steps

### Step 1: Pass `now` into `search`

Add `now: v.number()` to `search` args; pass it to `searchPostsAndPeople` instead of `Date.now()`.
Update the `CommandPalette` call to pass `Date.now()` (it already debounces; no timer needed).
Update `convex/search.test.ts` / `app` tests if they construct args.

**Verify**: `grep -n "Date.now()" convex/search.ts` returns nothing; `pnpm --filter convex test` passes.

### Step 2: Replace MOTD wall-clock selection with a reconcile mutation + cron

In `convex/motd/motd.ts`:

- Change `getActiveMotd` to filter `enabled === true` only (the existing `by_enabled_and_created`
  equality) and select the newest row without a time check: if `selectActiveMotd` is only used here,
  simplify it; otherwise keep it for the reconcile mutation.
- Add an internal mutation `reconcileMotdWindows` that loads enabled MOTDs (bounded, `.take(50)`) and
  flips `enabled` false for rows whose `expiresAt` passed, and (only if your `selectActiveMotd` needs
  it) treats `startAt` in the future by... do NOT enable future rows early; instead `getActiveMotd`
  should exclude rows with `startAt > now`? That would reintroduce a clock read. Correct design:
  the cron enables rows whose `startAt` has arrived and disables rows whose `expiresAt` passed, so the
  query only reads `enabled === true`.
- Register the mutation in `convex/crons.ts` with
  `crons.interval('reconcile MOTD windows', { minutes: 5 }, internal.motd.motd.reconcileMotdWindows, {})`.
- When an admin creates/updates a MOTD (`motd.ts:103,140,163`), set `enabled` consistently: enabled
  only when `startAt` is absent or already past, and `expiresAt` is absent or in the future. Reuse one
  pure helper `resolveMotdEnabled(input, now)` so the admin path and the cron cannot drift, and unit
  test it.

**Verify**: `grep -n "Date.now()" convex/motd/motd.ts` shows matches only in mutations (not in
`getActiveMotd`); `pnpm --filter convex test` passes including new `resolveMotdEnabled` cases.

### Step 3: Pass `now` into the export status/download queries

Add `now: v.number()` to `getExportStatus` and `getExportDownloadUrl` args; replace both `Date.now()`
reads. Update the DSR/Privacy page caller to pass `Date.now()` (grep `getExportStatus` in `app/src`).
Update `convex/privacy/export.test.ts` accordingly.

**Verify**: `grep -n "Date.now()" convex/privacy/export.ts` shows only mutation/action sites (request
creation, export build, purge), never the two queries; tests pass.

### Step 4: Fix the weekly count index and My Posts sort

In `convex/posts.ts`:

- `countRecentPosts`: add `limit: v.number()` to args (max int64 accepted as number). Query becomes
  `by_author_and_publishedAt` with `q.eq('authorId', authorId).gte('publishedAt', since)`, `.take(limit)`.
  Return the length (cap reached is all the caller needs).
- `getWeeklyUsage`: same index + range, `.take(limits.postsPerWeek)`, `postsThisWeek = posts.length`.
- `getMyPosts`: switch to `by_author_and_publishedAt` with `q.eq('authorId', user._id)`,
  `.order('desc').take(500)` and drop the in-memory sort (the index now orders by publishedAt).
- Update the two `countRecentPosts` callers: `posts.submitPost` (`posts.ts:283-292`) now passes
  `limit: planLimits.postsPerWeek`; `jobs/syncPosts.ts:69-73` already uses its own index read, leave it.
- `getFeaturedUsage`: add `now: v.number()` arg and call `currentUtcMonthKey(now)`; update the client
  caller.
- Update the `countRecentPosts`/`countPostsSince` tests in `convex/posts.test.ts` for the new args.

**Verify**: `pnpm --filter convex test` and `pnpm --filter app test` pass;
`grep -n "by_author'" convex/posts.ts` finds no weekly/usage read.

### Step 5: Document the exceptions and update `docs/PLATFORM.md`

- §11 (feed): note the `Date.now()` in `getFeed`/`getCaughtUp` is a deliberate exception to the
  "no wall clock in queries" guideline, with the staleness behavior it buys.
- §6 or §17: note `resolveSession`'s `Date.now()` is required (server-authoritative session expiry).
- §9 `postsPerWeek` (`:2357`): confirm the text now matches the code (all three reads use
  `by_author_and_publishedAt`).

## Test plan

- New/extended pure tests: `search` arg plumbing is covered by existing tests after updates;
  `resolveMotdEnabled` cases (future start, past expiry, open-ended) in `convex/motd/motd.test.ts`;
  `countRecentPosts`/`getWeeklyUsage` behavior with back-dated publishedAt in `convex/posts.test.ts`.
- Client updates covered by existing component tests; update mocks that assert query args.
- Verification: `pnpm verify` all green.

## Done criteria (ALL must hold)

- [ ] `pnpm verify` exits 0
- [ ] `grep -rn "Date.now()" convex/search.ts` empty; no wall clock inside the four fixed query handlers
- [ ] `getFeed`/`getCaughtUp`/`resolveSession` documented as exceptions in PLATFORM.md
- [ ] Weekly reads use `by_author_and_publishedAt`; `grep -n "by_author'" convex/posts.ts` returns none
- [ ] `getMyPosts` no longer sorts in JS
- [ ] Only in-scope files changed; no commit made
- [ ] `plans/README.md` row updated

## STOP conditions

- `getCollaborativeEditing`-style shared helpers make passing `now` unsafe (for example search `now`
  feeds a security check): STOP and report.
- The MOTD reconcile design would enable a row early or leave a disabled MOTD active across the
  cron window in a way the product would notice (test the boundary): report the behavior rather than
  accepting silent drift.
- An app caller cannot supply `Date.now()` cleanly (for example it renders server-side): STOP and
  report the call site.

## Maintenance notes

- Any new time-window query should take `now` as an arg or rely on a reconcile mutation; the
  exceptions list in PLATFORM.md is the only allowed set.
- If the My Posts list ever needs more than 500 posts, paginate; do not remove the bound.
- Reviewer: confirm `getFeaturedUsage`'s month key matches the enforcement path's (`featurePost` uses
  `currentUtcMonthKey()` with server time in a mutation, which is correct).
