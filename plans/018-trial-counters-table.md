# Plan 018: Move trial interaction counters off the shared `users` document

> **Executor instructions**: Follow step by step, run each verification. Honor STOP conditions.
> Update this plan's row in `plans/README.md` when done.
> **Repo rule (`CLAUDE.md`/`AGENTS.md`): NEVER commit or push.** Keep `docs/PLATFORM.md` in sync (Step 5).
>
> **Drift check (run first)**:
>
`git status --porcelain -- convex/schema.ts convex/interactions.ts convex/users.ts convex/billing.ts convex/seed.ts convex/privacy/deletion.ts convex/privacy/export.ts convex/migrations/ docs/PLATFORM.md`
> Plans 016 and 017 also edit `convex/interactions.ts`; preserve their changes. Compare the excerpts
> below. On a mismatch, STOP.

## Status

- **Priority**: P2
- **Effort**: M-L (schema change + migration + cascade wiring)
- **Risk**: MED. The trial-conversion milestone (50 interactions) drives `endTrialEarly`; a broken
  counter read delays or misses a conversion. Tests pin the thresholds.
- **Depends on**: none; run after 016/017 (shared file).
- **Category**: perf / schema
- **Planned at**: working tree at commit `ced69ac`, 2026-09-10

## Why this matters

`trialInteractionsMade`/`trialInteractionsReceived` live on the `users` row (`convex/schema.ts:61-62`)
and are patched on every interaction while either side is trialing (`convex/interactions.ts:63-69,217-218,260-261`). The
`users` document is also read on every
authenticated request (`convex/lib/auth.ts:42`) and, for feed authors, by `feed.getFeed`
(`convex/feed.ts:208`), so each trial counter write invalidates the author's own queries and every
open feed page containing one of their posts, and concurrent interactions on different posts by the
same trialing author serialize on that one document. The Convex guidelines call for high-churn
operational data to live in its own table.

## Current state

```ts
// convex/schema.ts:61-62 (users)
trialInteractionsMade: v.optional(v.number()),
trialInteractionsReceived: v.optional(v.number()),
```

```ts
// convex/interactions.ts:57-69
export async function bumpTrialInteractionHandler(
  ctx: TrialBumpCtx, userId: string, kind: 'made' | 'received',
  loadSubscriptions: () => Promise<readonly TrialSubscriptionRow[]>
): Promise<void> {
  const u = await ctx.db.get(userId)
  if (!u || u.subscriptionStatus !== 'trialing') return
  const made = u.trialInteractionsMade ?? 0
  const received = u.trialInteractionsReceived ?? 0
  const combined = made + received
  if (kind === 'made') await ctx.db.patch(userId, { trialInteractionsMade: made + 1 })
  else await ctx.db.patch(userId, { trialInteractionsReceived: received + 1 })
  // ... crossesThreshold -> near-end notice + endTrialEarly
}
```

Readers: `convex/users.ts:216-217` (`getTrialProgress`), `convex/billing.ts:75-76`. Seed writes them
at `convex/seed.ts:205-206,411-412,570-571,1133`. Test expectations:
`convex/interactions.trialMilestone.test.ts:10,39-40,58,62,86,112` assert patches like
`{ trialInteractionsMade: 4 }` on the user row.

**Conventions**: batched migrations follow `convex/migrations/backfillFeedFields.ts` (page with
`paginationOpts`, reschedule when the page is full). Privacy wiring: `EXPORT_TABLES` in
`convex/privacy/export.ts` and the cascade table list in `convex/privacy/deletion.ts`.

## Commands you will need

| Purpose          | Command                        | Expected |
|------------------|--------------------------------|----------|
| Convex tests     | `pnpm --filter convex test`    | all pass |
| Typecheck / lint | `pnpm typecheck` / `pnpm lint` | exit 0   |
| Full gate        | `pnpm verify`                  | exit 0   |

## Scope

**In scope**: `convex/schema.ts`, `convex/interactions.ts`, `convex/users.ts`, `convex/billing.ts`,
`convex/seed.ts`, `convex/privacy/deletion.ts`, `convex/privacy/export.ts`,
`convex/migrations/moveTrialCounters.ts` (create), `convex/interactions.trialMilestone.test.ts`,
any other test that constructs users with these fields, `docs/PLATFORM.md`. **Out of scope**: the trial threshold logic
(`lib/trialMilestone.ts`), `endTrialEarly`, the Stripe
webhook, and any other users field.

## Git workflow

- Branch: `advisor/018-trial-counters-table`. Do NOT commit or push. The migration is run by the
  maintainer (or a dev deployment), never committed.

## Steps

### Step 1: Add the table (widen)

In `convex/schema.ts`, add:

```ts
// High-churn trial interaction counters, kept off the users doc so each interaction does not
// invalidate every query that reads the member (getMe, feed pages containing their posts).
trialCounters: defineTable({
  userId: v.id('users'),
  made: v.number(),
  received: v.number()
}).index('by_user', ['userId']),
```

Keep the existing `users` fields for now (widen phase).

**Verify**: `pnpm --filter convex exec tsc --noEmit -p convex/tsconfig.json` exits 0.

### Step 2: Switch writers and readers

- `convex/interactions.ts`:
    - Change `TrialBumpCtx` to expose the new table: `get(userId)` (for `subscriptionStatus`) plus
      `query('trialCounters')`/`insert`/`patch` as needed, or keep a narrow structural type.
    - In `bumpTrialInteractionHandler`, after the trialing check, read the counter row
      (`withIndex('by_user', q => q.eq('userId', userId)).unique()`), compute `made`/`received`, then
      update it: patch when present, insert `{ userId, made: kind === 'made' ? 1 : 0, received: ... }`
      when absent. Use `Id<'users'>` for `userId` (it is currently `string`).
    - Do NOT patch the `users` row.
- `convex/users.ts` `getTrialProgress`: read the counter row and use `?? 0`.
- `convex/billing.ts:75-76`: same.
- `convex/seed.ts`: replace user-field writes with `trialCounters` inserts (keep the seed's shape:
  only seed a counter row when `made` or `received` is nonzero).
- Update `convex/interactions.trialMilestone.test.ts` mock ctx to accept the new reads/writes and
  assert counter patches/inserts; keep every threshold assertion (4, 8, 31, 50) intact.

**Verify**: `pnpm --filter convex test` passes; `grep -rn "trialInteractions" convex --include=*.ts`
returns only the migration and (temporarily) the schema fields.

### Step 3: Backfill migration

Create `convex/migrations/moveTrialCounters.ts`, modeled on `convex/migrations/backfillFeedFields.ts`:
page through `users` (bounded batch, e.g. 100) that still carry either field, upsert a `trialCounters`
row with the values, then patch the user to clear the two fields (`undefined`), rescheduling when the
page is full. Idempotent: skip users whose counter row already exists and whose fields are cleared.

**Verify**: `pnpm --filter convex exec tsc --noEmit -p convex/tsconfig.json` exits 0. Do not run
`convex run` against any deployment; the maintainer runs the migration after deploying Step 2.

### Step 4: Narrow the schema

After the migration has been run on every deployment (the maintainer confirms; pre-launch this is a
no-op), remove the two fields from `users` in `convex/schema.ts`. If you cannot confirm the migration
ran, leave the fields and mark this step as pending in the plan's status row and your report.

**Verify**: `pnpm --filter convex exec tsc --noEmit -p convex/tsconfig.json` exits 0; grep shows no
remaining `trialInteractionsMade`/`Received` uses.

### Step 5: Wire privacy + docs

- Add `trialCounters` to `EXPORT_TABLES` in `convex/privacy/export.ts` (user-owned data) and to the
  cascade table list in `convex/privacy/deletion.ts` so erasure deletes it.
- `docs/PLATFORM.md`: §5 table list and ER text (16 tables becomes 17), §8/§9 trial-counter storage
  note, and the type/table counts wherever the doc states them.

## Test plan

- `convex/interactions.trialMilestone.test.ts`: threshold behavior unchanged with the new table,
  including the exactly-50 early conversion and the 40/50 near-end notice.
- A small unit test for the counter upsert helper if you extract one (patch vs insert paths).
- Verification: `pnpm verify` all green.

## Done criteria (ALL must hold)

- [ ] `pnpm verify` exits 0
- [ ] No runtime writer patches `trialInteractionsMade`/`Received` on `users`
  (`grep -rn "trialInteractions" convex --include=*.ts` shows only schema (if Step 4 pending) and the migration)
- [ ] `getTrialProgress` and `billing.getBillingContext` read `trialCounters`
- [ ] `trialCounters` is in the DSR export list and the deletion cascade
- [ ] `docs/PLATFORM.md` table count and trial storage updated
- [ ] Only in-scope files changed; no commit made; migration not executed against a deployment
- [ ] `plans/README.md` row updated (note Step 4 pending if applicable)

## STOP conditions

- The milestone tests cannot be adapted without weakening an assertion: STOP and report; the
  conversion threshold is money.
- Any other reader of the user fields appears (grep before starting): include it or report.
- The migration cannot be made idempotent (for example counter rows may drift): STOP and report the
  conflict rather than overwriting counters.

## Maintenance notes

- `trialCounters` is authoritative once the migration lands; the users fields must not come back.
- Reviewer: verify the counter upsert runs in the same mutation as the `userInteractions` insert (atomicity) and that
  erasure covers the new table.
