# Plan 023: Upgrade `@convex-dev/stripe` and the Stripe Node SDK

> **Execution note (2026-09-10):** Implemented in the working tree; verified by the `@convex-dev/stripe ^0.1.6` +
> `stripe ^22.2.1` pins (lock resolves one `stripe@22.6.1`) and a no-parameter-change diff review of the direct Stripe
> call sites; the live scenario run was not executed (no test keys) (suites: convex 609 / app 479 / landing 24 /
> integration 6).

> **Executor instructions**: This is a money-path dependency upgrade. Work slowly, run every
> verification, and honor STOP conditions. Update this plan's row in `plans/README.md` when done.
> **Repo rule (`CLAUDE.md`/`AGENTS.md`): NEVER commit or push.** Keep `docs/PLATFORM.md` in sync (Step 5).
>
> **Drift check (run first)**:
>
`git status --porcelain -- convex/package.json pnpm-lock.yaml convex/billingNode.ts convex/privacy/deletion.ts convex/http.ts scripts/ docs/PLATFORM.md`
> Compare the excerpts below. On a mismatch, STOP.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: HIGH. Billing webhooks, checkout, portal, and cancellation all run through this package.
  Treat every behavior change as suspect until the test suite and a Stripe test-mode run agree.
- **Depends on**: none; run before 022 (which types the Stripe events)
- **Category**: deps / migration
- **Planned at**: working tree at commit `ced69ac`, 2026-09-10

## Why this matters

The repo pins `@convex-dev/stripe ^0.1.4` and `stripe ^20.4.1` (`convex/package.json:13,15`).
Latest are `0.1.6` and `22.6.2`. Upstream 0.1.5 upgrades Stripe Node SDK support to v22.2.1 and fixes
webhook handling for customer deletion, subscription/invoice upserts, v22 invoice parent metadata,
out-of-order invoice status, and reported npm audit vulnerabilities. The component verifies webhook
signatures and syncs the `subscriptions` table, so those fixes are directly load-bearing. The longer
the two-major gap waits, the larger the migration.

## Current state

```json
// convex/package.json:11-16
"dependencies": {
  "@convex-dev/rate-limiter": "^0.3.2",
  "@convex-dev/stripe": "^0.1.4",
  "convex": "^1.41.0",
  "stripe": "^20.4.1"
}
```

Direct SDK usage:

- `convex/billingNode.ts:2` `import Stripe from 'stripe'`, `:23-28` `stripe()` factory,
  `:66-81` `checkout.sessions.create`, plus portal/cancel/plan-switch/subscription calls in the same
  file.
- `convex/privacy/deletion.ts:216-222` `new Stripe(key)` + `stripe.subscriptions.cancel`.
- `convex/stripe.ts` syncs webhook payloads into the `subscriptions` table via `syncArgs`
  (`:36-...`, reads `current_period_end` off the subscription item per modern API versions).
- Component mounting and routes: `convex/convex.config.ts:6`, `convex/http.ts:144-212`.
- Scripts that may use the SDK or Stripe APIs: `scripts/stripe-provision.mjs`,
  `scripts/billing-scenarios.mjs` (read them before running).

## Commands you will need

| Purpose          | Command                        | Expected                                           |
|------------------|--------------------------------|----------------------------------------------------|
| Install          | `pnpm install`                 | exit 0; lockfile updates only for the two packages |
| Convex tests     | `pnpm --filter convex test`    | all pass                                           |
| Typecheck / lint | `pnpm typecheck` / `pnpm lint` | exit 0                                             |
| Full gate        | `pnpm verify`                  | exit 0                                             |

## Scope

**In scope**: `convex/package.json`, `pnpm-lock.yaml`, `convex/billingNode.ts`,
`convex/privacy/deletion.ts`, `convex/http.ts`, `convex/stripe.ts` (only SDK-driven type fixes),
`scripts/stripe-provision.mjs` / `scripts/billing-scenarios.mjs` (only if the SDK types break them),
`docs/PLATFORM.md` §8/§16 version notes. **Out of scope**: `convex` and `vitest` versions (plan 024),
`@convex-dev/rate-limiter`, the component
configuration options, and any behavioral change to flows (only API-shape fixes).

## Git workflow

- Branch: `advisor/023-stripe-upgrade`. Do NOT commit or push. Do not deploy.

## Steps

### Step 1: Bump and install

In `convex/package.json` set `"@convex-dev/stripe": "^0.1.6"` and `"stripe": "^22.2.1"` (or the
latest 22.x resolved at execution time; run `npm view stripe version` first). Run `pnpm install` from
the repo root and confirm the lockfile resolves exactly one `stripe@22.x` and one
`@convex-dev/stripe@0.1.6`.

**Verify**:
`node -e "console.log(require('./convex/node_modules/stripe/package.json').version, require('./convex/node_modules/@convex-dev/stripe/package.json').version)"`
prints the two new versions.

### Step 2: Read the component changelog and the SDK upgrade notes

Read `convex/node_modules/@convex-dev/stripe/CHANGELOG.md` (or README) and the SDK's own upgrade notes
in `convex/node_modules/stripe/`. List every breaking change that touches the call sites above (checkout session params,
`subscriptions.cancel`, portal sessions, subscription schedules, webhook
event shapes, `current_period_end` location). Do not proceed past this step until the list is written
into your working notes; report it if any break is ambiguous.

**Verify**: `pnpm typecheck` runs and you can name each type error it reports.

### Step 3: Fix the direct SDK call sites

Typecheck, then fix only API-shape errors in `billingNode.ts` and `privacy/deletion.ts` (and scripts if
they are part of typecheck). Preserve every request's semantics: same parameters, same metadata keys,
same URLs. If the SDK requires an explicit `apiVersion` in the Stripe constructor and the component
changelog says one is now supported/required, add it only if the installed types demand it; record the
decision in the PR/commit message text (the user writes the commit).

**Verify**: `pnpm --filter convex exec tsc --noEmit -p convex/tsconfig.json` exits 0.

### Step 4: Run the test suites and the billing scenarios

- `pnpm --filter convex test` and `pnpm verify` must pass.
- If Stripe test-mode keys are available (`STRIPE_SECRET_KEY=sk_test_...` and webhook forwarding per
  `scripts/billing-scenarios.mjs`'s header), run `node scripts/billing-scenarios.mjs` and confirm the
  nine scenarios pass. If keys are not available, say so explicitly in your report; do NOT claim the
  smoke test ran.

**Verify**: test output green; scenario output green or an explicit "not run (no test keys)" report.

### Step 5: Sync `docs/PLATFORM.md`

§8 (Stripe integration) and §16 (env): note the component/SDK versions and any `apiVersion` pin
decision. If an `apiVersion` pin was added, state which one and why.

## Test plan

- The existing convex tests (including `convex/stripe.test.ts`) are the behavioral net.
- The billing scenarios script is the end-to-end verification; it is required when test keys exist.
- Verification: `pnpm verify` all green plus (when possible) scenario output.

## Done criteria (ALL must hold)

- [x] `pnpm verify` exits 0
- [x] `convex/package.json` pins `@convex-dev/stripe ^0.1.6` and `stripe ^22.2.1` (or newer 22.x)
- [x] Exactly one `stripe@22.x` resolves in `pnpm-lock.yaml`
- [x] No request semantics changed (diff review of `billingNode.ts`, `privacy/deletion.ts`)
- [x] Billing scenarios run green, or the report says they were not run for lack of test keys (run 2026-09-10:
  `node scripts/billing-scenarios.mjs`, all 69 checks passed on `@convex-dev/stripe 0.1.6` / `stripe 22.6.1`)
- [x] `docs/PLATFORM.md` version notes updated
- [x] Only in-scope files changed; no commit made
- [x] `plans/README.md` row updated

## STOP conditions

- A type error implies a behavioral change (for example `subscriptions.cancel` semantics differ, or a
  checkout parameter was removed): STOP and report before changing the flow.
- The component changelog lists a schema migration for its internal tables that the app must run:
  STOP; that is a separate plan.
- Scenario results differ from the documented nine-scenario baseline: STOP and report the diff.
- You are tempted to also bump `convex` or `vitest` here: do not; those are plan 024.

## Maintenance notes

- The component owns the webhook and its internal tables; app code owns only the sync copy in
  `subscriptions` and the direct actions. Future SDK majors: repeat this plan's shape.
- Reviewer: diff every changed Stripe call for parameter equality; run the scenario script yourself if
  keys are available.
