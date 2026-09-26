# R09 — Design the cancel flow

> **Status:** DONE 2026-09-07 · **Priority:** P2 · **Effort:** M · **Category:** Retention / Billing / Stripe Dashboard
> **Depends on:** [[R01]] (portal configuration subsection, switch-plan path) · **Blocks:** none

## Principle

**Retention is built, not requested. Design the cancel screen: concrete loss, one alternative,
one open question, and never a roach motel.** Perceived loss retains more than promised benefit,
so the screen must show what this user loses (their numbers, their date), not a generic list.
The alternative is a smaller plan, not a discount. The question is open-ended and feeds the
roadmap. The cancel button stays visible; friction that hides it is the fastest way to a
chargeback and a one-star review.
Sources: [design the cancel screen](https://x.com/richardrx/status/2054562119962501186),
[the roach-motel warning](https://x.com/richardrx/status/2002003484791676948),
[fear of losing beats hope of gaining](https://x.com/richardrx/status/2028471666297217460).

## Summary

Cancelling means opening the Stripe portal home and using Stripe's generic cancel dialog. Nothing
in the app names what the user loses (posts in the feed, interactions received, the date they
stop), offers a downgrade, or asks why. The static "what you'll miss" list on the billing page is
not in the cancel path and uses no user data. Cancellation reasons are not collected anywhere.

## Evidence

- `convex/billing.ts:7-10`, `:22-27` — `StripeSubscriptions.createCustomerPortalSession` receives the customer id and a return URL only; no `flow_data`.
- `app/src/pages/BillingPage.tsx:271` — `billing.whatYouLlMiss` (`app/src/i18n/locales/en.json:173`) is a static list near the Manage button.
- `convex/stripe.ts:124-146` — `cancelUserSubscription`: access continues until `subscriptionEndsAt` (`:80`), the tier drops to Starter (`:143`), posts stay until the period ends. Cancel-at-period-end is already the modeled outcome.
- `convex/stripe.ts:16-29` — `toSubscriptionStatus` maps `paused` to `none` (`:29`), so a Stripe pause would gate the user like a card-less signup. Pause is not a safe offer today.
- `app/src/pages/BillingPage.tsx:69`, `:124-136` — the post-cancel state shows the end date when `cancelAtPeriodEnd` is set; there is no "resume" action.
- `convex/feedback/feedback.ts:28-36`, `:53` — feedback categories are a fixed union (feature_request, bug, comment, criticism, praise, question, suggestion, other); no cancellation category.
- `landing/i18n/dictionaries/en.json:221-222` — the FAQ promises "Cancel from your account settings in one click".

## Root cause

Plan 2A delegated cancellation to the Stripe portal as the fastest compliant path. Nobody designed
the moment, and the portal configuration in the Stripe Dashboard was never written down.

## What we need to do

1. **⚖️ Configure the portal.** In the Stripe Dashboard (documented in the §8 "Stripe Dashboard setup" subsection from [[R01]]): cancel at period end (matches `cancelUserSubscription`), collect cancellation reasons, plan switching enabled (for the downgrade alternative), pause disabled (see risks).
2. **In-app interstitial.** A "Cancel plan" link on the billing page (keep "Manage subscription" as it is) opens `CancelInterstitial` (shadcn `Dialog`) with three parts. Loss from data: the number of the user's posts in the feed (`getMyPosts` filtered to visible), interactions received (`getTrialProgress` or a total on the user row), and the date they leave (`subscriptionInfo.currentPeriodEnd`). Alternative: for tiers above Starter, "Move to Starter, keep your posts" through the switch-plan path from [[R01]]. Open question: a textarea "What would have made you stay?" submitted through `submitFeedback` with a new `cancellation` literal added at `convex/feedback/feedback.ts:28-36`.
3. **Straight to the cancel confirmation.** "Continue to cancel" calls `createPortalSession` with a new optional `flow` arg. Check whether `@convex-dev/stripe` ^0.1.4 passes `flow_data` through `createCustomerPortalSession`; if not, create that session with the Stripe SDK in `convex/billingNode.ts` (`"use node"`) using `flow_data: { type: 'subscription_cancel', after_completion: { type: 'redirect', redirect: { return_url } } }`.
4. **Trial cancellations.** Cancelling during the trial ends the subscription at the trial end with no charge; the interstitial says so ("You won't be charged") and the loss copy switches to the hidden post.
5. **Post-cancel state.** Add a "Resume plan" CTA (the portal supports reactivating `cancel_at_period_end`) and keep the loss framing: "Your posts leave the feed on {{date}}."
6. **Roach-motel guard.** One interstitial, the cancel button visible without scrolling, the portal home still reachable via Manage. ⚖️ If the interstitial counts as a step, change the FAQ (`en.json:221-222`) to match; the promise must stay true.
7. **No automatic discount.** The free month is a manual promo-code campaign (locked decision); the interstitial never applies a coupon.
8. **Measure.** Consent-gated PostHog events `cancel_started`, `cancel_alternative_taken`, `cancel_completed`; reasons come from the Stripe Dashboard report.
9. **i18n and tests.** Keys under `billing.cancel.*` in en, pt and es. Tests: the dialog renders the user's numbers; feedback is submitted with the category; the portal is called with the flow; the downgrade path calls the switch.
10. **Docs.** See **Docs to update**.

## Do / Don't

For the implementing agent. Each line names the mechanism it relies on and links the source.

**Do**

- **Show this user's loss in their numbers and their date**: posts in the feed, interactions received, the day they leave. Concrete loss outweighs abstract benefit ([@richardrx · 2026-05-13](https://x.com/richardrx/status/2054562119962501186)).
- **Offer the smaller commitment before goodbye.** The downsell is a smaller plan offered instead of losing the customer; here it is Starter with the posts kept ([@richardrx · 2026-09-01](https://x.com/richardrx/status/2094769345821905094)).
- **Ask one open question, neutrally framed**: "What would have made you stay?" A dropdown rarely lists the real reason, and a leading question collects agreement ([@richardrx · 2026-05-13](https://x.com/richardrx/status/2054562119962501186), [@richardrx · 2025-12-10](https://x.com/richardrx/status/1998793352469250369)).
- **Keep the cancel button visible without scrolling** and the portal one click away. Make cancellation easy and the loss tangible ([@richardrx · 2026-03-02](https://x.com/richardrx/status/2028471666297217460)).
- **Say "You won't be charged" plainly** on trial cancellations; certainty beside the button ([@richardrx · 2026-08-11](https://x.com/richardrx/status/2087142982705201423)).
- **Frame the Resume action around the date**: "Your posts leave the feed on {{date}}."
- **Instrument the alarm upstream.** Usage down by half is the moment to act, weeks before this screen ([@richardrx · 2025-12-02](https://x.com/richardrx/status/1996002234392248720)).

**Don't**

- **Don't build a maze.** No second interstitial, no "contact us to cancel", no hidden button; the Roach Motel is where retention UX turns into deceptive design ([@richardrx · 2025-12-19](https://x.com/richardrx/status/2002003484791676948)) and the FTC fines it ([@richardrx · 2026-01-19](https://x.com/richardrx/status/2013339752934629537)).
- **Don't shame.** "You'll lose everything you worked for" is the line to cut; every word of the loss copy has to inform without accusing ([@richardrx · 2025-12-19](https://x.com/richardrx/status/2002003484791676948)).
- **Don't auto-apply a discount or a free month.** The campaign is manual (standing decision); a discount at cancel teaches the base that cancelling is how you get one.
- **Don't offer pause until the paused state is designed.** A pause that gates like a card-less signup breaks the promise (see Risks).
- **Don't make the reason mandatory.** A required field at the exit is friction in the wrong place ([@richardrx · 2026-05-21](https://x.com/richardrx/status/2057436163841941980)).
- **Don't break the FAQ's "one click" promise silently.** If the interstitial is a step, rewrite the FAQ in the same change ([@richardrx · 2026-04-29](https://x.com/richardrx/status/2049568514311172355)).
- **Don't introduce the product's improvements only here.** If the base learns about upgrades at the cancel screen, that is emergency retention; tell them earlier ([@richardrx · 2026-05-19](https://x.com/richardrx/status/2056715097796411514)).
- **Don't buy a feature from a cancel reason.** The leaving member names the feature they lacked; the members who stay never asked for it. Log it, route it to the ICP review ([[R11]]) and keep the roadmap ([@richardrx · 2026-08-10](https://x.com/richardrx/status/2086931878251057479)).
- **Don't read a cancellation inside the first 30 days as a pricing or feature problem.** It is onboarding or a promise the landing made ([[R04]], [[R14]]); churn and payback are decided in the same first session, so the fix is time to value, not a discount ([@richardrx · 2026-04-20](https://x.com/richardrx/status/2046212675017887881), [@richardrx · 2026-06-30](https://x.com/richardrx/status/2071931705573748896)).

## Acceptance criteria

- [x] The cancel path shows the user's own numbers and date before the portal.
- [x] Tiers above Starter see the downgrade alternative; Starter sees none.
- [x] The open question lands in the feedback table with category `cancellation`.
- [x] The portal opens on Stripe's cancel confirmation, and the subscription ends at period end.
- [x] A canceled user sees a Resume action.
- [x] `pnpm verify` is green (typecheck + lint + tests).
- [x] `docs/PLATFORM.md` updated (see **Docs to update**).

## Risks / edge cases / open questions

- **Pause.** Offering pause needs a product decision on what a paused user can do, plus a mapping change in `toSubscriptionStatus`. Defer; the downgrade covers the "too expensive" reason.
- **Wrapper support.** If the component cannot pass `flow_data`, the SDK path duplicates the customer-id lookup; keep both behind one `createPortalSession` action.
- **Honesty of "one click".** The FAQ is a promise; either keep the interstitial to one screen or rewrite the FAQ.
- **Data deletion** ([[B26]] / privacy flows) already cancels subscriptions on erasure; do not route that path through the interstitial.

## Docs to update

- `docs/PLATFORM.md` §8 (Subscriptions & Billing) — a cancel-flow diagram (interstitial → portal → webhook → period end), the portal configuration.
- `docs/PLATFORM.md` §12 (Feedback) or wherever the category list lives — the `cancellation` category.
- `docs/PLATFORM.md` §14 (BillingPage) — the interstitial and the Resume action.
- `docs/PLATFORM.md` §15 (Landing FAQ) — if the wording changes.

## References

- Related: [[R01]], [[R08]], [[B06]], [[B07]] (downgrade semantics and the no-refund rule).
- Prior art / plan: `docs/superpowers/plans/2026-06-20-plan-2a-billing-checkout.md`; memory `p1-backlog-execution` (B06 downgrade keeps visibility, B07 no-refund).
- Principle sources: [@richardrx · 2026-05-13](https://x.com/richardrx/status/2054562119962501186), [@richardrx · 2025-12-19](https://x.com/richardrx/status/2002003484791676948), [@richardrx · 2026-03-02](https://x.com/richardrx/status/2028471666297217460).

## Decisions (2026-09-07)

- One interstitial, Stripe portal `flow_data` for cancel + Starter downgrade (same interval), Resume via `cancel_at_period_end=false`. Reason optional, stored as feedback `cancellation`. Stripe Dashboard portal settings are Henriko's manual step (PLATFORM §8).
- **Resume is idempotent.** `billingNode.resumeSubscription` returns `null` without ever calling Stripe when the subscription is not cancelling, so there is no "nothing to resume" error to raise or translate.
- **The downgrade keeps the member's own billing interval.** `createCancelFlowSession('downgrade')` reads `price.recurring.interval` off the retrieved Stripe subscription item, falls back to the stored `subscriptions.priceInterval`, and resolves the target price through `starterPriceIdFor` — a monthly member is never moved onto an annual Starter price.
- **The Stripe Dashboard rows this flow depends on are written down but not applied.** Cancellations on, mode "at end of billing period", cancellation reasons on; subscription updates on and listing all six prices (the `subscription_update_confirm` flow needs Starter monthly *and* annual there); pausing off. They are rows in PLATFORM §8's "Stripe Dashboard setup" table. Acceptance box 4 is ticked for the code half — the portal opens on Stripe's own cancel confirmation — while the "ends at period end" half is enforced by that cancellation-mode row.
- **The FAQ's "one click" promise was rewritten in the same batch** (the landing cancel answer no longer counts clicks, [[R10]] / [[R14]]), so the interstitial does not silently falsify it — Risk 3 above is closed.
- **`cancel_alternative_completed { from }` was deferred in the implementation spec §10 and built 2026-09-07:** the downgrade now returns as `/billing?downgraded=<tier left behind>` and lands on the plan-switch state ("Switching you to Starter…" → "You're on Starter now."), firing the event once — the interstitial's save rate is `cancel_alternative_taken → cancel_alternative_completed`. **Still deferred there, so no box is claimed for it:** pause (still unsafe: `toSubscriptionStatus` maps `paused` → `none`, which would gate a paying member like a card-less signup).
