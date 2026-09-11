# Plan 010: Prevent cross-author post writes and tighten post-ownership verification

> **Executor instructions**: Follow step by step and run every verification. Honor STOP conditions.
> When done, update this plan's row in `plans/README.md`.
> **Repo rule (`CLAUDE.md`/`AGENTS.md`): NEVER commit or push.** Keep `docs/PLATFORM.md` in sync (Step 4).
>
> **Drift check (run first)**:
>
`git status --porcelain -- convex/jobs/syncPosts.ts convex/posts.ts convex/linkedin/verifyPostOwnership.ts convex/linkedin/verifyPostOwnership.test.ts docs/PLATFORM.md`
> Compare the excerpts below to the live files. On a mismatch, STOP.

## Status

- **Priority**: P1
- **Effort**: S (guard) with an M-sized test/doc tail
- **Risk**: LOW for the DB guard; MED for the ownership cross-check because a member who changed
  their LinkedIn vanity after it was auto-derived will be rejected until the stored identifier is
  cleared. See Maintenance notes.
- **Depends on**: none
- **Category**: security
- **Planned at**: working tree at commit `ced69ac`, 2026-09-10

## Why this matters

Post ownership is verified by comparing the submitted post page's JSON-LD author name against the
member's LinkedIn OIDC name (`convex/linkedin/verifyPostOwnership.ts:46-50`). The member's own name is
attacker-controlled (they can rename themselves on LinkedIn), and display names are not unique. On top
of that, `upsertPost`'s existing-URN branch patches `likeCount`/`commentCount`/`hidden` without ever
comparing `existing.authorId` to the incoming `authorId`
(`convex/jobs/syncPosts.ts:42-61`). Combined, a same-named member can submit another member's post
URL, pass ownership, and flip the victim's existing post out of the feed (through `hidden`) or
misattribute a new insert. `docs/PLATFORM.md:2512-2519` and `:5551-5552` currently claim this cannot be
spoofed. This plan closes the cross-author write (the persistent damage), adds a vanity cross-check
when the member already has a stored identifier, and corrects the docs to state the residual risk
honestly.

## Current state

`convex/jobs/syncPosts.ts:36-61` (the unguarded existing branch):

```ts
handler: async (ctx, args) => {
  const existing = await ctx.db
    .query('posts')
    .withIndex('by_urn', q => q.eq('linkedinPostUrn', args.linkedinPostUrn))
    .first()

  if (existing) {
    // Update branch — never checks limits; only updates engagement counts.
    const feed = computeFeedFields({ ... })
    await ctx.db.patch(existing._id, {
      likeCount: args.likeCount,
      commentCount: args.commentCount,
      hidden: args.hidden,
      ...feed
    })
    return { postId: existing._id, created: false }
  }
```

`convex/linkedin/verifyPostOwnership.ts:40-63` (primary branch and fallback):

```ts
export function verifyPostOwnership(
  postAuthorName: string | null,
  memberName: string,
  vanityName: string | null,
  storedPublicIdentifier: string | null
): OwnershipResult {
  if (postAuthorName) {
    if (!sameName(postAuthorName, memberName)) {
      throw new Error("This post doesn't belong to your LinkedIn account.")
    }
    return { confirmed: true, content: '', publishedAt: Date.now(), strategy: 'author-name' }
  }
  // fallback: vanity heuristic (only when no author block) ...
}
```

Call site `convex/posts.ts:350-356`:

```ts
const postAuthor = parsePostAuthor(rawLinkedinText)
ownership = verifyPostOwnership(
  postAuthor.name ?? null,
  user.name,
  parsed.vanityName,
  user.linkedinPublicIdentifier ?? null
)
```

`convex/posts.ts:428-452` calls upsert with `authorId: user._id` and then:

```ts
if (!postId) {
  throw new Error('Failed to upsert post')
}
```

`convex/jobs/syncPostsApify.ts:143-154` calls the same `upsertPost` per scraped post with
`queueOnLimitReached: true`; its `authorId` is always the synced member, so a re-sync never trips the
new guard. That action does not wrap `runMutation` in try/catch, so a throw aborts the remaining posts
for that user. The guard therefore returns `{ postId: null }` instead of throwing.

Error convention: user-facing failures use `ConvexError` (`docs/PLATFORM.md:779-787`). Tests are
pure-function Vitest; `convex/linkedin/verifyPostOwnership.test.ts` is the pattern.

## Commands you will need

| Purpose      | Command                     | Expected |
|--------------|-----------------------------|----------|
| Convex tests | `pnpm --filter convex test` | all pass |
| Typecheck    | `pnpm typecheck`            | exit 0   |
| Lint         | `pnpm lint`                 | exit 0   |
| Full gate    | `pnpm verify`               | exit 0   |

## Scope

**In scope**: `convex/jobs/syncPosts.ts`, `convex/jobs/syncPosts.test.ts` (create),
`convex/posts.ts` (only the `!postId` branch and imports), `convex/linkedin/verifyPostOwnership.ts`,
`convex/linkedin/verifyPostOwnership.test.ts`, `docs/PLATFORM.md`. **Out of scope**: the Apify fan-out logic,
`processQueue.ts`, `parsePostAuthor`, the auto-fill of
`linkedinPublicIdentifier` in `posts.ts:360-365`, and the admin override path. Do not add a LinkedIn
API call; OIDC Standard tier cannot make one.

## Git workflow

- Branch: `advisor/010-post-ownership-guard`. Do NOT commit or push.

## Steps

### Step 1: Add a testable guard and apply it in `upsertPost`

In `convex/jobs/syncPosts.ts`, add an exported helper above `upsertPost`:

```ts
// Cross-author write guard: a URN already owned by a different member is never patched.
// Returns true when the incoming write targets the same author and may proceed.
export function isSamePostAuthor(existingAuthorId: string, incomingAuthorId: string): boolean {
  return existingAuthorId === incomingAuthorId
}
```

In the `if (existing)` branch, before `computeFeedFields`, insert:

```ts
if (!isSamePostAuthor(existing.authorId, args.authorId)) {
  // A different member submitted this URN (e.g. a display-name collision). Never let the
  // incoming write touch the existing row's counts or hidden flag.
  console.warn(
    `[upsertPost] cross-author write ignored for ${args.linkedinPostUrn} (owner ${existing.authorId}, writer ${args.authorId})`
  )
  return { postId: null, created: false }
}
```

**Verify**: `pnpm --filter convex exec tsc --noEmit -p convex/tsconfig.json` exits 0.

### Step 2: Surface the refusal to the manual submitter

In `convex/posts.ts`, change the `!postId` branch (`~line 450`) to:

```ts
if (!postId) {
  throw new ConvexError('This post is already linked to another LinkedIn account and cannot be updated here.')
}
```

`ConvexError` is already imported in `posts.ts`. Do not change any other behavior.

**Verify**: `pnpm --filter convex test` and `pnpm lint` pass.

### Step 3: Cross-check the URL vanity against the stored identifier

In `convex/linkedin/verifyPostOwnership.ts`, inside the `if (postAuthorName)` branch, after the
`sameName` check and before the `return`, add:

```ts
// When we already know the member's vanity, a Format 1 URL that points at a different vanity is
// a different account, whatever the display name says.
if (
  storedPublicIdentifier &&
  vanityName &&
  storedPublicIdentifier.toLowerCase() !== vanityName.toLowerCase()
) {
  throw new Error("This post doesn't belong to your LinkedIn account.")
}
```

Leave the fallback branch unchanged. Format 2 URLs (`vanityName === null`) still pass on the name
check alone; that bypass is intentional and must be documented in Step 4.

**Verify**: `pnpm --filter convex test` passes (existing tests must stay green; the "does NOT fall
back" case uses vanity `real-vanity` matching the stored value, so it still passes).

### Step 4: Sync `docs/PLATFORM.md`

- `:2512-2519` ("Ownership verification"): replace "it cannot be spoofed via a settings field" with an
  honest statement: the signals come from LinkedIn and are not editable in-app, but **display names are
  not unique and the member's own name is editable on LinkedIn**, so same-name collisions are a known
  limitation at OIDC Standard tier. Document the new cross-checks: an existing URN is never written
  across authors; a Format 1 URL whose vanity contradicts the member's stored `linkedinPublicIdentifier`
  is rejected; Format 2 URLs have no vanity to check.
- `:5551-5552` in §17 Input validation: change "cannot be spoofed" to point at the limitation above.
- Add one sentence to the submit flow note: a cross-author URN returns a user-facing `ConvexError`.

## Test plan

- `convex/jobs/syncPosts.test.ts` (create): import `isSamePostAuthor`; assert true for equal ids,
  false for different ids. Model structure on `convex/linkedin/verifyPostOwnership.test.ts`.
- `convex/linkedin/verifyPostOwnership.test.ts`: add:
    - stored `henri-durand`, URL vanity `someone-else`, author name matching → throws.
    - stored `henri-durand`, URL vanity `Henri-Durand` (case) → confirms.
    - stored `henri-durand`, Format 2 (`vanityName` null), author name matching → confirms (documented
      bypass).
- Verification: `pnpm --filter convex test` all pass including the new cases.

## Done criteria (ALL must hold)

- [x] `pnpm verify` exits 0
- [x] `grep -n "isSamePostAuthor" convex/jobs/syncPosts.ts` finds the helper and one call site
- [x] `grep -n "already linked to another LinkedIn account" convex/posts.ts` finds the ConvexError
- [x] The three new ownership test cases exist and pass
- [x] `docs/PLATFORM.md` no longer claims name-based ownership cannot be spoofed; the limitation and
  both new guards are documented
- [x] Only in-scope files changed; no commit made
- [x] `plans/README.md` row updated

> **Execution note (2026-09-10):** Implemented in the working tree; verified by greps + the green suites at convex 609 /
> app 479 / landing 24 / integration 6.

## STOP conditions

- The live code does not match the excerpts (drift).
- The guard's `{ postId: null }` return trips a caller other than the two known sites (`posts.submitPost`,
  `jobs/syncPostsApify.syncUserPostsViaApify`): grep all callers first and report.
- An existing ownership test relies on the URL vanity differing from the stored identifier in a
  passing case: report instead of changing it.
- You are tempted to fix auto-fill impersonation by removing `setDerivedPublicIdentifier`; that breaks
  the Apify seed. Do not; the residual risk is documented instead.

## Maintenance notes

- **Vanity changes**: a member who changes their LinkedIn vanity after `linkedinPublicIdentifier` was
  set will be rejected by Step 3's cross-check. The escape hatch today is clearing the stored field (direct DB edit) so
  the next verified post re-derives it. If vanity churn becomes real, add a
  refresh-if-different path, but that reopens the spoofing vector, so it needs its own design.
- **Residual impersonation risk**: a first-time attacker with no stored identifier who shares the
  victim's display name can still insert the victim's post as their own; the auto-fill then mints the
  victim's vanity on the attacker's account. Fixing this needs a stronger identity signal than OIDC
  Standard tier exposes (for example LinkedIn Partner access). Keep the docs honest about it.
- Reviewer: verify the guard runs before any `ctx.db.patch` in the existing branch, and that
  `processQueue.ts` (which inserts, never patches by URN) needs no change.
