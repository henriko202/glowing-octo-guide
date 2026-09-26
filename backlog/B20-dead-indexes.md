# B20 — Remove or justify dead indexes

> **Status:** TODO (re-verified 2026-08-20) · **Priority:** P3 · **Effort:** S · **Category:** Data cleanup
> **Depends on:** — · **Blocks:** — (unblocks nothing; pure hygiene — reduces write amplification)

## Summary

Three declared indexes have **zero `withIndex()` callers** in application code. Every index adds
write cost on every insert/patch to its table (Convex maintains the index on each write), so an
unused index is pure overhead with no read benefit. Two are self-labeled "reserved for a future
feature" that was never built; one is genuinely redundant because the logic it would serve is done
in memory instead. Pre-launch with **no production data**, so dropping any of them is a cheap, safe
schema change (no backfill, dev is disposable).

## Evidence

- `convex/schema.ts:247` — `consentRecords` declares `.index('by_user_and_purpose', ['userId', 'purpose'])`.
- `convex/privacy/consent.ts:59-63` — the only consent read path queries `by_user` and folds the
  latest-per-purpose in memory, **not** `by_user_and_purpose`:
  ```ts
  const records = await ctx.db
    .query('consentRecords')
    .withIndex('by_user', q => q.eq('userId', user._id))
    .collect()
  return latestConsentByPurpose(records)
  ```
  `latestConsentByPurpose` (`consent.ts:15-26`) is a pure reducer over all of the user's rows. No
  code calls `withIndex('by_user_and_purpose')`. (A stale reference exists only in the plan doc
  `docs/superpowers/plans/2026-06-15-privacy-compliance-phase-3a-consent-retention-backend.md:176`,
  never shipped.)
- `convex/schema.ts:301` — `feedback` declares
  `.index('by_status', ['status', 'createdAt']), // reserved for future server-side status triage`.
  No `withIndex('by_status')` caller reads the **feedback** table. `listFeedback`
  (`convex/feedback/feedback.ts:74`) uses `.order('desc').take(500)` (a plain scan), not this index.
- `convex/schema.ts:341` — `userInteractions` declares
  `.index('by_post', ['postId']), // admin: who engaged with a post`. No `withIndex('by_post')`
  caller anywhere; the "who engaged with a post" admin view is not built.
- **Do NOT confuse** the feedback `by_status` with `dataExportRequests.by_status`
  (`convex/schema.ts:260`) — that one **is** live: `convex/privacy/retention.ts:67` does
  `.withIndex('by_status', q => q.eq('status', 'ready'))`. Same index name, different table; leave
  the `dataExportRequests` one alone.
- Doc drift to fix alongside: `docs/PLATFORM.md:511` and `:523` claim consent is *"Queried via
  `by_user_and_purpose` index"* — false; see `consent.ts:59-63` above.

## Root cause

Indexes were declared speculatively when their tables were designed (privacy Phase 1, feedback
form), ahead of the read paths that would use them. The consent read path was later implemented with
an in-memory latest-per-purpose reducer, making its compound index redundant. The feedback-triage
and admin-engagement views were never built, so their indexes never gained a caller.

## What we need to do

1. Confirm zero callers for each name (grep is the source of truth). For each of
   `by_user_and_purpose`, `feedback`'s `by_status`, `by_post`:
   ```
   rg "withIndex\('<name>'" convex/
   ```
   Expect no hits (remember `by_status` will hit `retention.ts` — that is the **dataExportRequests**
   index, not feedback's; verify the file/table before treating a hit as a caller).
2. **`consentRecords.by_user_and_purpose` → remove.** Delete the `.index('by_user_and_purpose', …)`
   line at `convex/schema.ts:247`. The logic does not need it. If you would rather switch consent to
   an indexed newest-first lookup instead of the in-memory reducer, that is a separate optimization —
   don't keep a dead index waiting for it.
3. **`userInteractions.by_post` → remove.** Delete `convex/schema.ts:341`. The admin "who engaged
   with a post" view has no backlog item and no code; re-add the index in the same change that builds
   that view if/when it lands.
4. **`feedback.by_status` → decide.** It already carries a self-documenting comment. Either:
   - **(recommended)** remove `convex/schema.ts:301`'s index (keep the plain `.order('desc').take()`
     scan `listFeedback` already uses; feedback volume is tiny), re-adding it with the triage
     feature; or
   - keep it and leave the comment as the pointer. Do not leave it half-documented.
5. Update `docs/PLATFORM.md` for every index removed (the "Table reference" §5 lists each table's
   indexes: `consentRecords` at `:523`, `feedback` at `:1465`, `userInteractions` — re-locate its
   index list, ~`:625` shifted by the `5fe86b8` doc rewrite). Also correct the false "Queried via
   `by_user_and_purpose`" claim at `:511` to describe the actual `by_user` + in-memory-latest path.
6. Since **no prod data** exists, no migration/backfill is needed — removing an index is a plain
   schema edit; a `pnpm convex dev` / next deploy rebuilds. If the dev deployment complains, a hard
   reset of dev is acceptable (see MEMORY: pre-launch, no prod data).

## Acceptance criteria

- [ ] `rg "withIndex\('by_user_and_purpose'\|withIndex\('by_post'"` returns no hits in `convex/`.
- [ ] Removed indexes are gone from `convex/schema.ts`; `dataExportRequests.by_status` is untouched
      and `retention.ts:67` still resolves.
- [ ] `feedback.by_status` decision recorded (removed, or kept with the pointer comment).
- [ ] `pnpm verify` is green (typecheck + lint + tests).
- [ ] `docs/PLATFORM.md` updated (see **Docs to update**), including the corrected consent-query claim.

## Risks / edge cases / open questions

- Removing an index **is a schema change** — the only real risk is a missed caller. The grep in
  step 1 is the gate; do not skip it.
- Two indexes are named `by_status` on different tables — the destructive mistake here is deleting
  the wrong one. Always check the enclosing `defineTable`.
- If the feedback-triage or admin-engagement features are imminent, the cheaper call may be to keep
  those two indexes with their comments rather than churn the schema twice. This is a judgement call,
  not a correctness issue.

## Docs to update

- `docs/PLATFORM.md` §5 (Data Model → Table reference) — drop each removed index from the
  `consentRecords` / `feedback` / `userInteractions` index lists.
- `docs/PLATFORM.md` §5 `:511` — replace "Queried via `by_user_and_purpose` index" with the real
  `by_user` + `latestConsentByPurpose` in-memory path.

## References

- Related: [[B21]] (written-never-read columns — sibling data-hygiene cleanup),
  [[B22]] (feedback deprecated columns — same table area), [[B23]] (consent purpose union — same
  `consentRecords` doc block and the same `:512` drift), [[B32]] (PLATFORM doc-drift fixes).
- Convex guideline: `convex/_generated/ai/guidelines.md` §"Query guidelines" — indexes serve
  `.withIndex()` reads; an index with no such caller only adds write cost.

## Update — 2026-08-20

Re-verified against current code after commits `8417b51` (onboarding) and `5fe86b8` (toast). **Status unchanged: TODO.** All three indexes still declared and still caller-free.

- `rg "withIndex\('by_user_and_purpose'|withIndex\('by_post'|withIndex\('by_status'"` over `convex/` returns **only** `privacy/retention.ts:67` (`by_status` on `dataExportRequests`, still live). Zero callers for `consentRecords.by_user_and_purpose`, `feedback.by_status`, `userInteractions.by_post`.
- Consent read path unchanged: `getConsents` still uses `by_user` + `latestConsentByPurpose` in-memory reducer (`consent.ts:59-63`, reducer `:15-26`). `consent.ts` was not touched by either commit — its lines are exact.
- Schema line numbers shifted (onboarding commit added `firstPostPromptedAt`): `by_user_and_purpose` `:246`→`:247`; feedback `by_status` `:300`→`:301`; `by_post` `:340`→`:341`; live `dataExportRequests.by_status` `:259`→`:260`.
- PLATFORM.md doc-drift lines moved in the `5fe86b8` rewrite: false "Queried via `by_user_and_purpose`" claim `:512`→`:511`; consentRecords index list `:524`→`:523`; feedback `:1461`→`:1465`.
