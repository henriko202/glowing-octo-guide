# R12 — CTA microcopy and the fear beside the button

> **Status:** DONE · **Priority:** P2 · **Effort:** S · **Category:** Landing copy / App copy
> **Depends on:** [[R11]] (the audience sets the verbs), [[R03]] and [[R01]] (in-app CTA labels) · **Blocks:** none

## Principle

**The CTA answers three questions before the click: what happens, how long it takes, what it
costs. "Start free" answers none of them.** A click trigger, the small line under the button,
answers the objection the reader has at that exact moment; for this product that objection is
"will this get my LinkedIn account restricted?", and it is answered in the FAQ, far from the
button. Match the CTA to the funnel stage: a cold visitor in the nav needs less commitment than a
warm one on the pricing table.
Sources: [write the CTA microcopy](https://x.com/richardrx/status/2058875777739866490),
["Start free" is the weakest CTA](https://x.com/richardrx/status/2045154631974539650),
[click triggers](https://x.com/richardrx/status/2002076748112875558),
[match the CTA to the funnel stage](https://x.com/richardrx/status/1986836679953719632),
[answer the fear two centimetres from the button](https://x.com/richardrx/status/2087142982705201423).

## Summary

Every landing CTA says "Start free" or "Start free with LinkedIn" while the trial requires a card.
The three plan cards use the same label. The disclaimer under the hero button answers cost and
nothing else. The two fears specific to this product, account safety and automation, sit in the
FAQ near the bottom of the page. In the app, the three plan CTAs disagree with each other.

## Evidence

- `landing/i18n/dictionaries/en.json:12` — nav "Start free"; `:20` hero "Start free with LinkedIn"; `:21` disclaimer "Card required · No charge until 50 interactions or 7 days · Cancel anytime"; `:167`, `:179`, `:192` plan CTAs "Start free"; `:229-230` final CTA.
- `landing/components/Hero.tsx:52`, `:59`, `Nav.tsx:77`, `Pricing.tsx:96`, `FinalCTA.tsx:31` — the CTA anchors; all carry `plan` and `interval`.
- `landing/i18n/dictionaries/en.json:201-202`, `:205-206` — FAQ answers on account safety and automation, below the fold.
- `landing/i18n/dictionaries/en.json:19` — hero sub-line "Every action is yours. Nothing automated." already sits near the CTA; keep it and sharpen it.
- `app/src/i18n/locales/en.json:192`, `:203`, `:215` — in-app plan CTAs "Start free trial" / "Get Growth" / "Get Pro".

## Root cause

"Start free" was the template label. The trial rules were added under it as a disclaimer, and
the fears were answered in the FAQ because that is where questions go.

## What we need to do

1. **Hero CTA.** "Start my 7-day trial with LinkedIn": what happens (LinkedIn sign-in), how long (7 days). Keep the cost disclaimer. Add a second trigger line for the fear: "Official LinkedIn sign-in · Nothing automated · Within LinkedIn's terms". Every word must stay true: sign-in is OIDC only, no API writes, every action is manual (memory `linkedin-api-access-constraints`).
2. **Nav CTA.** "Start 7-day trial", the lowest-commitment wording, for the cold visitor.
3. **Plan CTAs.** "Start 7-day {{plan}} trial" on all three; Enterprise keeps "Talk to us".
4. **Final CTA.** Mirror the hero, including the trigger line.
5. **In-app consistency.** Pre-card plan CTAs follow [[R03]] ("Start 7-day {{plan}} trial"); card holders get "Switch to {{plan}}" from [[R01]].
6. **Audience verbs.** After [[R11]], adjust the outcome words (for example "get found" vs "fill your pipeline") without touching the three answers.
7. **pt and es parity**, deslopped.
8. **Docs.** See **Docs to update**.

## Do / Don't

For the implementing agent. Each line names the mechanism it relies on and links the source.

**Do**

- **Make every CTA answer three questions**: what happens, how long, what it costs. "Start free in 30s" answers two; "Sign up" answers none ([@richardrx · 2026-05-25](https://x.com/richardrx/status/2058875777739866490)).
- **Put one click trigger under the primary CTA that names the top fear**: "7-day trial, card required, nothing charged before 50 interactions or day 7" ([@richardrx · 2025-12-19](https://x.com/richardrx/status/2002076748112875558)); place it exactly where the objection lives ([@richardrx · 2026-08-13](https://x.com/richardrx/status/2087885887895904369)).
- **Answer each fear beside the button where it occurs.** Reversibility at the pricing CTA, "what happens to my LinkedIn" at the hero CTA; the FAQ is the worst container for a fear ([@richardrx · 2026-08-11](https://x.com/richardrx/status/2087142982705201423)).
- **Match the verb to the stage.** Hero: the outcome; pricing: "Start 7-day Growth trial"; checkout: "Start my trial"; four words or fewer ([@richardrx · 2025-11-07](https://x.com/richardrx/status/1986836679953719632)).
- **Repeat the CTA about every 1.5 sections** with the same outcome wording ([@richardrx · 2025-11-10](https://x.com/richardrx/status/1987842649261261240)).
- **Give the primary button contrast by position, size and colour** against its surroundings ([@richardrx · 2026-04-28](https://x.com/richardrx/status/2049215050997784774)); users scan, so it has to be findable in a glance ([@richardrx · 2026-04-08](https://x.com/richardrx/status/2042013751742705816)).
- **Check the triggers in the user's context**: mobile widths, pt and es string lengths, a slow connection ([@richardrx · 2026-07-14](https://x.com/richardrx/status/2077010741995917659)).
- **Treat the hero as the login screen.** The app has no login page: an unauthenticated visitor bounces to the landing or straight into OAuth (`app/src/App.tsx:39`), so the trust line beside the CTA must say what the LinkedIn sign-in can and cannot do: name, photo and email only (`convex/linkedin/oauth.test.ts:17`), never a post, comment or reaction on the member's behalf, never a LinkedIn password ([@richardrx · 2026-05-29](https://x.com/richardrx/status/2060438993959882966), [@richardrx · 2026-06-29](https://x.com/richardrx/status/2071546806987538924)).
- **Show the product, alone.** A real screenshot of the feed card with the reaction row, no stock hands, no mockup with a face; three bullets and the screenshot for the skimmer, the long copy for the technical minority ([@richardrx · 2026-02-21](https://x.com/richardrx/status/2025246347587162602), [@richardrx · 2025-10-21](https://x.com/richardrx/status/1980599192624968189), [@richardrx · 2026-02-09](https://x.com/richardrx/status/2020815036168437814)).
- **Keep every component consistent.** Before the purchase the page is the only evidence of quality the visitor has; a section that looks assembled from defaults reads as an unfinished product ([@richardrx · 2025-11-18](https://x.com/richardrx/status/1990742862065959285)).

**Don't**

- **Don't A/B test button colours.** The label moves conversion, and the traffic cannot read a colour test anyway ([@richardrx · 2026-05-25](https://x.com/richardrx/status/2058875777739866490), [@richardrx · 2026-06-01](https://x.com/richardrx/status/2061463480868229189)).
- **Don't write "Start free" alone.** No value, no risk reduction, no urgency; the weakest CTA there is ([@richardrx · 2026-04-17](https://x.com/richardrx/status/2045154631974539650)).
- **Don't hide the card requirement in the trigger.** "No card" would be a lie; "card required, nothing charged before…" is the honest trigger, and a lie here is churn later ([@richardrx · 2026-04-29](https://x.com/richardrx/status/2049568514311172355)).
- **Don't put "Watch the video" or "Learn more" before the primary action.** A click is a decision and it competes with the CTA ([@richardrx · 2026-08-05](https://x.com/richardrx/status/2084988776053452923)).
- **Don't link out from the CTA area** ([@richardrx · 2026-02-05](https://x.com/richardrx/status/2019514730696565238)).
- **Don't stack trigger lines into a paragraph.** One line; an icon with three words beats a wall of text ([@richardrx · 2026-01-08](https://x.com/richardrx/status/2009227121441341734)).
- **Don't rely on a face looking at the button.** Gaze cues direct attention; they do not close the sale ([@richardrx · 2026-08-06](https://x.com/richardrx/status/2085417138358210700)).

## Acceptance criteria

- [x] No CTA on the landing or in the app says "Start free".
- [x] Every trial CTA names the trial length; the plan cards name the plan.
- [x] The fear line sits under the hero and final CTAs and states only verifiable facts.
- [x] pt and es match en.
- [x] `pnpm verify` is green (typecheck + lint + tests).
- [x] `docs/PLATFORM.md` updated (see **Docs to update**).

## Risks / edge cases / open questions

- **Length in pt and es.** "Start my 7-day trial with LinkedIn" grows in translation; test the hero at mobile widths.
- **"7-day" vs the 50-rule.** The button names the length; the disclaimer keeps both rules ([[R02]] owns the honesty of the rule).
- **"Within LinkedIn's terms" is a legal claim.** Keep it factual and run it through [[B29]].
- **Do not reintroduce** "boost each other" or reciprocal-pod wording (locked decision).

## Docs to update

- `docs/PLATFORM.md` §15 (Landing) — the CTA table (location, label, trigger line, href).
- `docs/PLATFORM.md` §14 (BillingPage) — the CTA labels, if [[R03]] has not already documented them.

## References

- Related: [[R01]], [[R02]], [[R03]], [[R11]], [[B29]].
- Prior art / plan: memory `landing-conversion-redesign` (CTA hrefs carry plan and interval); memory `linkedin-api-access-constraints` (OIDC-only, manual handoff).
- Principle sources: [@richardrx · 2026-05-25](https://x.com/richardrx/status/2058875777739866490), [@richardrx · 2026-04-17](https://x.com/richardrx/status/2045154631974539650), [@richardrx · 2025-12-19](https://x.com/richardrx/status/2002076748112875558), [@richardrx · 2025-11-07](https://x.com/richardrx/status/1986836679953719632), [@richardrx · 2026-08-11](https://x.com/richardrx/status/2087142982705201423).
