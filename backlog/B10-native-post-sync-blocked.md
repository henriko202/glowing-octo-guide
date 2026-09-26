# B10 — Native LinkedIn post sync — blocked (dead placeholder removed)

> **Status:** BLOCKED · **Priority:** P3 · **Effort:** M · **Category:** LinkedIn
> **Depends on:** LinkedIn MDP / Partner API approval (`r_member_social`) · **Blocks:** first-party
> (non-Apify) post sync

> **Updated 2026-08-20:** the unwired placeholder `fetchUserPosts` (+ `convex/linkedin/posts.ts`,
> `posts.test.ts`) was **deleted** per [[B12]]'s trim decision — so the "keep it as a resumable
> placeholder" recommendation below is **superseded**. The feature stays **BLOCKED**; if `r_member_social`
> ever lands, native sync must be **re-implemented from scratch** (Apify remains the sole shipped path).
> The evidence line-refs below point at the now-deleted file.

## Summary

There is a native LinkedIn post-fetch function (`fetchUserPosts`) that would sync a user's posts via
the official UGC Posts API, but it has **no caller** and would return `null` (403) for everyone
because the required `r_member_social` scope needs LinkedIn Marketing Developer Platform (MDP)
approval — and the Community Management API Standard tier was **DENIED**. The cron path delegates
exclusively to the Apify scraper instead. So this is documented dead code, blocked on external
access, kept as a placeholder for the day partner access lands.

## Evidence

- `convex/linkedin/posts.ts:36-50` — `fetchUserPosts(accessToken, linkedinPersonId)` does
  `GET /v2/ugcPosts?q=authors&authors=List(...)` via `callMemberApi` with `soft: [403]`, and
  `return null` on 403 (line 47). The comment (lines 32-35) states `r_member_social` requires MDP
  approval and "post syncing will be a no-op for all users" until then.
- `grep fetchUserPosts convex/` — the function is defined at `convex/linkedin/posts.ts:36` and has
  **no other reference** anywhere. It is never imported or scheduled.
- `convex/jobs/syncPosts.ts:122-134` — `syncAllPosts` (the cron fan-out) checks the Apify
  kill-switch and, when enabled, delegates **only** to
  `internal.jobs.syncPostsApify.syncAllPostsViaApify` (line 130). There is no native-API branch.
- `convex/linkedin/oauth.ts:8` — the OAuth scopes are `['openid', 'profile', 'email']` only; the
  comment (lines 4-7) documents that write/member scopes are deliberately excluded. So
  `r_member_social` is not requested and Step-A calls 403.

## Root cause

`fetchUserPosts` was written for a first-party sync that depends on `r_member_social` (MDP-gated).
Access was denied, so the compliant shipped path is the Apify scraper
(`convex/jobs/syncPostsApify.ts`). The native function was left in place, unwired, rather than being
deleted.

## What we need to do

**BLOCKED** — do not start until LinkedIn MDP / Partner approval grants `r_member_social`.

**When access is granted:**

1. Add `r_member_social` to the OAuth `SCOPES` in `convex/linkedin/oauth.ts:8` (coordinate with
   [[B11]] and [[B12]] — same scope list; adding a scope changes the consent screen and can break
   login for users without an app role, per the comment at oauth.ts:4-7).
2. Wire `fetchUserPosts` into the sync fan-out as an alternative to Apify: add a native branch in
   `convex/jobs/syncPosts.ts:122-134` (e.g. an app-setting toggle Apify-vs-native, or native-first
   with Apify fallback), fetch each active subscriber's posts, and map `ParsedPost`
   (`convex/linkedin/posts.ts:5-12`) into `upsertPost` args (`convex/jobs/syncPosts.ts:14-32`).
3. Reuse the existing `upsertPost` dedup (`by_urn`), weekly-limit + queue logic, and feed-field
   computation — do not duplicate them.
4. Handle token expiry/refresh (native sync needs a live token per user — see the token-refresh
   backlog item) and the `soft: [403]` no-op for users who haven't re-consented to the new scope.

**Interim decision (while blocked):** keep `fetchUserPosts` as documented dead code (cheap
placeholder, already commented) **vs.** delete it to shrink the LinkedIn surface and reduce the
maintenance/attack area. Recommendation: keep it (it's small, self-documenting, and directly
resumable) but add a `ponytail:`-style note that it is intentionally unwired pending MDP; revisit if
the LinkedIn client is refactored.

## Acceptance criteria

*(apply only once unblocked)*

- [ ] `r_member_social` requested; native sync fetches + upserts real posts for a consented user.
- [ ] Native path reuses `upsertPost` (dedup, weekly limit, queue, feed fields) — no duplication.
- [ ] Apify and native paths cannot double-insert the same URN (shared `by_urn` dedup verified).
- [ ] `pnpm verify` is green (typecheck + lint + tests)
- [ ] `docs/PLATFORM.md` updated (see **Docs to update**)

## Risks / edge cases / open questions

- **External blocker**: no work is possible until MDP/Partner approval; track only.
- **Double sync**: running Apify + native together risks duplicate work; the `by_urn` dedup protects
  correctness but wastes API calls — pick one primary path.
- **Token lifetime**: native sync needs valid per-user access tokens; without refresh, tokens die and
  native sync silently stops (couples to the token-refresh item).
- **Interim churn**: if the LinkedIn client module is refactored before access lands, the dead
  function is maintenance overhead — the keep-vs-delete call should be revisited then.

## Docs to update

- `docs/PLATFORM.md` §11 (LinkedIn integration / access constraints) — currently documents the
  embed + handoff compliant path; note native sync remains blocked/unwired, and describe the wiring
  if/when it ships.

## References

- Related: [[B11]] (UGC ownership verification — same `r_member_social` blocker), [[B12]] (vestigial
  member-API scopes/client — decide keep-vs-trim together)
- Prior art / plan: memory `linkedin-api-access-constraints.md`

## Update — 2026-08-20

Re-verified against `8417b51`. **Status unchanged: BLOCKED** — but the cleanup half is now genuinely **done**.

- **Confirmed deleted by `8417b51`:** `convex/linkedin/posts.ts` (including `fetchUserPosts`) and `convex/linkedin/posts.test.ts`. `grep fetchUserPosts` across the repo → **zero references**. The dead placeholder is gone; all Evidence bullets above that cite `convex/linkedin/posts.ts:*` now point at deleted code.
- **Native sync still blocked / unwired.** `convex/jobs/syncPosts.ts:122-134` still delegates **only** to `syncAllPostsViaApify` (line 130) — no native branch. OAuth scopes unchanged at `['openid', 'profile', 'email']` (`convex/linkedin/oauth.ts:8`); `r_member_social` is not requested and `grep r_member_social convex/` → zero references.
- The "Interim decision (keep vs delete)" is **resolved: deleted** (trim direction, coordinated with [[B12]]). The "keep it as a resumable placeholder" recommendation is superseded.

**Remains to do (still BLOCKED on external approval):** if LinkedIn ever grants `r_member_social`, native sync must be **re-implemented from scratch** — the "When access is granted" steps now describe a fresh build, not a re-wire, because the placeholder no longer exists. Apify remains the sole shipped path.
