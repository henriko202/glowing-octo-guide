# Backlog item template

Copy this file for each finding. Keep **every heading**. Replace the parenthetical
guidance with real content. Delete a section only if it is genuinely N/A (write `— n/a`).

Rules for authoring a backlog item:

- **Verify every `path:line` against the real file** before writing it down. The audit that
  seeded these may be a line or two off — correct it. Grounded evidence only.
- **This is a PLAN, not the implementation.** Describe the change precisely (files, functions,
  schema fields, crons, env vars) so an executor with zero context can do it — but do not paste
  the full final code. A short snippet is fine when it is the clearest way to specify intent.
- **No git.** Never run `git commit`/`git push`/`git stash` or any state-changing git command.
- **Keep `docs/PLATFORM.md` in sync** is part of every item's Definition of Done (CLAUDE.md rule).
- Cross-link related items with `[[Bxx]]`.

---

# Bxx — <Title>

> **Status:** TODO · **Priority:** P0 | P1 | P2 | P3 · **Effort:** S | M | L · **Category:** <area>
> **Depends on:** <Bxx / —> · **Blocks:** <what this unblocks / —>

## Summary

(2–4 sentences: what is incomplete or wrong, and why it matters. Plain language, no jargon.)

## Evidence

(Grounded, verified against the real files. One bullet per fact.)

- `path:line` — (what is there, or what is missing)

## Root cause

(Why it is in this state: missing writer, gated flag, deferred plan, blocked by an external API,
schema/UI mismatch, etc.)

## What we need to do

(Ordered, concrete steps. Name exact files, functions, schema fields, crons, env vars. Enough for
an executor with zero context.)

1. …
2. …

## Acceptance criteria

- [ ] …
- [ ] `pnpm verify` is green (typecheck + lint + tests)
- [ ] `docs/PLATFORM.md` updated (see **Docs to update**)

## Risks / edge cases / open questions

- …

## Docs to update

- `docs/PLATFORM.md` §<n> — (what changes)

## References

- Related: [[Bxx]]
- Prior art / plan: (`docs/...` path, if any)
