# Plan 026: Delete the stale npm lockfile and placeholder the committed observability keys

> **Execution note (2026-09-10):** Implemented in the working tree; verified by the deleted `convex/package-lock.json` +
> `.gitignore` rule and placeholder-only `app/.env.example` values (suites: convex 609 / app 479 / landing 24 /
> integration 6).

> **Executor instructions**: Follow step by step. Honor STOP conditions. Update this plan's row in
> `plans/README.md` when done.
> **Repo rule (`CLAUDE.md`/`AGENTS.md`): NEVER commit or push.** The user commits; deleting a tracked
> file is expressed as a working-tree deletion for them to review.
>
> **Drift check (run first)**:
> `git status --porcelain -- convex/package-lock.json app/.env.example .gitignore`
> Compare the excerpts below. On a mismatch, STOP.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW. The lockfile is unused; the example keys are client-publishable by vendor design.
- **Depends on**: none
- **Category**: dx / hygiene
- **Planned at**: working tree at commit `ced69ac`, 2026-09-10

## Why this matters

1. `convex/package-lock.json` is tracked while the workspace is pnpm-only. It is stale: its root entry
   declares `"convex": "^1.17.0"` and it pins `convex@1.33.1`, while the manifest pins `^1.41.0` and
   the pnpm lock resolves the real tree. Anyone or any tool running `npm install` from `convex/` gets a
   different, older graph, and dependency scanners read the wrong versions.
2. `app/.env.example:19,21` contain a real-format Sentry DSN and PostHog project key while every other
   line is a placeholder. Both key types are publishable by design (they ship in the client bundle),
   so this is not a credential leak, but committing them lets forks and preview builds send events
   into the production projects (quota burn, dashboard pollution) and breaks the placeholder
   discipline plan 002 established.

## Current state

`git ls-files convex/package-lock.json` returns the file; `.gitignore` ignores `.env*` but not
`package-lock.json`. `app/.env.example` is tracked and lines 19/21 begin
`VITE_SENTRY_DSN=https://...` and `VITE_POSTHOG_KEY=phc_...` with real-format values (not reproduced
here).

## Commands you will need

| Purpose       | Command                                        | Expected                 |
|---------------|------------------------------------------------|--------------------------|
| Tracked check | `git ls-files convex/package-lock.json`        | prints the path (before) |
| Ignore check  | `git check-ignore -v convex/package-lock.json` | prints a rule (after)    |
| Full gate     | `pnpm verify`                                  | exit 0                   |

## Scope

**In scope**: delete `convex/package-lock.json`, `.gitignore`, `app/.env.example`. **Out of scope**: the real
`.env.local` files (never touched), rotating the keys (optional and a
maintainer call), and any other workspace's lockfile.

## Git workflow

- Branch: `advisor/026-repo-hygiene`. Do NOT commit or push.

## Steps

### Step 1: Delete the stale npm lockfile

Delete `convex/package-lock.json` from the working tree. Add `package-lock.json` to the root
`.gitignore` (the repo is pnpm-only; this prevents a stray `npm install` from re-adding it) with a
one-line comment.

**Verify**: `git status --porcelain` shows `D convex/package-lock.json`;
`git check-ignore -v convex/package-lock.json` prints the `.gitignore` rule.

### Step 2: Placeholder the example keys

Replace the two real-format values in `app/.env.example` with placeholders that keep the documented
shape:

```
VITE_SENTRY_DSN=https://<key>@o<org>.ingest.sentry.io/<project>
VITE_POSTHOG_KEY=phc_<your_project_key>
```

Do not put the real values anywhere else in the repo; they already exist in the git history at commit
`f2e343f`, which is acceptable for publishable client keys. Mention in your report (not in the file)
that rotation is optional and a maintainer call.

**Verify**: `grep -nE "phc_[A-Za-z0-9]{20,}|@o[0-9]+\.ingest" app/.env.example` returns no matches;
`pnpm verify` exits 0 (the file is not read by tests).

## Test plan

- No tests affected; the gate proves nothing else broke.

## Done criteria (ALL must hold)

- [x] `pnpm verify` exits 0
- [x] `convex/package-lock.json` is deleted and covered by `.gitignore`
- [x] `app/.env.example` contains only placeholder values
- [x] Real values were not copied anywhere into the repo or this plan
- [x] `plans/README.md` row updated

## STOP conditions

- The lockfile is referenced by any script or CI workflow (grep `package-lock` first): STOP and report
  the reference.
- A real secret (not a publishable key) is found in any `.env.example` while doing this: STOP, report
  the file:line and credential type only, and recommend rotation; do not proceed with the cleanup in
  the same change.

## Maintenance notes

- Keep `.env.example` files placeholder-only; plan 002's discipline is the standard.
- Reviewer: confirm no other lockfile variant is tracked.
