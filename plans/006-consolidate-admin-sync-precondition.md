# Plan 006: One shared precondition behind the four admin Apify sync triggers

> **Executor instructions**: Follow step by step; confirm each verification. Honor STOP conditions.
> Update this plan's row in `plans/README.md` when done.
> **Repo rule (`CLAUDE.md`): NEVER commit or push.**
>
> **Drift check (run first)**: `git diff --stat 90a90ad..HEAD -- convex/admin.ts`
> If `convex/admin.ts` changed since `90a90ad`, compare the excerpts below to the live code first.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: 004 recommended (regression net), not required
- **Category**: tech-debt
- **Planned at**: commit `90a90ad`, 2026-06-18

## Why this matters

Four admin mutations in `convex/admin.ts` — `syncAllPosts`, `syncUserPosts`, `syncAllProfiles`,
`syncUserProfile` — repeat the same precondition: `requireAuth → assertAdmin → read appSettings →
check the feature flag → throw if disabled`. The flag check is the **authoritative server gate** (the
UI also gates, but a stale client / direct API call must not run a disabled integration), so this code
is security-relevant *and* duplicated. Consolidating it into one helper means the gate is defined once
(locality) and the next Apify trigger reuses it (leverage); each mutation shrinks to "gate + schedule".

This is a behavior-preserving refactor. Convex registers each mutation separately, so the four entry
points stay — only the shared precondition moves behind one function.

## Current state

`convex/admin.ts` — the four triggers (lines ~107–165). The "all" pair is the pure pattern:

```ts
export const syncAllPosts = mutation({
  args: {sessionToken: v.string()},
  handler: async (ctx, {sessionToken}) => {
    const user = await requireAuth(ctx, sessionToken)
    assertAdmin(user)
    const settings = await ctx.db.query('appSettings').first()
    if (!isApifyPostSyncEnabled(settings)) {
      throw new Error('Post sync is disabled — enable it in Settings first.')
    }
    await ctx.scheduler.runAfter(0, internal.jobs.syncPosts.syncAllPosts, {})
  }
})
// syncAllProfiles is identical but uses isApifyProfileScrapeEnabled + a different error + job ref.
```

The "user" pair (`syncUserPosts`, `syncUserProfile`) is the same precondition PLUS:

```ts
    const target = await ctx.db.get(userId)
    if (!target) throw new Error('User not found')
    if (!target.linkedinPublicIdentifier) throw new Error('User has no LinkedIn URL on file.')
```

Gate helpers already exist and are pure + tested: `isApifyPostSyncEnabled` / `isApifyProfileScrapeEnabled`
in `convex/lib/apify.ts`. `assertAdmin` is defined in `convex/admin.ts`.

## Commands you will need

| Purpose                   | Command                     | Expected                      |
|---------------------------|-----------------------------|-------------------------------|
| Convex tests              | `pnpm --filter convex test` | all pass (no behavior change) |
| Lint                      | `pnpm lint`                 | exit 0                        |
| Typecheck (if 001 landed) | `pnpm typecheck`            | exit 0                        |

## Scope

**In scope**: `convex/admin.ts` only. Optionally `docs/PLATFORM.md` §12 (one line noting the shared
precondition helper) to keep the canonical doc accurate.
**Out of scope**: the scheduled jobs themselves (`jobs/syncPosts.ts`, `jobs/syncPostsApify.ts`,
`jobs/scrapeProfileApify.ts`); `lib/apify.ts` gate helpers; the UI; any change to the error messages or
the gate semantics (must stay identical).

## Git workflow

- Branch: `advisor/006-admin-sync-precondition`. Do NOT commit/push.

## Steps

### Step 1: Add a private precondition helper in `admin.ts`

Add (near `assertAdmin`), typed with the generated `MutationCtx`:

```ts
// Shared gate for the admin-initiated Apify triggers: auth + admin + the feature flag.
// Throws the same messages the four triggers threw inline. Returns nothing — callers schedule.
async function assertApifyTriggerEnabled(
  ctx: MutationCtx,
  sessionToken: string,
  isEnabled: (s: Awaited<ReturnType<typeof getOrCreateSettings>> | null) => boolean,
  disabledMessage: string
): Promise<void> {
  const user = await requireAuth(ctx, sessionToken)
  assertAdmin(user)
  const settings = await ctx.db.query('appSettings').first()
  if (!isEnabled(settings)) throw new Error(disabledMessage)
}
```

Use whatever `settings` type the existing `isApifyPostSyncEnabled` accepts (it takes `ApifyFlags` from
`lib/apify.ts`) — keep the signature compatible; if the generic typing is awkward, type the predicate
parameter as `ApifyFlags`. Import `MutationCtx` from `./_generated/server` if not already imported.

**Verify**: `pnpm lint` exits 0; `pnpm --filter convex test` passes.

### Step 2: Rewrite the two "all" triggers to use it

`syncAllPosts` → call `await assertApifyTriggerEnabled(ctx, sessionToken, isApifyPostSyncEnabled,
'Post sync is disabled — enable it in Settings first.')` then `ctx.scheduler.runAfter(0,
internal.jobs.syncPosts.syncAllPosts, {})`.
`syncAllProfiles` → same with `isApifyProfileScrapeEnabled`, `'Profile scrape is disabled — enable it
in Settings first.'`, scheduling `internal.jobs.scrapeProfileApify.scrapeAllProfilesViaApify`.

**Verify**: error strings are byte-identical to the originals; `pnpm --filter convex test` passes.

### Step 3: Rewrite the two "user" triggers to use it

`syncUserPosts` / `syncUserProfile` → call the helper first (same flag + message as their "all"
sibling), then keep the existing `target` existence + `linkedinPublicIdentifier` checks, then schedule
their per-user job (`internal.jobs.syncPostsApify.syncUserPostsViaApify` /
`internal.jobs.scrapeProfileApify.scrapeUserProfile`).

**Verify**: `pnpm --filter convex test` passes; `pnpm lint` exits 0.

### Step 4: Keep the canonical doc in sync

In `docs/PLATFORM.md` §12 ("Manual Apify sync triggers"), add one sentence: the four triggers share a
single `assertApifyTriggerEnabled` precondition (auth + admin + flag) so the server gate is defined once.

## Test plan

- No new unit tests required (the gate predicates are already tested in `lib/apify.ts`; the helper is
  thin orchestration the repo does not `ctx`-mock). Existing `convex/admin.test.ts` is the regression
  net for the rest of `admin.ts`.
- Verification: `pnpm --filter convex test` stays green; error strings unchanged.

## Done criteria (ALL must hold)

- [ ] All four triggers call `assertApifyTriggerEnabled`; the inline auth/flag blocks are gone
- [ ] The thrown error messages are unchanged (grep them in `admin.ts` to confirm)
- [ ] `pnpm --filter convex test` passes; `pnpm lint` exits 0
- [ ] Only `convex/admin.ts` (and optionally `docs/PLATFORM.md`) changed (`git status`)
- [ ] No commit was made
- [ ] `plans/README.md` row for 006 updated

## STOP conditions

- The four triggers in `admin.ts` no longer match the excerpts (drift) → report.
- Typing the predicate parameter forces a non-trivial change to `lib/apify.ts`'s `ApifyFlags` → report;
  do not widen the shared type just to fit this refactor.

## Maintenance notes

- The next Apify-style admin trigger should reuse `assertApifyTriggerEnabled`.
- Reviewer: confirm no error message or gate semantic changed — this must be a pure refactor.
