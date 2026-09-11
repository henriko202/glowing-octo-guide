# Plan 022: Centralize the audit DB seam, type Stripe events, fix DSR pagination opts

> **Executor instructions**: Follow step by step, run each verification. Honor STOP conditions.
> Update this plan's row in `plans/README.md` when done.
> **Repo rule (`CLAUDE.md`/`AGENTS.md`): NEVER commit or push.** Keep `docs/PLATFORM.md` in sync (Step 4).
>
> **Drift check (run first)**:
>
`git status --porcelain -- convex/lib/audit.ts convex/privacy/consent.ts convex/feedback/feedback.ts convex/posts.ts convex/privacy/export.ts convex/privacy/deletion.ts convex/stripe.ts convex/http.ts convex/linkedin/auth.ts docs/PLATFORM.md`
> Plans 013 and 016 also touch some of these files; preserve their changes.
> Compare the excerpts below. On a mismatch, STOP.

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: MED. Replacing `any` Stripe event types can cascade type errors; work file by file and
  keep the 206 convex tests green.
- **Depends on**: 013 (audit/log changes), 016 (consent), 023 (Stripe version bump; do 022 after 023
  if 023 changes event typings)
- **Category**: tech-debt
- **Planned at**: working tree at commit `ced69ac`, 2026-09-10

## Why this matters

The audit found ~25 `as unknown as` casts in non-test convex files, most of them re-declaring a
narrow audit-DB interface so pure helpers stay unit-testable. Five files each declare their own
version, so an `writeAuditLog` signature change would not surface as a type error at most call sites.
`convex/http.ts:141-142` and `convex/stripe.ts:24-25` alias `type StripeEvent = any`, defeating the
compiler on the money path. Finally, the DSR export loop rebuilds `paginationOpts` field by field
(`convex/privacy/export.ts:166-169`), which the guidelines warn drops optional fields; this plan
switches it to explicit cursor/numItems args, the recommended server-owned-cursor shape.

## Current state

```ts
// convex/lib/audit.ts:10-31
export interface AuditEntry { actor: 'user' | 'admin' | 'system'; actorId?: string; action: string; targetUserId?: string; metadata?: string }
interface AuditInsertDb { insert(table: string, doc: Record<string, unknown>): Promise<string> }
export async function writeAuditLog(db: AuditInsertDb, entry: AuditEntry): Promise<void> { ... }
```

Duplicate aliases/casts:

- `convex/privacy/consent.ts:13` `type AuditDb = { insert: ... }`, casts at `:44,73,105`
- `convex/feedback/feedback.ts:150,172,195` inline casts
- `convex/posts.ts:710,732` inline casts
- `convex/privacy/export.ts:138` inline cast and `:97` `PaginatedDb`
- `convex/privacy/deletion.ts:180,201,276-277` `CascadeDb`/`CascadeStorage` casts

```ts
// convex/stripe.ts:24-25 (identical alias in convex/http.ts:141-142)
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Stripe event types vary by SDK version
type StripeEvent = any
```

```ts
// convex/privacy/export.ts:166-169 and the query at :92-102
const res = await ctx.runQuery(internal.privacy.export.gatherUserTablePage, {
  userId, table, paginationOpts: { numItems: EXPORT_PAGE_SIZE, cursor }
})
// gatherUserTablePage args: { userId, table, paginationOpts: paginationOptsValidator }
```

`convex/linkedin/auth.ts:2` imports the `internalMutationGeneric` testing seam but is missing from
the PLATFORM.md §6 seam list (`docs/PLATFORM.md:815-825` lists `lib/audit.ts` and the two Apify jobs).

## Commands you will need

| Purpose          | Command                        | Expected |
|------------------|--------------------------------|----------|
| Convex tests     | `pnpm --filter convex test`    | all pass |
| Typecheck / lint | `pnpm typecheck` / `pnpm lint` | exit 0   |
| Full gate        | `pnpm verify`                  | exit 0   |

## Scope

**In scope**: `convex/lib/audit.ts`, `convex/privacy/consent.ts`, `convex/feedback/feedback.ts`,
`convex/posts.ts`, `convex/privacy/export.ts`, `convex/privacy/deletion.ts`, `convex/stripe.ts`,
`convex/http.ts`, `docs/PLATFORM.md`. **Out of scope**: changing any function signature that tests mock (beyond the
`writeAuditLog` db type),
the `ctx as unknown as ActionCtx` casts in the two Apify jobs and `lib/audit.ts`'s registration seam (sanctioned), and
`convex/users.ts`'s per-handler structural casts unless they are audit-DB casts.

## Git workflow

- Branch: `advisor/022-type-seams-and-pagination`. Do NOT commit or push.

## Steps

### Step 1: Export one audit DB type and use it everywhere

In `convex/lib/audit.ts`, export the structural type (rename to make its purpose explicit):

```ts
/** Structural subset of MutationCtx['db'] that writeAuditLog needs. Exported so every call site
 *  shares one shape (and so pure handlers can pass a mock). */
export interface AuditDb {
  insert(table: string, doc: Record<string, unknown>): Promise<string>
}
```

Keep `writeAuditLog(db: AuditDb, ...)`. In `privacy/consent.ts`, `feedback/feedback.ts`,
`posts.ts`, `privacy/export.ts`, and `privacy/deletion.ts`, delete local `AuditDb`-shaped aliases for
audit writes and cast with the shared type: `ctx.db as unknown as AuditDb` (imported from
`../lib/audit`). Leave non-audit casts (`PaginatedDb`, `CascadeDb`'s non-audit methods) as they are.

**Verify**: `grep -rn "insert: (t: string, d: Record<string, unknown>)" convex --include=*.ts` returns
only `lib/audit.ts`; `pnpm --filter convex test` passes.

### Step 2: Replace the Stripe `any` aliases with real types

In `convex/stripe.ts`, replace `type StripeEvent = any` with an import from the SDK:

```ts
import type Stripe from 'stripe'
type StripeEvent = Stripe.Event
```

In `convex/http.ts`, same. Then fix the type errors that surface (`.data.object` fields are typed on
`Stripe.Event`; `syncArgs` already reads snake_case fields per the SDK). If the component's registered
handler callback signature conflicts, cast at the callback boundary only, with a comment, rather than
reverting to `any`.

**Verify**: `pnpm --filter convex exec tsc --noEmit -p convex/tsconfig.json` exits 0;
`grep -rn "= any" convex --include=*.ts` returns nothing outside tests; `pnpm --filter convex test`
passes.

### Step 3: Fix the DSR export pagination call

Change `gatherUserTablePage` args to explicit values (server owns the cursor):

```ts
args: { userId: v.id('users'), table: v.string(), cursor: v.union(v.string(), v.null()), numItems: v.number() },
handler: async (ctx, { userId, table, cursor, numItems }) => {
  // ...
  return await db.query(cfg.table).withIndex(cfg.index, q => q.eq(cfg.field, userId))
    .paginate({ cursor, numItems })
}
```

Update the caller in `generateExport` to pass `{ userId, table, cursor, numItems: EXPORT_PAGE_SIZE }`
and drop the field-by-field opts rebuild. Update `convex/privacy/export.test.ts` for the new args.

**Verify**: `pnpm --filter convex test` passes; `grep -n "numItems: EXPORT_PAGE_SIZE, cursor" convex/privacy/export.ts`
shows the explicit args, not a reconstructed `paginationOpts`.

### Step 4: Correct the seam list in `docs/PLATFORM.md`

§6 "Type-shim landscape": add `linkedin/auth.ts` to the files importing the
`internalMutationGeneric`/`internalActionGeneric` test seam, and note the exported `AuditDb` type.
No other doc changes.

## Test plan

- Existing tests are the regression net; none should need behavioral changes beyond the export args.
- `convex/lib/audit.test.ts` continues to pass with the renamed type.
- Verification: `pnpm verify` all green.

## Done criteria (ALL must hold)

- [ ] `pnpm verify` exits 0
- [ ] One `AuditDb` definition exists, in `lib/audit.ts`; all audit write casts use it
- [ ] No `type StripeEvent = any` remains; both files use `Stripe.Event`
- [ ] `gatherUserTablePage` takes explicit `cursor`/`numItems`; no opts reconstruction
- [ ] PLATFORM.md §6 seam list includes `linkedin/auth.ts`
- [ ] Only in-scope files changed; no commit made
- [ ] `plans/README.md` row updated

## STOP conditions

- `Stripe.Event`'s type shape makes the webhook handlers fail in ways that require runtime casts
  across many lines: STOP and report the specific mismatch; a second-best is a narrow local interface
  for the fields actually read, not `any`.
- Centralizing `AuditDb` breaks a test mock's ability to satisfy the type (for example a mock inserts
  with a different signature): report; do not widen back to `any`.
- Removing the `PaginatedDb` cast needs a signature change that cascades beyond the file: leave it and
  say so.

## Maintenance notes

- New audit writes must import the shared `AuditDb`.
- The `linkedin/auth.ts` seam is sanctioned by the tests' mock strategy; do not remove it without
  replacing the mock layer.
- Reviewer: confirm no behavior changed in the export loop (cursor semantics identical).
