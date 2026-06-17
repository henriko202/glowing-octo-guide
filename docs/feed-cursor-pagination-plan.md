# Feed Cursor-Pagination — Design Plan (SHIPPED)

> **Status (2026-06-17): fully implemented.** `feedRank` + `inFeed` are on the `posts` schema, the
> `by_feed_rank` index exists, every post writer stamps the fields via `computeFeedFields`
> ([`lib/feedRank.ts`](../convex/lib/feedRank.ts)), **and the cutover is done** —
> [`getFeed`](../convex/feed.ts) paginates over `by_feed_rank` and the client
> ([`FeedPage.tsx`](../app/src/pages/FeedPage.tsx)) uses `usePaginatedQuery` with a Load-more
> control. The old in-memory `by_published` scan is gone. Sections below are kept as the design
> record; this doc no longer describes pending work except the optional §5.5 narrow.
>
> **Decided (2026-06-17):**
>
> - Tier-priority ordering in the main feed is an **essential guarantee**, so the pure-recency
    > shortcut in §7 is **rejected** — §3–§5 (denormalized `feedRank`) is the path.
> - **No backfill migration.** There's no production data yet and the dev deployment is disposable,
    > so we skipped `@convex-dev/migrations`. New/edited posts get the fields via dual-write; the
    > cutover just needs the table (re)populated, which pre-launch traffic handles. If we ever launch
    > with existing prod posts before cutting over, add a one-off backfill at that point (see §5).

## 1. The problem

`getFeed` reads up to `FEED_SCAN_LIMIT = 1000` posts via `by_published [hidden, publishedAt]`,
then filters and sorts **in memory** to return ≤ `pageLimit` (default 20). Two costs grow with
the table:

- **Read amplification (bytes):** every feed load reads up to 1000 full post documents
  (including the `content` body) to return ~20.
- **Reactivity amplification:** it's one reactive subscription over all 1000 posts, so _any_
  like/comment/sync that patches _any_ of those posts re-runs the whole feed for **every**
  connected viewer.

## 2. Why we can't just call `.paginate()` today

Cursor pagination walks an index in its key order, so the index key order **must equal** the
desired sort order. The feed's effective order is:

1. **Featured** first, by `publishedAt` desc.
2. Then **regular**, by `authorTierRank` desc, then `publishedAt` desc.

That's two partitions with **different** secondary sort keys (featured→`featuredAt`/`publishedAt`,
regular→`authorTierRank` then `publishedAt`). No single existing index expresses it, so the sort
can only happen after a full in-memory read.

## 3. Proposed design — one denormalized sort key + a "in feed" flag

### 3a. New denormalized fields on `posts`

| Field      | Type      | Meaning                                                                            |
|------------|-----------|------------------------------------------------------------------------------------|
| `feedRank` | `number`  | Single monotonic sort key encoding featured→tier→recency (see formula).            |
| `inFeed`   | `boolean` | `hidden === false && interactionLimitReached !== true && deletedAt === undefined`. |

**`feedRank` formula** (keeps Float64 integer-exact; max value ≈ `1.002e15` < `2^53 ≈ 9.007e15`):

```
const TIER_WEIGHT   = 1e13   // > max publishedAt (~2e12), so tier dominates recency
const FEATURED_BASE = 1e15   // featured always rank above any regular post

feedRank = isFeatured
  ? FEATURED_BASE + publishedAt          // featured: ordered by recency
  : tierRank * TIER_WEIGHT + publishedAt // regular: tier desc, then recency
```

(Featured ignores tier — matches today's `featured.sort((a,b) => b.publishedAt - a.publishedAt)`.)

### 3b. New index

```ts
.index('by_feed_rank', ['inFeed', 'feedRank'])
```

Query becomes:

```ts
ctx.db
  .query('posts')
  .withIndex('by_feed_rank', q => q.eq('inFeed', true))
  .order('desc')
  .paginate(paginationOpts)
```

This moves **hidden / interactionLimitReached / soft-delete** filtering and the **entire sort**
into the index. The walk reads only as far as the page needs.

### 3c. Filters that must stay in JS (per page, not per 1000)

These are **viewer-dependent** or **author-state-dependent** and can't live in a global index:

- post-level visibility (`visibilityIndustries` / `visibilityCountries` vs viewer)
- viewer industry filter (growth/pro), viewer country filter (pro)
- author eligibility (`isAuthorFeedEligible` — trialing / pending deletion)

Apply them to **each page** (~20 posts) after `.paginate()`, fetching only that page's authors
(≤ pageSize `db.get`s — reuse the single-fetch pattern already in `getFeed`). Pages may come back
short when they contain filtered posts; the client's `usePaginatedQuery` just loads more.

> **Deliberately NOT denormalized:** author eligibility. Trialing/pending-deletion authors are a
> minority, and denormalizing their state onto every post would add write fan-out on every
> subscription/deletion change. Keeping it a per-page JS filter is the cheaper trade.

## 4. Writers that must maintain the new fields

`feedRank` / `inFeed` are recomputed wherever an input changes. **All wired (✓)** via the single
pure `computeFeedFields(post) → { feedRank, inFeed }` helper:

| Site                                                       | Recomputes because…                                 | ✓ |
|------------------------------------------------------------|-----------------------------------------------------|---|
| `jobs/syncPosts.upsertPost` (insert **and** update branch) | sets `hidden`, counts, `isFeatured`, `publishedAt`  | ✓ |
| `jobs/processQueue` (promote insert)                       | new post enters the feed                            | ✓ |
| `posts.setPostHidden`                                      | flips `hidden`                                      | ✓ |
| `posts.deletePost`                                         | sets `deletedAt` + `hidden` → `inFeed=false`        | ✓ |
| `interactions.incrementLike/CommentCount`                  | may flip `interactionLimitReached` → `inFeed=false` | ✓ |
| `stripe.syncUserSubscription` / `cancelUserSubscription`   | re-stamps `authorTierRank` → `feedRank` must follow | ✓ |
| `admin.setUserTier`                                        | admin tier override → `authorTierRank` / `feedRank` | ✓ |
| (admin feature/unfeature, if/when added)                   | would flip `isFeatured` → `feedRank` partition      | – |

The three tier-change paths (Stripe sync, Stripe cancel, admin override) share one
`restampUserPostsTierRank` helper, so a post's stored tier rank can never lag the user's real tier.

## 5. Rollout (widen → dual-write → cutover; backfill skipped)

The fields are optional, so widening was non-breaking. Current status:

1. **Widen — done.** `feedRank?`, `inFeed?` + the `by_feed_rank` index are in `schema.ts`.
2. **Dual-write — done.** `computeFeedFields` ships in every writer from §4; new/edited posts carry
   the fields.
3. **Backfill — skipped (no prod data).** The dev deployment is disposable, so we did **not** add
   `@convex-dev/migrations`. _If_ we ever launch with existing prod posts before the cutover, add a
   one-off backfill then: `migrations.define({ table: 'posts', migrateOne: p => computeFeedFields(p) })`
   (idempotent — skip posts already carrying both fields), dry-run, run, verify 0 remaining. See
   [`convex-migration-helper`](../.claude/skills/convex-migration-helper/SKILL.md).
4. **Cut over — done.** `getFeed` paginates over `by_feed_rank` (`eq(inFeed, true)`, `feedRank` desc),
   fetching only each page's authors and applying the viewer-/author filters per page; the client
   (`FeedPage.tsx`) uses `usePaginatedQuery` + Load more. The old `by_published` scan is removed.
   (Caveat: pre-cutover dev posts lacking `inFeed` are excluded from the feed until rewritten — fine
   on disposable dev data; a backfill would be required if launching with legacy prod posts.)
5. **Narrow (optional):** make the fields required and remove the old in-memory scan.

## 6. Trade-offs to weigh before building

- **Reactivity win (the real payoff):** each `.paginate()` page is its own subscription, so a post
  change invalidates only its page, not every viewer's whole feed. This is arguably a bigger win
  than the bytes saved.
- **Write amplification:** every post state change recomputes the fields; tier changes already fan
  out to all an author's posts (precedent: `authorTierRank`), so this adds little there.
- **Variable page sizes** from per-page JS filtering — standard `usePaginatedQuery` UX, acceptable.
- **Complexity:** `feedRank` arithmetic + `inFeed` upkeep across ~7 write sites + a backfill. Real
  work — justifying the "don't build until there's signal" stance.

## 7. Cheaper alternative — REJECTED

A pure-recency feed (tier influencing only featured/visibility, not regular-post sort) could
paginate **directly on the existing `by_published [hidden, publishedAt]`** with essentially no
migration. **This is ruled out:** tier-priority ordering in the main feed (contact → pro → growth →
starter, above equal-recency lower tiers) is a **confirmed essential product guarantee** (decided
2026-06-17). The denormalized-`feedRank` design in §3–§5 is therefore the committed approach when
the build trigger fires.
