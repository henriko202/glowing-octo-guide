# Security Fixes Design: Atomic Post Limit & Admin planLimits CRUD

**Date:** 2026-04-08
**Context:** Follow-up to the plan-limits feature implementation. Addresses two medium-severity issues found during security review.

---

## Problem 1 — TOCTOU Race Condition on Posts-Per-Week

### What's broken

`submitPost` (an action) checks the weekly post count in one Convex transaction, then inserts the post in a separate transaction. Because actions are not transactions themselves, two concurrent submissions from the same user can both pass the count check (both see `count = 0`) and both insert — letting a starter user submit 2 posts in a week when the limit is 1.

### Fix

Add the authoritative weekly count check inside `upsertPost` (an `internalMutation`), which runs as a single atomic Convex transaction. The existing check in `submitPost` remains as a fast UX guard (fails early before the LinkedIn API call), but the mutation becomes the security boundary.

**File to modify:** `convex/jobs/syncPosts.ts` → `upsertPost`

#### Apify sync bypass

`upsertPost` is called by two paths:
1. **User submission** (`submitPost` action) — must enforce the weekly limit
2. **Apify/cron background sync** — must NOT enforce the limit. These posts already exist on LinkedIn; we're importing existing activity, not creating new platform posts. Blocking the sync would prevent new LinkedIn posts from ever appearing in the feed for users at their limit.

Add a `bypassWeeklyLimit: v.optional(v.boolean())` argument to `upsertPost`. Callers that should bypass the check (Apify sync path) pass `true`. The `submitPost` action omits the argument (defaults to `false` / undefined = enforce).

#### Count logic (in the insert branch only, when `bypassWeeklyLimit` is not `true`)

1. Fetch the author: `const author = await ctx.db.get(args.authorId)` (already fetched for `tierToRank` — reuse it, move the fetch before the limit check)
2. Add `getPlanLimitsHelper` to the existing import from `'../lib/planLimits'` (it is a named export but not yet imported — add it alongside `tierToRank`)
3. Look up limits: `await getPlanLimitsHelper(ctx, args.authorId, author?.tier ?? 'starter')`
4. Count recent posts: query `by_author` index + `.order('desc').take(limits.postsPerWeek + 5)` (ceiling is plan limit + 5, not a hardcoded 20, so it remains correct if limits are later raised via `updateTierDefault`)
5. Filter JS-side: `posts.filter(p => p.publishedAt >= Date.now() - 7 * 24 * 60 * 60 * 1000).length`
6. If `recentCount >= limits.postsPerWeek`, throw `"Weekly post limit reached. Your plan allows N post(s) per week."`

The **update branch** (existing post) never checks limits — it only updates counts and visibility, regardless of `bypassWeeklyLimit`.

---

## Problem 2 — No Admin API for planLimits

### What's broken

There is no code path for admins to manage `planLimits` rows. Setting custom limits for contact-tier users requires direct Convex dashboard access — no audit trail, no access control beyond raw DB access.

### Fix

Add 4 functions to `convex/admin.ts`, all gated behind the existing `assertAdmin(user)` pattern:

### `listPlanLimits` (public `query`)

Returns all rows from `planLimits`, enriched with `userName` for contact override rows:

```typescript
args: { sessionToken: v.string() }
returns: Array<{
  _id: Id<'planLimits'>,
  tier: 'starter' | 'growth' | 'pro' | 'contact',
  userId?: Id<'users'>,    // undefined = tier default row
  userName?: string,        // user.name if userId is set, undefined otherwise
  interactionsPerPost: number,
  postsPerWeek: number
}>
```

Fetches all rows with `.collect()` (bounded — at most 4 default rows + N contact overrides), then for rows with `userId` set, resolves the user name via `ctx.db.get(row.userId)`.

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

Queries `by_user` index, deletes if found, no-op if not found. Does NOT delete tier-default rows (rows without `userId`).

### `updateTierDefault` (public `mutation`)

Updates the default `interactionsPerPost` and `postsPerWeek` for a tier's default row (the row with no `userId`). Useful for business decisions without a code deploy:

```typescript
args: {
  sessionToken: v.string(),
  tier: v.union(v.literal('starter'), v.literal('growth'), v.literal('pro'), v.literal('contact')),
  interactionsPerPost: v.number(),
  postsPerWeek: v.number()
}
```

Validation: both values >= 1.

Query logic: use `by_tier` index to get all rows for the tier, then **filter in JS for `row.userId === undefined`** to isolate the default row (avoids touching per-user overrides that share the same tier). If no default row is found, throw `"No default row found for tier — run seedPlanLimits first"`.

---

## Files Changed

| File | Change |
|------|--------|
| `convex/jobs/syncPosts.ts` | Add `bypassWeeklyLimit` arg + atomic weekly limit check in insert branch |
| `convex/admin.ts` | Add `listPlanLimits`, `setContactUserLimit`, `removeContactUserLimit`, `updateTierDefault` |

---

## Verification

**Fix 1 — Race condition:**
- Submit two posts simultaneously as a starter user (limit=1) → only one should succeed, second throws "Weekly post limit reached"
- Submit one post successfully, submit another in the same 7-day window → second throws
- Apify sync inserts a new post for a starter user already at their limit → succeeds (bypassWeeklyLimit=true)

**Fix 2 — Admin API:**
- `listPlanLimits` with admin token → returns 4 default rows; after adding a contact override, returns 5
- `listPlanLimits` contact override row → has `userName` populated
- `setContactUserLimit` on a non-existent user → throws "User not found"
- `setContactUserLimit` on a non-contact user → throws "User is not on the contact tier"
- `setContactUserLimit` with valid contact user → row inserted; calling again patches it
- `removeContactUserLimit` on user with override → row deleted; user falls back to contact default
- `removeContactUserLimit` on user without override → no-op, no error
- `updateTierDefault` for growth with new limits → `listPlanLimits` reflects updated values; contact per-user overrides are unchanged
- `updateTierDefault` for contact tier when overrides exist → only the default row (no userId) is updated
- All admin endpoints with non-admin session token → throws "Forbidden: admin access required"
