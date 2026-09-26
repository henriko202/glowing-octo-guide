# B12 — Vestigial LinkedIn write scopes & `callMemberApi`

> **Status:** ✅ DONE (2026-08-20) · **Priority:** P3 · **Effort:** S · **Category:** LinkedIn / Cleanup
> **Depends on:** — · **Blocks:** —

> **Resolved 2026-08-20 (trim direction chosen).** Deleted the dead `fetchUserPosts` along with its
> whole file (`convex/linkedin/posts.ts` + `posts.test.ts`) and the now-orphaned UGC/profile/connection
> response interfaces in `convex/linkedin/types.ts`. **Kept** `callMemberApi` + `client.ts` +
> `client.test.ts` — they are **not** vestigial: the live `/v2/userinfo` sign-in lookup
> (`convex/linkedin/oauth.ts:51`) is their one real caller, and it was preserved. Write scopes were
> already trimmed to `openid profile email`; no stale doc implies otherwise. This supersedes [[B10]]'s
> "keep the placeholder" option — the placeholder is gone.

## Summary

**Evidence correction (verified 2026-08-20):** the seed premise — that the OAuth flow still *requests*
`w_member_social` / `w_member_social_feed` — is **stale**. The current code already requests only
`['openid', 'profile', 'email']`; the write scopes have been removed and the removal is documented
in-code. So the "trim the write scopes" ask is effectively **already done**. What remains vestigial
is the LinkedIn **member-API client** (`callMemberApi`) plus the unwired `fetchUserPosts`: the client
exists to make authenticated member-API calls, but its only live use is the OIDC `/v2/userinfo`
lookup; the one write/read-social path it enables (post fetch) is dead ([[B10]]). Comment/react are a
clipboard + permalink handoff **by design** — nothing posts via the member API.

## Evidence

- `convex/linkedin/oauth.ts:8` — `const SCOPES = ['openid', 'profile', 'email'].join(' ')`. **No**
  `w_member_social` / `w_member_social_feed` / `r_basicprofile`.
- `convex/linkedin/oauth.ts:4-7` — comment: *"OpenID Connect only … No w_member_social*/
  r_basicprofile: the app makes no LinkedIn API writes (react/comment happen on LinkedIn via the
  handoff …), and those scopes would throw unauthorized_scope_error for any user without a role on
  the app — i.e. break login for everyone but the team."* → the least-privilege consent screen this
  item asked for is already in place.
- `convex/linkedin/client.ts:8-28` — `callMemberApi` is the single seam for authenticated member-API
  calls (`api.linkedin.com`, Bearer = user token), with a `soft` status list (e.g. 403 → `null`).
- `grep callMemberApi convex/` — live callers: `convex/linkedin/oauth.ts:51` (`GET /v2/userinfo`,
  the OIDC profile lookup) and `convex/linkedin/posts.ts:38` (the always-403 `fetchUserPosts` — dead,
  no caller; see [[B10]]). Plus `convex/linkedin/client.test.ts`. So the only **live** use is
  `/v2/userinfo`.
- `convex/interactions.ts:183-276` — `commentOnPost` (183-228) and `reactToPost` (230-276) are the
  engagement actions; the comments (lines 183-186, 230-232) state the comment/reaction happen on
  LinkedIn via a clipboard/permalink handoff because "LinkedIn exposes no member API for
  commenting/reacting on another member's post" — counted optimistically on tap. No member-API write
  anywhere.

## Root cause

The write scopes were already trimmed to least privilege (documented at `oauth.ts:4-7`). The
remaining vestigial surface is the member-API client kept for two callers — one legitimate
(`/v2/userinfo`) and one dead (`fetchUserPosts`, blocked on `r_member_social`). Because `callMemberApi`
still has a live use, it can't simply be deleted; the decision is about the dead post-fetch path and
whether to keep the general client shape for future partner access.

## What we need to do

**BLOCKED** (the "keep for future partner access" option depends on MDP approval landing). The
cleanup/decision itself can proceed now.

1. **Record the correction**: the write scopes are gone; do **not** re-add them. Any doc/comment that
   still implies write scopes are requested is stale.
2. **Decide the member-API surface:**
   - **Keep** `callMemberApi` + `fetchUserPosts` as documented placeholders for future partner
     access (they're small and self-documenting) — *or* —
   - **Trim to least surface**: delete `fetchUserPosts` (`convex/linkedin/posts.ts:36-50`, no caller)
     and inline the one remaining `/v2/userinfo` call, retiring `callMemberApi` +
     `convex/linkedin/client.ts` + `client.test.ts`. This shrinks the LinkedIn attack/maintenance
     surface. Coordinate with [[B10]] (which wants to *wire* `fetchUserPosts` when unblocked) — pick
     one direction so the two items don't conflict.
3. **Document** that the app performs **no** LinkedIn member-API writes (comment/react are a handoff),
   and that `callMemberApi`'s only live use is the OIDC profile lookup.

## Acceptance criteria

- [ ] No stale doc/comment implies the app requests `w_member_social*` scopes.
- [ ] A keep-vs-trim decision is recorded for `callMemberApi` + `fetchUserPosts`, consistent with
      [[B10]]'s direction.
- [ ] If trimmed: `fetchUserPosts` (and, if retired, `callMemberApi`/`client.ts`/`client.test.ts`)
      removed with `/v2/userinfo` still working; if kept: a `ponytail:`-style note marks them
      intentionally unwired pending MDP.
- [ ] `pnpm verify` is green (typecheck + lint + tests)
- [ ] `docs/PLATFORM.md` updated (see **Docs to update**)

## Risks / edge cases / open questions

- **Conflict with [[B10]]**: B10 wants to *use* `fetchUserPosts` when access is granted; this item
  considers *deleting* it. Resolve the direction first — if partner access is likely soon, keep;
  if not, trim.
- **Least privilege is a trust/review signal**: fewer scopes on the consent screen helps LinkedIn app
  review and user trust/privacy — the current 3-scope set is already the good state; the risk is a
  future change silently re-adding write scopes.
- **Don't break `/v2/userinfo`**: it's the OIDC profile lookup used at sign-in
  (`convex/linkedin/oauth.ts:50-56`); any client refactor must preserve it.

## Docs to update

- `docs/PLATFORM.md` §11 — confirm the OAuth scope set is `openid/profile/email` only, that the app
  makes no member-API writes (comment/react handoff), and the disposition of the member-API client.

## References

- Related: [[B10]] (wire vs delete `fetchUserPosts`), [[B11]] (ownership verification — same
  `r_member_social` blocker)
- Prior art / plan: memory `linkedin-api-access-constraints.md`; `convex/linkedin/oauth.ts:4-7`
  (in-code rationale for the trimmed scopes)

## Update — 2026-08-20

Re-verified against `8417b51`. **Status confirmed: ✅ DONE.** The trim direction was executed by `8417b51`:

- **Deleted:** `convex/linkedin/posts.ts` (`fetchUserPosts`) + `convex/linkedin/posts.test.ts`. `grep fetchUserPosts` → **zero references**.
- **Kept — and correctly, not vestigial:** `callMemberApi` + `client.ts` + `client.test.ts`. `grep callMemberApi convex/` confirms its **only live caller is now `convex/linkedin/oauth.ts:51`** (the `/v2/userinfo` OIDC sign-in lookup). The former second caller `posts.ts:38` is gone — so the Evidence bullet listing *two* live callers is now **one** (`oauth.ts:51`).
- **`convex/linkedin/types.ts` was trimmed, not deleted** — the orphaned UGC/profile/connection interfaces were removed (≈48 lines), leaving only `LinkedInTokenResponse` + `LinkedInUserInfo`, both still imported by `oauth.ts`/`http.ts`.
- **Write scopes still absent:** `SCOPES = ['openid', 'profile', 'email']` (`oauth.ts:8`); `grep r_member_social convex/` → **zero references** (the docstrings that mentioned it lived in the now-deleted `posts.ts` and the rewritten `verifyPostOwnership.ts`). No member-API writes exist — comment/react stay a clipboard + permalink handoff (`convex/interactions.ts`, `commentOnPost` ≈`:187-228`, `reactToPost` ≈`:233-276`; that file was rewritten by `5fe86b8` but the handoff/"counted optimistically" design is unchanged).

**Remains to do:** nothing for this item. (Cross-ref: [[B10]] stays BLOCKED — if `r_member_social` ever lands, native post-fetch is a fresh build, since the placeholder was deleted here rather than kept.)
