# Plan 025: Adopt `convex-test` for integration coverage of high-risk backend paths

> **Executor instructions**: Follow step by step, run each verification. Honor STOP conditions.
> Update this plan's row in `plans/README.md` when done.
> **Repo rule (`CLAUDE.md`/`AGENTS.md`): NEVER commit or push.** Keep `docs/PLATFORM.md` in sync (Step 5).
>
> **Drift check (run first)**:
> `git status --porcelain -- convex/package.json convex/vitest.config.ts package.json convex-mocks/ docs/PLATFORM.md`
> Compare the excerpts below. On a mismatch, STOP.

## Status

- **Priority**: P3
- **Effort**: L (harness plus a first small suite)
- **Risk**: MED. A second test runner configuration must not disturb the existing 206 mock-based
  tests. Keep the two configs fully separate.
- **Depends on**: 024 recommended (the harness should be built on the bumped Convex)
- **Category**: tests
- **Planned at**: working tree at commit `ced69ac`, 2026-09-10

## Why this matters

The Convex guidelines recommend `convex-test` with `vitest` and `@edge-runtime/vm` (module map from
`import.meta.glob`, `environment: "edge-runtime"`). This repo instead aliases `convex/server` to a
hand-written mock (`convex/vitest.config.ts:4-9`, `convex-mocks/_test/__mocks__/convex_server_generics.ts`)
and tests only pure helpers. Registered wrappers, validator enforcement, index behavior, transaction
limits, and scheduling are never executed; money paths (Stripe sync) and the DSR export loop have no
integration coverage. The shim can silently drift from the real API (it still models deprecated cron
helpers).

## Current state

```ts
// convex/vitest.config.ts (whole file)
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  resolve: {
    alias: {
      'convex/server': path.resolve(__dirname, '../convex-mocks/_test/__mocks__/convex_server_generics.ts')
    }
  }
})
```

`convex/package.json:9` `"test": "vitest run"`; no `convex-test` or `@edge-runtime/vm` dependency.
README documents the mock shim as the testing approach; `docs/PLATFORM.md:3265` records "no
convex-test" as a convention. This plan overturns that convention deliberately and says so in the
docs.

Guideline pattern (from `convex/_generated/ai/guidelines.md` testing section):

```ts
/// <reference types="vite/client" />
import { convexTest } from 'convex-test'
import { expect, test } from 'vitest'
import { api } from './_generated/api'
import schema from './schema'
const modules = import.meta.glob('./**/*.ts')
```

## Commands you will need

| Purpose                | Command                                 | Expected         |
|------------------------|-----------------------------------------|------------------|
| Install                | `pnpm install`                          | exit 0           |
| Unit tests (unchanged) | `pnpm --filter convex test`             | all 206 pass     |
| Integration tests      | `pnpm --filter convex test:integration` | new suite passes |
| Typecheck / lint       | `pnpm typecheck` / `pnpm lint`          | exit 0           |
| Full gate              | `pnpm verify`                           | exit 0           |

## Scope

**In scope**: `convex/package.json`, `pnpm-lock.yaml`, `convex/vitest.integration.config.ts` (create),
`convex/integration/` (create: test files), `package.json` (verify script addition),
`docs/PLATFORM.md`. **Out of scope**: deleting or rewriting the mock shim and the existing 63 unit test files; they stay
until the integration suite covers their ground.

## Git workflow

- Branch: `advisor/025-convex-test-adoption`. Do NOT commit or push.

## Steps

### Step 1: Install and configure the second runner

- `pnpm --filter convex add -D convex-test @edge-runtime/vm` (or edit `convex/package.json` and
  `pnpm install`).
- Create `convex/vitest.integration.config.ts`:

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'edge-runtime',
    include: ['integration/**/*.test.ts']
  }
})
```

No `convex/server` alias here: `convex-test` needs the real module.

- Add `"test:integration": "vitest run --config vitest.integration.config.ts"` to
  `convex/package.json`.
- Update the root `verify` script to run it after `pnpm -r test`:
  `"verify": "pnpm format:check && pnpm lint && pnpm typecheck && pnpm -r test && pnpm --filter convex test:integration"`.

**Verify**: `pnpm --filter convex test` still passes (unchanged config);
`pnpm --filter convex test:integration` runs and reports no test files (exit 0 or the runner's
no-tests exit; if it exits 1 on no tests, add `passWithNoTests: true` to the integration config).

### Step 2: Write the first integration suite

Create `convex/integration/highRisk.test.ts` with the module map and `convexTest(schema, modules)`.
Cover, using only in-function fakes (no external services):

1. **Weekly limit inserts and queues.** Call `internal.jobs.syncPosts.upsertPost` twice for the same
   fresh starter author via `t.mutation(...)` (inspect the exported args) and assert the second is
   refused/queued per its args, plus the `posts`/`postQueue` row counts via `t.run(ctx => ctx.db...)`.
2. **Reaction dedupe.** Seed a user + post, call `incrementLikeCount` twice for the same actor, assert
   `likeCount === 1` and one `userInteractions` row.
3. **Auth negative.** Seed a user + session, call `posts.setPostHidden` with a bogus session token and
   assert it throws; with the real token and another user's post, assert the ownership rejection.
4. **Validator enforcement.** Call a public mutation with a missing/extra arg from the module map and
   assert the validator rejects it (this is the behavior the mock shim cannot test).

Use `t.run(async ctx => { ... })` for direct seeding; model the file on the guideline snippet.

**Verify**: `pnpm --filter convex test:integration` passes with all four tests.

### Step 3: Decide the migration boundary and record it

Add a short section to `docs/PLATFORM.md` §18 (Testing):

- two runners: unit (`vitest.config.ts`, mock shim) for pure helpers; integration (`vitest.integration.config.ts`,
  edge-runtime + `convex-test`) for registered wrappers and DB
  behavior;
- the integration suite is the required home for any new money, authz, or transaction test;
- the mock shim is frozen (no new capabilities) and can be retired once integration coverage reaches
  the high-risk paths (list them: Stripe sync, DSR export/deletion, rate limits, trial milestone).

**Verify**: doc review only.

## Test plan

- The four integration tests above, plus the existing suite untouched.
- If `convex-test` cannot load the generated `api` because of the local component registrations (stripe, rate-limiter),
  start with tests that call `internal` functions and document the limitation;
  do not delete the component mounts.
- Verification: `pnpm verify` green including `test:integration`.

## Done criteria (ALL must hold)

- [ ] `pnpm verify` exits 0 and runs both suites
- [ ] `convex/vitest.integration.config.ts` uses `environment: 'edge-runtime'` and no mock alias
- [ ] At least the four integration tests pass
- [ ] The unit suite still passes with its alias config unchanged
- [ ] `docs/PLATFORM.md` §18 documents the two-runner model and the shim's freeze
- [ ] Only in-scope files changed; no commit made
- [ ] `plans/README.md` row updated

## STOP conditions

- `convex-test` cannot resolve the project's generated functions (component mounts, `.js` import
  suffixes in `syncPostsApify.ts`): report the exact failure; do not rewrite source imports to make
  tests pass in this plan.
- The edge-runtime environment breaks `convex-test` on the installed vitest version: try the
  documented `environmentMatchGlobs` or a separate vitest workspace; if neither works, STOP with the
  error.
- A test requires Stripe/network: cut it from this plan's scope; the harness and four local tests are
  the deliverable.

## Maintenance notes

- New high-risk tests go in `convex/integration/`.
- Keep `convex-test` and `@edge-runtime/vm` versions aligned with `convex` on future bumps.
- Reviewer: confirm the integration config has no alias (a shim leak would silently make integration
  tests fake).
