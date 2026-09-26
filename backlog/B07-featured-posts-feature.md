# B07 — Featured-posts feature — no write path, quota table unwired

> **Status:** ✅ DONE (2026-08-29, uncommitted) · **Priority:** P1 · **Effort:** M · **Category:** Feature / Billing
> **Depends on:** — · **Blocks:** "1 / 3 / Custom featured posts" tier promise (docs/PLATFORM.md §1)

## Summary

Featured posts are half-built. The consumer side is done — the feed boosts featured posts and the UI
renders a "Featured" badge — but nothing ever sets `isFeatured: true`. Every writer passes `false`,
`featuredAt` is only ever written `undefined`, and the `featuredPostUsage` quota table exists (with a
`by_user_month` index) yet is referenced only by the deletion cascade and tests. So a tier-gated
feature has a live reader and a completely absent writer + quota enforcement.

## Evidence

- `convex/schema.ts:100-101` — `posts.isFeatured: v.boolean()` and
  `featuredAt: v.optional(v.number())`.
- `convex/posts.ts:272` — `submitPost` passes `isFeatured: false`.
- `convex/jobs/syncPostsApify.ts:50` — Apify sync passes `isFeatured: false`.
- `convex/jobs/processQueue.ts:81,96` — queue-promotion inserts also pass `isFeatured: false`.
- `convex/jobs/syncPosts.ts:103-117` — `upsertPost` stores the `isFeatured` arg (via `...postArgs`,
  `:104`) but **hardcodes `featuredAt: undefined`** at line 113 — so `featuredAt` can never be
  non-null through the only insert path.
- `convex/lib/feedRank.ts:54` — the feed rank formula boosts featured posts:
  `post.isFeatured ? FEATURED_BASE + post.publishedAt : tierRank * TIER_WEIGHT + post.publishedAt`.
- `app/src/components/PostCard.tsx:98-104` — renders the `t('feed.featured')` `Badge` (`:103`) when
  `post.isFeatured` (`:98`).
- `convex/schema.ts:156-160` — `featuredPostUsage: { userId, month, usedCount }` with
  `.index('by_user_month', ['userId', 'month'])` (`:160`).
- `convex/privacy/deletion.ts:36` — the table's **only** non-test reference: the deletion cascade
  lists `featuredPostUsage` among owned tables. No mutation ever inserts/increments a row.
- `convex/schema.ts:209-214` — `planLimits` has `interactionsPerPost` + `postsPerWeek` only (`:212-213`);
  there is **no** featured-quota field to gate against.

## Root cause

The reader (feed boost + badge), the storage columns, and the usage table were shipped ahead of the
writer. There is no user action to feature a post, no mutation that flips `isFeatured`/`featuredAt`,
no per-tier featured cap in `planLimits`, and no code that reads/increments `featuredPostUsage`.

## What we need to do

1. **Define the feature.** A user action ("Feature this post") in **My Posts**, gated by a
   per-month, per-tier quota (tier table §1: 1 / 3 / Custom). Featuring sets `isFeatured: true` +
   `featuredAt: Date.now()` and re-stamps the denormalized feed fields; unfeaturing reverses it.
2. **Add the quota field.** Add `featuredPerMonth: v.number()` to the `planLimits` table
   (`convex/schema.ts:209-214`) and to `seedPlanLimits` / `getPlanLimitsHelper`
   (`convex/lib/planLimits.ts`). Pre-launch, prefer widen + re-seed over a backfill migration.
3. **Add mutations** `featurePost` / `unfeaturePost` (`convex/posts.ts`):
   - Auth + ownership (`canModifyPost`, as `setPostHidden` at `convex/posts.ts:305` does).
   - Compute the current month key (e.g. `YYYY-MM`), read `featuredPostUsage` via
     `by_user_month`, and reject when `usedCount >= limits.featuredPerMonth`.
   - On feature: patch the post `{ isFeatured: true, featuredAt: Date.now(), ...computeFeedFields }`
     (must recompute `feedRank`/`inFeed` via `convex/lib/feedRank.ts` — `isFeatured` changes rank),
     and upsert/increment the usage row atomically in the same mutation.
   - On unfeature: patch `{ isFeatured: false, featuredAt: undefined, ...computeFeedFields }`.
     Decide whether unfeaturing refunds the monthly quota (recommend **no** refund to prevent
     churn — document it).
   - Remove the hardcoded `featuredAt: undefined` at `convex/jobs/syncPosts.ts:113` only if the
     insert path ever needs to carry a featured value; otherwise leave insert-as-not-featured and
     let the mutation be the sole writer.
4. **Add the UI** in My Posts: a feature/unfeature toggle showing remaining monthly quota; disable
   when the cap is hit.
5. **Localize** the new strings (en/pt/es) — see [[B16]].

## Acceptance criteria

- [ ] A user can feature a post up to their tier's monthly cap; the (N+1)th is rejected with a clear
      message.
- [ ] Featuring sets `isFeatured`/`featuredAt`, increments `featuredPostUsage` (`by_user_month`), and
      the post rises in the feed (`feedRank` recomputed) and shows the badge.
- [ ] `planLimits` carries a featured cap and is seeded for every tier.
- [ ] Unfeature reverses `isFeatured`/`featuredAt` and re-ranks; refund behavior is decided + tested.
- [ ] `pnpm verify` is green (typecheck + lint + tests)
- [ ] `docs/PLATFORM.md` updated (see **Docs to update**)

## Risks / edge cases / open questions

- **Month boundary**: define the month key in a fixed timezone (UTC) so quotas reset predictably.
- **Concurrency**: two rapid feature taps could double-increment — do the read-check-increment in one
  mutation transaction (Convex mutations are transactional).
- **Feed rank**: forgetting to recompute `computeFeedFields` on feature/unfeature leaves the stored
  `feedRank` stale (post won't move). This is the most likely bug.
- **`featuredAt` currently written-never-read** ([[B21]]) — this item is the "wire it" resolution;
  coordinate so B21 doesn't delete the column first.
- **Deletion cascade** already clears `featuredPostUsage` (`convex/privacy/deletion.ts:36`) — verify
  it still holds once rows actually exist.

## Docs to update

- `docs/PLATFORM.md` §1 (tier table — featured caps now enforced) + the billing/plan-limits section
  (new `featuredPerMonth` limit + the `featuredPostUsage` quota flow).

## References

- Related: [[B21]] (`featuredAt` written-never-read — resolved by wiring here), [[B20]] (dead
  indexes — `by_user_month` becomes live), [[B27]] (`seedPlanLimits` must seed the new cap),
  [[B06]] (sibling planned-but-unwired Pro feature)
- Prior art / plan: —

## Update — 2026-08-20

Re-verified against current code after commits `8417b51` (onboarding) and `5fe86b8` (toast). **Status unchanged: TODO.** No writer sets `isFeatured: true`; quota table still unwired.

- Every insert path still hardcodes `isFeatured: false`: `posts.ts:272` (submitPost), `jobs/syncPostsApify.ts:50`, `jobs/syncPosts.ts:104` (via arg), `jobs/processQueue.ts:81,96`. `featuredAt` is still only ever `undefined` (`syncPosts.ts:113`).
- `planLimits` still has no `featuredPerMonth` field (`schema.ts:209-214`); `featuredPostUsage` (`schema.ts:156-160`) is still referenced only by the deletion cascade (`deletion.ts:36`) + tests.
- `5fe86b8` added two more **readers** of `post.isFeatured` in `convex/interactions.ts:117,169` (feed-field restamp on reaction/comment) — they only preserve the existing value, they do **not** create a write path. The reader/consumer side (feed boost `feedRank.ts:54`, badge `PostCard.tsx:98-104`) remains complete while the writer remains absent, exactly as filed.
- Evidence lines corrected: `schema.ts` `:99-100`→`:100-101`, `:155-159`→`:156-160`, `:208-213`→`:209-214`; `posts.ts` submitPost `:252`→`:272`; `syncPosts.ts` insert block `:111-117`→`:103-117` (`featuredAt: undefined` still `:113`); `PostCard.tsx` `:98-105`→`:98-104`. Added the `processQueue.ts:81,96` insert paths (also `isFeatured:false`).
