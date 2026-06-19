# Plan 001: A one-command `verify` and CI run lint + format + types + tests

> **Executor instructions**: Follow this plan step by step. Run every verification command and
> confirm the expected result before moving on. If a "STOP conditions" item occurs, stop and report —
> do not improvise. When done, update this plan's row in `plans/README.md`.
> **Repo rule (`CLAUDE.md`): NEVER commit or push.** Make and save file changes only; the user commits.
>
> **Drift check (run first)**:
> `git diff --stat 90a90ad..HEAD -- package.json convex/tsconfig.json app/tsconfig.json landing/tsconfig.json`
> If any of these changed since `90a90ad`, compare the "Current state" excerpts to the live files
> before proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx
- **Planned at**: commit `90a90ad`, 2026-06-18

## Why this matters

The codebase has money paths (Stripe sync), privacy paths (account-deletion cascade), and quota
enforcement, an `eslint . --max-warnings 0` policy, and a full Vitest suite — but **no automated gate
runs any of it**. There is no `.github/` directory and no `typecheck`/`verify` script, so lint, types,
and tests only run when a contributor remembers to run them locally. This plan adds a single
`pnpm verify` command and a CI workflow that runs it on every push/PR, so regressions surface
automatically.

## Current state

- `package.json` (repo root) — scripts today (no `typecheck`, no `verify`):
  ```json
  "scripts": {
    "dev:landing": "pnpm --filter landing dev",
    "dev:app": "pnpm --filter app dev",
    "dev:convex": "npx convex ai-files update && npx convex dev",
    "build:landing": "pnpm --filter landing build",
    "build:app": "pnpm --filter app build",
    "build:convex": "npx convex deploy",
    "lint": "eslint . --max-warnings 0",
    "lint:fix": "eslint . --fix",
    "format": "prettier --write .",
    "format:check": "prettier --check ."
  }
  ```
- Workspaces (`pnpm-workspace.yaml`): `landing`, `app`, `convex`.
- TypeScript availability per workspace (verified): `app` has `typescript ^5.9.3`, `landing` has
  `typescript ^5.9.3`. **`convex` has NO `typescript` devDependency** (its devDeps are `@types/node`,
  `vitest`). The Convex backend's types are normally validated by `npx convex dev`/`deploy` codegen.
- `app` build already gates on `tsc`: `app/package.json` → `"build": "tsc && vite build"`.
- Tests run green via `pnpm -r test` (Vitest in `app` and `convex`).
- `.github/` does not exist.

## Commands you will need

| Purpose           | Command                                                   | Expected on success    |
|-------------------|-----------------------------------------------------------|------------------------|
| Install           | `pnpm install`                                            | exit 0                 |
| Lint              | `pnpm lint`                                               | exit 0 (zero warnings) |
| Format check      | `pnpm format:check`                                       | exit 0                 |
| Tests (all)       | `pnpm -r test`                                            | all pass               |
| App typecheck     | `pnpm --filter app exec tsc --noEmit`                     | exit 0                 |
| Landing typecheck | `pnpm --filter landing exec tsc --noEmit`                 | exit 0                 |
| Convex typecheck  | `pnpm --filter convex exec tsc --noEmit -p tsconfig.json` | exit 0 (after step 2)  |

## Scope

**In scope**:

- `package.json` (root) — add `typecheck` + `verify` scripts.
- `convex/package.json` — add `typescript` devDependency (only if step 2 shows it is needed).
- `.github/workflows/ci.yml` (create).

**Out of scope** (do NOT touch):

- Any source file under `app/src`, `convex/`, `landing/` — this plan adds tooling only.
- Existing `lint`/`format` scripts — leave as-is.
- Deploy config for Railway/Vercel/Convex — not part of CI here.

## Git workflow

- Branch: `advisor/001-verification-baseline` (or the repo's convention if one is evident from `git log`).
- Do NOT commit or push (see `CLAUDE.md`). Leave changes staged/unstaged for the user.

## Steps

### Step 1: Confirm the app & landing typechecks pass today

Run `pnpm --filter app exec tsc --noEmit` and `pnpm --filter landing exec tsc --noEmit`.
**Verify**: both exit 0. If either reports pre-existing errors, STOP and report (do not fix source).

### Step 2: Make the convex backend typecheckable

Run `pnpm --filter convex exec tsc --noEmit -p tsconfig.json`.

- If it runs and exits 0 → no dependency change needed.
- If it fails with "tsc not found" / cannot resolve TypeScript → add `"typescript": "^5.9.3"` to
  `convex/package.json` `devDependencies`, run `pnpm install`, then re-run the command.

**Verify**: `pnpm --filter convex exec tsc --noEmit -p tsconfig.json` exits 0.
**STOP** if it reports many pre-existing type errors (more than a handful) — the convex `tsconfig.json`
may be configured only for codegen, not standalone `--noEmit`. Report the error output instead of
editing source or tsconfig.

### Step 3: Add root `typecheck` and `verify` scripts

In root `package.json` `scripts`, add:

```json
"typecheck": "pnpm --filter convex exec tsc --noEmit -p tsconfig.json && pnpm --filter app exec tsc --noEmit && pnpm --filter landing exec tsc --noEmit",
"verify": "pnpm format:check && pnpm lint && pnpm typecheck && pnpm -r test"
```

**Verify**: `pnpm verify` exits 0.

### Step 4: Add the CI workflow

Create `.github/workflows/ci.yml`:

```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm verify
```

**Verify**: the file exists and is valid YAML (`pnpm dlx js-yaml .github/workflows/ci.yml` prints
parsed YAML, or simply re-read the file and confirm structure). CI itself runs on GitHub after the
user pushes — not in this session.

## Test plan

- No new unit tests. The deliverable is the gate itself.
- Verification that the gate works: `pnpm verify` exits 0 locally.

## Done criteria (ALL must hold)

- [ ] `pnpm verify` exits 0
- [ ] root `package.json` has `typecheck` and `verify` scripts
- [ ] `.github/workflows/ci.yml` exists and parses as YAML
- [ ] No files outside the in-scope list changed (`git status`)
- [ ] No commit was made
- [ ] `plans/README.md` row for 001 updated

## STOP conditions

- The convex standalone typecheck (step 2) surfaces many pre-existing errors → report; do not edit source/tsconfig.
- `pnpm verify` fails on lint/format/tests due to **pre-existing** issues unrelated to this plan → report which.
- Adding `typescript` to convex changes other workspaces' resolution unexpectedly → report.

## Maintenance notes

- If a 4th workspace is added, extend the `typecheck` script.
- Reviewer should confirm CI runs `verify` (not a narrower subset) so the gate can't silently weaken.
- Follow-up (not in this plan): caching, matrix Node versions, and a `convex deploy --dry-run` schema
  check if a CI-accessible Convex deploy key is available.
