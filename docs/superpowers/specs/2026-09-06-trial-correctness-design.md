# Trial correctness: repeat-trial guard, early-charge disclosure, chosen plan

> **Date:** 2026-09-06 · **Backlog items:** R01, R02, R03 (`backlog/revenue/`)
> **Status:** approved 2026-09-06 · **Do not commit** — Henriko commits (`CLAUDE.md`).

## Problem

The 7-day card-required trial has three gaps, verified against the code on 2026-09-06:

1. **The trial filter leaks.** `createCheckoutSession` (`convex/billingNode.ts:23-62`) never reads
   `subscriptions`, `user.subscriptionStatus` or `user.trialEndsAt`, and
   `trial_period_days: TRIAL_PERIOD_DAYS` (`:44`) is unconditional. A trialing or active user who
   clicks another plan gets a **second live Stripe subscription**; a canceled user can re-trial
   forever. The card is meant to filter for commercial intent, and a filter that can be consumed
   twice is not a filter.
2. **The charge can arrive unannounced.** The 50-interaction early end works (`convex/interactions.ts:27-37` →
   `internal.billingNode.endTrialEarly`), but nothing warns the
   user it is coming: no `custom_text` on the checkout session, no
   `customer.subscription.trial_will_end` handler, no near-threshold state, no billing email, and
   no trial clause in the Terms. Visa and Mastercard trial rules expect a pre-charge reminder
   stating the amount, the date and how to cancel.
3. **The plan the visitor chose is thrown away.** `AuthSuccessPage.tsx:17` stores `chosenPlan`;
   no file under `app/src` reads it. `BillingPage.tsx:229` recommends Growth to everyone and the
   trial banner names Growth whatever tier the user is on.

A latent bug sits underneath all three. `bumpTrialInteraction` selects the subscription with
`.withIndex('by_user', …).first()` (`convex/interactions.ts:28-31`). Convex appends
`_creationTime` to every index, so `.first()` returns the **oldest** row. Today every user has at
most one row, so it is harmless. The moment a second row can exist — which is exactly what this
work permits and then guards — the 50-interaction early end starts calling `endTrialEarly` against
a **canceled** subscription id, silently. Fixing the lookup is a prerequisite of the guard.

## Decisions taken (2026-09-06)

| #  | Question                                       | Decision                                                                                                                                                                    |
|----|------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| D1 | Scope                                          | R01 + R02 + R03 together — all three land in `createCheckoutSession` and `BillingPage.tsx`                                                                                  |
| D2 | Two-tab race creating a duplicate subscription | The `customer.subscription.created` webhook **auto-cancels the newer subscription** with no proration, and tells the user in-app **and** by email. Never silent.            |
| D3 | Day-7 reminder                                 | **Ours** — a `customer.subscription.trial_will_end` handler and mailer. Stripe's built-in trial-ending email stays **OFF**; never both for one event.                       |
| D4 | Language for checkout copy and billing email   | `createCheckoutSession` takes a `locale` arg and **persists `users.language`**. Resolution order for any billing notice: `users.language` → `users.primaryLocale` → `'en'`. |
| D5 | Pre-card billing layout                        | **Single primary card** for the chosen plan with one CTA, a "See all plans" toggle revealing the grid, and the Enterprise anchor line always visible.                       |
| D6 | Near-threshold warning                         | Warn at **40 of 50**, one email, plus the amber in-app banner from 40 onward. The same-session 39→50 sprint is an accepted edge case; the charge is not delayed.            |
| D7 | Proration on a portal plan switch              | **Upgrade immediately with proration, downgrade at period end.** Stripe Dashboard setting, recorded in §8; no refunds, consistent with the existing no-refund policy.       |

## Non-goals

- The SSI link-out (`BillingPage.tsx:180-187`) stays as-is. LinkedIn moved the SSI page behind
  Sales Navigator, but replacing that link is R15's job, not a P0 billing fix.
- No cancel-flow redesign (R09), no upgrade-at-the-limit component (R08), no landing copy
  changes (R11 / R12).
- No new npm dependency. The shadcn Dialog, the existing toast and the existing Resend mailer
  cover everything here.
- No "trial abuse" copy, warning or penalty state anywhere in the UI. The guard is plumbing; the
  user sees a portal, never an accusation.

## Architecture

Three layers. Every decision that can be a pure function is one, so it is unit-testable without a
database — the convention `convex/lib/access.ts`, `planLimits.ts` and `interactionLimit.ts` already
follow, and the reason `convex/` needs no `convex-test` dependency.

### Pure logic

**`convex/lib/trialMilestone.ts`** (extend — it already owns the 50-interaction rule):

```ts
export const TRIAL_INTERACTION_THRESHOLD = 50      // existing
export const TRIAL_WARNING_THRESHOLD = 40          // new — 80% of the way
export const LIVE_SUBSCRIPTION_STATUSES = ['trialing', 'active', 'past_due'] as const

export function crossesThreshold(current, delta, threshold): boolean          // existing
export function isNearThreshold(combined: number): boolean                    // new
export function findLiveSubscription<T extends { status: string }>(rows: T[]): T | undefined
export function pickTrialingSubscription<T extends { status: string }>(rows: T[]): T | undefined
export function trialEligible(subscriptionCount: number): boolean             // === 0
```

`trialEligible` keys on the **row count**, never on `user.trialEndsAt`: `syncUserSubscription`
(`convex/stripe.ts:78`) overwrites `trialEndsAt` with `undefined` for a non-trial subscription, so
that marker erases itself and would hand a returning user a second free trial.

**`convex/lib/checkoutCopy.ts`** (new) — pure per-language copy for the Stripe checkout page:

```ts
export type BillingLocale = 'en' | 'pt' | 'es'
export function resolveBillingLocale(language?: string, primaryLocale?: string): BillingLocale
export function stripeCheckoutLocale(locale: BillingLocale): 'en' | 'pt-BR' | 'es'
export function checkoutSubmitMessage(locale: BillingLocale, opts: { trial: boolean }): string
```

Two variants. **Trial:** the 50-or-7-days rule stated as a fact, with the cancel path. **No trial**
(returning subscriber): "No trial this time. You are billed today." — the term is stated *before*
the pay button, because a cost learned late is the top abandonment reason. Never "may end early";
the rule is deterministic. Stripe caps `custom_text.submit.message` at 1200 characters.

**`convex/lib/billingEmails.ts`** (new) — pure `{ subject, html, text }` builders, one per
language, mirroring `convex/privacy/emails.ts` exactly:

```ts
export function trialNearEndEmail(locale, { made, received, remaining, planName, priceLabel, billingUrl }): EmailContent
export function trialEndingEmail(locale, { endsOn, planName, priceLabel, billingUrl }): EmailContent
export function duplicateSubscriptionCanceledEmail(locale, { planName, billingUrl }): EmailContent
```

Each opens with what the member **did** (a progress note, not an alarm), then states the number,
the amount and the date exactly, and ends with one link to `/billing` to cancel. Transactional
only — no promotional copy, no countdown, no urgency theatrics.

**Where the amount comes from.** No backend module knows a plan's price today:
`convex/lib/stripePrices.ts` maps price id → tier and nothing else, and the `$150/yr` strings live
in `BillingPage.tsx:29-32` on the client. Rather than duplicate a price table that drifts the day
pricing changes, the webhook persists what Stripe already sends it — `items.data[0].price`'s
`unit_amount`, `currency` and `recurring.interval` — onto the `subscriptions` row, and
`formatPriceLabel(locale, { amount, currency, interval })` renders it with `Intl.NumberFormat`.
The amount in the email is then Stripe's own, per subscription, exact.

### Convex seams

| File                      | Change                                                                                                                                                                       |
|---------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `convex/schema.ts`        | `users.language`, `users.billingNotice`; `subscriptions.priceAmount` / `.priceCurrency` / `.priceInterval` (all `v.optional`)                                                |
| `convex/billing.ts`       | new `listUserSubscriptions` (`internalQuery`), `getBillingContext` (`internalQuery`)                                                                                         |
| `convex/billingNode.ts`   | guard + conditional trial + `custom_text` + `locale`; new `cancelDuplicateSubscription` (`internalAction`)                                                                   |
| `convex/interactions.ts`  | `.first()` → `.collect()` + `pickTrialingSubscription`; schedule the 40-of-50 email                                                                                          |
| `convex/http.ts`          | duplicate detection in `customer.subscription.created`; new `customer.subscription.trial_will_end` handler                                                                   |
| `convex/users.ts`         | new `setLanguage` + `setBillingNotice` (`internalMutation`), `clearBillingNotice` (`mutation`); `getTrialProgress` returns `nearThreshold`; `getMe` surfaces `billingNotice` |
| `convex/notifications.ts` | **new** — `sendTrialNearEnd`, `sendTrialEnding`, `sendDuplicateCanceled` (`internalAction`s)                                                                                 |

### Client and copy

| File                                              | Change                                                                                                                                             |
|---------------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------|
| `app/src/pages/BillingPage.tsx`                   | portal routing for card holders, single-primary-card layout, amber near-threshold banner, duplicate-canceled notice, `ALREADY_SUBSCRIBED` handling |
| `app/src/i18n/locales/{en,pt,es}.json`            | new `billing.*` keys, three locales in parity                                                                                                      |
| `landing/app/[lang]/terms/content/{en,pt,es}.tsx` | free-trial clause inside the existing §5 "Subscriptions & Billing"                                                                                 |

## Data flow

### Checkout

```
BillingPage → createCheckoutSession({ priceId, sessionToken, locale })
  ├─ requireAuthAction
  ├─ internal.billing.listUserSubscriptions(userId)
  ├─ findLiveSubscription(rows) ──► ConvexError('ALREADY_SUBSCRIBED: …')
  │                                   └─ client opens the Customer Portal instead
  ├─ trialEligible(rows.length) ──► subscription_data.trial_period_days set or omitted
  ├─ custom_text.submit.message = checkoutSubmitMessage(locale, { trial })
  ├─ session.locale = stripeCheckoutLocale(locale)
  ├─ internal.users.setLanguage(userId, locale)
  └─ Stripe Checkout
```

### Duplicate race

```
customer.subscription.created (webhook)
  ├─ internal.stripe.syncUserSubscription        (existing — unchanged)
  └─ internal.billing.listUserSubscriptions
       └─ another LIVE row whose id ≠ this event's id?
            └─ scheduler → internal.billingNode.cancelDuplicateSubscription
                 ├─ stripe.subscriptions.cancel(id, { prorate: false, invoice_now: false })
                 ├─ internal.users.setBillingNotice(userId, 'duplicate_canceled')
                 └─ scheduler → internal.notifications.sendDuplicateCanceled
```

The guard in `createCheckoutSession` runs when the session is **created**; this webhook closes the
window between that check and Stripe completing the payment. The **newer** subscription is the one
voided, so the user keeps the plan they already had.

### Trial-end notices

```
interaction → bumpTrialInteraction
  ├─ crossesThreshold(combined, 1, 40) → internal.notifications.sendTrialNearEnd   (our email)
  └─ crossesThreshold(combined, 1, 50) → internal.billingNode.endTrialEarly        (existing)

Stripe customer.subscription.trial_will_end (3 days before trial_end)
  └─ internal.notifications.sendTrialEnding                                        (our email)
```

`endTrialEarly` sets `trial_end: 'now'`, so Stripe never emits `trial_will_end` for the early path
— which is why the 40-of-50 mail has to be ours. Stripe's own trial-ending email stays disabled in
the Dashboard so the two paths never double up.

Every notification action re-reads state before sending and **skips** when the subscription is no
longer `trialing` or has `cancelAtPeriodEnd` set. A user who already canceled gets no mail.

## Error handling

| Case                                         | Behaviour                                                                                                                                                                                                                                                                                                                                                                                                             |
|----------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Card holder clicks another plan              | `ALREADY_SUBSCRIBED` → the client opens the Customer Portal. The user never sees the prefix; the message reads "You already have a plan. Manage it from the billing portal."                                                                                                                                                                                                                                          |
| Portal call fails after `ALREADY_SUBSCRIBED` | Existing `billing.portalFailed` toast                                                                                                                                                                                                                                                                                                                                                                                 |
| Race creates a second subscription           | Newer one voided, in-app notice + email                                                                                                                                                                                                                                                                                                                                                                               |
| `past_due` user                              | Billing-info card and Manage button render, so the card fix is reachable. Never a fresh checkout. Keyed on `subscriptionStatus ∈ {trialing, active, past_due}` — **not** on `stripeCustomerId`, which `toSafeMe` (`convex/users.ts:79`) strips before the client ever sees it. Status is also the better key: a user who opened a checkout and abandoned it has a Stripe customer but nothing for the portal to show. |
| `RESEND_API_KEY` / `EMAIL_FROM` unset        | `sendEmail` already no-ops. Billing callers now `console.error('[billing] notification skipped …', scrubError(…))` so `pnpm watch:errors` and the Convex dashboard show it. A silently unmailed billing notice is a compliance hole, not a dev convenience.                                                                                                                                                           |
| Resend returns non-2xx                       | `sendEmail` throws; the scheduled action fails and Convex logs it. No retry loop — the in-app banner is the durable channel.                                                                                                                                                                                                                                                                                          |
| Unknown / missing locale                     | `resolveBillingLocale` falls back `users.language` → `users.primaryLocale` → `'en'`                                                                                                                                                                                                                                                                                                                                   |
| User erases their account and signs in again | New user, new Stripe customer, fresh trial. Accepted; documented in §8.                                                                                                                                                                                                                                                                                                                                               |

Convex has no server-side Sentry SDK in this repo (`app/src/lib/observability/sentry.ts` is
client-only), so backend logging goes through `console.error` + `scrubError`, the existing
convention in `convex/http.ts:63` and `convex/lib/email.ts:49`.

## UI

### BillingPage — pre-card user (no `stripeCustomerId`)

`targetPlan` = `?plan=` query param → `sessionStorage.chosenPlan` → `'growth'`, validated against
`PLAN_IDS`. One primary card for `targetPlan` with a single CTA ("Start 7-day {{plan}} trial"), the
Enterprise anchor line below it, and a "See all plans" toggle that reveals the existing grid. Lead
copy is `billing.chosenPlanLead` ("You picked {{plan}} on the site…") when the plan came from the
URL or the stash, `billing.newUserLead` otherwise. `chosenPlan` / `chosenInterval` are cleared from
`sessionStorage` once a checkout URL is in hand, so a later visit in the same tab does not re-nudge.

The annual/monthly toggle stays, annual stays the default.

### BillingPage — card holder (`subscriptionStatus ∈ {trialing, active, past_due}`)

The grid stays: a switcher needs the comparison. Every non-current plan CTA reads
"Switch to {{plan}}" and opens the portal. The billing-info card and the Manage Subscription
button now render for `trialing`, `active` and `past_due` — today they render only for `active`,
so a trialing user has no portal path at all. A `canceled` user is **not** a card holder here: they
keep the checkout path (without a trial, per the guard) so they can re-subscribe.

### States

| State                                    | Treatment                                                                                                                                   |
|------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------|
| Trialing, combined < 40                  | Existing accent banner, tier-aware text (`billing.trialBanner` interpolates the real plan name)                                             |
| Trialing, 40 ≤ combined < 50             | **Amber** banner: "10 interactions from your plan starting · {{plan}}, {{price}}". Amber, never red — red is an alarm and invites reactance |
| `billingNotice === 'duplicate_canceled'` | Dismissible notice above the plans; dismissing calls `users.clearBillingNotice`                                                             |
| `past_due`                               | Billing-info card with the Manage button                                                                                                    |

## Testing

| Test                                                           | Covers                                                                                                                                                                                                                                                                              |
|----------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `convex/lib/trialMilestone.test.ts` (extend)                   | `trialEligible`, `findLiveSubscription`, `pickTrialingSubscription` (must return the **trialing** row when a canceled row is older), `isNearThreshold` boundaries at 39/40/49/50                                                                                                    |
| `convex/lib/checkoutCopy.test.ts` (new)                        | Both variants in all three languages, ≤1200 chars, no "may end early", locale fallback chain                                                                                                                                                                                        |
| `convex/lib/billingEmails.test.ts` (new)                       | Three builders × three languages: subject non-empty, amount and cancel link present, no promotional copy                                                                                                                                                                            |
| `app/src/pages/BillingPage.test.tsx` (new — none exists today) | Card holder's plan click calls the portal action; pre-card click calls checkout; `ALREADY_SUBSCRIBED` opens the portal; the badge follows `?plan=pro` and then `sessionStorage.chosenPlan`; Growth is the fallback; the banner interpolates the tier; the amber state renders at 40 |
| `app/src/i18n/i18n.test.ts` (extend)                           | A probe on one new billing key per language                                                                                                                                                                                                                                         |

Gate: `pnpm verify` (format:check + lint + typecheck + `pnpm -r test`) exits 0.

## Manual steps for Henriko (not code)

Recorded in `docs/PLATFORM.md` §8 under a new **Stripe Dashboard setup** subsection, per
environment (test and live), because none of it is configurable from code:

1. **Customer portal** — allow switching between the three products and six prices; allow
   payment-method updates; allow cancellation.
2. **Proration** — upgrades immediate with proration, downgrades at period end (D7).
3. **Trial-ending email — OFF.** Ours handles it (D3). The payment receipt stays **ON**.
4. **Verify a plan switch during a trial in test mode:** Stripe preserves `trial_end` across a
   price change, and `customer.subscription.updated` (`convex/http.ts:151-162`) re-derives the tier
   via `getTierFromPriceId`. Confirm both survive.
5. **Resend** — verified sending domain in production before launch, or billing notices no-op.

## Docs to update (same change)

- `docs/PLATFORM.md` §8 — checkout guard, one-trial-per-user rule, portal plan switching, corrected
  `bumpTrialInteraction` lookup, `custom_text` + `locale`, the notification table (event → channel → sender), the
  erasure-resets-the-trial note, the new Stripe Dashboard setup
  subsection.
- `docs/PLATFORM.md` §13B — transactional billing email in the data inventory.
- `docs/PLATFORM.md` §14 — BillingPage states: single-card pre-card layout, target-plan resolution
  order, amber near-threshold banner, Manage button visibility rule, duplicate-canceled notice.
- `docs/PLATFORM.md` §15 — the Terms trial clause; the app now consumes the `plan` parameter.
- `docs/PLATFORM.md` §19 — remove any "plan switching deferred" note.
- `backlog/revenue/README.md` — flip R01, R02, R03 to DONE (gitignored, local only).

## Acceptance criteria

R01

- [ ] A trialing or active user who clicks another plan lands in the Customer Portal; no second Stripe subscription is
  created.
- [ ] A user who already had a subscription row gets a checkout **without** a trial; the test-mode checkout page shows
  no trial.
- [ ] A brand-new user still gets the 7-day trial with the card collected.
- [ ] A user on a second subscription still converts at 50 interactions (`endTrialEarly` targets the **trialing**
  subscription).
- [ ] A trialing user sees the Manage Subscription button.
- [ ] A duplicate subscription created by a race is voided, and the user is told in-app and by email.

R02

- [ ] Test-mode checkout shows the custom message under the pay button in the user's language.
- [ ] The Terms pages in en, pt and es state the trial rule and how to cancel.
- [ ] A trialing user reaching 40 combined interactions sees the amber banner and receives exactly one email.
- [ ] A trialing user receives a reminder before day 7 — ours, with Stripe's disabled.
- [ ] A user who already canceled receives no trial email.

R03

- [ ] A visitor who clicked "Start free" on Pro sees Pro as the single primary card on `/billing`.
- [ ] `/billing?plan=growth` highlights Growth with no `sessionStorage` state.
- [ ] A user trialing Starter or Pro sees their own plan name in the trial banner in en, pt and es.
- [ ] All pre-card plan CTAs use the same "Start 7-day … trial" pattern.

All

- [ ] `pnpm verify` is green.
- [ ] `docs/PLATFORM.md` updated in the same change.
- [ ] Nothing committed.
