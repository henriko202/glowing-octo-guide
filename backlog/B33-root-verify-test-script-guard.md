# B33 — Root verify does not require every workspace to declare a test script

> **Status:** TODO · **Priority:** P2 · **Effort:** S · **Category:** tooling/CI
> **Depends on:** — · **Blocks:** silent loss of workspace tests from `pnpm verify`

## Summary

Root `pnpm verify` ends in `pnpm -r test`, and pnpm recursive runs only execute workspaces that declare a `test`
script. A workspace can contain vitest tests, be excluded from every gate, and still let `verify` pass. The landing
was in exactly this state until 2026-09-10, when its parity/middleware/trial tests were run only by hand.

## Evidence

- `package.json:23` — `"verify": "pnpm format:check && pnpm lint && pnpm typecheck && pnpm -r test"`.
- `landing/package.json:11` — `"test": "vitest run"` now exists (added 2026-09-10); before that the landing had
  `landing/i18n/dictionaries.test.ts`, `landing/middleware.test.ts` and `landing/lib/trial.test.ts` that `pnpm -r test`
  never picked up.
- `app/package.json:10` and `convex/package.json:9` — both declare a `test` script, which is why the gap was invisible
  in the other two workspaces.

## Root cause

`pnpm -r <script>` is opt-in per package and no root check asserts the converse ("has tests, must declare a script").
The landing tests were written before the script existed and were run manually, so nothing failed.

## What we need to do

1. Add a small root script (e.g. `scripts/check-workspace-tests.mjs`) that reads `pnpm-workspace.yaml`, walks each
   workspace package, and fails when the package contains files matching `**/*.test.{ts,tsx,js,jsx}` but its
   `package.json` has no `test` script.
2. Wire it into `verify` before `pnpm -r test` (e.g. `&& node scripts/check-workspace-tests.mjs && pnpm -r test`).

## Acceptance criteria

- [ ] `pnpm verify` fails if a workspace gains a test file without a `test` script (verify with a throwaway file).
- [ ] Current tree passes with all four workspaces declaring `test`.
- [ ] `pnpm verify` is green (typecheck + lint + tests)
- [ ] `docs/PLATFORM.md` updated (see **Docs to update**)

## Risks / edge cases / open questions

- Some packages may intentionally hold fixtures named `*.test.*`; keep the matcher strict and allow an explicit opt-out
  comment in `package.json` if it ever matters.
- `pnpm-workspace.yaml` currently uses only `packages:` globs; parse it rather than hardcoding four paths.

## Docs to update

- `docs/PLATFORM.md` §18 — Testing: note the guard alongside "All: `pnpm -r test`".

## References

- Related: [[B34]]
- Prior art / plan: 2026-09-10 landing SEO review (landing test script was wired in that change).
