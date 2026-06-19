# Plan 008: Make `pnpm verify` exit 0 (format + lint)

> **Executor instructions**: Follow step by step; confirm each verification. Honor STOP conditions.
> **Repo rule (`CLAUDE.md`): NEVER commit or push.** This plan runs in the existing worktree that
> already contains plans 001–007 (so `verify` can actually go green). Do all work there; do not commit.

## Status

- **Priority**: P1 (unblocks the CI gate added in 001)
- **Effort**: S
- **Risk**: LOW
- **Depends on**: 001 (the `verify` script) + the worktree state of 002–007
- **Category**: dx
- **Planned at**: commit `90a90ad`, 2026-06-18 (executed against the 001–007 worktree)

## Why this matters

Plan 001 added `pnpm verify` (= `format:check && lint && typecheck && test`) + CI. In the 001–007
worktree, **typecheck and test already pass**, but `verify` is red on:

1. **6 source files the 001–007 work left un-Prettier-formatted** (they pass `lint` because
   `eslint-config-prettier` disables format rules, but fail `format:check`): `convex/admin.ts`,
   `convex/interactions.ts`, `convex/lib/interactionLimit.ts`, `convex/linkedin/client.test.ts`,
   `convex/linkedin/oauth.ts`, `convex/linkedin/posts.ts`.
2. **13 pre-existing `docs/*.md`** that are not Prettier-clean (a deliberate repo convention — the
   canonical `docs/PLATFORM.md` uses hand-aligned tables Prettier would mangle).
3. **3 pre-existing `react-hooks/set-state-in-effect` lint errors** in `app/src/pages/SettingsPage.tsx`
   (the intentional "mirror server value into editable state unless dirty" pattern, lines ~52–57).

## Current state

- `.prettierignore` already excludes prose/config from Prettier (`node_modules`, `convex/_generated`,
  `pnpm-lock.yaml`, `AGENTS.md`, `CLAUDE.md`, …) — but NOT `docs/`.
- `app/src/pages/SettingsPage.tsx:52-57`:
  ```tsx
  // Mirror the server value for each field ... stop mirroring once the user edits it.
  const meIndustry = me?.industry
  const meCountry = me?.country
  useEffect(() => {
    if (!industryDirty) setIndustry(meIndustry ?? '')
  }, [meIndustry, industryDirty])
  useEffect(() => {
    if (!countryDirty) setCountry(meCountry ?? '')
  }, [meCountry, countryDirty])
  ```

## Commands you will need

| Purpose            | Command                                    | Expected               |
|--------------------|--------------------------------------------|------------------------|
| Format the 6 files | `pnpm exec prettier --write <the 6 paths>` | reformats them         |
| Format check       | `pnpm format:check`                        | exit 0 after steps 1–2 |
| Lint               | `pnpm lint`                                | exit 0 after step 3    |
| Full gate          | `pnpm verify`                              | exit 0                 |

## Scope

**In scope**: the 6 source files (formatting only — no token/logic changes), `.prettierignore` (add
`docs/`), `app/src/pages/SettingsPage.tsx` (add scoped `eslint-disable` comments only — no logic change).
**Out of scope**: reformatting `docs/**` (excluded instead — do NOT run `prettier --write` on docs, it
would destroy `PLATFORM.md`'s hand-aligned tables); any behavior change in `SettingsPage.tsx`; any other file.

## Steps

### Step 1: Prettier-format only the 6 flagged source files

`pnpm exec prettier --write convex/admin.ts convex/interactions.ts convex/lib/interactionLimit.ts convex/linkedin/client.test.ts convex/linkedin/oauth.ts convex/linkedin/posts.ts`
**Verify**: `pnpm --filter convex test` still passes (formatting is behavior-neutral). Do NOT run
`prettier --write .` — that would reformat the docs.

### Step 2: Exclude `docs/` from Prettier

Append `docs/` to `.prettierignore` (consistent with the existing `AGENTS.md`/`CLAUDE.md` exclusions and
the repo's "docs aren't Prettier-clean" convention).
**Verify**: `pnpm format:check` exits 0.

### Step 3: Resolve the 3 pre-existing SettingsPage lint errors (suppress-with-justification)

Run `pnpm lint` and note every `react-hooks/set-state-in-effect` error in
`app/src/pages/SettingsPage.tsx`. For each flagged line, add immediately above it:
`// eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: mirror server value into editable state until the user edits the field (see comment above)`
Do NOT change the effect logic. (If lint reports this rule in any file OTHER than `SettingsPage.tsx`,
STOP and report — that would be new debt, not the known pre-existing trio.)
**Verify**: `pnpm lint` exits 0.

### Step 4: Confirm the gate is green

**Verify**: `pnpm verify` exits 0.

## Test plan

No new tests. Verification is `pnpm verify` exit 0 and the convex/app suites still passing.

## Done criteria (ALL must hold)

- [ ] `pnpm verify` exits 0
- [ ] `git diff` for the 6 source files shows only formatting (no token/logic changes)
- [ ] `.prettierignore` includes `docs/`
- [ ] `SettingsPage.tsx` changed only by added `eslint-disable-next-line` comments
- [ ] No commit was made

## STOP conditions

- `react-hooks/set-state-in-effect` appears outside `SettingsPage.tsx` → report (new debt, investigate).
- Prettier-formatting a source file changes more than whitespace/line-wrapping → report.
- After steps 1–3, `pnpm verify` still fails on something else → report the failure (do not chase it).

## Maintenance notes

- Step 3 SUPPRESSES the pre-existing react-hooks errors rather than refactoring the controlled-sync
  pattern (behavior-preserving, reviewable). A proper fix is the "adjust state during render" pattern
  (React's "You Might Not Need an Effect") — deferred as a separate decision; flagged for the owner.
- Reviewer: confirm the 6 source diffs are formatting-only, and that `docs/PLATFORM.md` was NOT reformatted.
