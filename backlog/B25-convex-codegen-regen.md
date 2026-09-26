# B25 — Regenerate Convex `_generated/` after the `^1.41` backend bump

> **Status:** TODO · **Priority:** P2 · **Effort:** S · **Category:** Ops
> **Depends on:** [[B26]] (the version bump lives in the uncommitted worktree — plan 005) · **Blocks:** clean `pnpm typecheck` against the bumped Convex runtime

## Summary

Plan 005 bumped the `convex` backend dependency to `^1.41.0` and all tests passed, but `convex/_generated/` was **not regenerated** because the execution sandbox lacked deployment credentials. The generated code (server/API/dataModel types) can drift from the installed Convex version until codegen re-runs, so a `typecheck` may miss or surface type skew. Fix: run codegen from the repo root, then typecheck.

## Evidence

- `plans/README.md:49-51` — "(005) Regenerate Convex codegen. The `convex` backend bump to `^1.41.0` is in place and all tests pass, but `npx convex codegen` needs deployment creds the sandbox lacks. Run `npx convex dev` from the repo root to regenerate `convex/_generated/`, then `pnpm typecheck`."
- `plans/README.md:19` — plan 005 status: "DONE (worktree)\* — needs `npx convex dev` regen by user".
- `plans/README.md:39` — "005 → APPROVE with a required follow-up" (this item is that follow-up).
- `plans/README.md:66` — "005 (version align) is independent; run `001`'s `verify` after it to catch any codegen/type skew."
- `CLAUDE.md` (Convex tooling / MEMORY `convex-tooling-pnpm-cwd`) — use `pnpm`/`npx` not `npm`; **run the Convex CLI only from the repo root** — running it inside `convex/` wipes the dev deployment.

## Root cause

Codegen requires a live deployment connection (creds) that the isolated executor sandbox did not have. The version bump landed in source but `convex/_generated/` was left as-is. This is a one-command follow-up, not a design gap.

## What we need to do

1. Ensure the plan-005 change is present in the working tree first — it currently lives uncommitted in the worktree branch; integrating it is [[B26]]. Do B25 against the tree that actually has `convex@^1.41.0` installed.
2. From the **repo ROOT** (WARNING: never run the Convex CLI from inside `convex/` — it wipes the dev deployment), run codegen: `npx convex dev` (leave it running long enough to write `convex/_generated/`, or use `npx convex codegen` if creds are configured non-interactively). Uses `pnpm`/`npx`, never `npm`.
3. Confirm `convex/_generated/` (`api.d.ts`, `dataModel.d.ts`, `server.d.ts`, etc.) regenerated cleanly with no unexpected diff beyond what the version bump implies.
4. Run `pnpm typecheck` from the repo root to catch any type skew introduced by the `^1.41` bump against the freshly generated types.
5. If typecheck surfaces new errors, fix them minimally in the affected `convex/` or `app/` files (they would be genuine API-surface changes from the bump).

## Acceptance criteria

- [ ] `convex/_generated/` regenerated against `convex@^1.41.0`.
- [ ] `pnpm typecheck` is green from repo root.
- [ ] `pnpm verify` is green (typecheck + lint + tests) — per `plans/README.md:66`, run the full gate after the version align.
- [ ] The CWD warning (run CLI from root only) is captured wherever this is documented.
- [ ] `docs/PLATFORM.md` updated only if the bump changes documented tooling versions (see **Docs to update**).

## Risks / edge cases / open questions

- **CWD footgun (critical):** `npx convex dev`/`codegen` inside `convex/` wipes the dev deployment. Always repo root.
- **`npx convex dev` runs a watcher:** it stays foreground and connects to the dev deployment; stop it once `_generated/` is written. In a non-interactive setting prefer `npx convex codegen` if creds allow.
- **Skew surfaces late:** the whole point is that tests passed but typecheck against regenerated types is the missing gate — do not skip step 4.

## Docs to update

- `docs/PLATFORM.md §18` (Tooling) — update the pinned `convex` version if the doc records it.

## References

- Related: [[B26]] (integrate the worktree that carries plan 005), [[B24]] (prod deploy also runs `npx convex deploy` from repo root — same CWD discipline)
- Prior art / plan: `plans/README.md` (execution review §26-57; follow-up §49-51); worktree plan `005` "Align convex + vitest versions across workspaces"
