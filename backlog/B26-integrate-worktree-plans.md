# B26 — Integrate the uncommitted worktree (plans 001–008)

> **Status:** TODO · **Priority:** P2 · **Effort:** S · **Category:** Ops
> **Depends on:** — · **Blocks:** [[B25]] (plan 005 codegen follow-up runs against the integrated tree)

## Summary

Seven executed improvement plans (001–008; 001 and 008 are the CI/verify gate bookends) were implemented by a dispatched executor in an **isolated git worktree and never merged into the main checkout**. The changes are uncommitted on the worktree branch; the user's main tree was left untouched. Per `CLAUDE.md`, **only Henriko commits** — no agent ever runs git. This item **describes the human review + integration checklist**; it does not, and must not, trigger any automated git command.

> **This is a manual human task for Henriko.** The doc below is a checklist and description only. Do **not** run `git` (no `merge`, `cherry-pick`, `stash`, `checkout`, `rebase`, `commit`, `push`) as part of working this item — the same rule that stranded work once before (a subagent ran `git stash`).

## Evidence

- `plans/README.md:32-34` — "Worktree (changes are UNCOMMITTED here — the user integrates): branch `worktree-agent-acf776a24fbfdd76d` at `.claude/worktrees/agent-acf776a24fbfdd76d`."
- `plans/README.md:34` — "User's main tree was untouched — `git status` in the main checkout shows only `?? plans/`."
- `plans/README.md:26-40` — Execution review (2026-06-18): all seven plans executed by a `sonnet` executor in an isolated worktree, **reviewed by the advisor** (re-ran done criteria, scope + diff + test audit); advisor made no source edits and did not commit/merge.
- `plans/README.md:35-37` — re-verified: convex tests **206/206**, app tests **141/141**; scope clean (every changed file maps to a plan); 007's four call-site rewrites are byte-for-byte request-equivalent; 002 templates placeholder-only; 003 count fixed; 006 error strings preserved.
- `plans/README.md:39-40` — Verdicts: 002, 003, 004, 006, 007, 008 → APPROVE; 005 → APPROVE with a required follow-up ([[B25]]); plan 008 greened the gate — `pnpm verify` now exits 0.
- `plans/README.md:56-57` — "Integration: review the worktree branch and commit it yourself (per CLAUDE.md, the advisor/executor never commit). The diff is one coherent set across all seven plans."
- `plans/README.md:53-54` — minor pre-integration cleanups: stray `landing/tsconfig.tsbuildinfo` (gitignore / don't commit) and a duplicate `VITE_LANDING_URL` line in `app/.env.example` (see [[B15]]).
- `CLAUDE.md` (Git section) — "NEVER commit to git… the user (Henriko) makes all commits."

## Root cause

The improvement plans were executed in a throwaway worktree by design so the advisory session could review a clean diff without touching the maintainer's tree. Integration was deliberately left to Henriko because agents are forbidden from committing. So the work is done-and-reviewed but not yet in `master`.

## What we need to do

**Henriko performs all of the following manually.** An agent may summarize the diff or re-verify evidence read-only, but must not run any state-changing git command.

1. Review the worktree branch `worktree-agent-acf776a24fbfdd76d` at `.claude/worktrees/agent-acf776a24fbfdd76d` — inspect the full diff against `master`. It is **one coherent set across all seven executed plans** (001–004, 006–008; 005 is the version-align whose codegen follow-up is [[B25]]).
2. Re-confirm the advisor's review checklist from `plans/README.md:35-40` before integrating:
   - convex tests 206/206, app tests 141/141 green; `pnpm verify` exits 0 (plan 008).
   - scope is clean — every changed file maps to a plan.
   - 007's four `callMemberApi` call-site rewrites are behavior-preserving (byte-for-byte request-equivalent).
   - 002's `.env*.example` templates are placeholder-only (no secrets).
   - 003 fixed the `PLATFORM.md` table count / §4 note.
   - 006 preserved the admin Apify sync-trigger error strings.
   - the two suppressed react-hooks smells (SettingsPage `set-state-in-effect` ×2; BillingPage `purity` on `Date.now()`) are behavior-preserving and documented (`plans/README.md:42-48`).
3. Handle the minor pre-integration cleanups (`plans/README.md:53-54`): keep `landing/tsconfig.tsbuildinfo` out of the commit (gitignore it), and tidy the duplicate `VITE_LANDING_URL` in `app/.env.example` ([[B15]]).
4. Integrate the branch into `master` and commit — **Henriko's action, via his own git workflow.** The doc does not prescribe the git mechanics; that is the maintainer's call.
5. After integration, run the plan-005 codegen follow-up ([[B25]]) against the now-integrated tree: `npx convex dev` from repo root, then `pnpm typecheck`.

## Acceptance criteria

- [ ] The worktree diff (plans 001–004, 006–008) is present in `master` (integrated by Henriko).
- [ ] `pnpm verify` is green on the integrated tree.
- [ ] Pre-integration cleanups applied (no `tsconfig.tsbuildinfo`, no duplicate `VITE_LANDING_URL`).
- [ ] [[B25]] codegen follow-up completed against the integrated tree.
- [ ] No agent ran any git command while working this item.
- [ ] `docs/PLATFORM.md` — no change required unless a plan altered documented behavior; the plans already kept it in sync (003 fixed §-count). Verify, don't re-edit.

## Risks / edge cases / open questions

- **Git is Henriko-only:** the single hard rule. A prior incident had a subagent run `git stash` and strand completed work — this item exists precisely so integration stays manual.
- **Stale worktree:** `.claude/worktrees/agent-acf776a24fbfdd76d` is a throwaway; confirm it still exists / hasn't been GC'd before relying on it. If gone, the diff must be reconstructed from the reviewed plans.
- **Coherent set:** the seven plans were reviewed as one diff; splitting them per-plan risks breaking the `pnpm verify` gate that plan 008 greened as a whole.
- **005 is the outlier:** its follow-up (codegen) is intentionally deferred to [[B25]]; don't treat missing regenerated `_generated/` as a defect in the diff.

## Docs to update

- `docs/PLATFORM.md` — n/a for the integration act itself (the plans kept it in sync). Only touch it if post-integration verification reveals drift.

## References

- Related: [[B25]] (required plan-005 codegen follow-up), [[B15]] (duplicate `VITE_LANDING_URL` cleanup), [[B32]] (PLATFORM.md doc-drift, adjacent to plan 003)
- Prior art / plan: `plans/README.md` (execution order §13-24; execution review §26-57; integration note §56-57); worktree branch `worktree-agent-acf776a24fbfdd76d`
