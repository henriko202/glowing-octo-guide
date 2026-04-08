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

In the **insert branch only** (not the update branch), before `ctx.db.insert`:

1. Fetch the author: `const author = await ctx.db.get(args.authorId)` (already fetched for tierToRank — reuse it)
2. Look up limits: `await getPlanLimitsHelper(ctx, args.authorId, author?.tier ?? 'starter')`
3. Count recent posts via `by_author` index + `.order('desc').take(20)`, filter JS-side for `publishedAt >= now - 7 days`
4. If `recentCount >= limits.postsPerWeek`, throw `"Weekly post limit reached. Your plan allows N post(s) per week."`

`getPlanLimitsHelper` is already imported in this file via `tierToRank` — add it to the same import.

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
  userId?: Id<'users'>,
  userName?: string,       // user.name if userId is set
  interactionsPerPost: number,
  postsPerWeek: number
}>
```

Fetches all rows with `.collect()` (bounded — at most 4 default rows + N contact overrides), then for rows with `userId`, does a `ctx.db.get(userId)` to resolve the name.

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
- Target user must exist and have `tier === 'contact'` — throws `"User is not on the contact tier"` otherwise

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

Updates the default `interactionsPerPost` and/or `postsPerWeek` for a tier's default row (the row with no `userId`). Useful for business decisions without a code deploy:

```typescript
args: {
  sessionToken: v.string(),
  tier: v.union(v.literal('starter'), v.literal('growth'), v.literal('pro'), v.literal('contact')),
  interactionsPerPost: v.number(),
  postsPerWeek: v.number()
}
```

Validation: both values >= 1. Queries `by_tier` index for the tier's default row (no `userId`), patches it. Throws if no default row found (seed hasn't been run).

---

## Files Changed

| File | Change |
|------|--------|
| `convex/jobs/syncPosts.ts` | Add atomic weekly limit check in `upsertPost` insert branch |
| `convex/admin.ts` | Add `listPlanLimits`, `setContactUserLimit`, `removeContactUserLimit`, `updateTierDefault` |

---

## Verification

**Fix 1 — Race condition:**
- Submit two posts simultaneously as a starter user (limit=1) → only one should succeed, second throws "Weekly post limit reached"
- Submit one post successfully, wait, submit another in the same 7-day window → second throws

**Fix 2 — Admin API:**
- `listPlanLimits` with admin token → returns 4 default rows; after adding a contact override, returns 5
- `setContactUserLimit` on a non-contact user → throws "User is not on the contact tier"
- `setContactUserLimit` with valid contact user → row inserted; calling again updates it
- `removeContactUserLimit` on user with override → row deleted; user falls back to contact default
- `removeContactUserLimit` on user without override → no-op, no error
- `updateTierDefault` for growth with new limits → `listPlanLimits` reflects updated values
- All admin endpoints with non-admin session token → throws "Forbidden: admin access required"
