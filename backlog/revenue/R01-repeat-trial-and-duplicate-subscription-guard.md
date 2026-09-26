# R01 — Repeat-trial and duplicate-subscription guard

> **Status:** DONE · **Priority:** P0 · **Effort:** M · **Category:** Billing
> **Depends on:** none · **Blocks:** [[R09]] (the cancel flow needs the portal path this item adds), [[R03]] (plan switching for card holders)

## Principle

**Ask for the card in the trial, and give one trial per user.** The card filters for commercial
intent (ChartMogul 2026: card-required trials convert at roughly 31% against roughly 9% without).
The filter only works if a trial can be consumed once. Today a user can hold two trials at the
same time, or cancel on day 6 and start a fresh trial forever, so the filter leaks.
Source: [@richardrx · 2026-05-15](https://x.com/richardrx/status/2055247161349054950).

## Summary

`createCheckoutSession` creates a new Stripe subscription with a fresh 7-day trial for anyone who
asks, and the billing page shows a checkout button on every non-current plan card to everyone.
A trialing or active user who clicks another plan gets a second live subscription. A canceled user
can re-trial without limit. On a second subscription the 50-interaction early end also breaks,
because the early-end lookup picks the oldest subscription row, which is the canceled one.

## Evidence

- `convex/billingNode.ts:23-62` — `createCheckoutSession` validates the price (`:26`), loads the user (`:28`), gets or creates the Stripe customer (`:31-35`) and creates the session (`:39-51`). It never reads `subscriptions`, `user.subscriptionStatus` or `user.trialEndsAt`.
- `convex/billingNode.ts:43-46` — `subscription_data.trial_period_days: TRIAL_PERIOD_DAYS` is unconditional. Stripe does not stop a customer from holding several subscriptions or several trials.
- `convex/interactions.ts:27-36` — `bumpTrialInteraction` picks the subscription with `.withIndex('by_user', …).first()`. Convex appends `_creationTime` to every index, so `.first()` returns the **oldest** row for that user, not the trialing one.
- `convex/stripe.ts:101-111` — `syncUserSubscription` upserts by `by_stripe_id`. A new Stripe subscription id inserts a **new** row; earlier rows stay.
- `convex/stripe.ts:124-132` — `cancelUserSubscription` patches the row to `status: 'canceled'` and keeps it. So after cancel plus re-subscribe, the user has two rows and the oldest is canceled.
- `convex/users.ts:219-223` — `getSubscriptionInfo` takes `filter(s => s.status !== 'canceled')[0]` from the Stripe component. With two live subscriptions it shows whichever the component lists first.
- `app/src/pages/BillingPage.tsx:64` — `hasCard = trialing || active`. `:222-224` renders the plan grid for everyone. `:280` every non-current card calls `handleUpgrade(priceId)`, which is `createCheckoutSession` (`:83-90`).
- `app/src/pages/BillingPage.tsx:116` — the billing-info card with the **Manage Subscription** button (`:145-152`) renders only when `subscriptionStatus === 'active'`. A trialing user has no portal path at all.
- `convex/billing.ts:13-29` — `createPortalSession` opens the Stripe Customer Portal with a `returnUrl` only. Nothing in code configures what the portal allows (plan switching is a dashboard setting).
- `docs/PLATFORM.md:929` — documents "7-day trial on every new subscription" as intended behaviour, so the doc must change with the code.

## Root cause

Plan 2A built checkout for the first-subscription case only and deferred plan switching. The
subscriptions table was written assuming one row per user, so `.first()` looked safe. The billing
page later grew into a full plan grid for every state (see [[B18]] era changes) without a rule for
what a card holder's click should do.

## What we need to do

1. **Add a subscription reader for actions.** In `convex/billing.ts` add `listUserSubscriptions` (`internalQuery`, args `userId`) returning the user's rows from `subscriptions.by_user`. Actions cannot read the database directly.
2. **Guard the checkout.** In `createCheckoutSession` (`convex/billingNode.ts:28` onward), after `requireAuthAction`: load the rows; if any row has status `trialing`, `active` or `past_due`, throw `new ConvexError('ALREADY_SUBSCRIBED: Manage your plan from the customer portal.')`. Keep the `PREFIX:` convention `lib/access.ts:18` uses so the client can branch on it.
3. **One trial per user.** Add a pure helper, for example `trialEligible({ subscriptionCount })` in `convex/lib/trialMilestone.ts`, returning `false` when the user has any subscription row. Build `subscription_data` without `trial_period_days` when it returns `false`. Do not use `user.trialEndsAt` as the marker: `syncUserSubscription` (`convex/stripe.ts:78`) overwrites it with `undefined` on a non-trial subscription.
4. **Fix the early-end lookup.** In `bumpTrialInteraction` (`convex/interactions.ts:28-31`) select the row whose `status === 'trialing'` (filter after the index, or collect and find) instead of `.first()`. Extract a pure `pickTrialingSubscription(rows)` so it can be unit-tested without a database.
5. **Route card holders to the portal.** In `BillingPage.tsx`: when `hasCard`, every non-current plan card calls `handleManageSubscription` with a new label `billing.switchPlan` ("Switch to {{plan}}"); pre-card users keep `handleUpgrade`. Render the billing-info card and the Manage button for every user with `me.stripeCustomerId` (covers trialing and past_due), not only `active` (`:116`).
6. **Handle the new error on the client.** In `handleUpgrade` (`:83-90`), when the message starts with `ALREADY_SUBSCRIBED`, open the portal instead of showing the failure toast.
7. **Configure the Customer Portal (Stripe Dashboard, per environment, Henriko).** Settings → Billing → Customer portal: allow customers to switch plans between the three products and six prices, choose the proration rule, allow payment-method updates, and allow cancellation. Record the exact settings in `docs/PLATFORM.md` §8 under a new "Stripe Dashboard setup" subsection so test and live stay in sync.
8. **Verify a plan switch during a trial in Stripe test mode.** Stripe keeps `trial_end` when the price changes on a trialing subscription; the `customer.subscription.updated` webhook (`convex/http.ts:151-162`) then updates the tier through `getTierFromPriceId`. Confirm the tier and the trial end survive the switch.
9. **Tests.** Unit tests for `trialEligible` and `pickTrialingSubscription`. `BillingPage.test.tsx`: a card holder's plan click calls the portal action, a pre-card click calls checkout, an `ALREADY_SUBSCRIBED` failure opens the portal. Keep en/pt/es locale parity for the new keys.
10. **Docs.** See **Docs to update**.

## Do / Don't

For the implementing agent. Each line names the mechanism it relies on and links the source.

**Do**

- **Keep the card at the door and one trial per person.** The card is the intent filter (31.4% vs 8.9% trial conversion in ChartMogul's data) and this guard is what makes the filter hold ([@richardrx · 2026-05-21](https://x.com/richardrx/status/2057436163841941980), [@richardrx · 2026-05-15](https://x.com/richardrx/status/2055247161349054950)).
- **Make the blocked path a door.** A card holder who clicks another plan lands in the portal with the switch pre-selected; the choice is constrained, never removed ([@richardrx · 2026-01-07](https://x.com/richardrx/status/2008925397522506165)). Continuing stays effortless and switching stays a decision ([@richardrx · 2026-07-28](https://x.com/richardrx/status/2082146908819071160)).
- **Write the error for a human.** "You already have a plan. Manage it from the billing portal." with the button under it, never `ALREADY_SUBSCRIBED`; error tone is part of the product ([@richardrx · 2026-03-24](https://x.com/richardrx/status/2036374984206025082)).
- **State the no-trial term before the pay button** for a returning user: "No trial this time. Billed today." Costs learned late are the top abandonment reason, 49% ([@richardrx · 2025-12-09](https://x.com/richardrx/status/1998432350842016222)).
- **Route `past_due` to the card fix**, never to a fresh checkout; card-collected trials die quietly in month two when the card fails ([@richardrx · 2026-03-16](https://x.com/richardrx/status/2033502548301091057)).
- **Log every time the guard fires** (Sentry breadcrumb plus a consent-gated PostHog event). The interface is data; read how often people try a second trial before deciding anything else here ([@richardrx · 2026-03-30](https://x.com/richardrx/status/2038566978760122661)).

**Don't**

- **Don't add "trial abuse" copy, warnings or a penalty state.** The guard is plumbing; the user sees a portal, never an accusation.
- **Don't add a confirmation step to the checkout for card holders.** Every added decision at the point of payment is lost conversion; checkout already drops about 70% ([@richardrx · 2025-12-12](https://x.com/richardrx/status/1999584679247134761), [@richardrx · 2026-01-20](https://x.com/richardrx/status/2013597792447394034)).
- **Don't cancel a duplicate subscription silently.** If the webhook has to void one, say so in the app and by email; a surprise on the statement is a reason to churn ([@richardrx · 2025-12-12](https://x.com/richardrx/status/1999584679247134761)).
- **Don't loosen the trial to compensate** (a longer window, a second trial after 90 days). Someone pays the subsidy, and this product is bootstrapped ([@richardrx · 2026-08-20](https://x.com/richardrx/status/2090509133405380624)).
- **Don't auto-apply a coupon to soften the no-trial checkout.** The free-month campaign is manual (standing decision).

## Acceptance criteria

- [x] A trialing or active user who clicks another plan lands in the Customer Portal. No second Stripe subscription is created.
- [x] A user who already had a subscription row gets a checkout **without** a trial; the Stripe test-mode checkout page shows no trial.
- [x] A brand-new user still gets the 7-day trial with the card collected.
- [x] A user on a second subscription still converts at 50 interactions (`endTrialEarly` targets the trialing subscription).
- [x] A trialing user sees the Manage Subscription button.
- [x] `pnpm verify` is green (typecheck + lint + tests).
- [x] `docs/PLATFORM.md` updated (see **Docs to update**).

## Risks / edge cases / open questions

- **Erasure resets the trial.** A user who deletes their account and signs in again is a new user with a new Stripe customer, so they get a fresh trial. Accept it, and note it in §8.
- **Two tabs, two checkouts.** The guard runs when the session is created, not when Stripe completes it. Open question for the brainstorm: should `customer.subscription.created` (`convex/http.ts:139`) cancel a newer subscription when the user already has a live one? Recommended: yes, with `proration_behavior: 'none'`, and log it.
- **`past_due` users** must reach the portal to fix the card, never a new checkout. Step 5 covers it through `stripeCustomerId`.
- **Proration on downgrade** (immediate vs. at period end) is a business choice. Default suggestion: upgrades prorate now, downgrades apply at period end.
- **Promotion codes** still apply to a no-trial checkout, so the manual free-month campaign keeps working for returning users.
- **Admins** bypass the card gate but not this guard; that is fine, they should not hold two subscriptions either.

## Docs to update

- `docs/PLATFORM.md` §8 (Subscriptions & Billing) — checkout guard, one-trial-per-user rule, portal plan switching, the new "Stripe Dashboard setup" subsection, the corrected `bumpTrialInteraction` lookup.
- `docs/PLATFORM.md` §14 (BillingPage states) — card holders switch plans through the portal; Manage button visibility rule.
- `docs/PLATFORM.md` §19 — remove any "plan switching deferred" note if present.

## References

- Related: [[R02]] (checkout disclosure line lands in the same session-creation call), [[R03]] (chosen plan), [[R09]] (cancel flow through the portal), [[B04]] (`trialEndsAt` wiring this builds on).
- Prior art / plan: `docs/superpowers/plans/2026-06-20-plan-2a-billing-checkout.md`; `docs/PLATFORM.md` §8.
- Principle source: [@richardrx · 2026-05-15](https://x.com/richardrx/status/2055247161349054950).
