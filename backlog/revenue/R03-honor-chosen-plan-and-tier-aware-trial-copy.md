# R03 — Honor the plan chosen on the landing, tier-aware trial copy

> **Status:** DONE · **Priority:** P1 · **Effort:** S · **Category:** Billing / Frontend
> **Depends on:** none (pairs well with [[R01]]) · **Blocks:** [[R04]] and [[R08]] reuse the `?plan=` deep-link this item adds

## Principle

**The default is the decision you made for the user, and a decision already made should not be
asked twice.** The visitor picked a plan on the landing pricing table. The billing page throws
that choice away and recommends Growth to everyone, so a Pro buyer has to find Pro again.
Richard's rule: pre-select from what you already know, compress the decision window.
Sources: [GBB and control the comparison](https://x.com/richardrx/status/1980402468673483181),
[decoy and anchor](https://x.com/richardrx/status/2044014136770580743).

## Summary

The OAuth round-trip carries `plan` and `interval` from the landing into `sessionStorage`, but the
billing page reads only `chosenInterval`. The recommended badge is hard-wired to Growth, and the
trial banner says "free Growth trial" in all three languages whatever tier the user is on. The
plan CTAs also disagree with each other ("Start free trial" on Starter, "Get Growth", "Get Pro").

## Evidence

- `convex/http.ts:21-32` — `/auth/linkedin` validates `plan` against `VALID_PLANS` (`:26-28`) and stores plan and interval on the OAuth state (`:32`); `:107` appends them to the success redirect.
- `app/src/pages/AuthSuccessPage.tsx:15-18` — stores `chosenPlan` and `chosenInterval` in `sessionStorage`.
- `app/src/pages/BillingPage.tsx:50` — reads `chosenInterval` only. No file under `app/src` reads `chosenPlan` (grep, 2026-09-05).
- `app/src/pages/BillingPage.tsx:229` — `isRecommended = planId === 'growth' && !hasCard`.
- `app/src/i18n/locales/en.json:170`, `pt.json:170`, `es.json:170` — `billing.trialBanner` names Growth regardless of `me.tier`.
- `app/src/i18n/locales/en.json:174` — `billing.newUserLead` says "Growth is the best bang for your buck" even when the visitor chose Pro.
- `app/src/i18n/locales/en.json:192`, `:203`, `:215` — plan CTAs "Start free trial" / "Get Growth" / "Get Pro" while every plan starts the same trial (`convex/billingNode.ts:44`).
- `docs/PLATFORM.md:2347-2351` — documents the storage of `chosenPlan` but names no consumer; `:98-100` describes the trial as "the tier they pick on the billing plan grid".
- `landing/components/Pricing.tsx:96`, `Hero.tsx:52`, `Nav.tsx:77`, `FinalCTA.tsx:31` — every landing CTA sends `?plan=&interval=`.

## Root cause

The 2026-06-21 trial fix threaded the plan through OAuth for a single-CTA billing page. The page
was later rebuilt as a full plan grid and the consumer was dropped. The banner and lead copy still
describe the earlier always-Growth trial.

## What we need to do

1. **Resolve a target plan in `BillingPage.tsx`.** `targetPlan` = `?plan=` query param (react-router `useSearchParams`), else `sessionStorage.chosenPlan`, else `'growth'`; validate against `PLAN_IDS` (`:12`). Replace `:229` with `isRecommended = !hasCard && planId === targetPlan`.
2. **Decide the pre-card layout (brainstorm).** Option A: keep the grid and move the badge. Option B (recommended): when `targetPlan` came from the landing or a deep-link, show that plan as a single primary card with one CTA and a "See all plans" toggle that reveals the grid. Option B is the original single-CTA design and removes a second decision.
3. **Lead copy.** Add `billing.chosenPlanLead` ("You picked {{plan}} on the site. Its 7-day trial starts below.") used when `targetPlan` came from outside; keep `newUserLead` only when the target is Growth.
4. **Tier-aware banner.** Change `billing.trialBanner` in en/pt/es to interpolate the plan name: `t('billing.trialBanner', { plan: t(\`billing.plans.${me.tier}.name\`) })`. Verify the `billing.plans.<id>.name` keys exist in all three locales before relying on them.
5. **Consistent pre-card CTAs.** All three plan CTAs become "Start 7-day {{plan}} trial" for pre-card users. Card holders get "Switch to {{plan}}" from [[R01]]. The landing side of the CTA wording is [[R12]].
6. **Clear the stash.** Remove `chosenPlan` and `chosenInterval` from `sessionStorage` once `handleUpgrade` has a checkout URL, so a later visit in the same tab does not re-nudge.
7. **Tests.** `BillingPage.test.tsx`: the badge follows `?plan=pro`; the badge follows `sessionStorage.chosenPlan`; Growth stays the fallback; the banner interpolates the tier. Locale parity test stays green (add the new keys to all three files).
8. **Docs.** See **Docs to update**.

## Do / Don't

For the implementing agent. Each line names the mechanism it relies on and links the source.

**Do**

- **Pre-select from what you already know.** The plan arrived on the URL, so the billing page shows it as the decision already made and asks only for the card; "pre-select the right plan from data you collected instead of asking" ([@richardrx · 2026-04-16](https://x.com/richardrx/status/2044785090832543998)). The default takes 60 to 80% of choices ([@richardrx · 2026-05-22](https://x.com/richardrx/status/2057872036718899256)).
- **Take decisions one at a time.** Plan on the landing, card on billing; Apple sells 69 SKUs by never showing more than one choice per screen ([@richardrx · 2026-09-03](https://x.com/richardrx/status/2095539158592729523)).
- **Give one card the weight and ghost the rest.** Von Restorff: the odd element gets the attention; three equal cards get none ([@richardrx · 2026-01-22](https://x.com/richardrx/status/2014317885494059106)).
- **Keep the anchor in view.** Pro, or the Enterprise line, is what makes Growth look cheap; a single card without an anchor loses the comparison the buyer needs ([@richardrx · 2025-10-20](https://x.com/richardrx/status/1980402468673483181), [@richardrx · 2026-04-14](https://x.com/richardrx/status/2044014136770580743)).
- **Reinforce the landing decision in the lead**: "You picked Growth on the site." The buyer wants to hear they chose right before typing a card number ([@richardrx · 2026-04-29](https://x.com/richardrx/status/2049392897598849333)).
- **Match the CTA to the stage.** One step from paying, the verb is "Start 7-day Growth trial": four words, the outcome in the label ([@richardrx · 2025-11-07](https://x.com/richardrx/status/1986836679953719632), [@richardrx · 2026-05-25](https://x.com/richardrx/status/2058875777739866490)).
- **Keep annual as the default interval**, monthly behind the toggle ([@richardrx · 2025-11-06](https://x.com/richardrx/status/1986454460281836026)).

**Don't**

- **Don't ask the plan question twice.** A decision re-opened is a decision re-litigated, and the tab closes; compress the window between decision and card ([@richardrx · 2026-05-11](https://x.com/richardrx/status/2053832356293738914)).
- **Don't override a stated choice.** A visitor who chose Pro and sees "Recommended: Growth" reads a bait-and-switch; the page promised one thing and the product shows another ([@richardrx · 2026-04-29](https://x.com/richardrx/status/2049568514311172355)).
- **Don't render three cards at equal weight.** Neutrality is omission ([@richardrx · 2026-05-05](https://x.com/richardrx/status/2051672248348479691)).
- **Don't add a comparison table to the billing page.** The comparison happened on the landing; each extra element at the payment step is lost conversion ([@richardrx · 2025-12-12](https://x.com/richardrx/status/1999584679247134761)).
- **Don't print the raw tier id.** The words the user read on the landing are the words they expect on the card; customer language is on the checklist ([@richardrx · 2026-01-02](https://x.com/richardrx/status/2007216871607771303)).
- **Don't drop the Enterprise line** when the grid collapses to one card (see Risks).

## Acceptance criteria

- [x] A visitor who clicked "Start free" on Pro sees Pro recommended (or as the single primary card) on `/billing`. (The landing CTA now reads "Start 7-day Pro trial" — R12.)
- [x] `/billing?plan=growth` highlights Growth without any `sessionStorage` state.
- [x] A user trialing Starter or Pro sees their own plan name in the trial banner in en, pt and es.
- [x] All three pre-card plan CTAs use the same "Start 7-day … trial" pattern.
- [x] `pnpm verify` is green (typecheck + lint + tests).
- [x] `docs/PLATFORM.md` updated (see **Docs to update**).

## Risks / edge cases / open questions

- **Single card vs. grid (Option B).** Hiding the grid behind a toggle lowers choice but may hide the anchor (Pro) that makes Growth look cheap. Keep the Enterprise line visible in both layouts.
- `sessionStorage` is per tab. A user who signs in on one tab and opens `/billing` in another loses the choice; the `?plan=` param covers deep-links, and the Growth fallback covers the rest.
- Plan names in copy: use the localized plan name keys, never the raw tier id.
- This item touches the same `BillingPage.tsx` regions as [[R01]]; plan the two together or land R01 first.

## Docs to update

- `docs/PLATFORM.md` §14 (BillingPage) — target-plan resolution order (query param → sessionStorage → Growth), the single-card layout if chosen, the tier-aware banner.
- `docs/PLATFORM.md` §8 (Trial model) — "the tier they pick on the landing or the billing page".
- `docs/PLATFORM.md` §15 (Landing CTAs) — note that the app now consumes the `plan` parameter.

## References

- Related: [[R01]], [[R04]], [[R08]], [[R12]].
- Prior art / plan: memory `landing-conversion-redesign` (TRIAL-FIX 2026-06-21 threaded the plan through OAuth); `docs/PLATFORM.md` §14 AuthSuccessPage.
- Principle sources: [@richardrx · 2025-10-20](https://x.com/richardrx/status/1980402468673483181), [@richardrx · 2026-04-14](https://x.com/richardrx/status/2044014136770580743).
