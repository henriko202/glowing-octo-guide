# B34 — No served-response smoke test for crawler/routing files

> **Status:** TODO · **Priority:** P2 · **Effort:** M · **Category:** testing/SEO
> **Depends on:** — · **Blocks:** confidence that `/robots.txt`, `/sitemap.xml`, `/llms.txt`, and per-locale pages are reachable as served

## Summary

The landing's crawler-facing files depend on routing behaviour — locale middleware, the dot-path bypass, and the
metadata routes. Verification so far has read build artifacts (`.next/server/app/*.html`, `robots.txt.body`,
`sitemap.xml.body`), which proves what was generated but not what the Worker actually serves. A regression in
`middleware.ts` or the OpenNext adapter could redirect those paths and go unnoticed.

## Evidence

- `landing/middleware.ts:30-36` — `bypassLocaleRouting` includes `pathname.includes('.')`; every crawler file depends on
  that single condition.
- `landing/app/robots.ts` and `landing/app/sitemap.ts` — metadata routes emitted at the root, outside `/[lang]`.
- `landing/public/llms.txt`, `landing/public/pricing.md`, `landing/public/og.png`, `landing/public/logo.png` — static
  files whose correct serving also depends on the dot-path bypass.
- 2026-09-10 review: verification read `.next` bodies; no dev server or preview was started.

## Root cause

The landing has unit tests (middleware matcher, metadata helpers) but no smoke test against a **running** server, and
the build output was treated as the artifact.

## What we need to do

1. Add `landing/scripts/smoke-seo.mjs` that builds, starts `next start` (or `opennextjs-cloudflare preview`), then:
   - fetches `/robots.txt`, `/sitemap.xml`, `/llms.txt`, `/pricing.md`, `/og.png`, `/logo.png` and asserts `200` with
     no redirect hop (`redirect: 'manual'` or check `response.redirected === false`);
   - fetches `/en`, `/pt`, `/es` and asserts the expected `<link rel="canonical">`, `hreflang` self-entry + `x-default`,
     and one `application/ld+json` block;
   - exits non-zero with the failing URL on any mismatch.
2. Add a root script `smoke:landing` (and optionally run it in Cloudflare Workers Builds post-deploy against the
   deployment URL).
3. Assert the negative: temporarily removing the dot-path bypass must make the script fail (documented in the script's
   own README or a comment in the plan, not committed as a runtime path).

## Acceptance criteria

- [ ] Script passes against the current build.
- [ ] Script fails when the dot-path bypass is removed from `middleware.ts` (manual negative check).
- [ ] `pnpm verify` is green (typecheck + lint + tests)
- [ ] `docs/PLATFORM.md` updated (see **Docs to update**)

## Risks / edge cases / open questions

- Port/startup flakiness: wait for the server to answer, use a bounded retry, and kill the child process in `finally`.
- `opennextjs-cloudflare preview` needs the OpenNext build; `next start` is faster and exercises the same route/matcher
  logic. Prefer `next start` for the local gate and reserve the OpenNext preview for a manual pre-deploy check.

## Docs to update

- `docs/PLATFORM.md` §18 — add the smoke command next to the landing test bullet.
- `docs/PLATFORM.md` §15 — mention the smoke script as the guard for the "Crawl + discovery files" table.

## References

- Related: [[B33]]
- Prior art / plan: 2026-09-10 landing SEO review.
