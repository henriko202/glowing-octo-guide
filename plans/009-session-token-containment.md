# Plan 009: Keep the OAuth session token out of Sentry and scrub local token copies

> **Executor instructions**: Follow step by step. Run every verification command and confirm the
> expected result before moving on. Honor the STOP conditions. When done, update this plan's row in
> `plans/README.md`.
> **Repo rule (`CLAUDE.md`/`AGENTS.md`): NEVER commit or push.** Keep `docs/PLATFORM.md` in sync (Step 6).
>
> **Drift check (run first)**:
>
`git status --porcelain -- app/index.html app/src/pages/AuthSuccessPage.tsx app/src/lib/observability/sentry.ts app/src/lib/session.ts app/src/components/Motd.tsx app/src/lib/cookies.ts app/src/i18n/index.ts landing/lib/cookies.ts`
> This tree had uncommitted changes when the plan was written. Compare the excerpts below against the
> live files. On a mismatch, STOP.

## Status

- **Priority**: P1
- **Effort**: S-M
- **Risk**: MED. The `#session=` handoff is the login path. If the capture script or the
  `AuthSuccessPage` read is wrong, users cannot log in. Every step below has a test.
- **Depends on**: none
- **Category**: security
- **Planned at**: working tree at commit `ced69ac`, 2026-09-10

## Why this matters

The OAuth callback redirects to `${APP_URL}/auth/success#session=<uuid>` (`convex/http.ts:115`). The
fragment is read by `AuthSuccessPage` inside a `useEffect` and only then removed with
`history.replaceState`. But `initSentry()` runs at `app/src/main.tsx:16`, before React renders, and
Sentry's browser SDK records `location.href` (fragment included) into `request.url`, navigation
breadcrumbs, transaction payloads, and Session Replay session URLs. `sentryBeforeSend`
(`app/src/lib/observability/sentry.ts:26-37`) drops cookies/headers/user and scrubs message text but
does not touch URLs, and Replay events bypass `beforeSend` entirely. So a session token that is valid
for 15 sliding days (`convex/sessions.ts:16`) can reach a third-party processor and enable account
takeover for anyone with Sentry project access. Secondary issues in the same area: the token is copied
into `sessionStorage.motdDismissed` and never cleared on sign-out, and the cross-site `theme`/`lang`
cookies are written without `Secure`.

## Current state

`app/index.html:19-33` has exactly one inline script (the pre-paint theme guard). Inline scripts are
hashed automatically by `app/scripts/gen-headers.mjs:19-29`, so an added inline script is covered by
the CSP without touching the generator.

`app/src/main.tsx:14-17`:

```ts
// No-ops in dev / without the prod env vars. PostHog starts opted-out; capture begins only after the
// signed-in user grants analytics consent (see AnalyticsConsentGate).
initSentry()
initPostHog()
```

`app/src/pages/AuthSuccessPage.tsx:9-27` (hash parse + scrub):

```ts
const hash = window.location.hash.replace(/^#/, '')
const params = new URLSearchParams(hash)
const session = params.get('session')
const plan = params.get('plan')
const interval = params.get('interval')
if (plan) sessionStorage.setItem('chosenPlan', plan)
if (interval) sessionStorage.setItem('chosenInterval', interval)
if (session) {
  sessionStorage.setItem('sessionToken', session)
  clearSignedOut()
  window.history.replaceState(null, '', window.location.pathname)
}
navigate('/feed', { replace: true })
```

`sentry.ts:26-37` is the whole scrubber; `:52` enables `replayIntegration()` with
`replaysSessionSampleRate: 0.1`, `:71` wires only `beforeSend`.

`app/src/components/Motd.tsx:23,31,40` reads the token and stores
`sessionStorage.setItem('motdDismissed', JSON.stringify({ token, motdId }))`.
`app/src/lib/session.ts:47-51` (`signOut`) removes only `sessionToken`.

Cookie writers, all lacking `Secure`:

- `app/src/lib/cookies.ts:10` `serializeCookie`: `...SameSite=Lax${domainPart}`
- `landing/lib/cookies.ts:17` `setCookie`: `...SameSite=Lax${domainPart}`
- `app/src/i18n/index.ts:29` `cookieOptions: { path: '/', sameSite: 'lax' }`

Conventions: app tests are Vitest with jsdom (`app/src/lib/session.test.ts`, `app/src/lib/cookies.test.ts`
exist; follow their structure). `pnpm verify` is the repo gate.

## Commands you will need

| Purpose       | Command                      | Expected |
|---------------|------------------------------|----------|
| App tests     | `pnpm --filter app test`     | all pass |
| Landing tests | `pnpm --filter landing test` | all pass |
| Typecheck     | `pnpm typecheck`             | exit 0   |
| Lint          | `pnpm lint`                  | exit 0   |
| Full gate     | `pnpm verify`                | exit 0   |

## Scope

**In scope**: `app/index.html`, `app/src/pages/AuthSuccessPage.tsx`,
`app/src/lib/observability/sentry.ts`, `app/src/lib/observability/sentry.test.ts`,
`app/src/lib/session.ts`, `app/src/lib/session.test.ts`, `app/src/components/Motd.tsx`,
`app/src/lib/cookies.ts`, `app/src/lib/cookies.test.ts`, `app/src/i18n/index.ts`,
`landing/lib/cookies.ts`, `docs/PLATFORM.md`. **Out of scope**: the Convex OAuth flow, `convex/http.ts` (plan 012 covers
it), PostHog, the CSP
generator (the hash list is automatic), and anything else in `app/src`.

## Git workflow

- Branch: `advisor/009-session-token-containment`. Do NOT commit or push.

## Steps

### Step 1: Capture and scrub `#session=` before any bundle runs

In `app/index.html`, insert a second inline `<script>` in `<head>`, immediately after the
`<meta name="theme-color">` tag and BEFORE the existing theme-guard script:

```html
<script>
  // OAuth return: move the session token out of the URL before any bundle, Sentry replay, or
  // error handler can observe location.href, then scrub the fragment from history.
  ;(function () {
    try {
      var hash = window.location.hash.replace(/^#/, '')
      if (!hash) return
      var p = new URLSearchParams(hash)
      var session = p.get('session')
      var plan = p.get('plan')
      var interval = p.get('interval')
      if (session) sessionStorage.setItem('sessionToken', session)
      if (plan) sessionStorage.setItem('chosenPlan', plan)
      if (interval) sessionStorage.setItem('chosenInterval', interval)
      if (session || plan || interval) {
        window.history.replaceState(null, '', window.location.pathname + window.location.search)
      }
    } catch (e) {}
  })()
</script>
```

**Verify**: `pnpm --filter app build` exits 0, then `node app/scripts/gen-headers.mjs` is not needed
manually (the build invokes it); check `app/dist/_headers` contains TWO `'sha256-` hashes in
`script-src`.

### Step 2: Make `AuthSuccessPage` read only from storage

Replace the effect body in `app/src/pages/AuthSuccessPage.tsx` with:

```ts
useEffect(() => {
  // The token (and plan/interval) were moved into sessionStorage by the inline script in
  // index.html before any bundle ran, so the URL bar is already scrubbed here.
  clearSignedOut()
  navigate('/feed', { replace: true })
}, [navigate])
```

Remove now-unused imports if any. Keep the component and its spinner.

**Verify**: `pnpm --filter app test` passes; `grep -n "location.hash" app/src/pages/AuthSuccessPage.tsx`
returns nothing.

### Step 3: Defense in depth in Sentry (URL scrub + transactions)

In `app/src/lib/observability/sentry.ts`:

1. Add and export a pure helper:

```ts
export function stripUrlSecrets(url: string): string {
  const i = url.indexOf('#')
  if (i === -1) return url
  const fragment = url.slice(i + 1)
  return /(^|&)session=/.test(fragment) ? url.slice(0, i) : url
}
```

2. In `sentryBeforeSend`, before the message scrub, strip the fragment:

```ts
const req = event.request as { url?: unknown } | undefined
if (req && typeof req.url === 'string') req.url = stripUrlSecrets(req.url)
```

3. In `Sentry.init`, add:

```ts
beforeSendTransaction: event =>
  sentryBeforeSend(event as unknown as ScrubbableEvent) as unknown as typeof event,
```

**Verify**: update `app/src/lib/observability/sentry.test.ts`:

- keep the existing "non-PII request fields kept" assertion but change the fixture URL to a clean one (no fragment),
  since fragment stripping now applies; and
- add a case asserting `sentryBeforeSend({ request: { url: 'https://app.example/auth/success#session=abc' } })`
  returns a URL without the fragment, and that a fragment without `session=` is preserved.
  `pnpm --filter app test` passes.

### Step 4: Stop copying the token into `motdDismissed`, clear it on sign-out

In `app/src/lib/session.ts` `signOut()` add `sessionStorage.removeItem('motdDismissed')` next to the
existing `sessionStorage.removeItem('sessionToken')`. Add a comment: dismissed-MOTD memory stores the
session token, so it must die with the session.

**Verify**: add a test to `app/src/lib/session.test.ts` (follow its existing jsdom setup) asserting
after `signOut()` both `sessionToken` and `motdDismissed` are absent and `signedOut` is `'1'`.
`pnpm --filter app test` passes.

### Step 5: Add `Secure` to the preference cookies

In `app/src/lib/cookies.ts` and `landing/lib/cookies.ts`, add a small local helper and append it:

```ts
function secureSuffix(): string {
  return typeof location !== 'undefined' && location.protocol === 'https:' ? '; Secure' : ''
}
```

Use it in the cookie string: `...SameSite=Lax${secureSuffix()}${domainPart}`.
In `app/src/i18n/index.ts:29` add `secure: window.location.protocol === 'https:'` to `cookieOptions`.

**Verify**: extend `app/src/lib/cookies.test.ts` with a jsdom `location.protocol` HTTPS case asserting
the serialized value contains `; Secure`; `pnpm --filter app test` and `pnpm --filter landing test` pass.

### Step 6: Sync `docs/PLATFORM.md`

- §17 bullet "CSP + security headers" and the "Sessions" bullet: state that the fragment is captured
  and scrubbed by a pre-bundle inline script in `app/index.html` (before Sentry/PostHog init), and
  that Sentry additionally strips fragment-bearing `request.url` values and runs transaction scrubbing.
- §17: note `theme`/`lang` cookies are `Secure` in HTTPS contexts.
- §14 (observability) is cross-referenced from §17; no other edit needed.

## Test plan

- `app/src/lib/observability/sentry.test.ts`: fragment stripping (with and without `session=`).
- `app/src/lib/session.test.ts`: sign-out clears `motdDismissed`.
- `app/src/lib/cookies.test.ts`: `Secure` suffix under HTTPS.
- The index.html capture is verified structurally via the built `_headers` two-hash check (Step 1);
  no unit test can execute `index.html`.

## Done criteria (ALL must hold)

- [x] `pnpm verify` exits 0
- [x] `grep -n "location.hash" app/src/ -r` returns no matches (capture moved to index.html)
- [x] `grep -c "replaceState" app/index.html` returns 1
- [x] `grep -n "Secure" app/src/lib/cookies.ts landing/lib/cookies.ts app/src/i18n/index.ts` finds all three
- [x] `grep -n "beforeSendTransaction" app/src/lib/observability/sentry.ts` finds it
- [x] `app/dist/_headers` `script-src` lists two hashes (check after a build)
- [x] Only in-scope files changed; no commit made
- [x] `plans/README.md` row updated

> **Execution note (2026-09-10):** Implemented in the working tree; verified by greps + the green suites at convex 609 /
> app 479 / landing 24 / integration 6.

## STOP conditions

- The snippets above do not match the live files (drift).
- Moving the capture to `index.html` breaks the login flow in a local run (`pnpm dev:app` then complete
  OAuth): STOP and report rather than adding fallbacks.
- Any code other than `AuthSuccessPage` reads `window.location.hash` (grep first); report the site
  before changing behavior.
- `app/dist/_headers` still lists one hash after the build (the generator did not pick up the new
  script): do not weaken the CSP; report.

## Maintenance notes

- Any future inline script in `index.html` is automatically hashed; do not add `script-src` domains for
  it.
- The `#session=` contract is owned by `convex/http.ts:115` (plan 012 adds `Cache-Control: no-store`
  there). If the fragment format changes, `index.html` and `AuthSuccessPage` must change together.
- Reviewer: check that the inline script runs before `main.tsx` (module scripts are deferred, so a
  classic inline script in `<head>` is always earlier), and that no request URL containing
  `session=` can reach Sentry in tests.
