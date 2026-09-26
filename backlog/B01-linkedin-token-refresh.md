# B01 — LinkedIn token refresh — never implemented

> **Status:** TODO · **Priority:** P0 · **Effort:** M · **Category:** Auth/Cron
> **Depends on:** — · **Blocks:** reliable post sync + submit after a member's LinkedIn access token expires (~60 days); silent loss of all LinkedIn-dependent features per user until they manually sign in again

## Summary

LinkedIn access tokens are stored on login and expire (LinkedIn's `expires_in`, typically ~60 days). Nothing ever refreshes them. The daily retention cron actively **NULLs** an expired token, and once null every LinkedIn-dependent action fails: `submitPost` throws "No LinkedIn access token. Please sign in again." and the Apify/member-API paths have no token to use. There is no refresh action, no refresh cron, and — critically — the app's current OAuth scope/tier almost certainly never receives a `refresh_token` in the first place, so a naive refresh flow would be dead code. This item must both add the refresh path **and** design the realistic fallback (proactive reconnect) for the no-refresh-token case.

## Evidence

- `convex/linkedin/auth.ts:44` — on existing-user login, `linkedinAccessToken: args.accessToken` is patched; `:45` patches `linkedinRefreshToken: args.refreshToken`; `:46` patches `tokenExpiresAt: args.tokenExpiresAt`.
- `convex/linkedin/auth.ts:63-64` — on new-user insert, same three fields are written (`linkedinAccessToken`, `linkedinRefreshToken`, `tokenExpiresAt`). `refreshToken` is `v.optional` (`:82`) and the interface comment `:25` notes "LinkedIn standard OAuth may omit refresh_token".
- `convex/http.ts:80` — `tokenExpiresAt = Date.now() + tokens.expires_in * 1000`; `:91-93` pass `accessToken`, `refreshToken: tokens.refresh_token`, `tokenExpiresAt` into `upsertUser`. `tokens.refresh_token` comes straight from LinkedIn's token response.
- `convex/linkedin/oauth.ts:8` — `const SCOPES = ['openid', 'profile', 'email']` — **OpenID Connect / "Sign In with LinkedIn" (Standard tier) only**. The file comment `:4-7` explains write scopes were deliberately dropped. This scope set does **not** grant offline access, so LinkedIn does not return a `refresh_token`.
- `convex/linkedin/oauth.ts:23-46` — `exchangeCodeForTokens` uses `grant_type=authorization_code`. There is **no** `grant_type=refresh_token` flow anywhere in the file (or the codebase).
- `convex/linkedin/types.ts:5` — `LinkedInTokenResponse.refresh_token?` is optional with comment "Only returned for some LinkedIn app configs (MDP / enterprise)". (Was `:17-21`; the file was trimmed by `8417b51`.)
- `convex/schema.ts:35-37` — `linkedinAccessToken`, `linkedinRefreshToken`, `tokenExpiresAt` are all `v.optional`. `:81` — index `by_token_expiry` on `['tokenExpiresAt']`.
- `convex/privacy/retention.ts:16-18` — `isTokenExpired` predicate. `:52-62` — the retention mutation reads expired-token users via `by_token_expiry` (`gte(1).lt(now)`) and **patches the token to `undefined`** (`linkedinAccessToken: undefined`, `linkedinRefreshToken: undefined`, `tokenExpiresAt: undefined`). It clears — it never refreshes.
- `convex/posts.ts:148-150` — `submitPost` throws `'No LinkedIn access token. Please sign in again.'` (at `:149`) when `!user?.linkedinAccessToken`. (Was `:142-144`; shifted by `8417b51`.)
- `convex/crons.ts:12-32` — **6** crons registered (sync posts, process queue, cleanup sessions, cleanup oauth states, process account deletions, enforce data retention). **None** refresh tokens.

## Root cause

Two compounding gaps:

1. **No refresh flow was ever written** — OAuth only implements the authorization-code exchange (`oauth.ts`). No cron watches `tokenExpiresAt`; the only cron that touches expiry (`retention.ts`) deletes the token.
2. **The current scope/tier likely never yields a `refresh_token`.** The app uses OIDC Standard-tier scopes (`openid profile email`). LinkedIn issues refresh tokens only to apps with programmatic/partner access (the `types.ts:19` "MDP / enterprise" note). So `tokens.refresh_token` is `undefined` for essentially every user, and `linkedinRefreshToken` is stored as `undefined`. A refresh action alone would have nothing to refresh — the design must center on the fallback.

## What we need to do

1. **Confirm the ground truth first** (do this before writing the refresh action): inspect a real LinkedIn token response in dev. If `refresh_token` is absent for the `openid profile email` scope set, the refresh action is a best-effort path only and the **reconnect banner is the primary mitigation**. Document the finding inline.
2. **Add a refresh action** in `convex/linkedin/oauth.ts` — `refreshAccessToken(refreshToken: string): Promise<LinkedInTokenResponse>` — POST to `https://www.linkedin.com/oauth/v2/accessToken` with `grant_type=refresh_token`, `refresh_token`, `client_id`, `client_secret`. Mirror `exchangeCodeForTokens`' error handling (log real error, throw sanitized). Reuse `LinkedInTokenResponse`.
3. **Add an internal mutation** (e.g. `convex/linkedin/auth.ts` → `updateTokens`) that patches `linkedinAccessToken` / `linkedinRefreshToken` / `tokenExpiresAt` for a user id. Keep the same "isAdmin intentionally excluded" discipline as `upsertUserHandler`.
4. **Add a refresh cron** in `convex/crons.ts` (the only file Convex reads for crons — see its `:2-3` header) → new internal action `refreshExpiringTokens`. Query users whose token is set and nearing expiry via the existing `by_token_expiry` index: `q.gte('tokenExpiresAt', now).lt('tokenExpiresAt', now + 7*24*60*60*1000)` **and** `linkedinRefreshToken !== undefined`. For each, call `refreshAccessToken` → `updateTokens`. Batch (reuse the `RETENTION_BATCH = 100` self-reschedule pattern from `retention.ts:129-132`). Run it **more often than daily** (e.g. every 6–12h) so a token is refreshed before the daily retention cron at its 24h cadence can null it.
5. **Coordinate with the retention cron.** `retention.ts:52-62` nulls any token already past expiry. The refresh cron must act on the pre-expiry window so a still-refreshable token is renewed before retention sees it as expired. Do **not** make retention itself attempt refresh (keep retention purely a minimization/cleanup job); document the ordering.
6. **Primary mitigation — proactive reconnect.** Add a "your LinkedIn connection expires in N days — reconnect" banner in the app when `tokenExpiresAt` is within, say, 7 days (and always when null). The existing OAuth entry point (`http.ts:14` `/auth/linkedin`) already re-runs the full login and re-stores a fresh token via `upsertUser`, so "reconnect" = re-run login. Surface `tokenExpiresAt` through an existing `getMe`-style query for the client to read.
7. **Graceful degradation.** Keep the `submitPost` error (`posts.ts:149`) but make the reconnect banner the thing users see first, so expiry is never a surprise mid-action.

## Acceptance criteria

- [ ] A `grant_type=refresh_token` action exists and, when a `refresh_token` is present, produces a new access token + expiry and persists them.
- [ ] A cron refreshes tokens in the pre-expiry window and cannot be beaten to the punch by the retention cron for a refreshable token.
- [ ] When no `refresh_token` exists (the expected common case), the user sees a reconnect prompt before expiry, and post-expiry actions fail with a clear "reconnect LinkedIn" message rather than a raw error.
- [ ] The refresh path never logs the token value (see [[B05]] PII scrubbing).
- [ ] `pnpm verify` is green (typecheck + lint + tests).
- [ ] `docs/PLATFORM.md` updated (see **Docs to update**).

## Risks / edge cases / open questions

- **Open question (blocking design):** does the `openid profile email` Standard-tier flow ever return a `refresh_token`? If never, item collapses to steps 6–7 plus a dormant refresh action. Verify before building the cron.
- LinkedIn refresh tokens (where they exist) themselves expire (~1 year) — a refresh can fail with `invalid_grant`; treat that identically to "no refresh token" (fall back to reconnect), don't crash the cron batch.
- Refresh cron must isolate per-user failures (one 400 from LinkedIn must not abort the whole batch).
- Pre-launch / no prod data ([[B03]] note): no existing tokens to migrate; dev deployment can be wiped. This is about correctness before real users, not a backfill.
- Interaction with [[B05]]: token-refresh failures are exactly the kind of silent error that error monitoring should surface.

## Docs to update

- `docs/PLATFORM.md` §7 (Authentication & Identity) — document the token lifecycle: issue → refresh window → reconnect fallback.
- `docs/PLATFORM.md` §13 (Scheduled Jobs / Crons) — add the new refresh cron (cadence, index used, batch/reschedule behavior) and note its ordering relative to `enforce data retention`.
- `docs/PLATFORM.md` §16 (Environment Variables) — none new expected (reuses `LINKEDIN_CLIENT_ID/SECRET`); confirm and note.

## References

- Related: [[B05]] (error monitoring should catch refresh failures)
- Prior art / plan: `convex/linkedin/oauth.ts` (`exchangeCodeForTokens` is the template for the refresh call); `convex/privacy/retention.ts` (batch self-reschedule pattern)
- Memory: `linkedin-api-access-constraints` (LinkedIn tier constraints — Standard tier, no elevated scopes)

## Update — 2026-08-20

Re-verified against commits `8417b51` (onboarding rewrite) and `5fe86b8` (toast). **Status unchanged: TODO** — no token-refresh flow was added; both commits are orthogonal to refresh. Current ground truth confirmed:

- **Scopes still `['openid', 'profile', 'email']`** (`convex/linkedin/oauth.ts:8`) → OIDC Standard tier, **no `offline_access`**, so LinkedIn returns **no `refresh_token`**. `linkedinRefreshToken` is stored as `undefined` for every user — the blocking open question in step 1 is effectively answered: **no refresh token is issued at this tier**, so the reconnect banner (steps 6-7) is the real mitigation and any refresh action is best-effort/dormant.
- **No `grant_type=refresh_token` anywhere.** `oauth.ts` still implements only `exchangeCodeForTokens` (`oauth.ts:23-46`). No refresh action, no refresh cron.
- **Retention cron still NULLs expired tokens** (`convex/privacy/retention.ts:52-62`, batch reschedule `:129-132`); `convex/crons.ts:12-32` still registers **6 crons, none refresh**.

Evidence line corrections (files touched by `8417b51`):
- `convex/http.ts` — `tokenExpiresAt` at **:80**, tokens passed to `upsertUser` at **:91-93** — both **unchanged** despite the rewrite (a comment block was inserted at `:82-85`).
- `convex/posts.ts:142-144` → **`:148-150`** (throw now at `:149`).
- `convex/linkedin/types.ts:17-21` → **`:5`** (file trimmed; `refresh_token?` still optional there).
- `convex/schema.ts` — token fields still **:35-37**; `by_token_expiry` index **:80 → :81**.
- `convex/linkedin/auth.ts` **unchanged** (not in either commit): patch fields `:44-46`, insert fields `:63-65`, `refreshToken` optional `:82`, interface comment `:25`.

**Remains to do:** the entire item is still open — refresh action + refresh cron are absent, and the primary mitigation (proactive reconnect banner, steps 6-7) is unbuilt. This is unblocked and actionable now.
