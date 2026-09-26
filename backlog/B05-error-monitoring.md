# B05 — No production error monitoring wired

> **Status:** TODO · **Priority:** P0 · **Effort:** M · **Category:** Ops/Observability
> **Depends on:** — · **Blocks:** ability to detect any of the other silent failures ([[B01]] token refresh, [[B02]] AI 404, [[B04]] webhook write) in production

## Summary

There is no production error monitoring anywhere in the stack. Backend errors are only `console.error`'d into Convex logs; there is no capture/alerting for unhandled action/mutation failures, HTTP webhook failures (Stripe / LinkedIn OAuth), or frontend render errors. The React app has **no** top-level error boundary, so a render crash blanks the page with nothing reported. This is the single biggest ops gap: every other P0 in this backlog fails *silently* today, and without monitoring no one will know. A `convex-sentinel` skill is available but was never set up.

## Evidence

- Repo-wide search for `Sentry` / `Sentinel` / `captureException` / `ErrorBoundary` / `componentDidCatch` / `Rollbar` / `Bugsnag` / `Datadog` matches **only** docs, `.agents/skills/*`, `skills-lock.json`, `package-lock.json`, and one unrelated test — **zero** hits in `app/src/**` or `convex/**` production code.
- `app/src/main.tsx:12-22` — the root render tree is `StrictMode > ThemeProvider > ConvexProvider > BrowserRouter > App`. **No error boundary** wraps `App`.
- `app/src/App.tsx` — search for `ErrorBoundary` / `componentDidCatch` / `catch` / `error`: **no matches**. No top-level render-error handling.
- Backend error handling is log-only, e.g.:
  - `convex/http.ts:116-124` — OAuth callback `catch` block does `console.error('OAuth callback error:', …)` then redirects; nothing is captured/alerted.
  - `convex/http.ts:177-179` — Stripe `onEvent` just `console.log('[Stripe webhook]', …)`; a failing webhook handler is invisible beyond logs.
  - `convex/ai/openrouter.ts:41` — `console.error` on a failed AI call (the [[B02]] 404 would land here and nowhere else).
  - `convex/linkedin/oauth.ts:42` — `console.error` on token-exchange failure.
- `.agents/skills/convex-sentinel/SKILL.md` — a Sentinel setup skill exists (self-hosted error capture in the Convex deployment) but has not been applied.

## Root cause

Observability was never added — the app ships errors to `console` and relies on manual log inspection. No capture library, no alert sink, no frontend boundary. Because the product is pre-launch, this simply hasn't bitten yet, but it means the other silent P0s have no detection path.

## What we need to do

1. **Backend capture — use Convex Sentinel** (matches the available `convex-sentinel` skill; self-hosted inside the deployment, so no new external sub-processor to disclose — important for the compliance program). Wire it to capture:
   - unhandled action/mutation/query errors,
   - the HTTP webhook `catch`/failure paths (`convex/http.ts` OAuth callback `:116`, Stripe handlers `:139-176`),
   - scheduled-job (cron/action) failures — the [[B01]] refresh cron, retention cron, AI scheduled `predictReaction` (`convex/posts.ts:269`).
   Prefer capturing at the existing seams (the `catch` blocks and the `openrouter.ts`/`oauth.ts` error paths) rather than sprinkling try/catch everywhere.
2. **Frontend error boundary.** Add a top-level React `ErrorBoundary` in `app/src` wrapping `<App/>` in `main.tsx:16-18` (inside `BrowserRouter` or just around `App`). It must (a) render a friendly fallback instead of a blank page, and (b) report the caught error to the monitoring sink. React 19/18 class-based boundary or a small existing library — do **not** add a heavy dependency for one boundary (ponytail: a ~40-line class component is enough).
3. **Define the alert sink.** Decide where captured errors go (Sentinel dashboard is the default; add an alerting channel only if Henriko wants push). Keep it minimal — the goal is "someone finds out", not a full APM.
4. **PII scrubbing — CRITICAL for compliance.** Whatever is captured must **never** log tokens, emails, or personal data. Concretely:
   - LinkedIn access/refresh tokens (`users.linkedinAccessToken/linkedinRefreshToken`) — the [[B01]] refresh path and `oauth.ts` handle these; ensure error payloads never include them.
   - `email` (`users.email`) and any userinfo fields.
   - The `openrouter.ts:41` error path logs `await res.text()` (the model response body) — scrub/limit it; AI request content includes post text.
   - Stripe customer/subscription ids are lower-risk but avoid dumping full event objects.
   Add a scrub step (allowlist of safe fields, or a denylist of token/email keys) at the capture boundary. Cross-link the compliance items (memory `privacy-compliance-program`): monitoring must not become a new place PII leaks.
5. **Scope guard.** Capture *errors*, not routine 302 redirects or expected "not signed in" returns (e.g. `EMPTY_PAGE` in `feed.ts:87`, the `getMe`/`getMyPosts` empty-session paths). Noise defeats the purpose.

## Acceptance criteria

- [ ] Backend unhandled errors (actions/mutations/queries), webhook failures, and cron/scheduled-action failures are captured to a durable sink, not just `console`.
- [ ] A top-level React error boundary renders a fallback and reports render crashes.
- [ ] Captured payloads are verified to exclude tokens, emails, and personal data (PII scrub in place and tested).
- [ ] The [[B02]] AI-404 and a simulated webhook failure both show up in the sink.
- [ ] No new external sub-processor is introduced without updating compliance docs (Sentinel self-hosted preferred).
- [ ] `pnpm verify` is green (typecheck + lint + tests).
- [ ] `docs/PLATFORM.md` updated (see **Docs to update**).

## Risks / edge cases / open questions

- **PII is the main risk.** A monitoring tool that captures request args/state can silently exfiltrate tokens/emails — the scrub must be default-deny at trust boundaries. Do not simplify this away.
- Convex Sentinel self-hosting keeps data in-deployment (no third-party sink) — confirm that's the chosen posture so compliance docs don't need a new sub-processor entry.
- Error boundaries only catch render errors, not async/event-handler errors — pair with the Convex client's error surfacing for mutation/action failures shown to users.
- Volume/cost: cap captured payload size (esp. the `openrouter.ts` response body) so a chatty error path can't blow up storage.
- Pre-launch: safe to wire now; no historical data to migrate.

## Docs to update

- `docs/PLATFORM.md` §2 (System Architecture) or §17 (Security Posture) — add an observability/monitoring subsection: what's captured, where it goes, PII scrubbing guarantees.
- `docs/PLATFORM.md` §17 → "Compliance Documentation" — confirm no new sub-processor (or add one if a third-party sink is chosen).
- `docs/PLATFORM.md` §14 (Frontend — Authenticated App) — note the top-level error boundary in the bootstrap description.

## References

- Related: [[B01]], [[B02]], [[B04]] (the silent failures monitoring must surface)
- Prior art / plan: `.agents/skills/convex-sentinel/SKILL.md`
- Memory: `privacy-compliance-program`, `apify-dormant-compliance-gate` (compliance sub-processor discipline)
