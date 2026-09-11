# Plan 028: PKCE-style verifier binding so the session token never travels in a URL

> **Execution note (2026-09-10):** Implemented in the working tree; verified by the PKCE challenge/redeem path
> (`convex/lib/pkce.ts`, `sessions.redeemAuthCode`), no `#session=` in `convex/http.ts`/`app/index.html`, `authCodes` in
> the erasure cascade + cleanup cron, and the two CSP script hashes in `app/dist/_headers`. The maintainer completed a
> real login on 2026-09-10, so the manual check passed (suites: convex 607 / app 479 / landing 24 / integration 6).

> **Executor instructions**: This is an auth-flow change. Follow step by step, run every verification,
> and honor STOP conditions. Update this plan's row in `plans/README.md` when done.
> **Repo rule (`CLAUDE.md`/`AGENTS.md`): NEVER commit or push.** Keep `docs/PLATFORM.md` in sync.
>
> **Drift check (run first)**:
>
`git status --porcelain -- convex/http.ts convex/sessions.ts convex/schema.ts convex/crons.ts convex/privacy/deletion.ts app/index.html app/src/App.tsx app/src/lib/session.ts app/src/components/ReconnectBanner.tsx landing/lib/links.ts landing/lib/trial.ts docs/PLATFORM.md`
> Compare the excerpts below to the live files. On a mismatch, STOP.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED-HIGH. This replaces the session-token handoff. A wrong step locks every user out of
  login. The nonce-cookie and state protections stay; only the token delivery changes.
- **Depends on**: none (builds on the 2026-09-10 review fixes)
- **Category**: security
- **Planned at**: working tree after the 2026-09-10 review fixes (baseline `f4a6832` + uncommitted work)

## Why this matters

The OAuth callback delivers the 15-day session token to the browser in the redirect fragment (`convex/http.ts`), because
the token is a bearer credential the SPA stores in `sessionStorage`. The
fragment is not logged, but it is transferable: an attacker can complete their own login, copy their
token, and send a logged-out victim `https://www.app.linkintothessi.com/auth/success#session=<attacker token>`.
The victim is then signed into the attacker's account and everything they type lands there. The
nonce cookie stops callback replay, the route guard stops non-`/auth/success` fragments, and the
no-overwrite rule protects already-signed-in victims, but none of those bind the token itself to the
browser that initiated the flow.

This plan removes the session token from every URL. The callback delivers a single-use, 2-minute
`authCode` instead, and the SPA redeems that code for a session token by presenting a secret verifier
that only the initiating browser holds (PKCE, RFC 7636 shape). A handed-over code is useless.

## Design (load-bearing decisions)

1. **Verifier and challenge.** At login start, the app generates a 32-byte random verifier (base64url, 43 chars) and
   stores it in `sessionStorage.oauthVerifier`. It computes
   `SHA-256(verifier)` base64url and sends it as `?vc=<challenge>` on the `/auth/linkedin` URL.
   The server stores the challenge, never the verifier.
2. **Code, not token.** After the callback validates `state` + the browser nonce cookie exactly as
   today, it mints `code = crypto.randomUUID()`, inserts an `authCodes` row bound to the challenge
   and user, and redirects to `${APP_URL}/auth/success#code=<code>` (plus `plan`/`interval` when
   chosen). No session row is created here.
3. **Redeem.** The SPA calls a new public mutation `sessions.redeemAuthCode({ code, verifier })`.
   The server finds the code row, rejects if expired, hashes the presented verifier, and compares to
   the stored challenge. On match it deletes the code row (single-use), creates the session, and
   returns `{ sessionToken }` over the Convex transport. On mismatch it deletes the row and throws
   `ConvexError('Login could not be verified. Please try again.')`.
4. **Entry points.** Every login starts at the app route `/auth/start`, which generates the
   verifier/challenge and redirects to Convex. `RequireAuth` and `ReconnectBanner` navigate there;
   the landing's `SIGN_IN_URL` points at `${NEXT_PUBLIC_APP_URL}/auth/start` with its existing
   `plan`/`interval`/`ref` query params. A direct hit on Convex `/auth/linkedin` without a valid
   `vc` is rejected with a 400.
5. **Hashing.** Use the Web Crypto API (`crypto.subtle.digest('SHA-256', ...)`) in `convex/lib/pkce.ts`
   and in the app. If `crypto.subtle` proves unavailable in the Convex runtime (the integration test
   below proves it), STOP rather than hand-rolling SHA-256.
6. **Deploy safety.** `oauthStates.challenge` is `v.optional(v.string())` so existing ephemeral rows
   do not fail the schema push; the callback treats a missing challenge as invalid. `authCodes` is a
   new table. Old in-flight logins (10-minute states) fail once and retry cleanly. No data migration.

## Current state (excerpts)

`convex/http.ts` start route generates `state` + `browserNonce`, stores the state, sets the nonce
cookie, and redirects to LinkedIn. The callback validates state + nonce, exchanges the code, upserts
the user, then (`~line 150`):

```ts
const sessionToken = crypto.randomUUID()
await ctx.runMutation(internal.sessions.create, { token: sessionToken, userId: userId as Id<'users'> })
let successUrl = `${appUrl}/auth/success#session=${sessionToken}`
if (oauthState.plan !== undefined) successUrl += `&plan=${oauthState.plan}`
if (oauthState.interval !== undefined) successUrl += `&interval=${oauthState.interval}`
return redirect(successUrl, clearNonce())
```

`convex/sessions.ts` has `create` (internalMutation, inserts `{ token, userId, expiresAt }`),
`validateAndConsumeOAuthState` (returns `{ valid, plan?, interval?, ref? }`, row deleted on success
before the response), `deleteExpiredOAuthStates`, and `oauthNonceMatches`.

`app/index.html` captures `#session=` into `sessionStorage.sessionToken` on `/auth/success` and
scrubs the fragment (current inline script, lines ~19-41).

`app/src/pages/AuthSuccessPage.tsx` currently just clears `signedOut` when a token was captured and
navigates to `/feed`.

`app/src/lib/session.ts` exports `AUTH_URL = ${CONVEX_SITE_URL}/auth/linkedin`, used by
`App.tsx:48` (`RequireAuth`) and `ReconnectBanner.tsx:30`.

`landing/lib/links.ts`:

```ts
const CONVEX_SITE = process.env.NEXT_PUBLIC_CONVEX_SITE
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:5173'
export const SIGN_IN_URL = CONVEX_SITE ? `${CONVEX_SITE}/auth/linkedin` : APP_URL
```

`landing/lib/trial.ts:33` appends `plan`/`interval`/`ref` to `SIGN_IN_URL` via `new URL(...)`.

`convex/schema.ts` `oauthStates`: `{ state, expiresAt, plan?, interval?, ref?, browserNonce }` with
`by_state` and `by_expires_at`. 19 tables today.

## Commands you will need

| Purpose                 | Command                                 | Expected                                      |
|-------------------------|-----------------------------------------|-----------------------------------------------|
| Codegen (backend first) | `npx convex codegen` (repo root)        | `api.d.ts` includes `sessions.redeemAuthCode` |
| Convex tests            | `pnpm --filter convex test`             | all pass                                      |
| Integration             | `pnpm --filter convex test:integration` | all pass incl. new redeem test                |
| App tests               | `pnpm --filter app test`                | all pass                                      |
| Landing tests           | `pnpm --filter landing test`            | all pass                                      |
| Typecheck               | `pnpm typecheck`                        | exit 0                                        |
| Full gate               | `pnpm verify`                           | exit 0                                        |

## Scope

**Backend**: `convex/schema.ts`, `convex/lib/pkce.ts` (create), `convex/lib/pkce.test.ts` (create),
`convex/sessions.ts`, `convex/sessions.test.ts`, `convex/http.ts`, `convex/crons.ts`,
`convex/privacy/deletion.ts` (erasure cascade: `authCodes`), `convex/integration/highRisk.test.ts`
(add redeem coverage), `docs/PLATFORM.md`. **App**: `app/index.html`, `app/src/App.tsx`,
`app/src/pages/AuthStartPage.tsx` (create),
`app/src/pages/AuthSuccessPage.tsx`, `app/src/lib/oauthStart.ts` (create), `app/src/lib/session.ts`,
`app/src/components/ReconnectBanner.tsx` + its test, `app/src/pages/AuthSuccessPage.test.tsx`,
`docs/PLATFORM.md`. **Landing**: `landing/lib/links.ts`, `landing/lib/trial.ts` (verify params only), its tests,
`landing/.env.example` comment, `docs/PLATFORM.md`. **Out of scope**: the nonce cookie mechanism, the Stripe/landing
redirects, session TTL/sliding
renewal, `users.forceLogoutAll`, and any UI redesign of the success screen.

## Git workflow

- Branch: `advisor/028-pkce-verifier-binding`. Do NOT commit or push. Do not deploy.

## Steps

### Step 1 (backend): challenge helpers

Create `convex/lib/pkce.ts`:

```ts
export function isPkceChallenge(value: string): boolean // 43-char base64url
export function isPkceVerifier(value: string): boolean  // 43-char base64url
export async function pkceChallengeFromVerifier(verifier: string): Promise<string>
// crypto.subtle.digest('SHA-256', TextEncoder utf8 verifier) -> base64url without padding
```

Tests in `convex/lib/pkce.test.ts`: RFC 7636 Appendix B vector
(`verifier = dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk` →
`challenge = E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM`), shape guards accept/reject, and
`pkceChallengeFromVerifier` round-trips with the app's generator shape.

**Verify**: `pnpm --filter convex test` passes.

### Step 2 (backend): schema + code lifecycle

- `convex/schema.ts`:
    - `oauthStates.challenge: v.optional(v.string())` with a comment (optional only for deploy safety).
    - New table:
      ```ts
      authCodes: defineTable({
        code: v.string(),
        userId: v.id('users'),
        challenge: v.string(),
        plan: v.optional(v.string()),
        interval: v.optional(v.string()),
        expiresAt: v.number()
      }).index('by_code', ['code'])
      ```
- `convex/sessions.ts`:
    - `createAuthCode` internalMutation `{ code, userId, challenge, plan?, interval? }` inserting with
      `expiresAt = now + 2 * 60 * 1000`. Export `AUTH_CODE_TTL_MS`.
    - `redeemAuthCode` public mutation `{ code, verifier }` returning `{ sessionToken: v.string() }`:
      look up by `by_code`; missing/expired → delete-if-present + `ConvexError`; compute the challenge
      from `verifier` and compare; mismatch → delete + `ConvexError('Login could not be verified.
    Please try again.')`; match → token `crypto.randomUUID()`, `ctx.db.insert('sessions', ...)` with
      `sessionExpiryFrom(Date.now())`, delete the code row, return the token. Do not call
      `internal.sessions.create` via `runMutation`; insert directly (cheaper, same transaction).
    - `deleteExpiredAuthCodes` internalMutation: bounded `.take(200)` by `by_expires_at`; add a
      `by_expires_at` index for it. Reschedule when the batch is full (mirror
      `deleteExpiredOAuthStates`).
    - `validateAndConsumeOAuthState` must also return `challenge` (from the row, before delete).
- `convex/crons.ts`:
  `crons.interval('cleanup expired auth codes', { hours: 1 }, internal.sessions.deleteExpiredAuthCodes, {})`.
- `convex/privacy/deletion.ts`: add `authCodes` to the erasure-owned table list so a deleted user's
  unredeemed codes are removed. Do NOT add it to the DSR export (a transient bearer credential).

**Verify**: `pnpm --filter convex test` and `pnpm --filter convex exec tsc --noEmit -p tsconfig.json`.

### Step 3 (backend): HTTP start/callback

In `convex/http.ts`:

- Start route: read `vc`, and
  `if (!vc || !isPkceChallenge(vc)) return new Response('Invalid login request.', { status: 400, headers: NO_STORE })`.
  Pass `challenge: vc` to `createOAuthState`. Everything else (plan/interval/ref, nonce cookie, 302)
  unchanged.
- Callback: after `upsertUser` (keep `ref` handling) and BEFORE the old session block, replace the
  session creation with:

```ts
const code = crypto.randomUUID()
await ctx.runMutation(internal.sessions.createAuthCode, {
  code,
  userId: userId as Id<'users'>,
  challenge: oauthState.challenge,
  plan: oauthState.plan,
  interval: oauthState.interval
})
let successUrl = `${appUrl}/auth/success#code=${code}`
if (oauthState.plan !== undefined) successUrl += `&plan=${oauthState.plan}`
if (oauthState.interval !== undefined) successUrl += `&interval=${oauthState.interval}`
return redirect(successUrl, clearNonce())
```

- Delete the now-unused session creation from the callback. `internal.sessions.create` stays for
  other callers/tests.

**Verify**: `pnpm --filter convex exec tsc --noEmit -p tsconfig.json` exits 0; `pnpm --filter convex test` passes.

### Step 4 (backend): prove the runtime + wire the integration test

Add to `convex/integration/highRisk.test.ts` a case that inserts an `authCodes` row with a real
challenge, calls `sessions.redeemAuthCode` with the matching verifier, and asserts a `sessions` row
exists and the code row is gone; plus a mismatch case that throws and deletes the code. This also
proves `crypto.subtle` works in the edge runtime. If `crypto.subtle` is unavailable, STOP.

**Verify**: `pnpm --filter convex test:integration` passes.

### Step 5 (app): start route + helper

- Create `app/src/lib/oauthStart.ts`:

```ts
// Generates a PKCE verifier (stored only in this browser), derives the SHA-256 challenge, and
// navigates to the Convex OAuth start with it. All login entry points route through here.
export async function beginOAuthLogin(params?: { plan?: string; interval?: string; ref?: string }) {
  // crypto.getRandomValues(32) -> base64url verifier; sessionStorage.setItem('oauthVerifier', verifier)
  // crypto.subtle.digest -> base64url challenge; build `${AUTH_URL}?vc=...` + params; window.location.assign
}
```

- Create `app/src/pages/AuthStartPage.tsx`: a spinner page that reads `plan`/`interval`/`ref` from
  `useSearchParams()` in an effect and calls `beginOAuthLogin`.
- `app/src/App.tsx`: add `<Route path="/auth/start" element={<AuthStartPage />} />`; `RequireAuth`
  (line ~48) redirects to `/auth/start` instead of `AUTH_URL` (use `window.location.assign('/auth/start')`
  or a `navigate` call; keep the stale-token removal from the review fix).
- `app/src/components/ReconnectBanner.tsx`: `reconnect()` navigates to `/auth/start`; update its test's
  `@/lib/session` mock accordingly.
- Keep `AUTH_URL` exported from `lib/session.ts` (used by `oauthStart.ts`).

**Verify**: `pnpm --filter app exec tsc --noEmit` exits 0; `pnpm --filter app test` passes.

### Step 6 (app): capture the code and redeem it

- `app/index.html`: capture `code` into `sessionStorage.oauthCode` on `/auth/success` (keep the path
  guard, keep plan/interval, keep never overwriting when `sessionToken` already exists, keep the
  fragment scrub). Update the comments.
- `app/src/pages/AuthSuccessPage.tsx`: use `useMutation(api.sessions.redeemAuthCode)` with a
  run-once ref:
    - if `sessionToken` already exists: clear `signedOut`, navigate `/feed`.
    - else read `oauthCode` + `oauthVerifier`; if either is missing, clear them and
      `window.location.replace(LANDING_URL)` (fail closed, no redeem call so a handed-over code is not
      burned for its owner).
    - else call redeem; on success store the returned token in `sessionStorage.sessionToken`, remove
      `oauthCode`/`oauthVerifier`, `clearSignedOut()`, navigate `/feed`. On failure, remove both keys and
      replace to `LANDING_URL`.
- Update `app/src/pages/AuthSuccessPage.test.tsx` for the new flow (success, missing verifier,
  mismatch failure, existing-token short-circuit).
- `pnpm --filter app build` must still emit two CSP script hashes (`app/dist/_headers`).

**Verify**: `pnpm --filter app test` and `pnpm --filter app exec tsc --noEmit` pass.

### Step 7 (landing): point CTAs at the app start route

- `landing/lib/links.ts`: `export const SIGN_IN_URL = `${APP_URL}/auth/start`` (drop the CONVEX_SITE
  branch or keep it only as a fallback constant that is no longer used for sign-in). Update the
  header comment: CTAs now hit the app route so the app can generate the PKCE verifier; the app then
  bounces to Convex.
- `landing/lib/trial.ts`: confirm `new URL(SIGN_IN_URL)` still receives `plan`/`interval`/`ref`
  unchanged; update its test expectations if they pin the old URL.
- `landing/.env.example`: update the comment next to `NEXT_PUBLIC_CONVEX_SITE`.

**Verify**: `pnpm --filter landing test` passes.

### Step 8 (docs): PLATFORM.md

- §5: table count 19 → 20, add `authCodes` (one line) and `oauthStates.challenge`.
- §7: rewrite the OAuth flow (Mermaid + prose) to: app `/auth/start` generates verifier/challenge →
  Convex stores challenge → callback mints a single-use 2-minute `authCode` → SPA redeems with the
  verifier → session token returned over the Convex transport, never in a URL. Note the nonce cookie
  is unchanged and the landing CTA target moved to `${NEXT_PUBLIC_APP_URL}/auth/start`.
- §17: replace the fragment-delivery rationale with the new binding, and note the residual: a stolen
  verifier plus code is required, so a handed-over link is inert.
- §14: update `AuthSuccessPage`/`RequireAuth`/`ReconnectBanner` descriptions.
- §15: landing CTA note.

## Test plan

- `convex/lib/pkce.test.ts`: RFC vector + shape guards.
- `convex/sessions.test.ts`: any new pure helper (e.g. `isAuthCodeUsable` if extracted).
- `convex/integration/highRisk.test.ts`: redeem success + mismatch (also proves `crypto.subtle`).
- App tests: `AuthSuccessPage.test.tsx`, `ReconnectBanner.test.tsx`, `CommandPalette`/others only if a
  mock of `session.ts` breaks.
- Landing tests: link construction.
- Manual (report if unavailable): full login in dev; DevTools shows `oauthCode` + `oauthVerifier` in
  sessionStorage briefly, `#code=` scrubbed, session token appears only after redeem, and a copied
  `#code=` URL opened in another browser fails to redeem.

## Done criteria (ALL must hold)

- [x] `pnpm verify` exits 0
- [x] `grep -n "session=" convex/http.ts app/index.html` returns nothing (the token no longer travels in a URL)
- [x] `grep -rn "redeemAuthCode" convex app/src` finds the mutation and its only caller
- [x] `grep -n "auth/linkedin" landing/lib app/src/lib/session.ts` shows it only inside `AUTH_URL`/`beginOAuthLogin`,
  not a direct CTA target
- [x] `authCodes` is in the erasure cascade and a cleanup cron
- [x] CSP still lists two script hashes after an app build
- [x] `docs/PLATFORM.md` §5/§7/§14/§15/§17 updated
- [x] Only in-scope files changed; no commit made
- [x] `plans/README.md` row 028 updated

## STOP conditions

- `crypto.subtle` is unavailable in the Convex runtime (the integration test fails to hash): STOP.
  Do not hand-roll SHA-256 and do not fall back to sending the raw verifier.
- Any login entry point cannot be routed through `/auth/start` (for example a link that cannot be
  changed): STOP and report the site; do not leave a path that bypasses `vc`.
- Session creation for another caller depends on the callback's old block: grep first; report if the
  removal would break it.
- The dev/prod redirect origins make the verifier unreachable at redeem (for example the verifier
  stored on a different origin than `/auth/success`): STOP and report, do not move the verifier to a
  cookie without a design review.

## Maintenance notes

- The redeemer deletes the code on mismatch. If the same browser retries after a transient failure it
  simply starts a new login; the attacker's handed-over code is inert either way.
- `authCodes` rows are bearer credentials with a 2-minute TTL; never log `code` or `verifier`, never
  add them to the DSR export, and keep them in the erasure cascade.
- Future auth providers must use the same start/redeem split; the invariant is "no credential in a
  URL".
- Reviewer: confirm the callback no longer creates a session and that the only session creation left
  in the OAuth path is inside `redeemAuthCode`.
