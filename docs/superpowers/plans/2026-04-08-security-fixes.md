# Security Fixes: Atomic Post Limit & Admin planLimits CRUD

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:
> executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix a TOCTOU race condition on the posts-per-week limit and add an admin API for managing planLimits rows.

**Architecture:** The race condition is fixed by moving the weekly-limit check inside `upsertPost` (an
`internalMutation` = a single Convex OCC transaction), making it atomic. Apify sync overflow routes to a new `postQueue`
table. A daily cron drains the queue using bounded per-author `by_author` index queries, rescheduling itself via
`ctx.scheduler.runAfter(0, ...)` if the batch is full. Admin CRUD is added to `convex/admin.ts` behind the existing
`assertAdmin` pattern.

**Tech Stack:** Convex (internalMutation, internalQuery, query, mutation, cronJobs), TypeScript, vitest

---

## File Map

| File                               | Change                                                                                                                                        |
|------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------|
| `convex/schema.ts`                 | Add `postQueue` table                                                                                                                         |
| `convex/jobs/syncPosts.ts`         | Export `countInWindow` helper; add `queueOnLimitReached` arg + atomic limit check in insert branch                                            |
| `convex/jobs/syncPostsApify.ts`    | Pass `queueOnLimitReached: true` to each `upsertPost` call                                                                                    |
| `convex/jobs/processQueue.ts`      | **New** — export `computeCapacity` helper + `processPostQueue` internalMutation                                                               |
| `convex/crons.ts`                  | Add daily cron calling `internal.jobs.processQueue.processPostQueue`                                                                          |
| `convex/admin.ts`                  | Export `validateLimitArgs` helper + 4 admin functions: `listPlanLimits`, `setContactUserLimit`, `removeContactUserLimit`, `updateTierDefault` |
| `convex/schema.test.ts`            | Assert `postQueue` table exists                                                                                                               |
| `convex/jobs/syncPosts.test.ts`    | **New** — import and test `countInWindow`                                                                                                     |
| `convex/jobs/processQueue.test.ts` | **New** — import and test `computeCapacity`                                                                                                   |
| `convex/admin.test.ts`             | **New** — import and test `validateLimitArgs`                                                                                                 |

---

## Task 1: Add `postQueue` table to schema

**Files:**

- Modify: `convex/schema.ts`
- Modify: `convex/schema.test.ts`

- [ ] **Step 1: Write the failing test**

In `convex/schema.test.ts`, add one assertion:

```typescript
import {describe, it, expect} from 'vitest'
import schema from './schema'

describe('schema', () => {
  it('defines users table with required fields', () => {
    const tables = schema.tables
    expect(tables).toHaveProperty('users')
    expect(tables).toHaveProperty('posts')
    expect(tables).toHaveProperty('subscriptions')
    expect(tables).toHaveProperty('featuredPostUsage')
    expect(tables).toHaveProperty('planLimits')
    expect(tables).toHaveProperty('postQueue')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd D:/ERP/LinkIntoTheSSI/LinkIntoTheSSI
npx vitest run convex/schema.test.ts
```

Expected: FAIL — `postQueue` not found in tables.

- [ ] **Step 3: Add `postQueue` table to `convex/schema.ts`**

Add this table definition after the `planLimits` table (before the closing `}`):

```typescript
  // Overflow queue for posts that could not be inserted because the author was at
  // their weekly post limit. A daily cron promotes queued posts to the posts table
  // when capacity opens (i.e. old posts fall outside the 7-day window).
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
  queuedAt: v.number()
})
  .index('by_author', ['authorId'])
  .index('by_urn', ['linkedinPostUrn'])
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run convex/schema.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add convex/schema.ts convex/schema.test.ts
git commit -m "feat(schema): add postQueue table for overflow posts"
```

---

## Task 2: Atomic limit check in `upsertPost`

**Files:**

- Modify: `convex/jobs/syncPosts.ts`
- Create: `convex/jobs/syncPosts.test.ts`

**Why this fixes the race:** `upsertPost` is an `internalMutation` — it runs inside one Convex OCC transaction. Two
concurrent inserts cannot both pass; one reads the other's write and fails or queues.

- [ ] **Step 1: Write the failing test (import-first)**

Create `convex/jobs/syncPosts.test.ts`:

```typescript
import {describe, it, expect} from 'vitest'
import {countInWindow} from './syncPosts'

describe('countInWindow', () => {
  const since = 1_000_000

  it('counts posts within the window', () => {
    const posts = [
      {publishedAt: 1_000_001},
      {publishedAt: 1_000_002},
      {publishedAt: 999_999},  // outside window
    ]
    expect(countInWindow(posts, since)).toBe(2)
  })

  it('returns 0 when no posts are in the window', () => {
    const posts = [{publishedAt: 999_998}, {publishedAt: 500_000}]
    expect(countInWindow(posts, since)).toBe(0)
  })

  it('includes the boundary timestamp', () => {
    const posts = [{publishedAt: 1_000_000}]  // exactly at boundary
    expect(countInWindow(posts, since)).toBe(1)
  })

  it('returns 0 for empty array', () => {
    expect(countInWindow([], since)).toBe(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run convex/jobs/syncPosts.test.ts
```

Expected: FAIL — `countInWindow` is not exported from `syncPosts.ts`.

- [ ] **Step 3: Modify `convex/jobs/syncPosts.ts`**

Full replacement of the file (preserves `syncAllPosts` unchanged):

```typescript
// convex/jobs/syncPosts.ts
import {internalAction, internalMutation} from '../_generated/server'
import {v} from 'convex/values'
import {internal} from '../_generated/api'
import {getPlanLimitsHelper, tierToRank} from '../lib/planLimits'

// Exported for testing. Counts posts published at or after `since`.
export function countInWindow(posts: Array<{ publishedAt: number }>, since: number): number {
  return posts.filter(p => p.publishedAt >= since).length
}

// Upsert a single post — inserts new, updates like/comment counts on existing.
// On insert, performs an atomic weekly-limit check within this transaction.
// If the limit is reached and queueOnLimitReached is true, routes to postQueue instead.
export const upsertPost = internalMutation({
  args: {
    linkedinPostUrn: v.string(),
    authorId: v.id('users'),
    content: v.string(),
    publishedAt: v.number(),
    likeCount: v.number(),
    commentCount: v.number(),
    mediaUrls: v.array(v.string()),
    isFeatured: v.boolean(),
    visibilityIndustries: v.array(v.string()),
    visibilityCountries: v.array(v.string()),
    hidden: v.boolean(),
    sourceUrl: v.optional(v.string()),
    queueOnLimitReached: v.optional(v.boolean())
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('posts')
      .withIndex('by_urn', q => q.eq('linkedinPostUrn', args.linkedinPostUrn))
      .first()

    if (existing) {
      // Update branch — never checks limits; only updates engagement counts
      await ctx.db.patch(existing._id, {
        likeCount: args.likeCount,
        commentCount: args.commentCount,
        hidden: args.hidden
      })
      return existing._id
    }

    // Insert branch — atomic weekly-limit check (all reads+write in one transaction)
    const author = await ctx.db.get(args.authorId)
    const tier = (author?.tier ?? 'starter') as 'starter' | 'growth' | 'pro' | 'contact'
    const limits = await getPlanLimitsHelper(ctx, args.authorId, tier)

    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
    const recentPosts = await ctx.db
      .query('posts')
      .withIndex('by_author', q => q.eq('authorId', args.authorId))
      .order('desc')
      .take(limits.postsPerWeek)
    const recentCount = countInWindow(recentPosts, sevenDaysAgo)

    if (recentCount >= limits.postsPerWeek) {
      if (args.queueOnLimitReached) {
        // Apify path: route to postQueue (dedup by URN)
        const existingInQueue = await ctx.db
          .query('postQueue')
          .withIndex('by_urn', q => q.eq('linkedinPostUrn', args.linkedinPostUrn))
          .first()
        if (!existingInQueue) {
          await ctx.db.insert('postQueue', {
            linkedinPostUrn: args.linkedinPostUrn,
            authorId: args.authorId,
            content: args.content,
            publishedAt: args.publishedAt,
            likeCount: args.likeCount,
            commentCount: args.commentCount,
            mediaUrls: args.mediaUrls,
            hidden: args.hidden,
            sourceUrl: args.sourceUrl,
            queuedAt: Date.now()
          })
        }
        return null
      }
      throw new Error(
        `Weekly post limit reached. Your plan allows ${limits.postsPerWeek} post${limits.postsPerWeek === 1 ? '' : 's'} per week.`
      )
    }

    const authorTierRank = tierToRank(author?.tier ?? 'starter')
    // Destructure out queueOnLimitReached so it is never stored on the post
    const {queueOnLimitReached: _ignored, ...postArgs} = args
    return await ctx.db.insert('posts', {
      ...postArgs,
      featuredAt: undefined,
      authorTierRank,
      interactionLimitReached: false
    })
  }
})

// Fan-out action — checks if Apify sync is enabled, then delegates accordingly
export const syncAllPosts = internalAction({
  args: {},
  handler: async ctx => {
    const settings = await ctx.runQuery(internal.admin.getSettingsInternal, {})

    if ((settings as Record<string, unknown> | null)?.apifySyncEnabled) {
      await ctx.runAction(internal.jobs.syncPostsApify.syncAllPostsViaApify, {})
      return
    }
  }
})
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run convex/jobs/syncPosts.test.ts
```

Expected: PASS (4 tests)

- [ ] **Step 5: Run all tests to verify nothing regressed**

```bash
npx vitest run
```

Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add convex/jobs/syncPosts.ts convex/jobs/syncPosts.test.ts
git commit -m "feat(posts): atomic weekly limit check in upsertPost; route overflow to postQueue"
```

---

## Task 3: Update Apify sync to pass `queueOnLimitReached`

**Files:**

- Modify: `convex/jobs/syncPostsApify.ts`

This is a single-arg addition. The existing test suite covers the integration; no new test file is added.

- [ ] **Step 1: Update the `upsertPost` call in `syncUserPostsViaApify`**

In `convex/jobs/syncPostsApify.ts`, locate the line inside the `for (const post of posts)` loop (around line 129):

```typescript
await actionCtx.runMutation(internal.jobs.syncPosts.upsertPost, apifyPostToUpsertArgs(post, userId, hidden))
```

Replace with:

```typescript
await actionCtx.runMutation(internal.jobs.syncPosts.upsertPost, {
  ...apifyPostToUpsertArgs(post, userId, hidden),
  queueOnLimitReached: true
})
```

- [ ] **Step 2: Run all tests**

```bash
npx vitest run
```

Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add convex/jobs/syncPostsApify.ts
git commit -m "feat(apify): pass queueOnLimitReached:true to route overflow to postQueue"
```

---

## Task 4: Create `processPostQueue` internalMutation

**Files:**

- Create: `convex/jobs/processQueue.ts`
- Create: `convex/jobs/processQueue.test.ts`

This mutation runs daily. It takes bounded batches (100 rows at a time), processes each author's queued posts using the
`by_author` index, promotes what fits, and reschedules itself via `ctx.scheduler.runAfter(0, ...)` if more rows remain.

- [ ] **Step 1: Write the failing test (import-first)**

Create `convex/jobs/processQueue.test.ts`:

```typescript
import {describe, it, expect} from 'vitest'
import {computeCapacity} from './processQueue'

describe('computeCapacity', () => {
  it('returns positive capacity when under limit', () => {
    expect(computeCapacity(0, 2)).toBe(2)
    expect(computeCapacity(1, 2)).toBe(1)
  })

  it('returns 0 when at or above limit', () => {
    expect(computeCapacity(2, 2)).toBe(0)
    expect(computeCapacity(3, 2)).toBe(0)
  })

  it('never returns negative', () => {
    expect(computeCapacity(5, 1)).toBe(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run convex/jobs/processQueue.test.ts
```

Expected: FAIL — `computeCapacity` is not exported from `processQueue.ts` (file doesn't exist yet).

- [ ] **Step 3: Create `convex/jobs/processQueue.ts`**

```typescript
// convex/jobs/processQueue.ts
// Daily post-queue drain: promotes queued posts to `posts` when an author gains capacity.
//
// Design:
// - Processes up to BATCH_SIZE queue rows per invocation (bounded transaction reads).
// - Uses by_author index to fetch each author's queued posts (no full-table JS grouping).
// - If the batch is full (suggesting more rows exist), schedules itself via runAfter(0).
import {internalMutation} from '../_generated/server'
import {internal} from '../_generated/api'
import type {Id} from '../_generated/dataModel'
import {getPlanLimitsHelper, tierToRank} from '../lib/planLimits'

const BATCH_SIZE = 100

// Exported for testing.
export function computeCapacity(recentCount: number, postsPerWeek: number): number {
  return Math.max(0, postsPerWeek - recentCount)
}

export const processPostQueue = internalMutation({
  args: {},
  handler: async ctx => {
    // Take a bounded sample of queue rows to discover which authors have queued posts.
    // This is only used for author discovery — per-author queries use the by_author index.
    const batch = await ctx.db.query('postQueue').take(BATCH_SIZE)
    if (batch.length === 0) return

    // Collect distinct authorIds from this batch
    const authorIds = [...new Set(batch.map(p => p.authorId as string))] as Array<Id<'users'>>
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000

    for (const authorId of authorIds) {
      const author = await ctx.db.get(authorId)

      if (!author) {
        // Author deleted — purge their queued posts
        const orphaned = await ctx.db
          .query('postQueue')
          .withIndex('by_author', q => q.eq('authorId', authorId))
          .collect()
        for (const p of orphaned) await ctx.db.delete(p._id)
        continue
      }

      const tier = (author.tier ?? 'starter') as 'starter' | 'growth' | 'pro' | 'contact'
      const limits = await getPlanLimitsHelper(ctx, authorId, tier)

      // Count author's posts in the last 7 days (bounded by limit — exact check)
      const recentPosts = await ctx.db
        .query('posts')
        .withIndex('by_author', q => q.eq('authorId', authorId))
        .order('desc')
        .take(limits.postsPerWeek)
      const recentCount = recentPosts.filter(p => p.publishedAt >= sevenDaysAgo).length

      const capacity = computeCapacity(recentCount, limits.postsPerWeek)
      if (capacity <= 0) continue

      // Fetch author's queued posts via index (bounded — they can have at most a few)
      const authorQueued = await ctx.db
        .query('postQueue')
        .withIndex('by_author', q => q.eq('authorId', authorId))
        .take(limits.postsPerWeek)

      // Promote oldest posts first (publishedAt ascending)
      const toPromote = [...authorQueued]
        .sort((a, b) => a.publishedAt - b.publishedAt)
        .slice(0, capacity)

      for (const queuedPost of toPromote) {
        // Dedup: skip if this URN was already promoted in a prior cron run
        const existingInPosts = await ctx.db
          .query('posts')
          .withIndex('by_urn', q => q.eq('linkedinPostUrn', queuedPost.linkedinPostUrn))
          .first()

        if (existingInPosts) {
          await ctx.db.delete(queuedPost._id)
          continue
        }

        const authorTierRank = tierToRank(author.tier)
        await ctx.db.insert('posts', {
          linkedinPostUrn: queuedPost.linkedinPostUrn,
          authorId: queuedPost.authorId,
          content: queuedPost.content,
          publishedAt: queuedPost.publishedAt,
          likeCount: queuedPost.likeCount,
          commentCount: queuedPost.commentCount,
          mediaUrls: queuedPost.mediaUrls,
          isFeatured: false,
          featuredAt: undefined,
          visibilityIndustries: [],
          visibilityCountries: [],
          hidden: queuedPost.hidden,
          sourceUrl: queuedPost.sourceUrl,
          authorTierRank,
          interactionLimitReached: false
        })
        await ctx.db.delete(queuedPost._id)
      }
    }

    // If batch was full, more rows may remain — reschedule immediately
    if (batch.length === BATCH_SIZE) {
      await ctx.scheduler.runAfter(0, internal.jobs.processQueue.processPostQueue, {})
    }
  }
})
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run convex/jobs/processQueue.test.ts
```

Expected: PASS (3 tests)

- [ ] **Step 5: Run all tests**

```bash
npx vitest run
```

Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add convex/jobs/processQueue.ts convex/jobs/processQueue.test.ts
git commit -m "feat(queue): add processPostQueue internalMutation with batched daily drain"
```

---

## Task 5: Add daily cron for `processPostQueue`

**Files:**

- Modify: `convex/crons.ts`

- [ ] **Step 1: Add the cron**

In `convex/crons.ts`, add after the existing `sync LinkedIn posts` cron:

```typescript
// Promote queued posts to the feed when authors regain capacity (runs at 4:00 UTC,
// one hour after the post sync so new posts are already settled).
crons.daily('process post queue', {hourUTC: 4, minuteUTC: 0}, internal.jobs.processQueue.processPostQueue, {})
```

- [ ] **Step 2: Run all tests**

```bash
npx vitest run
```

Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add convex/crons.ts
git commit -m "feat(crons): add daily cron to drain post queue at 4:00 UTC"
```

---

## Task 6: Admin planLimits CRUD

**Files:**

- Modify: `convex/admin.ts`
- Create: `convex/admin.test.ts`

Adds four admin-only functions, all gated by the existing `assertAdmin(user)` check.

- [ ] **Step 1: Write the failing test (import-first)**

Create `convex/admin.test.ts`:

```typescript
import {describe, it, expect} from 'vitest'
import {validateLimitArgs} from './admin'

describe('validateLimitArgs', () => {
  it('passes with valid positive values', () => {
    expect(() => validateLimitArgs(25, 1)).not.toThrow()
    expect(() => validateLimitArgs(1, 1)).not.toThrow()
    expect(() => validateLimitArgs(200, 5)).not.toThrow()
  })

  it('throws when interactionsPerPost < 1', () => {
    expect(() => validateLimitArgs(0, 1)).toThrow('>= 1')
    expect(() => validateLimitArgs(-1, 1)).toThrow('>= 1')
  })

  it('throws when postsPerWeek < 1', () => {
    expect(() => validateLimitArgs(25, 0)).toThrow('>= 1')
    expect(() => validateLimitArgs(25, -5)).toThrow('>= 1')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run convex/admin.test.ts
```

Expected: FAIL — `validateLimitArgs` is not exported from `admin.ts`.

- [ ] **Step 3: Add functions to `convex/admin.ts`**

Add immediately **before** the `// ─── Internal functions` comment:

```typescript
// Exported for testing.
export function validateLimitArgs(interactionsPerPost: number, postsPerWeek: number): void {
  if (interactionsPerPost < 1 || postsPerWeek < 1) {
    throw new Error('interactionsPerPost and postsPerWeek must each be >= 1')
  }
}

// Returns all planLimits rows, enriched with userName for contact per-user overrides.
export const listPlanLimits = query({
  args: {sessionToken: v.string()},
  handler: async (ctx, {sessionToken}) => {
    const user = await requireAuth(ctx, sessionToken)
    assertAdmin(user)
    const rows = await ctx.db.query('planLimits').collect()
    return await Promise.all(
      rows.map(async row => {
        let userName: string | undefined
        if (row.userId) {
          const u = await ctx.db.get(row.userId)
          userName = u?.name
        }
        return {...row, userName}
      })
    )
  }
})

// Upserts a per-user plan limit override for a contact-tier user.
export const setContactUserLimit = mutation({
  args: {
    sessionToken: v.string(),
    userId: v.id('users'),
    interactionsPerPost: v.number(),
    postsPerWeek: v.number()
  },
  handler: async (ctx, {sessionToken, userId, interactionsPerPost, postsPerWeek}) => {
    const admin = await requireAuth(ctx, sessionToken)
    assertAdmin(admin)
    validateLimitArgs(interactionsPerPost, postsPerWeek)

    const targetUser = await ctx.db.get(userId)
    if (!targetUser) throw new Error('User not found')
    if (targetUser.tier !== 'contact') throw new Error('User is not on the contact tier')

    const existing = await ctx.db
      .query('planLimits')
      .withIndex('by_user', q => q.eq('userId', userId))
      .unique()

    if (existing) {
      await ctx.db.patch(existing._id, {interactionsPerPost, postsPerWeek})
    } else {
      await ctx.db.insert('planLimits', {
        tier: 'contact',
        userId,
        interactionsPerPost,
        postsPerWeek
      })
    }
  }
})

// Deletes a contact-tier per-user limit override (reverts user to tier default).
export const removeContactUserLimit = mutation({
  args: {
    sessionToken: v.string(),
    userId: v.id('users')
  },
  handler: async (ctx, {sessionToken, userId}) => {
    const admin = await requireAuth(ctx, sessionToken)
    assertAdmin(admin)

    const existing = await ctx.db
      .query('planLimits')
      .withIndex('by_user', q => q.eq('userId', userId))
      .unique()

    if (existing) {
      await ctx.db.delete(existing._id)
    }
    // No-op if no override exists
  }
})

// Updates the default limits for a tier's default row (the row without userId).
// Filters JS-side to isolate the default row and avoid touching per-user overrides
// that share the same tier value in the by_tier index.
export const updateTierDefault = mutation({
  args: {
    sessionToken: v.string(),
    tier: v.union(
      v.literal('starter'),
      v.literal('growth'),
      v.literal('pro'),
      v.literal('contact')
    ),
    interactionsPerPost: v.number(),
    postsPerWeek: v.number()
  },
  handler: async (ctx, {sessionToken, tier, interactionsPerPost, postsPerWeek}) => {
    const admin = await requireAuth(ctx, sessionToken)
    assertAdmin(admin)
    validateLimitArgs(interactionsPerPost, postsPerWeek)

    const tierRows = await ctx.db
      .query('planLimits')
      .withIndex('by_tier', q => q.eq('tier', tier))
      .collect()

    const defaultRow = tierRows.find(r => r.userId === undefined)
    if (!defaultRow) {
      throw new Error('No default row found for tier — run seedPlanLimits first')
    }

    await ctx.db.patch(defaultRow._id, {interactionsPerPost, postsPerWeek})
  }
})
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run convex/admin.test.ts
```

Expected: PASS (3 tests)

- [ ] **Step 5: Run all tests**

```bash
npx vitest run
```

Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add convex/admin.ts convex/admin.test.ts
git commit -m "feat(admin): add listPlanLimits, setContactUserLimit, removeContactUserLimit, updateTierDefault"
```

---

## Verification Checklist

After all tasks complete, verify manually via Convex dashboard / test client:

**Fix 1 — Queue & limit:**

- [ ] Submit two posts simultaneously as a starter user (limit=1) → only one succeeds, second throws "Weekly post limit
  reached"
- [ ] Apify sync finds a new post for a starter already at their weekly limit → post lands in `postQueue`, not `posts`
- [ ] Apify sync tries to queue a URN already in `postQueue` → no duplicate (dedup via `by_urn`)
- [ ] Apify sync tries to queue a URN already in `posts` → update branch fires, no queue insertion
- [ ] `processPostQueue` runs when author is at capacity → no promotions, queue unchanged
- [ ] `processPostQueue` runs after author's 7-day window shifts → queued post promoted to `posts`, deleted from
  `postQueue`

**Fix 2 — Admin API:**

- [ ] `listPlanLimits` with admin token → returns 4 default rows; after adding a contact override, returns 5 with
  `userName` populated
- [ ] `setContactUserLimit` on non-existent user → throws "User not found"
- [ ] `setContactUserLimit` on non-contact user → throws "User is not on the contact tier"
- [ ] `setContactUserLimit` valid contact user → row inserted; calling again patches it
- [ ] `removeContactUserLimit` with override → row deleted
- [ ] `removeContactUserLimit` without override → no-op, no error
- [ ] `updateTierDefault` for growth → `listPlanLimits` reflects updated values; contact per-user overrides unchanged
- [ ] `updateTierDefault` for contact tier → only the default row (no userId) is patched
- [ ] All admin endpoints with non-admin token → throws "Forbidden: admin access required"
