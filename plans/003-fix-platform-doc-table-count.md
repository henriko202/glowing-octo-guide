# Plan 003: `PLATFORM.md` reports the correct table count (16)

> **Executor instructions**: Follow step by step; confirm each verification. Honor STOP conditions.
> Update this plan's row in `plans/README.md` when done.
> **Repo rule (`CLAUDE.md`): NEVER commit or push.**
>
> **Drift check (run first)**: `git diff --stat 90a90ad..HEAD -- convex/schema.ts docs/PLATFORM.md`
> If either changed since `90a90ad`, re-count tables in `convex/schema.ts` yourself and reconcile
> before editing (the count below may have moved).

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: docs
- **Planned at**: commit `90a90ad`, 2026-06-18

## Why this matters

`docs/PLATFORM.md` is the canonical, maintained reference (`CLAUDE.md` treats keeping it accurate as
part of "done"). It currently undercounts the schema: it says "15 tables" / "13-table" while
`convex/schema.ts` defines **16**. A wrong count in the canonical doc erodes trust in the rest of it.

## Current state

- `convex/schema.ts` defines exactly **16** tables (one `defineTable(...)` each):
  `users, posts, subscriptions, featuredPostUsage, appSettings, sessions, rateLimits, oauthStates,
planLimits, postQueue, consentRecords, dataExportRequests, auditLogs, feedback, feedbackResponses,
motds`.
  (Quick check: `grep -c 'defineTable' convex/schema.ts` returns 17 — that counts the `import {
defineSchema, defineTable }` line too, so subtract 1 → **16 tables**.)
- `docs/PLATFORM.md` stale claims:
    - line ~115 (architecture Mermaid): `DB[("Convex DB<br/>15 tables")]`
    - line ~198 (repo layout): `│   ├── schema.ts                # 13-table database schema`
    - line ~240 (§5 intro): `There are **15 tables**.`

## Commands you will need

| Purpose             | Command                                           | Expected                                  |
|---------------------|---------------------------------------------------|-------------------------------------------|
| Count tables        | `grep -c 'defineTable' convex/schema.ts`          | `17` (→ 16 tables, minus the import line) |
| Find the doc claims | `grep -nE '15 tables\|13-table' docs/PLATFORM.md` | the 3 lines above                         |

## Scope

**In scope**: `docs/PLATFORM.md` only (the three numeric claims).
**Out of scope**: `convex/schema.ts` (the code is correct; only the doc is wrong); any other PLATFORM.md
content; README.

## Git workflow

- Branch: `advisor/003-platform-table-count`. Do NOT commit/push.

## Steps

### Step 1: Re-count to be certain

Run `grep -c 'defineTable' convex/schema.ts`. Subtract 1 (the import line). Confirm the result is 16.
**STOP** if it is not 16 — the schema changed since this plan; report the new count and the table list
(`grep -nE '^\s*[a-zA-Z]+: defineTable' convex/schema.ts`) instead of editing blindly.

### Step 2: Update the three claims in `docs/PLATFORM.md`

- Mermaid node: `Convex DB<br/>15 tables` → `Convex DB<br/>16 tables`
- Repo layout: `# 13-table database schema` → `# 16-table database schema`
- §5 intro: `There are **15 tables**.` → `There are **16 tables**.`

**Verify**: `grep -nE '15 tables|13-table' docs/PLATFORM.md` returns nothing;
`grep -c '16 tables\|16-table' docs/PLATFORM.md` ≥ 2.

## Test plan

None (docs only). Verification is the grep results above.

## Done criteria (ALL must hold)

- [ ] `grep -nE '15 tables|13-table' docs/PLATFORM.md` returns no matches
- [ ] The three locations now say 16
- [ ] Only `docs/PLATFORM.md` changed (`git status`)
- [ ] No commit was made
- [ ] `plans/README.md` row for 003 updated

## STOP conditions

- The schema table count is not 16 (step 1) → report the real count; do not edit.

## Maintenance notes

- This is the kind of drift `CLAUDE.md` asks to prevent: whoever adds/removes a `defineTable` should
  update §5 (and the two other spots) in the same change.
