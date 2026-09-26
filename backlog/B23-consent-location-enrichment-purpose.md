# B23 — consent `location_enrichment` purpose not in validator

> **Status:** TODO (re-verified 2026-08-20) · **Priority:** P3 · **Effort:** S · **Category:** Data / Consent
> **Depends on:** — · **Blocks:** — (removes a misleading "reserved consent purpose" implication)

## Summary

The schema comment on `consentRecords` says a `'location_enrichment'` consent purpose is "reserved
for future use", but the `purpose` validator only accepts `'marketing'` and `'analytics'` — so no
`location_enrichment` record can ever be written. The comment (and a matching line in
`PLATFORM.md`) implies a consent flow that does not exist, gating an Apify profile-scrape that is
**disabled by default and is DEV/LOCAL-ONLY, not a production sub-processor**. Recommended fix:
remove the misleading comment so the schema stops implying an unimplemented, undisclosed consent
purpose. Do **not** add the purpose unless the gated feature truly ships as a production data flow —
which, per project policy, it will not.

## Evidence

- `convex/schema.ts:236-241` — the comment (`:236-238`) claims a reserved purpose the validator (`:241`) cannot express:
  ```ts
  // latest record for (userId, purpose). 'location_enrichment' is reserved for future use
  // (the Apify profile scrape is disabled at launch).
  consentRecords: defineTable({
    userId: v.id('users'),
    purpose: v.union(v.literal('marketing'), v.literal('analytics')),
  ```
  The union has no `location_enrichment` literal → such a record is unwritable.
- `convex/privacy/consent.ts:11` — the code's own type agrees: `type ConsentPurpose = 'marketing' | 'analytics'`.
  Both writers only accept those two: `recordConsent` (`consent.ts:31`,
  `v.union(v.literal('marketing'), v.literal('analytics'))`) and `completeConsentPrompt`
  (`consent.ts:86,91-94`, marketing + analytics only).
- The scrape it would gate is off by default: `appSettings.apifyProfileScrapeEnabled`
  (`convex/schema.ts:168`, "Absent ⇒ disabled (false) — opt-in (paid actor)"), behind the master
  `apifyEnabled` kill-switch (`schema.ts:166`).
- Same claim is mirrored in the docs: `docs/PLATFORM.md:511-512` — *"`'location_enrichment'` is
  reserved for a future Apify profile-scrape opt-in that is disabled at launch."*

## Root cause

During privacy Phase 1 the consent model was documented as "extensible" with `location_enrichment`
pencilled in for a future Apify profile-scrape opt-in (see
`docs/superpowers/specs/2026-06-15-privacy-compliance-design.md:94`). The purpose was written into
the **comment/docs** but never into the **validator**, and the gated feature was never enabled — so
the reservation is a dangling promise: a consent purpose the system neither accepts nor honors.

## Project policy (read before deciding)

**Apify scraping is DEV/LOCAL-ONLY and is NOT a production sub-processor** (per Henriko, 2026-06-21).
Do **not** frame Apify as a production data flow, and do **not** propose disclosing it as a
production sub-processor in any compliance document. That constraint drives the recommendation below.

## What we need to do

**Decide, then execute one path:**

- **(Recommended) Remove the misleading reservation.** Delete the `'location_enrichment' is reserved
  for future use…` sentence from the schema comment (`convex/schema.ts:237-238`) so the schema no
  longer implies an unimplemented consent purpose. Correspondingly soften/remove the matching claim
  in `docs/PLATFORM.md:511-512` so the docs don't advertise a "future Apify profile-scrape opt-in".
  Leave the validator as-is (`marketing`/`analytics` only) — it correctly reflects what the system
  honors. This is a comment/doc change, not a behavior change.
- **(Only if the feature truly ships as production) Add the purpose.** Add
  `v.literal('location_enrichment')` to the `purpose` union (`schema.ts:241`), extend
  `ConsentPurpose` (`consent.ts:11`) and both writers, build the actual consent-capture UI, and wire
  the scrape to check for a granted `location_enrichment` record before running. **Gate:** do this
  **only if** the profile-scrape becomes a real production feature **and** Apify becomes a disclosed
  production sub-processor — which, per the policy above, it currently will not. Coordinate with
  compliance first; never create a consent purpose the product cannot honor.

Under either path: never introduce a consent purpose that is captured but not enforced, or enforced
but not captured.

## Acceptance criteria

- [ ] The schema no longer implies a `location_enrichment` consent purpose that the validator cannot
      produce (comment removed), **or** the purpose is fully implemented end-to-end (validator + type
      + writers + capture UI + scrape gate) with compliance sign-off.
- [ ] `docs/PLATFORM.md:512-514` matches the chosen reality (no dangling "reserved" claim if the
      comment is removed).
- [ ] No Apify path is framed or disclosed as a production sub-processor.
- [ ] `pnpm verify` is green (typecheck + lint + tests).
- [ ] `docs/PLATFORM.md` updated (see **Docs to update**).

## Risks / edge cases / open questions

- **Compliance coupling:** editing consent-purpose text touches the privacy story. Removing the
  reservation is the safe, honest direction (it stops promising a purpose that isn't honored); adding
  the purpose without honoring it would be worse than the current state. Loop in the compliance
  owner either way.
- Stale copies of the same sentence live in plan/spec docs
  (`docs/superpowers/plans/2026-06-15-privacy-compliance-phase-1-foundations.md:121,680`,
  `docs/superpowers/specs/2026-06-15-privacy-compliance-design.md:94`). These are historical
  artifacts — not required to change, but note them so they aren't mistaken for current intent.

## Docs to update

- `docs/PLATFORM.md` §5 (Data Model → `consentRecords`, ~`:508-523` after the `5fe86b8` doc rewrite) —
  remove/soften the `location_enrichment` reservation to match the chosen path (claim now at
  `:511-512`); if the purpose is actually added, add it to the `purpose` field row and the union
  description (`:512`).
- `docs/PLATFORM.md` §13B (Privacy & Compliance → Consent & Retention) — keep the consent-purpose
  set in sync with the validator.

## References

- Related: [[B20]] (dead `by_user_and_purpose` index — same `consentRecords` doc block, and the
  same `:512` region), [[B29]]/[[B30]] (compliance sign-off / sub-processor DPAs — coordinate any
  consent-purpose change with these).
- MEMORY: "Apify dormant compliance gate" — Apify is DEV/LOCAL-ONLY, not a prod sub-processor.
- Historical: `docs/superpowers/specs/2026-06-15-privacy-compliance-design.md:94`.

## Update — 2026-08-20

Re-verified against current code after commits `8417b51` (onboarding) and `5fe86b8` (toast). **Status unchanged: TODO.** The misleading reservation is still in the schema; the validator still cannot express it.

- The `consentRecords` comment still claims `'location_enrichment' is reserved for future use (the Apify profile scrape is disabled at launch)` (`schema.ts:237-238`), while the `purpose` union is still `v.union(v.literal('marketing'), v.literal('analytics'))` (`:241`) — so a `location_enrichment` record remains unwritable.
- `5fe86b8` edited `schema.ts` but left the `consentRecords` comment and union untouched.
- Code-side agrees, unchanged: `type ConsentPurpose = 'marketing' | 'analytics'` (`consent.ts:11`); both writers accept only those two (`recordConsent` `:31`, `completeConsentPrompt` `:86,91-94`).
- Gated scrape still off-by-default: `apifyProfileScrapeEnabled` (`schema.ts:168`) behind `apifyEnabled` kill-switch (`schema.ts:166`). Project policy holds — Apify is DEV/LOCAL-ONLY, not a prod sub-processor; the recommended path stays "remove the reservation."
- Evidence lines corrected (schema.ts grew via `firstPostPromptedAt`): comment/union block `:236-240`→`:236-241` (union `:240`→`:241`, sentence `:236-237`→`:237-238`); scrape gate `:167`→`:168`, kill-switch `:165`→`:166`; PLATFORM.md `:512-514`→`:511-512`. `consent.ts` lines unchanged (file not touched by either commit).
