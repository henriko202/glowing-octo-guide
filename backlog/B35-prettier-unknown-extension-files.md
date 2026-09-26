# B35 — Prettier explicit-file checks fail on extensionless files

> **Status:** TODO · **Priority:** P3 · **Effort:** S · **Category:** tooling
> **Depends on:** — · **Blocks:** — (developer friction only)

## Summary

Running `prettier --check <file>` against `landing/public/llms.txt` or `landing/.env.example` exits with an error
("No parser could be inferred"), while the normal directory scan silently skips them. Any future agent that checks a
changed file directly gets a failure that has nothing to do with formatting, and a file-targeted `--write` cannot
succeed at all.

## Evidence

- `.prettierignore:17` — ignores `*.md` (which covers `pricing.md`) but not `llms.txt` or `.env.example`.
- `pnpm exec prettier --check landing/public/llms.txt landing/.env.example` — errors with "No parser could be inferred
  for file …"; `pnpm format:check` (whole-tree scan) passes and skips both.
- 2026-09-10 landing SEO review reproduced this while checking the new AI-discovery files.

## Root cause

Prettier's CLI fails on unknown extensions when a file is passed explicitly; directory scans filter them out first.
The repo has no unknown-file policy.

## What we need to do

1. Add `--ignore-unknown` to the root `format` and `format:check` scripts in `package.json` so explicit-file invocations
   are safe, **or** add `landing/public/llms.txt` and `landing/.env.example` to `.prettierignore`.
2. Pick one: `--ignore-unknown` is the durable fix (covers future extensionless files such as `llms-full.txt` or a
   `CNAME`), while ignore entries are more explicit but need maintenance.

## Acceptance criteria

- [ ] `pnpm exec prettier --check landing/public/llms.txt landing/.env.example` exits 0.
- [ ] `pnpm format:check` is still green.
- [ ] `pnpm verify` is green (typecheck + lint + tests)
- [ ] `docs/PLATFORM.md` updated (see **Docs to update**)

## Risks / edge cases / open questions

- `--ignore-unknown` also hides genuinely malformed files with a known extension? No — it only skips files whose parser
  cannot be inferred, so `.ts`/`.tsx`/`.json` formatting is unaffected.

## Docs to update

- `docs/PLATFORM.md` §18 — Configuration/Tooling: note the flag/ignore entries if the chosen fix changes the command.

## References

- Related: [[B34]]
- Prior art / plan: 2026-09-10 landing SEO review.
