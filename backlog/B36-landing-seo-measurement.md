# B36 — Landing SEO has no measurement baseline

> **Status:** TODO · **Priority:** P2 · **Effort:** S · **Category:** SEO/ops
> **Depends on:** — · **Blocks:** knowing whether the 2026-09-10 SEO work moved anything

## Summary

The landing now ships metadata, JSON-LD, robots/sitemap, `llms.txt` and `pricing.md`, but nothing records a baseline
or a target, so the outcome the user asked for ("appear on Google and other search providers even better") is
unmeasurable. The AI-crawler policy half of the original item is **decided** (see below); only measurement remains.

## Evidence

- `landing/public/` — no Search Console / Bing verification file; `landing/.env.example` has no verification token.
- `docs/PLATFORM.md` §15 — documents the crawl files but no measurement or monitoring step.
- `landing/app/robots.ts:13-30` — allow-all policy, training crawlers included (owner decision, 2026-09-10); this part
  is done, not open.

## Root cause

The change was implemented and verified for correctness (tags present, build green), not for outcome. Verification and
measurement were treated as the same thing.

## What we need to do

1. Verify `www.linkintothessi.com` in **Google Search Console** and **Bing Webmaster Tools** (DNS TXT preferred so no
   token lands in the repo); submit `${SITE_URL}/sitemap.xml` in both.
2. Record a date-stamped baseline: 28-day impressions / clicks / average position and the priority query set
   (`LinkedIn SSI`, `Social Selling Index`, `LinkedIn SSI tool`, `improve LinkedIn SSI`, plus localized variants).
3. Add a monthly manual check (Search Console coverage + the ai-seo 20-query loop) to the ops routine; automate later
   if it proves worth it.

## Acceptance criteria

- [ ] GSC + Bing verified, sitemap submitted, baseline captured with a date.
- [ ] `pnpm verify` is green (typecheck + lint + tests)
- [ ] `docs/PLATFORM.md` updated (see **Docs to update**)

## Risks / edge cases / open questions

- Verification tokens are per-account secrets; use DNS TXT so nothing sensitive enters the repo or build env.
- Google AI Overviews have no separate Search Console report; use core Performance/Coverage as the proxy (per the
  ai-seo skill).

## Docs to update

- `docs/PLATFORM.md` §15 — add the measurement/monitoring note.
- `docs/PLATFORM.md` §18 — tooling/ops: where the baseline and monthly check live.

## References

- Related: [[B34]]
- Prior art / plan: 2026-09-10 landing SEO review. Crawler policy decided the same day (allow training crawlers;
  `docs/PLATFORM.md` §15 "Crawl + discovery files").
