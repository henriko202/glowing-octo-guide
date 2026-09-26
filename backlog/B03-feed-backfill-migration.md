# B03 — Feed backfill migration missing — legacy posts silently dropped

> **Status:** TODO (re-verified 2026-08-20) · **Priority:** P0 · **Effort:** M · **Category:** Data/Feed
> **Depends on:** — · **Blocks:** correctness of `getFeed` once real posts exist that predate the `feedRank`/`inFeed` fields

## Summary

The feed query walks a single index `by_feed_rank` keyed on `['inFeed', 'feedRank']`, matching only rows where `inFeed === true`. Both fields are declared `v.optional` on the schema as a widen→backfill placeholder, and the schema comment explicitly promises a backfill migration stamps old posts **before** `getFeed` switches to that index. That migration was never written — `convex/migrations/` contains only `seedPlanLimits.ts`. Any post whose `inFeed` is `undefined` (i.e. written before the field existed) can never match `q.eq('inFeed', true)` and is silently excluded from the feed. Pre-launch there is no prod data so this is currently harmless, but it is a latent data-loss bug that must be fixed before real posts exist.

## Evidence

- `convex/feed.ts:113-121` — `getFeed` reads `ctx.db.query('posts').withIndex('by_feed_rank', q => q.eq('inFeed', true)).order('desc').paginate(...)` (`withIndex` at `:119`). Only `inFeed === true` rows are ever considered.
- `convex/schema.ts:125-132` — the feed fields with the promise: `:127-128` comment "Optional during the widen→backfill rollout — old posts are stamped by the backfill migration before getFeed switches to the by_feed_rank index"; `:129` `feedRank: v.optional(v.number())`; `:130-132` comment + `inFeed: v.optional(v.boolean())`.
- `convex/schema.ts:144` — `.index('by_feed_rank', ['inFeed', 'feedRank'])`. Convex index equality on `inFeed === true` cannot match rows where the field is absent/undefined.
- `convex/migrations/` — contains **only** `seedPlanLimits.ts` (a plan-limits seed, not a post backfill). No feed backfill exists.
- The write paths that *do* stamp the fields today (all call the single source of truth `computeFeedFields`, `convex/lib/feedRank.ts:52-55`):
  - `convex/jobs/syncPosts.ts:103-117` (insert branch, `computeFeedFields` at `:103`, `isFeatured` at `:104`) and `:43-56` (update branch) — every new/updated post gets `feedRank`/`inFeed`.
  - `convex/posts.ts:305` (`setPostHidden`, restamp `computeFeedFields` at `:323`) and `:342` (`deletePost`, restamp at `:357`).
  - `convex/lib/feedRank.ts:95` (`restampUserPostsTierRankPage`, the tier-change restamp; `computeFeedFields` at `:110`).
- `convex/lib/feedRank.ts:52-55` — `computeFeedFields`: `feedRank = post.isFeatured ? FEATURED_BASE + publishedAt : tierRank * TIER_WEIGHT + publishedAt` (`:54`); `inFeed = post.hidden === false && post.interactionLimitReached !== true && post.deletedAt === undefined` (`:55`; `tierRank = authorTierRank ?? 1`).

## Root cause

A widen→migrate→narrow rollout was started (fields added as optional, `getFeed` already migrated to the new index) but the middle step — the backfill that stamps every pre-existing post — was skipped. Every current *writer* stamps the fields, so only rows that predate the field (or any row inserted by a path that bypasses `computeFeedFields`, of which there are currently none) are affected. With no prod data the gap is invisible today.

## What we need to do

1. **Author the backfill** using `@convex-dev/migrations` (the repo's chosen migration tool; see the `convex-migration-helper` / `convex-migrate` skills). Add a new file, e.g. `convex/migrations/backfillFeedFields.ts`, that iterates all `posts` and, for any row missing `inFeed`/`feedRank` (or unconditionally re-stamping — cheaper to reason about), computes fields via the existing `computeFeedFields` from `convex/lib/feedRank.ts` and patches them. Reuse `computeFeedFields` — do **not** re-derive the formula, so the backfill can never drift from the writers.
2. **Feed each post's real inputs** into `computeFeedFields`: `isFeatured`, `publishedAt`, `authorTierRank` (fall back to `tierToRank(author.tier ?? 'starter')` when the row lacks `authorTierRank`, matching `jobs/syncPosts.ts:100`), `hidden`, `interactionLimitReached`, `deletedAt`. Note the migration runs in a mutation context, so it can `ctx.db.get(authorId)` for the tier if needed.
3. **Batch it.** `@convex-dev/migrations` handles batching + resumability; use its page-based runner rather than a hand-rolled `.collect()` (the `posts` table is the highest-write table). If hand-rolling instead, follow the self-rescheduling pattern in `convex/privacy/retention.ts:123-132` / `convex/lib/feedRank.ts:126-133`.
4. **Run order:** the migration must run before `getFeed` is trusted against real data. Since `getFeed` already uses the index, in practice: run the migration immediately after any bulk insert that could bypass the stamping writers.
5. **Pre-launch shortcut (document, don't skip):** per project context there is **no production data** and dev is disposable, so in practice this backfill may be a no-op and dev can simply be wiped. The migration must still be *written and committed* so it exists before the first real posts land, and so any future bulk-import path is covered. Mark the "no rows to backfill today" reality with a `ponytail:` note in the migration rather than deleting the migration.

## Acceptance criteria

- [ ] A committed backfill migration stamps `feedRank` + `inFeed` on every `posts` row via `computeFeedFields`.
- [ ] After running it, **no** `posts` row has `inFeed === undefined` or `feedRank === undefined`.
- [ ] The backfill reuses `convex/lib/feedRank.ts:computeFeedFields` (no duplicated ranking formula).
- [ ] The migration is batched/resumable (no unbounded `.collect()` on `posts`).
- [ ] `pnpm verify` is green (typecheck + lint + tests).
- [ ] `docs/PLATFORM.md` updated (see **Docs to update**).

## Risks / edge cases / open questions

- Featured posts: `computeFeedFields` already handles `isFeatured`; ensure `featuredAt` isn't needed for ranking (it isn't — only `isFeatured` + `publishedAt` feed the formula).
- Soft-deleted / hidden / interaction-capped posts must resolve to `inFeed === false` (they do, via the same helper) — the backfill must not accidentally resurface them.
- Author lookup: a post whose author was hard-deleted still needs a defined `authorTierRank`; fall back to starter rank (`1`) rather than throwing.
- Convex `.optional` index-equality semantics: confirm no row is left with `inFeed: false` when it should be `true` and vice-versa by spot-checking a hidden and a visible post after backfill.
- Once every row is guaranteed stamped, a *future* item could narrow the schema (`v.optional` → required); out of scope here, note it in the migration.

## Docs to update

- `docs/PLATFORM.md` §11 (Feed & Engagement) — note the `by_feed_rank` index requires stamped `inFeed`/`feedRank` and reference the backfill.
- `docs/PLATFORM.md` §5 (Data Model) — if the fields are later narrowed to required, update the `posts` table reference; for now note the backfill invariant.
- `docs/PLATFORM.md` §19 (Known Discrepancies / Roadmap) — remove this from open gaps once the migration exists.

## References

- Related: [[B04]] (both are widen→backfill items; this one is the feed side)
- Prior art / plan: `docs/feed-cursor-pagination-plan.md` (referenced by `convex/lib/feedRank.ts:2`); `convex/migrations/seedPlanLimits.ts` (existing migration shape)
- Memory: `prelaunch-no-prod-data` (dev disposable, prefer widen+dual-write over backfill); `convex-testing-convention`

## Update — 2026-08-20

Re-verified against current code after commits `8417b51` (onboarding) and `5fe86b8` (toast). **Status unchanged: TODO.** Nothing wired a backfill.

- `convex/migrations/` still contains **only** `seedPlanLimits.ts` — no feed backfill.
- `feed.ts` `getFeed` still walks `by_feed_rank` with `q.eq('inFeed', true)` (now `:113-121`, `withIndex` at `:119`).
- `feedRank`/`inFeed` are still `v.optional` (`schema.ts:129`, `:132`); the "stamped by the backfill migration" comment is still present (`:127-128`); index `by_feed_rank` still `['inFeed', 'feedRank']` (`:144`).
- `computeFeedFields` (`feedRank.ts:52-55`) and all stamping writers are unchanged in behavior; only line numbers shifted (schema.ts grew ~1 line from the onboarding commit's `firstPostPromptedAt`, ~13-line block shift in the `posts` writers).
- Evidence lines corrected above: `feed.ts` `:117-121`→`:113-121`; `schema.ts` `:124-131`→`:125-132`, `:128`→`:129`, `:143`→`:144`; `posts.ts` `setPostHidden` `:299-307`→`:305`/`:323`, `deletePost` `:333-341`→`:342`/`:357`; `feedRank.ts` computeFeedFields range `:52-56/:52-57`→`:52-55`, restamp `:110-123`→`:95`/`:110`.
