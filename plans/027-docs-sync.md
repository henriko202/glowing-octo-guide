# Plan 027: Reconcile `docs/PLATFORM.md` and the compliance docs with the fixed code

> **Executor instructions**: Run this plan LAST, after 009-026 have landed or have been explicitly
> skipped. It corrects documented facts that this review found wrong or incomplete. Follow each step
> and verification. Update this plan's row in `plans/README.md` when done.
> **Repo rule (`CLAUDE.md`/`AGENTS.md`): NEVER commit or push.**
>
> **Drift check (run first)**:
> `git status --porcelain -- docs/PLATFORM.md docs/compliance/DATA-INVENTORY.md`
> Then check the specific lines quoted below; earlier plans may have updated some of them. Fix only
> what is still stale at execution time; record what was already correct.

## Status

- **Priority**: P3
- **Effort**: S-M
- **Risk**: LOW (documentation only)
- **Depends on**: 009-026 (this plan reflects their final state)
- **Category**: docs
- **Planned at**: working tree at commit `ced69ac`, 2026-09-10

## Why this matters

`docs/PLATFORM.md` is canonical (AGENTS.md rule), but the audit found security-relevant facts that
drift from the code. A wrong TTL, a wrong rate-limit inventory, and a false "unspoofable" claim make
the document actively misleading for review and incident response. This plan is the final sync pass.

## Current state (each item was verified against code on 2026-09-10)

1. **Session TTL contradiction.** `docs/PLATFORM.md:5518` says "**30-day TTL**" in §17, while `:844`
   (§7) and `convex/sessions.ts:16` say 15 days (`SESSION_TTL_MS = 15 * 24 * 60 * 60 * 1000`).
2. **§16 consumer cells.** `:5474` says `VITE_CONVEX_SITE` is consumed in `App.tsx`; the only read is
   `app/src/lib/session.ts:3`. `:5412-5413` omits `convex/jobs/refreshFeedEngagement.ts:58-59` for the
   Apify vars. `:5410` omits the direct `STRIPE_SECRET_KEY` read in `convex/privacy/deletion.ts:216`.
3. **§9 weekly-count claim.** `:2357` says `postsPerWeek` is "counted via `by_author_and_publishedAt`".
   Before plan 015 the pill/pre-check used `by_author`; if 015 landed, the claim is now true. Verify.
4. **§11 refresh claim.** `:3540` says the 30-minute refresh "does **not** re-evaluate
   `interactionLimitReached` from external engagement", but `convex/jobs/syncPosts.ts:179-196`
   explicitly does (and always did, per the implementation).
5. **§17 Sentry claim.** The doc says `sendDefaultPii:false`; the code sets
   `dataCollection: {}` (`app/src/lib/observability/sentry.ts:46-51`). After plan 009, add the URL
   fragment stripping and `beforeSendTransaction` behavior.
6. **§17 redaction claim.** "the backend log redactor (`scrubError`) runs everywhere regardless" was
   false at `linkedin/client.ts:26`, `lib/apify.ts:67`, `lib/email.ts:34`, `http.ts:56`. Plan 013
   fixed those; if 013 landed, the claim is true (and the wired-at list should name the new sites).
7. **§17 rate-limit inventory.** `:5545-5547` lists engagement limits only. Plan 014 adds billing and
   deletion limits; reflect them if 014 landed.
8. **§6 type-shim list.** `:819-824` lists `lib/audit.ts` and the two Apify jobs; `linkedin/auth.ts:2`
   also uses the seam. Plan 022 may have fixed this; verify.
9. **Table counts.** Plans 018 (`trialCounters`) and 020 (`survivalSnapshots`) add tables. Wherever the
   doc states a table count (for example §2 "16 tables" and the §5 ER text), recount from
   `convex/schema.ts` and update.
10. **Compliance doc claim.** `docs/compliance/DATA-INVENTORY.md:246` describes the `sessions.token`
    as "hashed"; the code stores and looks up the raw opaque token (`convex/sessions.ts:33-35`,
    `convex/lib/auth.ts:29-33`). Fix the sentence to "opaque random token (not derived from user
    data)" or, if the team prefers hashing at rest, that is a separate security change, not this plan.

## Commands you will need

| Purpose         | Command                                   | Expected     |
|-----------------|-------------------------------------------|--------------|
| Table count     | `grep -c "defineTable(" convex/schema.ts` | exact number |
| Doc consistency | manual grep of each fact                  | matches code |
| Format check    | `pnpm format:check`                       | exit 0       |

## Scope

**In scope**: `docs/PLATFORM.md`, `docs/compliance/DATA-INVENTORY.md` (one sentence), plus any other
doc sentence that one of the ten items makes stale (grep the changed facts: `30-day`, `sendDefaultPii`,
`by_author_and_publishedAt`, `16 tables`, `scrubError`). **Out of scope**: code changes (if a fact is still wrong
because its plan did not land, record that in
the plan row and leave the doc untouched for that item), README.md (PLATFORM.md is canonical), and
compliance documents other than the one sentence.

## Git workflow

- Branch: `advisor/027-docs-sync`. Do NOT commit or push.

## Steps

1. Fix item 1 in §17 to "15-day sliding TTL (`SESSION_TTL_MS`)" and cross-reference §7.
2. Fix item 2's three consumer cells.
3. Verify item 3 against `convex/posts.ts` (`countRecentPosts`, `getWeeklyUsage`, `getMyPosts`): if
   plan 015 landed, leave the text; if not, change it to name the actual indexes and note the
   discrepancy is planned.
4. Fix item 4 to state that the 30-minute refresh DOES re-evaluate the cap and can drop a post from
   the feed (matching `applyEngagementCounts`).
5. Update item 5's wording to the actual Sentry `dataCollection` option plus (if 009 landed) the
   pre-bundle fragment scrub and transaction scrubbing.
6. For item 6, if 013 landed, keep the sentence and extend the wired-at list with the four sites.
7. For item 7, if 014 landed, add the billing/deletion caps to the §17 list.
8. For item 8, add `linkedin/auth.ts` if absent.
9. For item 9, recount tables and update every stated count and the ER description.
10. Fix item 10's sentence in `DATA-INVENTORY.md`.
11. Final sweep: `grep -n "30-day\|sendDefaultPii\|by_author\b\|16 tables" docs/PLATFORM.md` and
    confirm each remaining match is correct.

**Verify**: `pnpm format:check` exits 0; `pnpm verify` exits 0 (docs do not affect it, but the repo
gate is the standard).

## Done criteria (ALL must hold)

- [ ] Every one of the ten items is either fixed or explicitly recorded as pending because its source
  plan did not land
- [ ] Table count matches `grep -c "defineTable(" convex/schema.ts`
- [ ] No doc sentence still claims a fact contradicted by the current code (spot-check the ten)
- [ ] `docs/compliance/DATA-INVENTORY.md` no longer says the session token is hashed
- [ ] No code files changed
- [ ] `plans/README.md` row updated

## STOP conditions

- A cited line no longer exists or has already been corrected: record "already correct" and move on.
- A fix would require choosing between contradicting doc sections (for example §7 and §17 both
  claim different TTLs and only one matches code): the code wins; if both are wrong, STOP and report.
- You are tempted to change code to match the doc: do not. This plan is docs-only.

## Maintenance notes

- §21's table maps code areas to sections; this plan's fixes stay within those mappings.
- Reviewer: diff the ten items against the plan rows of 009-026; anything left stale should say which
  plan owns it.
