# Security Fixes Design: Atomic Post Limit & Admin planLimits CRUD

**Date:** 2026-04-08
**Context:** Follow-up to the plan-limits feature implementation. Addresses two medium-severity issues found during
security review.

---

## Problem 1 — TOCTOU Race Condition on Posts-Per-Week

### What's broken

`submitPost` (an action) checks the weekly post count in one Convex transaction, then inserts the post in a separate
transaction. Because actions are not transactions themselves, two concurrent submissions from the same user can both
pass the count check (both see `count = 0`) and both insert — letting a starter user submit 2 posts in a week when the
limit is 1.

The weekly limit applies to **both** Apify sync (background LinkedIn discovery) and manual URL submissions. The platform
does not create LinkedIn posts — it only accepts links to posts the user has already published. The limit governs how
many of those posts appear in the platform feed per week, regardless of how they were ingested.

### Behavior when limit is reached

| Path                                 | Behavior when limit reached                                     |
| ------------------------------------ | --------------------------------------------------------------- |
| Manual URL submission (`submitPost`) | Throw error immediately — user sees "Weekly post limit reached" |
| Apify sync                           | Route to `postQueue` table instead of inserting into `posts`    |

### New table: `postQueue`

Holds posts that could not be inserted because the author was at their weekly limit. Same fields as `posts` (minus
feed-specific fields that are set at insert time):

```typescript
postQueue: defineTable({
  linkedinPostUrn: v.string(),
  authorId: v.id('users'),
  content: v.string(),
  publishedAt: v.number(),
  likeCount: v.number(),
  commentCount: v.number(),
  mediaUrls: v.array(v.string()),
  hidden: v.boolean(),
  sourceUrl: v.optional(v.string()),
  queuedAt: v.number() // timestamp when this post entered the queue
})
  .index('by_author', ['authorId'])
  .index('by_urn', ['linkedinPostUrn']) // for upsert deduplication
```

Fields NOT stored in the queue (set at promote-time using the author's current state):

- `isFeatured` — always `false` on promote
- `featuredAt` — omitted
- `visibilityIndustries` / `visibilityCountries` — set to `[]` on promote
- `authorTierRank` — derived from author's current tier at promote-time
- `interactionLimitReached` — always `false` on promote

### Fix in `convex/jobs/syncPosts.ts` → `upsertPost`

Add `queueOnLimitReached: v.optional(v.boolean())` to `upsertPost` args.

In the **insert branch only**, before `ctx.db.insert`:

1. Move `const author = await ctx.db.get(args.authorId)` to the top of the insert branch (it already exists for
   `tierToRank` — just move it earlier)
2. Add `getPlanLimitsHelper` to the existing import from `'../lib/planLimits'` (named export, not yet imported — add
   alongside `tierToRank`)
3. Count recent posts: query `by_author` index + `.order('desc').take(limits.postsPerWeek)`, filter JS-side for
   `publishedAt >= Date.now() - 7 * 24 * 60 * 60 * 1000`. The `.take(limits.postsPerWeek)` ceiling is exact — the N most
   recent posts (sorted desc) is exactly what we need to determine if the limit is reached.
4. If `recentCount >= limits.postsPerWeek`:
   - If `args.queueOnLimitReached === true`: insert into `postQueue` (check `by_urn` first to avoid duplicates), return
     `null` (or a sentinel) instead of a post `_id`
   - Otherwise: throw `"Weekly post limit reached. Your plan allows N post(s) per week."`

The **update branch** (existing post) never checks limits — it only updates counts and visibility.

### Fix in `convex/jobs/syncPostsApify.ts`

The Apify sync calls `upsertPost` — pass `queueOnLimitReached: true` so overflow posts route to the queue instead of
throwing.

### New cron job: `processPostQueue`

Runs **daily**. For each user that has queued posts:

1. Count their posts published in the last 7 days (same logic as above, `.take(limits.postsPerWeek)`)
2. Fetch their current plan limits via `getPlanLimitsHelper`
3. Compute `capacity = limits.postsPerWeek - recentCount`
4. If `capacity > 0`: promote up to `capacity` queued posts (ordered by `publishedAt` ascending — oldest first) from
   `postQueue` into `posts`, then delete them from the queue
5. Each promoted post is inserted with the author's **current** `authorTierRank`, `isFeatured: false`,
   `visibilityIndustries: []`, `visibilityCountries: []`, `interactionLimitReached: false`

The cron does NOT attempt re-promotion if a post's `linkedinPostUrn` already exists in `posts` (upsert check via
`by_urn`) — it simply deletes the queue entry.

**Convex transaction limit:** If a user has many queued posts, process in batches using `ctx.scheduler.runAfter(0, ...)`
to avoid hitting transaction limits.

**File:** `convex/crons.ts` — add a daily cron calling a new `internal.jobs.processQueue.processPostQueue`
internalMutation.

### New file: `convex/jobs/processQueue.ts`

Contains the `processPostQueue` internalMutation with the promotion logic above. Kept separate from `syncPosts.ts` to
keep file responsibilities clear.

---

## Problem 2 — No Admin API for planLimits

### What's broken

There is no code path for admins to manage `planLimits` rows. Setting custom limits for contact-tier users requires
direct Convex dashboard access — no audit trail, no access control beyond raw DB access.

### Fix

Add 4 functions to `convex/admin.ts`, all gated behind the existing `assertAdmin(user)` pattern:

### `listPlanLimits` (public `query`)

Returns all rows from `planLimits`, enriched with `userName` for contact override rows:

```typescript
args: {
  sessionToken: v.string()
}
returns: Array<{
  _id: Id<'planLimits'>
  tier: 'starter' | 'growth' | 'pro' | 'contact'
  userId?: Id<'users'> // undefined = tier default row
  userName?: string // user.name if userId is set, undefined otherwise
  interactionsPerPost: number
  postsPerWeek: number
}>
```

Fetches all rows with `.collect()` (bounded — at most 4 default rows + N contact overrides), then for rows with `userId`
set, resolves the user name via `ctx.db.get(row.userId)`.

### `setContactUserLimit` (public `mutation`)

Upserts a per-user limit override for a contact-tier user:

```typescript
args: {
  sessionToken: v.string(),
  userId: v.id('users'),
  interactionsPerPost: v.number(),
  postsPerWeek: v.number()
}
```

Validation before upsert:

- `interactionsPerPost >= 1` and `postsPerWeek >= 1`
- Target user must exist — throws `"User not found"` if `ctx.db.get(userId)` returns null
- Target user must have `tier === 'contact'` — throws `"User is not on the contact tier"` otherwise

Upsert logic: query `by_user` index for existing row → patch if found, insert if not.

### `removeContactUserLimit` (public `mutation`)

Deletes a contact-tier per-user override, reverting that user to the contact tier default:

```typescript
args: {
  sessionToken: v.string(),
  userId: v.id('users')
}
```

Queries `by_user` index, deletes if found, no-op if not found. Does NOT delete tier-default rows (rows without
`userId`).

### `updateTierDefault` (public `mutation`)

Updates the default `interactionsPerPost` and `postsPerWeek` for a tier's default row (the row with no `userId`). Useful
for business decisions without a code deploy:

```typescript
args: {
  sessionToken: v.string(),
  tier: v.union(v.literal('starter'), v.literal('growth'), v.literal('pro'), v.literal('contact')),
  interactionsPerPost: v.number(),
  postsPerWeek: v.number()
}
```

Validation: both values >= 1.

Query logic: use `by_tier` index to get all rows for the tier, then **filter in JS for `row.userId === undefined`** to
isolate the default row (avoids touching per-user overrides that share the same tier in `by_tier`). If no default row is
found, throw `"No default row found for tier — run seedPlanLimits first"`.

---

## Files Changed

| File                            | Change                                                                                     |
| ------------------------------- | ------------------------------------------------------------------------------------------ |
| `convex/schema.ts`              | Add `postQueue` table                                                                      |
| `convex/jobs/syncPosts.ts`      | Add `queueOnLimitReached` arg + atomic weekly limit check in insert branch                 |
| `convex/jobs/syncPostsApify.ts` | Pass `queueOnLimitReached: true` to `upsertPost` calls                                     |
| `convex/jobs/processQueue.ts`   | New file — `processPostQueue` internalMutation                                             |
| `convex/crons.ts`               | Add daily cron calling `processPostQueue`                                                  |
| `convex/admin.ts`               | Add `listPlanLimits`, `setContactUserLimit`, `removeContactUserLimit`, `updateTierDefault` |

---

## Verification

**Fix 1 — Race condition & queue:**

- Submit two posts simultaneously as a starter user (limit=1) → only one succeeds, second throws "Weekly post limit
  reached"
- Submit one post as starter, then Apify sync finds a second new post → second post lands in `postQueue`, not `posts`
- Next day, cron runs, starter user's 7-day window now has capacity → queued post promoted to `posts`, deleted from
  `postQueue`
- Apify sync tries to queue a post whose URN is already in `postQueue` → no duplicate inserted (deduplication via
  `by_urn`)
- Apify sync tries to queue a post whose URN is already in `posts` (from a prior week) → update branch fires, no queue
  insertion

**Fix 2 — Admin API:**

- `listPlanLimits` with admin token → returns 4 default rows; after adding a contact override, returns 5
- `listPlanLimits` contact override row → has `userName` populated
- `setContactUserLimit` on a non-existent user → throws "User not found"
- `setContactUserLimit` on a non-contact user → throws "User is not on the contact tier"
- `setContactUserLimit` with valid contact user → row inserted; calling again patches it
- `removeContactUserLimit` on user with override → row deleted; user falls back to contact default
- `removeContactUserLimit` on user without override → no-op, no error
- `updateTierDefault` for growth with new limits → `listPlanLimits` reflects updated values; contact per-user overrides
  unchanged
- `updateTierDefault` for contact tier when per-user overrides exist → only the default row (`userId === undefined`) is
  patched
- All admin endpoints with non-admin session token → throws "Forbidden: admin access required"
