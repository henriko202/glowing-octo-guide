# Plan 014: Rate-limit billing actions and the account-deletion cycle

> **Executor instructions**: Follow step by step and run every verification. Honor STOP conditions.
> When done, update this plan's row in `plans/README.md`.
> **Repo rule (`CLAUDE.md`/`AGENTS.md`): NEVER commit or push.** Keep `docs/PLATFORM.md` in sync (Step 3).
>
> **Drift check (run first)**:
> `git status --porcelain -- convex/billingNode.ts convex/privacy/deletion.ts convex/lib/rateLimit.ts docs/PLATFORM.md`
> Compare the excerpts below to the live files. On a mismatch, STOP.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW. Every edit adds a limiter call after `requireAuthAction`; normal flows are far below
  the caps.
- **Depends on**: none
- **Category**: security
- **Planned at**: working tree at commit `ced69ac`, 2026-09-10

## Why this matters

Every abuse-prone action in this codebase has a per-user rate limit except the money paths. A signed-in
account can loop `createCheckoutSession`, `createPortalSession`, the cancel/plan-switch flow actions,
and `purchaseFeaturedPost` to mint unbounded Stripe sessions (external API cost, rate-limit pressure,
Radar noise), and it can cycle `requestAccountDeletion` / `cancelAccountDeletion` to trigger repeated
Stripe subscription cancels and "deletion scheduled" emails. `docs/PLATFORM.md:5545-5547` documents
the rate-limit posture for engagement actions; these paths are simply missing from it. The rate-limiter
component is already wired (`convex/lib/rateLimit.ts:16-25`), so this is a small, mechanical fix.

## Current state

Existing per-user limits use `internal.lib.rateLimit.checkAndIncrement` from actions (`convex/posts.ts:270-274`) or
`checkRateLimit` from mutations (`convex/privacy/export.ts:132`):

```ts
await ctx.runMutation(internal.lib.rateLimit.checkAndIncrement, {
    userId: user._id,
    action: 'submitPost',
    maxPerHour: 10
})
```

`RATE_LIMIT_ACTIONS` (`convex/lib/rateLimit.ts:30-38`) is the erasure reset list and must name every
action:

```ts
export const RATE_LIMIT_ACTIONS = [
    'submitFeedback', 'dataExport', 'profile_refresh', 'submitPost',
    'generateComment', 'commentOnPost', 'reactToPost'
] as const
```

Unlimited action sites (each begins with `requireAuthAction`):

| File                    | Export                    | Line (approx) |
|-------------------------|---------------------------|---------------|
| `convex/billingNode.ts` | `createCheckoutSession`   | 34            |
| `convex/billingNode.ts` | `purchaseFeaturedPost`    | 105           |
| `convex/billingNode.ts` | `createPortalSession`     | 263           |
| `convex/billingNode.ts` | `createCancelFlowSession` | 370           |
| `convex/billingNode.ts` | `createPlanSwitchSession` | 414           |
| `convex/billingNode.ts` | `undoScheduledDowngrade`  | 471           |
| `convex/billingNode.ts` | `resumeSubscription`      | 486           |

Deletion cycle (`convex/privacy/deletion.ts:167-208`):

```ts
export const requestAccountDeletion = mutation({
    args: {sessionToken: v.string()},
    handler: async (ctx, {sessionToken}) => {
        const user = await resolveSession(ctx, sessionToken)
        if (!user) throw new Error('Unauthorized')
        if (user.deletionScheduledAt) return {deletionScheduledAt: user.deletionScheduledAt} // idempotent
        // ... patches, deleteAllForUser, audit, scheduler.onDeletionRequested (Stripe cancel + email)
    }
})

export const cancelAccountDeletion = mutation({
    args: {sessionToken: v.string()},
    handler: async (ctx, {sessionToken}) => {
        const user = await resolveSession(ctx, sessionToken)
        if (!user) throw new Error('Unauthorized')
        // ... patches, audit
    }
})
```

Note plan 013 may convert those two `Unauthorized` throws to `ConvexError`; leave that alone if it
landed. `@convex-dev/rate-limiter` is mounted (`convex/convex.config.ts:7`), and `checkRateLimit`
supports a custom window (`convex/lib/rateLimit.ts:77-91`).

## Commands you will need

| Purpose      | Command                     | Expected |
|--------------|-----------------------------|----------|
| Convex tests | `pnpm --filter convex test` | all pass |
| Typecheck    | `pnpm typecheck`            | exit 0   |
| Lint         | `pnpm lint`                 | exit 0   |
| Full gate    | `pnpm verify`               | exit 0   |

## Scope

**In scope**: `convex/billingNode.ts`, `convex/privacy/deletion.ts`, `convex/lib/rateLimit.ts`,
`convex/lib/rateLimit.test.ts`, `docs/PLATFORM.md`. **Out of scope**: changing any Stripe logic, redirect URLs, webhook
handling, the rate-limit helper
internals, admin exemptions (do not add one here), and the `onDeletionRequested` action itself.

## Git workflow

- Branch: `advisor/014-billing-rate-limits`. Do NOT commit or push.

## Steps

### Step 1: Add the limits in `billingNode.ts`

For each of the seven actions, immediately AFTER the `requireAuthAction` call (and after the
`ALLOWED_PRICE_IDS` check in `createCheckoutSession`, so invalid price ids still fail first), add a
`ctx.runMutation(internal.lib.rateLimit.checkAndIncrement, ...)` call with the caps below. Use the
action string exactly as written; they become keys.

| Action                    | `action` key                | `maxPerHour` |
|---------------------------|-----------------------------|--------------|
| `createCheckoutSession`   | `'createCheckoutSession'`   | 10           |
| `purchaseFeaturedPost`    | `'purchaseFeaturedPost'`    | 10           |
| `createPortalSession`     | `'createPortalSession'`     | 20           |
| `createCancelFlowSession` | `'createCancelFlowSession'` | 10           |
| `createPlanSwitchSession` | `'createPlanSwitchSession'` | 10           |
| `undoScheduledDowngrade`  | `'undoScheduledDowngrade'`  | 20           |
| `resumeSubscription`      | `'resumeSubscription'`      | 10           |

Example shape (adapt the variable name to each handler's resolved user):

```ts
await ctx.runMutation(internal.lib.rateLimit.checkAndIncrement, {
    userId: user._id,
    action: 'createCheckoutSession',
    maxPerHour: 10
})
```

Add the `internal` import from `./_generated/api` if absent.

**Verify**: `pnpm --filter convex exec tsc --noEmit -p convex/tsconfig.json` exits 0.

### Step 2: Add the limits in `privacy/deletion.ts`

`requestAccountDeletion` (mutation): after the idempotent early return, so an already-scheduled
account does not consume budget:

```ts
await checkRateLimit(ctx, user._id, 'requestAccountDeletion', 3, 24 * 60 * 60 * 1000, 'day')
```

`cancelAccountDeletion` (mutation): after the `resolveSession` check:

```ts
await checkRateLimit(ctx, user._id, 'cancelAccountDeletion', 10)
```

Import `checkRateLimit` from `../lib/rateLimit` (the existing import style is
`convex/privacy/export.ts:11`). Do not add an admin exemption: erasure must stay uniformly available
and uniformly bounded.

**Verify**: `pnpm --filter convex exec tsc --noEmit -p convex/tsconfig.json` exits 0.

### Step 3: Register every new action in `RATE_LIMIT_ACTIONS`

Append the nine names to `convex/lib/rateLimit.ts:30-38`:

```
'createCheckoutSession', 'purchaseFeaturedPost', 'createPortalSession',
'createCancelFlowSession', 'createPlanSwitchSession', 'undoScheduledDowngrade',
'resumeSubscription', 'requestAccountDeletion', 'cancelAccountDeletion'
```

This keeps account erasure (`resetUserRateLimits`) complete.

**Verify**: extend `convex/lib/rateLimit.test.ts` with an assertion that `RATE_LIMIT_ACTIONS` contains
all nine new names (sort and compare, so ordering is not pinned). `pnpm --filter convex test` passes.

### Step 4: Sync `docs/PLATFORM.md`

- §17 rate-limiting bullet (`:5545-5547`): add the billing/deletion caps listed above.
- §8 billing section: one sentence stating checkout/portal/plan-change actions are rate-limited per
  user, and that the deletion request is capped at 3/day with cancellation at 10/hour.

## Test plan

- `convex/lib/rateLimit.test.ts`: `RATE_LIMIT_ACTIONS` contains the nine new names.
- Call-site behavior is not coverable with the repo's pure-test harness; the done-criteria greps below
  enforce that every listed action has a limiter call.
- Verification: `pnpm --filter convex test` all pass.

## Done criteria (ALL must hold)

- [ ] `pnpm verify` exits 0
- [ ] Each of the nine action keys appears exactly once as an `action:` argument in
  `convex/billingNode.ts` / `convex/privacy/deletion.ts`
  (`grep -n "action: '" convex/billingNode.ts convex/privacy/deletion.ts` shows them)
- [ ] `RATE_LIMIT_ACTIONS` contains all nine names
- [ ] `requestAccountDeletion`'s limiter runs after the idempotent early return
- [ ] No Stripe call, URL, or message changed (diff review)
- [ ] `docs/PLATFORM.md` §8/§17 updated
- [ ] Only in-scope files changed; no commit made
- [ ] `plans/README.md` row updated

## STOP conditions

- Any of the seven actions does not call `requireAuthAction`, or resolves its user differently: report
  the actual shape instead of inserting a limiter blind.
- A billing flow test or the Stripe scenario script (`scripts/billing-scenarios.mjs`) exercises these
  actions more than 10 times in a run: report; do not raise a cap without the maintainer's call.
- You find an existing limiter on one of these actions (duplicate): report and skip that one.

## Maintenance notes

- Caps are deliberately generous for humans and tiny for loops. If a legitimate support flow needs
  more, raise the specific cap, never remove the call.
- The `action` strings are erasure keys; renaming one strands its counter on account deletion.
- Reviewer: confirm the limiter runs before any Stripe SDK call and that error messages are unchanged.
