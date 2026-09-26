# R10 — ⚖️ Verify or drop the landing SSI stats

> **Status:** DONE 2026-09-07 · **Priority:** P1 · **Effort:** S · **Category:** Landing / Proof / Compliance copy
> **Depends on:** [[R15]] (the recap is the proof the product can show), [[R11]] (decides which proof matters most) · **Blocks:** none

## Principle

**Your promise is the size of your proof.** Precise numbers convince only when the reader can
trace them; an untraceable number is a claim dressed as data, and it turns into expectation debt
the day a user checks. Proof also has a ladder: a quote card is level one, a screenshot level
two, an embedded post from another network level three, because the reader can verify it.
Sources: [precise numbers convince](https://x.com/richardrx/status/2024141244717281514),
[the four levels of testimonial credibility](https://x.com/richardrx/status/1975181466368634940),
[churn starts on the landing page](https://x.com/richardrx/status/2049568514311172355).

## Summary

The SSI explainer shows three large numbers attributed to "LinkedIn data": 45% more
opportunities, 5× more profile views in the top quartile, and 51% more likely to be contacted by
a recruiter with an SSI above 70. LinkedIn's public SSI page publishes the first figure and a
different second one (social selling leaders are 51% more likely to reach quota). The recruiter
framing and the "above 70" threshold are not LinkedIn's, and the 5× profile-views figure has no
traceable source. Two sections below, the Proof block says "We won't inflate the numbers." and
sends the visitor to check their own SSI on LinkedIn, a page LinkedIn started closing to free
members in late August 2026.

## Evidence

- `landing/i18n/dictionaries/en.json:79-93` — the three stats, each with `"source": "LinkedIn data"` (pt and es carry the same values).
- `landing/components/SSIExplainer.tsx:40-48` — renders value, label and source; the source is plain text (`:47`), no link.
- `landing/i18n/dictionaries/en.json:97-108` — the Proof section: "We just launched. We won't inflate the numbers." and "The only proof that matters is your own."; `:104-106` promise growth "measured on LinkedIn itself, not by us" and "Check your current SSI on LinkedIn"; `landing/components/Proof.tsx` links out to `linkedin.com/sales/ssi` and shows no score.
- LinkedIn's SSI page shows free members a discontinuation banner since 2026-08-27 (sources in [[R15]]); "check it on LinkedIn" stops being proof for most visitors.
- LinkedIn's public Social Selling Index page (business.linkedin.com, Sales Solutions) states that social selling leaders create 45% more opportunities and are 51% more likely to reach quota than peers with a lower SSI. Confirm the current wording and record the URL at implementation time.
- No testimonial, quote or embedded LinkedIn post exists anywhere under `landing/` (grep for `testimonial`, `blockquote`, `linkedin.com/embed`, 2026-09-05).
- Memory `landing-conversion-redesign`: "no fabricated proof on the landing" is a locked decision.

## Root cause

The stats were written from memory of LinkedIn's social-selling marketing and reframed for job
seekers. Nobody attached a URL, so nobody noticed the reframing. The Proof card delegated the
proof to a LinkedIn page the product does not control.

## What we need to do

1. **⚖️ Source each number.** Henriko finds the exact LinkedIn page or report behind each stat. Keep only the ones with a URL; store `sourceUrl` and a retrieval date next to each stat in the three dictionaries and in `docs/PLATFORM.md` §15.
2. **Match the label to the source.** 45%: "more opportunities for social selling leaders" (LinkedIn's wording). 51%: "more likely to reach quota", or drop it if the audience is job seekers ([[R11]]). 5×: drop unless a source appears.
3. **Link the source.** `SSIExplainer.tsx:47` renders an anchor to `sourceUrl` with `rel="noopener noreferrer"` and the label "Source: LinkedIn, {{year}}".
4. **Replace dropped stats with proof the product can show.** The mechanism, in LinkedIn's own pillar language (establish your brand, find the right people, engage with insights, build relationships). A real, dated screenshot of the in-app recap ([[R15]]): interactions made and received over a week (level two, real). The founder's own SSI history only if Henriko keeps Sales Navigator access; free members can no longer open the page. Later, embedded LinkedIn posts from early members (level three) in a `Testimonials` component using LinkedIn's post embed, which is the compliant path (memory `linkedin-api-access-constraints`).
5. **Rewrite the Proof card.** `en.json:104-106` in en, pt and es: the proof is the recap the member sees from day one ("every reaction and comment you make and receive, counted in the app"), not a score on LinkedIn. `Proof.tsx` drops the link-out, or keeps it as one factual line for Sales Navigator subscribers.
6. **Keep the honesty line true.** Any LinkedIn figure that stays is labeled as LinkedIn's figure for social sellers, never as "our members".
7. **pt and es parity**, then the SSG build.
8. **Docs.** See **Docs to update**.

## Do / Don't

For the implementing agent. Each line names the mechanism it relies on and links the source.

**Do**

- **Keep only numbers a reader can trace to a URL and a date.** A precise number convinces because it is traceable ([@richardrx · 2026-02-18](https://x.com/richardrx/status/2024141244717281514)).
- **Label LinkedIn's figures as LinkedIn's, about social sellers.** Population and wording match the source; "Used by Company X" proves nothing, "we cut X's churn from 12 to 6%" does ([@richardrx · 2026-04-17](https://x.com/richardrx/status/2045154631974539650)).
- **Replace dropped stats with proof the product can show**: a real, dated recap screenshot (level two), then embedded member posts (level three) as they appear ([@richardrx · 2025-10-06](https://x.com/richardrx/status/1975181466368634940)).
- **Order the proof from strong and shallow at the top to dense below.** Proof must outweigh the promise at every scroll depth ([@richardrx · 2025-11-10](https://x.com/richardrx/status/1987842649261261240)).
- **Match the proof to the doubt.** Descriptive proof (counts, logos) answers "does this work"; dynamic proof (your recap this week) answers "is this still right for me" ([@richardrx · 2026-01-09](https://x.com/richardrx/status/2009632940683153420)).
- **Use real faces and full names when testimonials arrive**; real users outconvert models ([@richardrx · 2025-11-04](https://x.com/richardrx/status/1985681720104903142)). Let a four-star quote stand; unanimity reads as fake ([@richardrx · 2026-05-14](https://x.com/richardrx/status/2054910531132183030)).
- **Keep the founder note honest.** "We just launched" is a strength beside numbers that are real.

**Don't**

- **Don't invent a member count, a rating or a "members saw X" line.** Fabricated proof is the locked no (standing decision) and fake unanimity lowers trust ([@richardrx · 2026-05-14](https://x.com/richardrx/status/2054910531132183030)).
- **Don't link out to LinkedIn's SSI page as proof.** A click out is lost conversion ([@richardrx · 2026-02-05](https://x.com/richardrx/status/2019514730696565238)), and the page is closing for free members.
- **Don't round.** "45%" stays "45%", never "almost half" ([@richardrx · 2026-02-18](https://x.com/richardrx/status/2024141244717281514)).
- **Don't use stock people or generated faces** ([@richardrx · 2025-11-04](https://x.com/richardrx/status/1985681720104903142)).
- **Don't clone another SaaS's proof wall.** Proof comes from this product's members and this research; a copied section without its research is cargo cult ([@richardrx · 2026-05-09](https://x.com/richardrx/status/2053086365781205142)).
- **Don't embed member posts without consent and the cookie gate** (see Risks).

## Acceptance criteria

- [ ] Every number on the landing links to a dated source. — every *statistic* is gone, so nothing is unsourced; the numbers that remain (four areas, 25 points each, 0–100) are LinkedIn's own definition of the index and the caption links LinkedIn's page, but it carries **no retrieval date** (see Decisions).
- [x] Every label matches its source's wording and population.
- [x] No untraceable stat remains in en, pt or es.
- [x] The Proof card no longer tells visitors to check their SSI on LinkedIn.
- [x] The landing builds and the stats block renders with links. — the stats grid is replaced by the one-line source caption, which renders its link.
- [x] `pnpm verify` is green (typecheck + lint + tests).
- [x] `docs/PLATFORM.md` updated (see **Docs to update**).

## Risks / edge cases / open questions

- **LinkedIn changes its pages.** Record the retrieval date and re-check before launch.
- **Audience mismatch.** The surviving stats describe salespeople; if [[R11]] picks job seekers, the block may shrink to the mechanism and the recap proof.
- **Proof must be real and dated.** No mock-ups; the recap screenshot comes from a real account.
- **The SSI page is closing for free members.** Any proof that says "check your SSI" is dead on arrival; [[R15]] carries the proof, and this item rewrites the copy around it.
- **Member embeds** need each member's consent (privacy, §13B) and the embed iframe sets LinkedIn cookies; gate it behind the landing's `CookieNotice.tsx` consent.

## Docs to update

- `docs/PLATFORM.md` §15 (Landing) — a stats table with source URLs and retrieval dates; the Proof card copy; the testimonial component when it exists.
- `docs/PLATFORM.md` §13B (Privacy & Compliance) — only if member embeds are added.

## References

- Related: [[R11]], [[R12]], [[R14]], [[R15]].
- Prior art / plan: memory `landing-conversion-redesign` (no fabricated proof); `landing/components/Proof.tsx` (link-out pattern, retired by [[R15]]).
- Principle sources: [@richardrx · 2026-02-18](https://x.com/richardrx/status/2024141244717281514), [@richardrx · 2025-10-06](https://x.com/richardrx/status/1975181466368634940), [@richardrx · 2026-04-29](https://x.com/richardrx/status/2049568514311172355).

## Decisions (2026-09-07)

- All three stats dropped (unverifiable); source line links LinkedIn's Social Selling page. Proof card links nowhere; SSI mention only behind "Have Sales Navigator?".
- **Dropping beat sourcing.** Rather than hunt a URL for each figure, the whole stats grid came out: `ssiExplainer.stats` is deleted from all three dictionaries and `SSIExplainer.tsx` renders `sourceLine` ("Four areas, 25 points each, recalculated daily.") plus a `sourceLabel` anchor ("Source: LinkedIn") to `https://business.linkedin.com/sales-solutions/social-selling`. The 45%, 5× and 51% claims exist nowhere in the repo any more.
- **The Proof card links nowhere at all.** `proofCardLink` is deleted; `proofCardNote` ("Have Sales Navigator? Your SSI is still on LinkedIn.") is plain text, so there is no click-out and no dead promise for the free members who lost the page.
- **First box left unticked, deliberately.** The caption names LinkedIn as the source and links it, but shows no retrieval date, so "every number links to a **dated** source" is not literally true of the structural numbers (25 points per area, 0–100) that survived. Adding a date is a one-key change if Henriko wants it; nothing on the page is a research statistic today.
- **Deferred in the implementation spec §10, so nothing is claimed for it:** the dated recap screenshot (item 4's level-two proof) for the Proof card. The card carries copy only until a real, dated capture from a real account exists.
