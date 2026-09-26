# B22 — Finalize deprecated feedback response columns (backfill + narrow)

> **Status:** TODO (re-verified 2026-08-20) · **Priority:** P3 · **Effort:** M · **Category:** Data / Migration
> **Depends on:** — · **Blocks:** — (closes out the Task-10 feedback-replies migration)

## Summary

The `feedback` table still carries three columns — `responseText`, `respondedAt`, `respondedBy` —
explicitly marked **DEPRECATED**, superseded by the `feedbackResponses` table (each admin reply is
now its own row). No production code reads or writes them anymore. They were left as `v.optional`
to avoid an immediate schema-narrowing migration. This item performs the **final narrow step** of the
widen → migrate → narrow pattern: run the one-time backfill (a no-op pre-launch), verify parity, then
remove the three columns **and the now-orphaned backfill function**.

## Evidence

- `convex/schema.ts:293-298` — the deprecation is in the schema itself (comment `:293-295`, fields `:296-298`):
  ```ts
  // DEPRECATED — superseded by feedbackResponses table (Task 10).
  // Retained as v.optional to avoid a schema-narrowing migration on existing rows.
  // Stop writing these fields; read feedbackResponses instead.
  responseText: v.optional(v.string()),
  respondedAt: v.optional(v.number()),
  respondedBy: v.optional(v.id('users'))
  ```
- **No live writer of the columns.** `respondToFeedback` (`convex/feedback/feedback.ts:113-150`)
  takes a mutation **arg** coincidentally named `responseText` (`:117`) and inserts it into
  `feedbackResponses` (`:128-133`), then patches only `status` on the feedback row (`:136`). The UI
  passes that arg — `app/src/components/RespondFeedbackModal.tsx:45`
  (`await respond({ …, responseText: trimmed, sendEmail })`) — so the arg name is not the column.
- **No live reader of the columns.** `listFeedback` (`convex/feedback/feedback.ts:74-111`) and
  `reopenFeedback` (`:170-190`) read from `feedbackResponses` (`withIndex('by_feedback', …)`), never
  the legacy fields. The DSR export gathers replies from `feedbackResponses` too
  (`convex/privacy/export.ts:79-87`); it returns whole feedback docs (`export.ts:96`) so the columns
  ride along as pass-through only, never functionally read.
- **The one-time migration exists and is manual.** `backfillFeedbackResponses`
  (`convex/feedback/feedback.ts:232-254`) is an `internalMutation` (not cron-scheduled) that, for
  each feedback row still holding both `responseText` and `respondedBy` (`:239`), inserts a
  `feedbackResponses` row (`:240-245`) and clears the legacy fields for idempotency (`:248-250`).
- The `feedbackResponses` table + its comment referencing the legacy trio is at
  `convex/schema.ts:306-311` (comment `:303-305`); `docs/PLATFORM.md:1465` already notes the columns
  are "no longer written; superseded by `feedbackResponses`".

## Root cause

Task 10 replaced the single inline reply (`responseText`/`respondedAt`/`respondedBy`) with an
append-only `feedbackResponses` table. To avoid narrowing the schema against existing rows, the trio
was kept `v.optional` and a manual backfill was written but deliberately **not run on a schedule** —
the operator was to run it once, then drop the columns later. "Later" is now.

## What we need to do

Follow the widen → migrate → **narrow** pattern (this item is the final narrow). See the
`convex-migration-helper` skill and `convex/_generated/ai/guidelines.md` §"Schema guidelines".

1. **Migrate.** Run the backfill once, from the **repo root** (never from inside `convex/` — that
   wipes the deployment; see MEMORY convex-tooling), against the target deployment:
   ```
   npx convex run feedback/feedback:backfillFeedbackResponses
   ```
   It processes up to 200 rows (`feedback.ts:236`); if the table is larger, re-run until it reports
   nothing left to migrate (each run clears the legacy fields it copies, so it self-drains).
2. **Verify parity.** Confirm no feedback row still has `responseText`/`respondedBy` set (i.e. every
   legacy reply now has a matching `feedbackResponses` row). Pre-launch there is **no prod data**, so
   this backfill is almost certainly a **no-op** — the app has never written those columns since
   `feedbackResponses` shipped. Verify the no-op (dashboard data view or a quick count), then proceed;
   don't skip the check just because it's expected to be empty.
3. **Narrow.** Remove the three columns from `convex/schema.ts:296-298` (delete the DEPRECATED comment
   block `:293-295` too).
4. **Remove the orphaned migration.** After narrowing, `backfillFeedbackResponses` will **not
   typecheck** — it reads `f.responseText`, `f.respondedBy`, `f.respondedAt` (`feedback.ts:239-250`),
   which no longer exist on the row type. Delete `backfillFeedbackResponses`
   (`convex/feedback/feedback.ts:232-254`) in the **same change** as the schema narrow. Also drop the
   parenthetical "(responseText/respondedAt/respondedBy)" mention in the `feedbackResponses` schema
   comment (`schema.ts:304`) so nothing points at removed fields.
5. **Confirm no other reference survives** before deleting (removing a column is a schema change):
   ```
   rg "responseText|respondedAt|respondedBy" convex app
   ```
   Expect the only remaining hits to be the mutation **arg** `responseText`
   (`feedback.ts:117,120,123` + `RespondFeedbackModal.tsx:45`) — leave those, they are the
   `feedbackResponses.text` input, not the columns. `convex/privacy/export.test.ts:74,78` builds a
   synthetic object with `responseText` and asserts pass-through of a pure builder — narrowing the
   schema does not change that pure function, so the test still passes; confirm it does.
6. No prod data ⇒ no rollback plan needed beyond the standard; if dev is in a bad state a hard reset
   is acceptable.

## Acceptance criteria

- [ ] `backfillFeedbackResponses` has been run once (or confirmed a no-op) and parity verified — no
      feedback row retains legacy reply fields.
- [ ] `convex/schema.ts` `feedback` table no longer declares `responseText`/`respondedAt`/`respondedBy`.
- [ ] `backfillFeedbackResponses` is deleted and no code references the removed fields
      (`rg` clean except the mutation arg named `responseText`).
- [ ] `pnpm verify` is green (typecheck + lint + tests) — including `export.test.ts`.
- [ ] `docs/PLATFORM.md` updated (see **Docs to update**).

## Risks / edge cases / open questions

- **Ordering trap:** narrow the schema and delete `backfillFeedbackResponses` **together**. Narrowing
  alone breaks typecheck because the backfill still references the dropped fields.
- The mutation **arg** `responseText` shares the deprecated column's name — do not delete or rename it;
  it feeds `feedbackResponses.text`. This is the single most likely mistaken edit.
- Backfill is bounded to 200 rows per invocation (`feedback.ts:236`); on a populated deployment it
  must be re-run until drained. Pre-launch this is moot, but the check in step 2 still applies.

## Docs to update

- `docs/PLATFORM.md` §5 (Data Model → Table reference, `feedback` at `:1463-1465`; field rows at
  `:571-573`) — remove the deprecated columns from the field list and drop the "no longer written"
  note once the columns are gone.
- `docs/PLATFORM.md` §12A (Feedback) — ensure the replies model reads as `feedbackResponses`-only,
  with no lingering mention of the inline reply fields.

## References

- Related: [[B20]] (dead `feedback.by_status` index — same table hygiene), [[B21]]
  (written-never-read columns — sibling cleanup).
- Pattern: `convex-migration-helper` skill (widen → migrate → narrow); `@convex-dev/migrations`;
  `convex/_generated/ai/guidelines.md` §"Schema guidelines" (adding/removing columns, batching a
  backfill across transactions with `ctx.scheduler.runAfter`).

## Update — 2026-08-20

Re-verified against current code after commits `8417b51` (onboarding) and `5fe86b8` (toast). **Status unchanged: TODO.** Deprecated columns still present; the orphaned backfill still exists.

- The three DEPRECATED columns are still declared `v.optional` (`schema.ts:296-298`, comment `:293-295`).
- `backfillFeedbackResponses` still exists and still references the doomed fields (`feedback.ts:232-254`; reads `f.responseText`/`f.respondedBy` at `:239`, `f.respondedAt` at `:244`; clears them at `:248-250`) — it will not typecheck once the columns are narrowed, so delete it in the same change.
- No live reader/writer of the columns: `respondToFeedback` (`feedback.ts:113-150`) still inserts into `feedbackResponses` and takes the coincidentally-named arg `responseText` (`:117`); `listFeedback`/`reopenFeedback`/`export.ts` read `feedbackResponses` only.
- `5fe86b8` touched `export.ts` (feedbackResponses gather now `:79-87`, returns whole docs `:96`) but did **not** change the pass-through behavior. `export.test.ts:74,78` still asserts pure builder pass-through — lines still exact.
- Evidence lines corrected (schema.ts grew via `firstPostPromptedAt`): deprecation block `:292-297`→`:293-298`; `feedbackResponses` table `:302-310`→`:306-311` (comment `:303-305`, parenthetical mention `:303`→`:304`); backfill clear lines `:247-251`→`:248-250`; PLATFORM.md `:1461`→`:1465`.
