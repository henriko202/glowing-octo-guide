# R13 — ⚖️ Pricing decoy and monthly visibility

> **Status:** DONE 2026-09-08 · **Priority:** P2 · **Effort:** M · **Category:** Pricing / Landing / Billing / Env
> **Depends on:** none (sequence after [[R03]], which edits the same BillingPage constants) · **Blocks:** none

**Decision (Henriko, 2026-09-07):** Starter $10 / $100 (decoy under Growth), monthly demoted to a text link, one
value axis (interactions per post), fixed featured-post cap bonus +25/+50/+100 for R17.

## Principle

**Price is a filter, and the comparison is yours to design.** Good-Better-Best works when the
middle plan sits a small step above Good and a big step below Best, so Better reads as the
obvious deal. Rows follow serial position (first and last are remembered), each card leads with
one value axis the reader can compare without reading, and the monthly price stays out of the
default view so the annual price is the offer rather than the commitment.
Sources: [Good-Better-Best](https://x.com/richardrx/status/1980402468673483181),
[decoy and anchor](https://x.com/richardrx/status/2044014136770580743),
[anchor at both extremes](https://x.com/richardrx/status/2006022937770414515),
[serial position in pricing rows](https://x.com/richardrx/status/2029623167900061970),
[one value axis per table](https://x.com/richardrx/status/2018357024543715480),
[hide the monthly plan](https://x.com/richardrx/status/1986454460281836026).

## Summary

Plans are $5, $15 and $50 a month, with annual at ten times monthly. Starter at $5 anchors the
page on "cheap" and Growth is three times Starter, so the decoy does not fire. Monthly and annual
sit side by side behind a toggle, and the eye lands on the smaller number. Enterprise is a text
line. The plan cards mix five axes (posts per week, interactions, featured posts, targeting, AI).

## Evidence

- `landing/components/Pricing.tsx:8-11` — `MONTHLY_PRICES` 10 / 15 / 50 (Starter raised, not $5); `:13-21` `priceLabel` (annual = monthly × 10); `:24` annual is the default; `:40-46` the annual/monthly text link (`seeMonthly` / `seeAnnual`) that replaced the toggle; `:62-67` the recommended badge; `:78-80` the one value axis (`plan.axis`); `:109` the trial note; `:110-117` the Enterprise line, whose floor follows the same interval toggle as the cards.
- `app/src/lib/planPrices.ts` — `PLAN_PRICES` now lives here, not in `BillingPage.tsx` (shared with the no-trial card-gate surfaces); `app/src/pages/BillingPage.tsx:22` imports it, `:29-31`/`:34-36` the six `VITE_STRIPE_*` price ids (monthly / annual).
- `convex/lib/stripePrices.ts:13-18` — the six backend `STRIPE_*_PRICE_ID` env vars.
- `landing/i18n/dictionaries/en.json:136` — "2 months free if you pay annually"; `:138-141` the Enterprise line (`enterprisePriceMonth` "$100/mo" / `enterprisePriceYear` "$1,000/yr", picked by the interval toggle); `:148`, `:156`, `:169` the plan feature lists.
- `convex/lib/planLimits.ts:28-29` — the candidate value axes: interactions per post 25 / 50, posts per week 1 / 2, featured 0 / 1.
- `docs/PLATFORM.md:75-85` — the tier table with prices; §16 lists the env vars.
- Memory `prelaunch-no-prod-data`: no paying users exist, so no grandfathering is needed.

## Root cause

Prices were set as round numbers for three tiers with no anchor design, and annual pricing was
added as a ten-times shortcut.

## What we need to do

This is a decision document. The brainstorm picks the structure; the change list follows.

1. **⚖️ Choose the structure.**
   - **(a) Raise Starter** to $9 to $12 so Growth at $15 reads as one step more for double the limits. Starter exists to make Growth obvious.
   - **(b) Keep $5, strip Starter** further so the comparison favors Growth on the value axis.
   - **(c) Drop Starter**: two plans plus Enterprise as the anchor.
   - **(d) Hide monthly**: annual is the visible price, monthly behind a low-emphasis "See monthly" link; monthly stays in Stripe and in the env.
   - **Recommendation: (a) with (d).** Starter $10 ($100 a year), Growth $15 ($150), Pro $50 ($500), annual visible, monthly behind a link.
2. **One value axis.** Lead every card with the same number, the one that grows across the row (interactions a post collects: 25, 50, and the Pro figure; or posts per week), and demote the rest to secondary lines. Put the strongest feature first and last in each list (serial position).
3. **Anchor with Enterprise.** Decide whether Enterprise becomes a fourth card ("from $100/mo", "Talk to us") so Pro reads mid-range, or stays a line.
4. **Implementation after the decision.** New Stripe Prices per environment in the Dashboard; the six backend env vars (`stripePrices.ts:13-18`) and the six `VITE_STRIPE_*` vars (`BillingPage.tsx:18-24`); `Pricing.tsx:8-12` and `BillingPage.tsx:29-32` (keep the two constants, one per package, and update both in the same change); the plan rows in the three dictionaries; `docs/PLATFORM.md` §1 tier table, §8, §15 and §16 env parity.
5. **First-charge disclosure.** With annual as the default, the first charge after the trial is the annual amount; the [[R02]] checkout message and the pre-charge reminder must state that amount.
6. **Tests.** `priceLabel` math if it changes; BillingPage price rendering; locale parity for new keys.
7. **Docs.** See **Docs to update**.

## Do / Don't

For the implementing agent. Each line names the mechanism it relies on and links the source.

**Do**

- **Give each plan a job.** Starter is the decoy that makes Growth obvious, Pro is the anchor that makes Growth cheap; a plan without a job has no place on the page ([@richardrx · 2026-05-28](https://x.com/richardrx/status/2059951433827426437)).
- **Keep the ladder on one axis** (interactions, posts, featured) so the differences are visible almost without reading ([@richardrx · 2026-02-02](https://x.com/richardrx/status/2018357024543715480), [@richardrx · 2025-10-20](https://x.com/richardrx/status/1980402468673483181)).
- **Price Growth closer to Starter than to Pro**, so the reader thinks "a little more for double" ([@richardrx · 2026-02-03](https://x.com/richardrx/status/2018693884449009956)).
- **Order each card's rows by serial position**: killer feature first, utilities in the middle, the differentiator or the loss hook last, next to the CTA ([@richardrx · 2026-03-05](https://x.com/richardrx/status/2029623167900061970)).
- **Default to annual and keep monthly as a low-emphasis link**, present so nobody feels trapped ([@richardrx · 2025-11-06](https://x.com/richardrx/status/1986454460281836026), [@richardrx · 2026-05-22](https://x.com/richardrx/status/2057872036718899256)).
- **Set the floor from cost plus margin** (tokens per member count) **and the ceiling from what the job is worth** to the ICP, then move up when value is easy to prove ([@richardrx · 2026-08-03](https://x.com/richardrx/status/2084250609687884144)).
- **Change price for new customers only**, decided by willingness-to-pay research on the ICP; 1% on price beats 1% on acquisition ([@richardrx · 2026-06-03](https://x.com/richardrx/status/2062127283977019757)).
- **If tier names change, pick by the metric.** Aspirational names sell more units; plain names shift the mix up ([@richardrx · 2026-08-26](https://x.com/richardrx/status/2092692547244007852)).
- **Price toward the value delivered, never toward the cheapest pod.** The founder sees every limitation; the buyer sees the problem solved. A price raise keeps most of the base and what stays is almost pure cash, while a channel grown by the same share costs money and has a ceiling ([@richardrx · 2026-06-29](https://x.com/richardrx/status/2071634185228329219)).

**Don't**

- **Don't A/B test the price.** There will never be the volume ([@richardrx · 2026-06-01](https://x.com/richardrx/status/2061463480868229189)).
- **Don't show a $0 plan first.** The first number anchors everything above it as expensive ([@richardrx · 2026-04-14](https://x.com/richardrx/status/2044014136770580743)).
- **Don't add a fourth card.** Four or more triggers the paradox of choice; Enterprise stays a line ([@richardrx · 2026-05-28](https://x.com/richardrx/status/2059951433827426437)).
- **Don't undercut the cheapest competitor.** Price as bait filters in the client you least want ([@richardrx · 2026-06-03](https://x.com/richardrx/status/2062314549483589691)).
- **Don't mix axes in the comparison** ("50 interactions" against "priority support") ([@richardrx · 2026-02-03](https://x.com/richardrx/status/2018693884449009956)).
- **Don't stack bonuses or "worth $X" anchors.** Past a point they read as desperation ([@richardrx · 2025-10-23](https://x.com/richardrx/status/1981338127592570944)).
- **Don't raise prices on the existing base**; new customers only, with what improved ([@richardrx · 2026-06-03](https://x.com/richardrx/status/2062127283977019757)).
- **Don't put monthly beside annual at equal weight.** The buyer anchors on the smaller number and pays more over the year ([@richardrx · 2025-11-06](https://x.com/richardrx/status/1986454460281836026)).
- **Don't invent a struck-through "was $X" price.** Framing the truth is persuasion; inventing one is the deceptive-design line ([@richardrx · 2026-01-06](https://x.com/richardrx/status/2008610564222672914)).
- **Don't add a free plan.** Freemium lifts signups and crushes the economics: in the source's funnel the free plan yields roughly a tenth of the MRR at a far higher cost per payer, and free members burn AI tokens; the card-required trial is the filter ([@richardrx · 2026-07-01](https://x.com/richardrx/status/2072312844784152628)).

## Acceptance criteria

- [x] The chosen structure is written in `docs/PLATFORM.md` §15 with the reasoning.
- [x] Growth is the visible best deal by construction, not only by the badge.
- [x] Each plan card leads with the same value axis.
- [x] Backend and `VITE_` price ids match in every environment (§16 parity) — **done 2026-09-10**: the new $10/$100
      Starter Prices exist in Stripe (test mode) and the env vars are repointed (manual, PLATFORM §8).
- [x] The "2 months free" line matches the math.
- [x] `pnpm verify` is green (typecheck + lint + tests) — exit 0 after the round-3 fix wave: convex 486/486, app
      421/421, `prettier --check .` and `eslint --max-warnings 0` both clean. The stray `;` in
      `app/src/components/CardGateDialog.test.tsx:76` that blocked this box is fixed in the working tree; it is still
      in `HEAD`, so the green run depends on this batch being committed.
- [x] `docs/PLATFORM.md` updated (see **Docs to update**).

## Risks / edge cases / open questions

- **Volume vs filter.** A higher Starter filters out low-intent users, which is the point, and cuts volume. Decide before launch and measure after; do not A/B before there is traffic.
- **Never change prices while a trial is live.** Pre-launch only; after launch, new prices need new Stripe Price objects and a migration plan.
- **Currency.** USD only; BRL and PIX are out of scope here.
- **~~The $100 collision~~ — RESOLVED 2026-09-08.** Raising Starter to $100/yr put the same number on the page twice:
  on the annual grid (the default) the cards read $100/yr, $150/yr, $500/yr and the anchor line under them read
  "Enterprise from $100/mo", so the top tier showed the *cheapest* number on the page — the ladder inverted at exactly
  the point it is supposed to peak. Fixed by making the Enterprise floor follow the same interval toggle the cards
  already follow (`enterprisePriceMonth` / `enterprisePriceYear`); the annual form is the page's own ×10 rule, so no
  new price was invented and the negotiated-per-account reality (PLATFORM §8) is unchanged. Enterprise stays a line,
  not a fourth card.
- **The badge and the target plan.** [[R03]] moves the badge to the chosen plan; the decoy design must still make Growth the default recommendation for visitors who chose nothing.

## Docs to update

- `docs/PLATFORM.md` §1 (tier table), §8 (Stripe prices), §15 (pricing section, structure and reasoning), §16 (env parity).

## References

- Related: [[R02]], [[R03]], [[B16]] (env parity), [[B27]] (plan limits as the value axis).
- Prior art / plan: memory `landing-conversion-redesign` (pricing rework, annual default); `docs/PLATFORM.md` §16.
- Principle sources: [@richardrx · 2025-10-20](https://x.com/richardrx/status/1980402468673483181), [@richardrx · 2026-04-14](https://x.com/richardrx/status/2044014136770580743), [@richardrx · 2025-12-30](https://x.com/richardrx/status/2006022937770414515), [@richardrx · 2026-03-05](https://x.com/richardrx/status/2029623167900061970), [@richardrx · 2026-02-02](https://x.com/richardrx/status/2018357024543715480), [@richardrx · 2025-11-06](https://x.com/richardrx/status/1986454460281836026).
