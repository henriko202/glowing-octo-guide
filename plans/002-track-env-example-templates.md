# Plan 002: `.env*.example` templates are tracked in git (onboarding templates exist)

> **Executor instructions**: Follow step by step; run each verification and confirm the expected
> result. Honor STOP conditions. Update this plan's row in `plans/README.md` when done.
> **Repo rule (`CLAUDE.md`): NEVER commit or push.** Stage/save changes; the user commits.
>
> **Drift check (run first)**: `git diff --stat 90a90ad..HEAD -- .gitignore convex/.gitignore`
> If either changed since `90a90ad`, re-read it and compare to the excerpts below before proceeding.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx
- **Planned at**: commit `90a90ad`, 2026-06-18

## Why this matters

`docs/PLATFORM.md` §16 states "the `.env*.example` files document the required set" — but the root
`.gitignore` rule `.env*` (line 2) also matches `.env.example` / `.env.local.example`, so **none of
the template files are actually tracked**. A new contributor (or an agent) cloning the repo gets no
env template at all. This plan narrows the ignore rule so the _example templates_ are tracked while
real secret files (`.env`, `.env.local`) stay ignored.

## Current state

- Root `.gitignore` line 2 is exactly: `.env*`
- `convex/.gitignore` line 2 is exactly: `.env.local`
- Verified ignored (should NOT be): `git check-ignore -v app/.env.example` → `.gitignore:2:.env*	app/.env.example`
- Verified NOT tracked: `git ls-files | grep -E '\.env.*example'` → (empty)
- Template files that exist on disk: `app/.env.example`, `landing/.env.example`, `convex/.env.local.example`
- Real secret files (must STAY ignored): `.env.local`, `app/.env.local`, `convex/.env.local`,
  `landing/.env.local`. **These were verified never committed** (`git log --all --full-history` empty).

## Commands you will need

| Purpose                               | Command                             | Expected                                         |
|---------------------------------------|-------------------------------------|--------------------------------------------------|
| Check a template is no longer ignored | `git check-ignore app/.env.example` | exit 1, **no output**                            |
| Check secrets stay ignored            | `git check-ignore app/.env.local`   | prints the path (still ignored)                  |
| List what would be tracked            | `git status --porcelain`            | shows the `.env*.example` files as untracked/new |

## Scope

**In scope**: `.gitignore` (root). **In scope only if step 3 shows it's needed**: `convex/.gitignore`.
**Out of scope**: the contents of any `.env*` file; any source code; `docs/PLATFORM.md` (its §16 claim
becomes accurate once the templates are trackable — no edit needed).

## Git workflow

- Branch: `advisor/002-env-example-templates`. Do NOT commit/push.

## Steps

### Step 1: Narrow the root `.gitignore` rule

In `.gitignore`, replace the single line `.env*` with:

```
.env*
!.env.example
!.env.local.example
```

(Keep `.env*` so real secret files stay ignored; the two negations re-include the templates at any depth.)

**Verify**:

- `git check-ignore app/.env.example` → exit 1, no output (not ignored)
- `git check-ignore landing/.env.example` → exit 1, no output
- `git check-ignore convex/.env.local.example` → exit 1, no output
- `git check-ignore app/.env.local` → prints `app/.env.local` (STILL ignored)
- `git check-ignore .env.local` → prints `.env.local` (STILL ignored)

### Step 2: Verify the templates contain only placeholders (safety gate)

Open each now-trackable file (`app/.env.example`, `landing/.env.example`, `convex/.env.local.example`)
and confirm every value is a placeholder (e.g. `your_key_here`, `whsec_...`, empty), **not a real
secret**. Real secrets look like live tokens (`sk_live_…`, `sk_test_…` with long random tails,
`WPL_AP1.…`, `apify_api_…`).
**STOP** if any template contains what looks like a real credential — report the `file:line` and the
credential _type_ only (never copy the value), and recommend the value be replaced with a placeholder
and rotated before the file is tracked.

### Step 3: Check `convex/.gitignore` doesn't re-ignore the convex template

Run `git check-ignore convex/.env.local.example`. If it still prints the path, `convex/.gitignore`'s
`.env.local` rule is catching it — add `!.env.local.example` on the next line of `convex/.gitignore`.
Re-run; expect exit 1 / no output.

## Test plan

No unit tests — this is a git-config change. Verification is the `git check-ignore` results above.

## Done criteria (ALL must hold)

- [ ] `git check-ignore` reports the 3 template files as NOT ignored
- [ ] `git check-ignore` reports `.env.local` / `app/.env.local` / `convex/.env.local` as STILL ignored
- [ ] No real secret value appears in any tracked file (step 2 passed)
- [ ] Only `.gitignore` (and maybe `convex/.gitignore`) changed (`git status`)
- [ ] No commit was made
- [ ] `plans/README.md` row for 002 updated

## STOP conditions

- A template file contains a real-looking credential (step 2) → report, do not track it.
- `git check-ignore` still ignores a template after the change → the negation pattern isn't matching;
  report the exact `.gitignore` contents rather than guessing further patterns.

## Maintenance notes

- After this lands, the user can `git add` the three template files and commit them.
- Reviewer: confirm no `.env.local` (secrets) slipped into tracking — `git ls-files | grep env` should
  show only `*.example` templates and `*-env.d.ts` type files.
