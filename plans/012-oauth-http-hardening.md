# Plan 012: Harden the OAuth HTTP surface (browser-bound state, throttled start, no-store)

> **Executor instructions**: Follow step by step and run every verification. Honor STOP conditions.
> When done, update this plan's row in `plans/README.md`.
> **Repo rule (`CLAUDE.md`/`AGENTS.md`): NEVER commit or push.** Keep `docs/PLATFORM.md` in sync (Step 7).
>
> **Drift check (run first)**:
> `git status --porcelain -- convex/http.ts convex/sessions.ts convex/lib/rateLimit.ts docs/PLATFORM.md`
> Compare the excerpts below to the live files. On a mismatch, STOP.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED. This touches the login redirect and callback. A wrong cookie setting blocks every
  login; verify with the local dev flow if available.
- **Depends on**: none
- **Category**: security
- **Planned at**: working tree at commit `ced69ac`, 2026-09-10

## Why this matters

Three gaps on the OAuth surface:

1. **Login CSRF.** The `state` nonce is random, single-use, and server-stored (`convex/http.ts:21,38`;
   `convex/sessions.ts:109-148`), but it is not bound to the browser that
   started the flow. An attacker can complete LinkedIn auth for their own account, capture the
   callback URL, and deliver it to a victim; the victim's browser then receives the attacker's
   session.
2. **Anonymous write amplification.** Every unauthenticated `GET /auth/linkedin` inserts an
   `oauthStates` row with no throttle (`http.ts:17-42`), while cleanup removes at most 200 expired
   rows per hour (`sessions.ts:150-159`, `crons.ts:35`). A sustained request rate outruns cleanup.
3. **Token-bearing redirects are cacheable by intermediaries.** The callback 302's `Location` embeds
   `#session=<uuid>` and sets no `Cache-Control` (`http.ts:119-122`).

## Current state

`convex/http.ts:17-42` (start route):

```ts
http.route({
  path: '/auth/linkedin',
  method: 'GET',
  handler: httpAction(async (ctx, req) => {
    const state = crypto.randomUUID()
    // ... plan/interval/ref parsing ...
    await ctx.runMutation(internal.sessions.createOAuthState, { state, plan, interval, ref })
    const url = buildAuthUrl(state)
    return new Response(null, { status: 302, headers: { Location: url } })
  })
})
```

`convex/http.ts:73-122` (callback route): reads `state`, calls
`internal.sessions.validateAndConsumeOAuthState`, and returns plain
`new Response(null, { status: 302, headers: { Location } })`
at seven sites (lines 57-60, 65-68, 74-82, 119-122).

`convex/sessions.ts:109-159` (state lifecycle; excerpts):

```ts
export const createOAuthState = internalMutation({
  args: { state: v.string(), plan: v.optional(v.string()), interval: v.optional(v.string()), ref: v.optional(v.string()) },
  handler: async (ctx, { state, plan, interval, ref }) => {
    await ctx.db.insert('oauthStates', { state, expiresAt: Date.now() + 10 * 60 * 1000, plan, interval, ref })
  }
})

export const validateAndConsumeOAuthState = internalMutation({
  args: { state: v.string() },
  handler: async (ctx, { state }) => {
    const record = await ctx.db.query('oauthStates').withIndex('by_state', q => q.eq('state', state)).unique()
    if (!record) return { valid: false }
    const plan = record.plan; const interval = record.interval; const ref = record.ref
    await ctx.db.delete(record._id)
    if (record.expiresAt < Date.now()) return { valid: false }
    return { valid: true, plan, interval, ref }
  }
})

export const deleteExpiredOAuthStates = internalMutation({
  args: {},
  handler: async ctx => {
    const now = Date.now()
    const expired = await ctx.db.query('oauthStates').withIndex('by_expires_at', q => q.lt('expiresAt', now)).take(200)
    await Promise.all(expired.map(s => ctx.db.delete(s._id)))
  }
})
```

`convex/lib/rateLimit.ts:44-56` shows the component pattern (`rateLimiter.limit(ctx, action, { key, config })`);
`RATE_LIMIT_ACTIONS` (`:30-38`) is per-user only, so it does not cover anonymous callers.

Conventions: pure helpers get their own tests (`convex/lib/rateLimit.test.ts`), and existing tests do
not mock full function handlers. `ConvexError` is the user-facing error type (`docs/PLATFORM.md:779-787`).

## Commands you will need

| Purpose      | Command                     | Expected |
|--------------|-----------------------------|----------|
| Convex tests | `pnpm --filter convex test` | all pass |
| Typecheck    | `pnpm typecheck`            | exit 0   |
| Lint         | `pnpm lint`                 | exit 0   |
| Full gate    | `pnpm verify`               | exit 0   |

## Scope

**In scope**: `convex/http.ts`, `convex/sessions.ts`, `convex/schema.ts` (add the `browserNonce`
field to `oauthStates`; scope added 2026-09-10 after execution revealed the strict table validator),
`convex/lib/rateLimit.ts`, `convex/lib/cookies.ts` (create), `convex/lib/cookies.test.ts` (create),
`convex/sessions.test.ts`, `docs/PLATFORM.md`. **Out of scope**: the LinkedIn token exchange and userinfo calls, the
Stripe webhook routes, the feed,
plan 009's frontend changes, and the `deleteExpiredSessions` / `deleteAllForUser` loops (plan 013 owns
those, even though they live in `sessions.ts`).

## Git workflow

- Branch: `advisor/012-oauth-http-hardening`. Do NOT commit or push.

## Steps

### Step 1: Add a cookie parser (pure, tested)

Create `convex/lib/cookies.ts`:

```ts
// convex/lib/cookies.ts
// Minimal request Cookie header parser. Pure and dependency-free so it is unit-testable and safe to
// use inside httpActions (which have no DOM APIs).
export function readCookie(cookieHeader: string | null | undefined, name: string): string | null {
  if (!cookieHeader) return null
  for (const part of cookieHeader.split(';')) {
    const eq = part.indexOf('=')
    if (eq === -1) continue
    if (part.slice(0, eq).trim() !== name) continue
    return decodeURIComponent(part.slice(eq + 1).trim())
  }
  return null
}
```

Create `convex/lib/cookies.test.ts`: null/empty header, absent name, present among several cookies,
surrounding spaces, and a percent-encoded value.

**Verify**: `pnpm --filter convex test` passes including the new file.

### Step 2: Bind OAuth state to a browser nonce

In `convex/schema.ts`, add `browserNonce: v.string()` to the `oauthStates` table definition (the
strict table validator rejects the new field otherwise).

In `convex/sessions.ts`:

- Add `browserNonce: v.string()` to `createOAuthState` args and store it on the inserted row.
- Add `browserNonce: v.string()` to `validateAndConsumeOAuthState` args. After the record is found and
  read and BEFORE the expiry return, add (keep the existing delete-before-expiry-check ordering):

```ts
if (!oauthNonceMatches(record.browserNonce, args.browserNonce)) return { valid: false }
```

- Add and export the pure comparator, tested so the property has a regression target:

```ts
export function oauthNonceMatches(stored: string, presented: string): boolean {
  return stored === presented
}
```

Add tests to `convex/sessions.test.ts` for `oauthNonceMatches` (match, mismatch, empty strings).

**Verify**: `pnpm --filter convex test` passes.

### Step 3: Issue and require the nonce cookie

In `convex/http.ts`:

1. Add imports: `readCookie` from `./lib/cookies`.
2. Add a local helper above the routes:

```ts
const NO_STORE = { 'Cache-Control': 'no-store', Pragma: 'no-cache' } as const
const CLEAR_NONCE = 'oauth_nonce=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0'

function redirect(location: string, extraHeaders: Record<string, string> = {}): Response {
  return new Response(null, { status: 302, headers: { Location: location, ...NO_STORE, ...extraHeaders } })
}
```

3. In the start handler, generate and store the nonce, and set it as an HttpOnly cookie (10-minute lifetime, matching
   the `oauthStates` TTL):

```ts
const state = crypto.randomUUID()
const browserNonce = crypto.randomUUID()
// ... plan/interval/ref parsing unchanged ...
await ctx.runMutation(internal.sessions.createOAuthState, { state, browserNonce, plan, interval, ref })
return redirect(buildAuthUrl(state), {
  'Set-Cookie': `oauth_nonce=${browserNonce}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`
})
```

4. In the callback, after reading `state`, read and require the cookie nonce, and pass it through:

```ts
const nonce = readCookie(req.headers.get('cookie'), 'oauth_nonce')
if (!nonce) { /* existing invalid-state error path */ }
const oauthState = await ctx.runMutation(internal.sessions.validateAndConsumeOAuthState, { state, browserNonce: nonce })
if (!oauthState.valid) { /* existing invalid-state error path */ }
```

5. Replace every callback `new Response(null, { status: 302, headers: { Location } })` with
   `redirect(location, { 'Set-Cookie': CLEAR_NONCE })` so the nonce is single-use client-side too.
   Do not change status codes, error targets, or log lines.

**Verify**: `pnpm --filter convex exec tsc --noEmit -p convex/tsconfig.json` exits 0; `pnpm lint` passes.

### Step 4: Throttle the anonymous start route

In `convex/lib/rateLimit.ts` add:

```ts
// Anonymous (no user key) global limiter. Used only by the OAuth start route, whose caller has no
// identity yet. A global key bounds oauthStates growth; it is deliberately coarse.
export async function checkGlobalRateLimit(
  ctx: RunMutationCtx,
  action: string,
  maxPerWindow: number,
  windowMs: number = WINDOW_MS
): Promise<void> {
  const { ok } = await rateLimiter.limit(ctx, action, {
    key: 'global',
    config: { kind: 'fixed window', rate: maxPerWindow, period: windowMs }
  })
  if (!ok) throw new ConvexError('Too many sign-in attempts. Please try again shortly.')
}

export const checkOAuthStartBudget = internalMutation({
  args: {},
  handler: async ctx => {
    await checkGlobalRateLimit(ctx, 'oauthStart', 300)
  }
})
```

Add the `ConvexError` import from `convex/values`. In `convex/http.ts`'s start handler, call
`await ctx.runMutation(internal.lib.rateLimit.checkOAuthStartBudget, {})` BEFORE
`createOAuthState`. 300/hour is the ceiling; if the deploy owner wants a different cap, it is a one
line change, and the plan's cleanup fix keeps a 300/hour rate drainable.

**Verify**: `pnpm --filter convex exec tsc --noEmit -p convex/tsconfig.json` exits 0.

### Step 5: Drain the OAuth-state cleanup fully

In `convex/sessions.ts` `deleteExpiredOAuthStates`, after the batch delete add:

```ts
if (expired.length === 200) {
  await ctx.scheduler.runAfter(0, internal.sessions.deleteExpiredOAuthStates, {})
}
```

Add the `internal` import from `./_generated/api` if not present (mirror the pattern used by other
jobs, e.g. `convex/jobs/processQueue.ts:122`).

**Verify**: `pnpm --filter convex exec tsc --noEmit -p convex/tsconfig.json` exits 0.

### Step 6: Give the callback responses `no-store`

Confirm every response in both routes goes through the `redirect()` helper (or sets the `NO_STORE`
headers), including the success redirect at `http.ts:119-122`. `grep -n "new Response" convex/http.ts`
must show no OAuth-route response without `NO_STORE` (the Stripe `registerRoutes` call is untouched).

### Step 7: Sync `docs/PLATFORM.md`

- §17 CSRF bullet (`:5516-5517`): state that the nonce is also bound to an `HttpOnly; Secure;
  SameSite=Lax` cookie set on `/auth/linkedin` and required on callback, and that `/auth/linkedin` is
  globally rate-limited (300/hour) to bound `oauthStates` growth.
- §7 OAuth flow Mermaid: add the nonce cookie step (`createOAuthState` stores the nonce; callback
  requires the cookie) and note `Cache-Control: no-store` on the token-bearing redirect.

## Test plan

- `convex/lib/cookies.test.ts`: parser cases (new test surface).
- `convex/sessions.test.ts`: `oauthNonceMatches` match/mismatch.
- Full handler behavior (cookie set, callback rejection without the cookie) is not coverable with the
  repo's pure-test harness; it is verified by typecheck plus the manual check below.
- Manual check if a local Convex dev deployment is available: `pnpm dev:convex`, open
  `${VITE_CONVEX_SITE}/auth/linkedin`, complete LinkedIn auth, confirm login succeeds; then repeat in a
  private window and confirm login fails when the `oauth_nonce` cookie is removed before callback.
  If no deployment is available, say so in the final report instead of claiming the manual check.

## Done criteria (ALL must hold)

- [ ] `pnpm verify` exits 0
- [ ] `grep -n "oauth_nonce" convex/http.ts` finds the Set-Cookie and the read
- [ ] `grep -n "browserNonce" convex/sessions.ts convex/http.ts` finds both sides
- [ ] `grep -n "no-store" convex/http.ts` finds the helper and it is used by every OAuth redirect
- [ ] `grep -n "checkOAuthStartBudget" convex/http.ts convex/lib/rateLimit.ts` finds the call and definition
- [ ] `deleteExpiredOAuthStates` reschedules when the batch is full
- [ ] `docs/PLATFORM.md` §7 and §17 updated
- [ ] Only in-scope files changed; no commit made
- [ ] `plans/README.md` row updated

## STOP conditions

- The callback route does not have exactly the seven response sites listed (drift), or the Stripe
  `registerRoutes` block appears in the grep and would be swept into the `redirect()` refactor: stop
  and report.
- The rate-limiter component rejects a non-Id string key (`key: 'global'`) at typecheck: report the
  type error instead of casting.
- The cookie is not sent on the cross-site callback in a real login attempt (SameSite/precedence
  surprise): STOP and report; do not drop the binding silently.
- A production login cannot be tested from this environment: say so; do not mark the manual check
  passed.

## Maintenance notes

- The global 300/hour cap is coarse on purpose (no trustworthy client IP at `.convex.site`). If
  sign-in traffic grows or a targeted DoS appears, move the cap to an edge/WAF rule or key it on a
  trusted proxy header with its own review.
- `browserNonce` is required on new state rows. There is no migration: rows live 10 minutes, so a
  deploy invalidates any in-flight login at worst.
- Reviewer: confirm the invalid-state paths still return the same error redirects and that the nonce
  cookie is cleared on both success and failure.
