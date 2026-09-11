# Plan 024: Bump Convex and adopt `defineApp({ env })` typed environment

> **Execution note (2026-09-10):** Implemented in the working tree; verified by `convex ^1.45.0` in all three manifests
> (one lock resolution), the typed `defineApp({ env })` schema with generated `env`, and no non-test `process.env` reads
> left (suites: convex 609 / app 479 / landing 24 / integration 6).

> **Executor instructions**: Steps 1-2 are fully executable without deployment access. Steps 3-5
> require Convex codegen, which needs deployment credentials; if `npx convex codegen` cannot run,
> STOP after Step 2 and report (do not hand-edit `_generated/`). Update this plan's row in
> `plans/README.md` when done.
> **Repo rule (`CLAUDE.md`/`AGENTS.md`): NEVER commit or push.** Keep `docs/PLATFORM.md` in sync (Step 6).
>
> **Drift check (run first)**:
>
`git status --porcelain -- package.json app/package.json convex/package.json pnpm-lock.yaml convex/convex.config.ts convex/_generated/server.d.ts docs/PLATFORM.md`
> Compare the excerpts below. On a mismatch, STOP.

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: MED. The Convex bump can shift generated types; the typed-env switch touches the billing,
  AI, email, and OAuth read paths.
- **Depends on**: none; do not combine with 023
- **Category**: deps / dx
- **Planned at**: working tree at commit `ced69ac`, 2026-09-10

## Why this matters

`convex` is installed at 1.41.0 (latest 1.45.0; `convex/_generated/ai/guidelines.md` targets ^1.44.0).
Separately, the guidelines say to declare env vars with `defineApp({ env })` and read them via `env`
from `./_generated/server`, so typos and missing required vars are caught at deploy/typecheck instead
of surfacing as silent no-ops or fallbacks (the price-map default-to-starter failure mode documented
at `docs/PLATFORM.md:5424-5435` is exactly this class). `convex/convex.config.ts:5` is bare
`defineApp()`, and about 18 vars are read through `process.env` directly.

## Current state

```ts
// convex/convex.config.ts (whole file)
import { defineApp } from 'convex/server'
import stripe from '@convex-dev/stripe/convex.config.js'
import rateLimiter from '@convex-dev/rate-limiter/convex.config.js'

const app = defineApp()
app.use(stripe)
app.use(rateLimiter)
export default app
```

Version pins: `package.json:27`, `app/package.json:20`, `convex/package.json:14` all `convex ^1.41.0`;
`pnpm-lock.yaml` resolves a single `convex@1.41.0`.

Backend env reads (grep `process.env` in `convex/**` excluding tests before editing; the known set):
LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET, LINKEDIN_REDIRECT_URI, APP_URL, APIFY_API_TOKEN,
APIFY_TASK_ID, APIFY_TASK_ID_PROFILE_SCRAPE, RESEND_API_KEY, EMAIL_FROM, FEEDBACK_REPLY_TO,
OPENROUTER_API_KEY, OPENROUTER_MODEL, OPENROUTER_SITE_URL, OPENROUTER_SITE_NAME, STRIPE_SECRET_KEY,
STRIPE_FEATURED_POST_PRICE_ID, the six `STRIPE_*_{,ANNUAL_}PRICE_ID` vars (via `buildPriceMap`),
ALLOW_ADMIN_SHARE_ANY_POST. `STRIPE_WEBHOOK_SECRET` is read by the Stripe component, not app code;
verify with grep and do not declare it unless app code reads it.
Never declare `CONVEX_SITE_URL`/`CONVEX_CLOUD_URL` (platform-provided; redeclaring breaks the
generated `env` type).

## Commands you will need

| Purpose          | Command                               | Expected                                                 |
|------------------|---------------------------------------|----------------------------------------------------------|
| Install          | `pnpm install`                        | exit 0                                                   |
| Codegen          | `npx convex codegen` (from repo root) | regenerates `convex/_generated/`; needs deployment creds |
| Tests            | `pnpm --filter convex test`           | all pass                                                 |
| Typecheck / lint | `pnpm typecheck` / `pnpm lint`        | exit 0                                                   |
| Full gate        | `pnpm verify`                         | exit 0                                                   |

## Scope

**In scope**: `package.json`, `app/package.json`, `convex/package.json`, `pnpm-lock.yaml`,
`convex/convex.config.ts`, `convex/_generated/` (regenerated only, never hand-edited), every
`convex/**` file with a `process.env` read, `convex/.env.local.example` (names only),
`docs/PLATFORM.md` §16. **Out of scope**: `stripe`/`vitest` versions, frontend `VITE_*`/`NEXT_PUBLIC_*` vars, and any
deployment or env-value change.

## Git workflow

- Branch: `advisor/024-convex-bump-typed-env`. Do NOT commit or push, and do NOT deploy.

## Steps

### Step 1: Bump `convex` and install

Set `"convex": "^1.45.0"` in all three manifests (`package.json`, `app/package.json`,
`convex/package.json`), run `pnpm install`, and confirm the lockfile resolves one `convex@1.45.x`.

**Verify**: `node -e "console.log(require('./node_modules/convex/package.json').version)"` prints
`1.45.x`; `pnpm --filter convex test` passes; `pnpm typecheck` exits 0. If the bump causes type
errors, fix only mechanical issues (generated type signatures) and report anything behavioral.

### Step 2: Declare the env schema

Rewrite `convex/convex.config.ts`:

```ts
import { defineApp } from 'convex/server'
import { v } from 'convex/values'
import stripe from '@convex-dev/stripe/convex.config.js'
import rateLimiter from '@convex-dev/rate-limiter/convex.config.js'

const app = defineApp({
  env: {
    LINKEDIN_CLIENT_ID: v.string(),
    LINKEDIN_CLIENT_SECRET: v.string(),
    LINKEDIN_REDIRECT_URI: v.string(),
    APP_URL: v.string(),
    // ... one entry per var the grep in Current state found; match the read sites' optionality
    // (vars whose absence is handled at runtime stay v.optional(v.string()))
  }
})
app.use(stripe)
app.use(rateLimiter)
export default app
```

Use `v.optional(v.string())` for every var the code treats as optional (APIFY_*, OPENROUTER_*,
RESEND_*, EMAIL_FROM, FEEDBACK_REPLY_TO, STRIPE_*_PRICE_IDs, ALLOW_ADMIN_SHARE_ANY_POST), and
`v.string()` only for vars that must exist in every deployment (LINKEDIN_*, APP_URL, STRIPE_SECRET_KEY
if that is how the code treats it; check `billingNode.ts`'s throw).

**Verify**: `pnpm lint` exits 0. Typecheck may still fail because `env` is not generated yet; that is
expected until Step 3.

### Step 3: Regenerate codegen

Run `npx convex codegen` from the repo root. If it fails for missing credentials or deployment
selection, STOP here and report: the declarations are in place and a maintainer must run
`npx convex dev` or `npx convex codegen` with access, then resume the plan. Do not hand-edit
`_generated/`.

**Verify**: `grep -n "export const env" convex/_generated/server.d.ts` finds the generated export.

### Step 4: Switch the read sites

For each `process.env.X` read in `convex/**` (excluding tests), import `env` from the appropriate
`./_generated/server` (respecting each file's relative path) and replace the read with `env.X`. Keep
the same optionality checks (`if (!env.RESEND_API_KEY)` etc.). Do not touch `buildPriceMap`'s shape
beyond passing `env` instead of `process.env`.

**Verify**: `grep -rn "process.env" convex --include=*.ts` returns only non-env uses (if any) and test
files; `pnpm typecheck` exits 0; `pnpm --filter convex test` passes.

### Step 5: Confirm env parity

Cross-check the declared names against `convex/.env.local.example` and `docs/PLATFORM.md` §16: every
declared var documented, no documented backend var missing. Fix the example/doc (names only, no
values) rather than dropping declarations.

**Verify**: a manual diff of declared names vs `grep -oE "^[A-Z_]+=" convex/.env.local.example` is
clean.

### Step 6: Sync `docs/PLATFORM.md`

§16 and §18: note the typed env schema in `convex/convex.config.ts`, the Convex version bump, and that
env names are validated at deploy time.

## Test plan

- The full convex suite is the regression net; the typed-env switch is a mechanical read replacement.
- A failed declaration (for example a required var missing in a dev deployment) fails deploy, which is
  the intended validation; note this in the report so the maintainer deploys deliberately.
- Verification: `pnpm verify` all green after Step 3 codegen.

## Done criteria (ALL must hold)

- [x] `pnpm verify` exits 0
- [x] All three manifests pin `convex ^1.45.0`; the lockfile resolves one version
- [x] `convex/convex.config.ts` declares every backend env var; `env` is generated and imported
- [x] No `process.env` remains in non-test `convex/**`
- [x] `CONVEX_SITE_URL`/`CONVEX_CLOUD_URL` are not declared
- [x] `docs/PLATFORM.md` §16/§18 updated
- [x] Only in-scope files changed; no commit made; no deployment performed
- [x] `plans/README.md` row updated (mark BLOCKED at Step 3 if codegen was unavailable)

## STOP conditions

- `npx convex codegen` cannot run (no credentials): STOP after Step 2 and report exactly what the
  maintainer must run. Do not stub the generated file.
- The Convex bump changes generated function typing in a way that needs source changes beyond
  mechanical fixes: STOP and report the diff.
- A var proves to have different requiredness between dev and prod: keep it optional and document the
  runtime check; do not fail deploys for dev-only vars.

## Maintenance notes

- New env reads go through `env`; a missing declaration is then a type error.
- Reviewer: confirm no secret value moved into the repo and that `convex.config.ts` changes only the
  `env` schema.
