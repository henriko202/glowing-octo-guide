# B11 — Post-ownership is self-attested (vanity heuristic) — harden the trust boundary

> **Status:** ✅ DONE (2026-08-20) · **Priority:** P3 · **Effort:** S · **Category:** LinkedIn / Security
> **Depends on:** — · **Blocks:** —

> **✅ Resolved 2026-08-20:** the self-attested-ownership concern is closed. Post ownership now anchors on the
> member's LinkedIn **name** — their OIDC `name` claim from login, which is **not editable in-app** — matched
> (case-/accent-insensitively) against the post page's JSON-LD `author.name` (parsed by `parsePostAuthor`). Both
> values come from LinkedIn, so a user can no longer set a settings field to impersonate someone else. The vanity
> (`linkedinPublicIdentifier`) is now **auto-derived (set-once)** from a name-verified post's `author.url` via the
> internal `users.setDerivedPublicIdentifier`; the editable Settings input + Save and the first-login
> `PublicIdentifierPromptScreen` onboarding prompt were **removed**, so there is no longer any user-typed identity to
> self-attest. The old vanity heuristic survives only as a **fallback** when the post page carries no author block
> (not attacker-triggerable — a submitter can't make LinkedIn omit the author). No LinkedIn API call is made. See
> `docs/PLATFORM.md` §11. The open acceptance-criteria items and "What we need to do" below are **superseded**; the
> body is retained as historical context.

> **Updated 2026-08-20:** the dead **Step A** (UGC-API ownership check needing `r_member_social`) was
> **removed** — `verifyPostOwnership` is now the local vanity-name heuristic **by design**, not a
> fallback waiting on MDP approval. That closes the dead-code half of this item and un-blocks it. What
> **remains open** is the security half below: post ownership is **self-attested**, and deleting Step A
> did **not** change that (Step A never actually ran). This is actionable now with no external blocker.
> The "When access is granted" steps below are **superseded** — re-adding API verification would be a
> fresh implementation, not a re-wire.

## Summary

When a user submits a post URL, the app tries to prove they own it. Step A (the authoritative UGC
Posts API check) always fails with 403/404 because the app lacks the `r_member_social` scope
(MDP-gated, denied), so verification **always** falls back to Step B: a self-attested heuristic that
compares the URL's vanity name against the user's stored LinkedIn public identifier. This is a trust
boundary — ownership is effectively self-asserted — and it stays that way until partner access
lands.

## Evidence

- `convex/linkedin/oauth.ts:8` — OAuth `SCOPES = ['openid', 'profile', 'email']`; the comment
  (lines 4-7) documents that member/write scopes are deliberately excluded. So `r_member_social` is
  not granted.
- `convex/linkedin/verifyPostOwnership.ts:40-94` — Step A (lines 41-68) does a raw
  `fetch('https://api.linkedin.com/v2/ugcPosts/{urn}')` and only confirms ownership when
  `ugcPost.author === "urn:li:person:{linkedinId}"`. On 403/404 (line 70) it enters Step B
  (lines 71-93): **no API call**, it compares `storedPublicIdentifier.toLowerCase()` against the
  URL's `vanityName.toLowerCase()` (line 85) and returns `strategy: 'vanity-heuristic'` (line 92).
- `convex/linkedin/verifyPostOwnership.ts:16-23` — the docstring states Step A "Requires
  `r_member_social` scope (LinkedIn MDP approval)" and Step B is the fallback because "standard OAuth
  apps cannot access any LinkedIn profile-identity endpoint with non-partner scopes."

## Root cause

The authoritative ownership check needs `r_member_social`, which is MDP-gated and denied. Step A is
therefore permanently a 403/404, so every submission is verified by the self-attested vanity-name
heuristic — the app never actually confirms with LinkedIn that the poster owns the post.

## What we need to do

**BLOCKED** — do not start until LinkedIn MDP / Partner approval grants `r_member_social`.

**When access is granted:**

1. Add `r_member_social` to `convex/linkedin/oauth.ts:8` (shared scope list — coordinate with
   [[B10]] and [[B12]]; adding a scope changes the consent screen).
2. Step A (`convex/linkedin/verifyPostOwnership.ts:41-68`) then succeeds for consented users and
   returns `strategy: 'ugc-api'` with real content/`publishedAt` — no code change needed there
   beyond ensuring the token carries the scope; keep Step B as the fallback for users who haven't
   re-consented.
3. Verify the submit path (`convex/posts.ts`) records which strategy verified each post, so
   API-verified vs heuristic-verified posts are distinguishable.

**SECURITY NOTE (applies now, while blocked):** ownership is currently **self-attested**. A user who
sets their LinkedIn profile URL (hence `storedPublicIdentifier`) to a vanity name matching a target
post's URL, and submits a `/in/{vanity}/...`-style URL, passes Step B without LinkedIn ever
confirming authorship. The only gates are: the user must have set a public identifier
(`verifyPostOwnership.ts:79-84`), and the URL must use a `vanityName`-bearing format
(`verifyPostOwnership.ts:76-78`). Document this residual abuse risk explicitly and consider interim
anti-abuse mitigations that do **not** need the blocked scope:

- Rate-limit / cap submissions per user (leverage existing `rateLimits` infra).
- Require the stored public identifier to be confirmed once (it comes from OIDC profile data at
  sign-in, not free-text) and disallow editing it to arbitrary values.
- Log heuristic-verified submissions for admin review; flag mismatches between the post author's
  display name and the submitter.

## Acceptance criteria

*(security note is actionable now; the rest applies once unblocked)*

- [ ] The self-attested trust boundary is documented (docs + code comment) with its abuse scenario.
- [ ] Interim anti-abuse mitigation is decided (implement or explicitly accept the risk pre-launch).
- [ ] *(unblocked)* `r_member_social` requested; Step A returns `strategy: 'ugc-api'` for consented
      users; Step B remains the fallback.
- [ ] `pnpm verify` is green (typecheck + lint + tests)
- [ ] `docs/PLATFORM.md` updated (see **Docs to update**)

## Risks / edge cases / open questions

- **External blocker** for the real fix; the security documentation + interim mitigation are the only
  parts actionable now.
- **Impersonation**: a determined user can claim someone else's post via the vanity heuristic — how
  severe is this pre-launch (no prod data yet) vs at launch? Decide the acceptable risk.
- **Format 2 URLs** (`vanityName === null`, `verifyPostOwnership.ts:76-78`) are rejected outright —
  confirm that's intended and doesn't push users toward the weaker path.

## Docs to update

- `docs/PLATFORM.md` §11 — document that post-ownership verification is self-attested
  (vanity-heuristic) while `r_member_social` is unavailable, the residual abuse risk, and any interim
  mitigation; note the API-verified path resumes when access is granted.

## References

- Related: [[B10]] (native sync — same scope blocker), [[B12]] (member-API scopes/client cleanup)
- Prior art / plan: memory `linkedin-api-access-constraints.md`

## Update — 2026-08-20

Re-verified **honestly** against `8417b51` (which rewrote the ownership model). **Status confirmed: ✅ DONE** for the original concern — with one narrower residual, tracked below as still-open.

**What actually changed (`8417b51`) — "name-anchored, vanity auto-derived":**

- **New primary check.** `convex/linkedin/verifyPostOwnership.ts` was rewritten (Step A / UGC-API path **removed entirely**). The post page's JSON-LD `author.name` (`parsePostAuthor`, `convex/linkedin/parsePostContent.ts:198-208`) must match the member's OIDC `name` via `sameName()` — case/accent-insensitive, whitespace-collapsed (`verifyPostOwnership.ts:16-19`; match + throw at `:46-51`). The member's `name` is the OIDC claim written at login and is **not editable in-app** (`updateProfile` accepts only industry/country/headline — `convex/users.ts:127-144`; there is no mutation to change `name` or the identifier).
- **Fallback narrowed & de-fanged.** The vanity heuristic (`verifyPostOwnership.ts:53-63`) runs **only** when the page carried no author block — not attacker-triggerable (a submitter can't make LinkedIn omit the author). It also **cannot bootstrap a fresh identity**: with no stored identifier it throws (`:57-59`), so a first-ever submission must pass the name check.
- **Self-entered identifier step gone.** `PublicIdentifierPromptScreen.tsx` and `app/src/lib/linkedinProfile.ts` were **deleted**; onboarding now uses `FirstPostPromptScreen.tsx`, which asks only for a post URL. The editable Settings input + Save were removed — `linkedinPublicIdentifier` is now **read-only** in `SettingsPage.tsx` (used only to enable the refresh button, `:212`).
- **Vanity auto-derived, set-once** from a name-verified post's `author.url` via `internal.users.setDerivedPublicIdentifier` (`convex/users.ts:254-270`), called from `submitPost` (`convex/posts.ts:209-224`). LinkedIn-authoritative, never user-typed.

**Verdict:** the original hole — ownership self-attested through a **user-editable settings field** — is genuinely closed. Both sides of the check are LinkedIn-sourced; neither is controllable via app state. DONE is defensible, not a rubber-stamp.

**Residual (new, narrower — recommend tracking as a separate low-priority follow-up, actionable now):** `sameName` matches on **display name only**, and LinkedIn display names are **not unique**. A member could still claim a *different* person's post when they share the same display name (e.g. two "John Smith"s), and matching is case/accent-insensitive. This is far smaller than the original vector (requires an exact display-name collision **and** the target post to carry that author block), and is low-severity pre-launch, but it is not zero. If it needs hardening: the submit rate-limit already caps abuse volume (`posts.ts:161-167`, 10/hr), and recording the verifying `strategy` (`author-name` vs `vanity-heuristic`) per post would let admins flag suspicious claims.

**Evidence corrections:** the Evidence bullets above cite the pre-rewrite Step A/Step B structure (`verifyPostOwnership.ts:40-94`, `:16-23`, `:76-85`, `:92`) — all **obsolete** (file rewritten to 65 lines, no API call, no `r_member_social` reference). Current anchors: `sameName` `:16-19`, primary match `:46-51`, fallback `:53-63`.
