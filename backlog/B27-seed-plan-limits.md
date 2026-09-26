# B27 — Run (or automate) `seedPlanLimits` in each environment

> **Status:** TODO · **Priority:** P2 · **Effort:** S · **Category:** Ops
> **Depends on:** — · **Blocks:** admin "update tier default" flow in any un-seeded environment

## Summary

`planLimits` tier-default rows are populated by a **manual one-time seed mutation** (`seedPlanLimits`) that must be run once per environment. Runtime plan-limit lookups tolerate the rows being absent via hardcoded fallbacks, so the app doesn't crash unseeded — **but the admin "update tier default" mutation throws** `No default row found for tier — run seedPlanLimits first` until the seed has run. This needs to be part of the deploy checklist (dev + prod), or the seed should be made lazy.

## Evidence

- `convex/migrations/seedPlanLimits.ts:3-8` — header comment: "One-time seed mutation to populate the default planLimits rows for each tier. Run once via the Convex dashboard or CLI: `npx convex run migrations/seedPlanLimits:seedPlanLimits --prod`"; the `internalMutation` export starts at line 8. Safe to re-run — skips any tier that already has a default row (`convex/migrations/seedPlanLimits.ts:26-38`).
- `convex/lib/planLimits.ts:18-23` — hardcoded `DEFAULTS` record (`starter`/`growth`/`pro`/`contact`) used as the safety net.
- `convex/lib/planLimits.ts:83-84` — "Safety-net fallback." → `return DEFAULTS[tier]` when the DB row is missing, so reads never fail unseeded.
- `convex/admin.ts:269` — `export const updateTierDefault = mutation({ … })`.
- `convex/admin.ts:287-288` — `if (!defaultRow) { throw new Error('No default row found for tier — run seedPlanLimits first') }` — the admin write path hard-fails until seeded.

## Root cause

The seed was written as a deliberate one-time manual step (dashboard/CLI), not wired into deploy or a lazy-init. Reads were given hardcoded fallbacks so the product works pre-seed, which masks the gap — but the admin default-editing mutation has no fallback: it patches an existing default row, so it must exist first.

## What we need to do

Pick one of two approaches (A is the minimal, ship-it path; B removes the manual step entirely).

**A. Add to the deploy checklist (recommended, minimal).**
1. In each environment, from the **repo ROOT** (never inside `convex/` — it wipes the deployment), run: `npx convex run migrations/seedPlanLimits:seedPlanLimits` (append `--prod` for the prod deployment). Idempotent — safe to re-run.
2. Add this as an explicit step in [[B24]] Phase D (dev already-seeded check + prod seed on first deploy), so no environment reaches an admin who hits the throw.
3. Verify: open the admin plan-limits screen and change a tier default — it should patch, not throw.

**B. Auto-seed (removes the manual step).**
1. Make the default guaranteed to exist before `updateTierDefault` patches it — e.g. on first admin access, upsert the tier default from `DEFAULTS` (reuse `convex/lib/planLimits.ts` `DEFAULTS` as the single source so seed and fallback can't diverge), or have `updateTierDefault` insert-then-patch when `defaultRow` is missing instead of throwing.
2. Keep it idempotent (only insert when no default row / `userId === undefined` exists for the tier), mirroring the current seed's skip logic (`seedPlanLimits.ts:26-30`).
3. This retires the manual seed as a deploy prerequisite; keep `seedPlanLimits` around for explicit re-seeding.

Decision note: A is one command per environment and is enough for launch; B is a small change that removes a footgun for future environments/previews. Default to A now, do B if new environments (preview deploys) get spun up often.

## Acceptance criteria

- [ ] Every live environment (dev + prod) has `planLimits` tier-default rows for `starter`/`growth`/`pro`/`contact`.
- [ ] Admin "update tier default" patches successfully (no `No default row found` throw).
- [ ] If approach A: the seed command is an explicit item in the [[B24]] deploy checklist.
- [ ] If approach B: `updateTierDefault` (or an init) no longer throws on an un-seeded tier; idempotency preserved; `DEFAULTS` remains the single source shared with the read fallback.
- [ ] `pnpm verify` is green (only relevant if B changes code).
- [ ] `docs/PLATFORM.md` updated (see **Docs to update**).

## Risks / edge cases / open questions

- **CWD footgun:** `npx convex run …` must be from repo root.
- **Divergence risk:** the seed values (`seedPlanLimits.ts:16-19`) and the read fallback (`planLimits.ts:18-23`) are two copies of the same numbers — they currently match; if B is chosen, collapse to one source so they can't drift.
- **`contact` tier nuance:** `contact` has both a tier-default row and optional per-user override rows (`planLimits.ts:38-67`); the seed inserts only the default (no `userId`) — auto-seed logic must keep that distinction.
- **Idempotency:** re-running the seed is safe (skips existing defaults); don't add a variant that duplicates rows.

## Docs to update

- `docs/PLATFORM.md` — the section covering plan limits / admin tier defaults: document that tier defaults are seeded via `seedPlanLimits` (approach A) or auto-initialized (approach B), and add the seed step to the deploy runbook alongside [[B24]].

## References

- Related: [[B24]] (deploy checklist that should include the prod seed run)
- Prior art / plan: `convex/migrations/seedPlanLimits.ts`, `convex/lib/planLimits.ts`, `convex/admin.ts` (`updateTierDefault`)
