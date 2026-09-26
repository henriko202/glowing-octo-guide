# R02 — Early-charge disclosure and pre-charge reminder

> **Status:** DONE · **Priority:** P0 · **Effort:** M · **Category:** Billing / Notifications / Legal copy
> **Depends on:** none (lands in the same `createCheckoutSession` call as [[R01]]) · **Blocks:** [[R06]] (the near-threshold state), [[R14]] (the day-7 recap email rides on this mailer)

## Principle

**Your promise is the size of your proof, and expectation debt starts at the first screen that
states a term.** The landing, the FAQ and the in-app banner all say "billed at 50 interactions or
7 days, whichever comes first". Stripe's own checkout page says "7 days free, then $X starting
<date>". The user reads the last screen before entering a card, so the charge can arrive days
before the date Stripe printed. Card-network trial rules (Visa and Mastercard) also expect a
reminder before the first charge that states the amount, the date and how to cancel. The 7-day
path has no reminder wired, and the early-end path cannot have one from Stripe at all.
Sources: [churn starts on the landing page](https://x.com/richardrx/status/2049568514311172355),
[answer the fear two centimetres from the button](https://x.com/richardrx/status/2087142982705201423).

## Summary

The 50-interaction early end works, but nobody warns the user it is coming. There is no
`custom_text` on the checkout session, no `customer.subscription.trial_will_end` handler, no
in-app heads-up near 40 of 50, and no email, although the Resend mailer already exists for privacy
and feedback flows. The Terms pages do not mention the trial at all. Result: a surprise charge
risk, chargebacks, and a broken promise at the moment of conversion.

## Evidence

- `convex/billingNode.ts:39-51` — the checkout session sets `trial_period_days`, `payment_method_collection` and `allow_promotion_codes`, but no `custom_text` and no `consent_collection`. Stripe derives its "then $X starting <date>" line from `trial_period_days` alone.
- `convex/billingNode.ts:64-70` — `endTrialEarly` sets `trial_end: 'now'`. Stripe invoices immediately; no `trial_will_end` event precedes it.
- `convex/http.ts:136-178` — webhook handlers exist for `customer.subscription.created` / `updated` / `deleted` and `invoice.payment_failed` only. No `customer.subscription.trial_will_end`.
- `convex/lib/email.ts:23` — `sendEmail` (Resend). Callers: `convex/feedback/feedback.ts:227`, `convex/privacy/deletion.ts:232` and `:298`, `convex/privacy/export.ts:203`, `convex/privacy/retention.ts:140`. No billing email anywhere.
- `convex/lib/trialMilestone.ts:3-8` — `TRIAL_INTERACTION_THRESHOLD = 50`; `crossesThreshold(current, delta, threshold)` already accepts a custom threshold.
- `convex/users.ts:183-201` — `getTrialProgress` returns `combined`, `threshold`, `reached`, `trialEndsAt`; no near-threshold flag.
- `app/src/pages/BillingPage.tsx:157-175` — the rule and the meter appear only on the billing page.
- `landing/i18n/dictionaries/en.json:21`, `:152`, `:210` — the rule is disclosed on the landing (hero disclaimer, pricing note, FAQ).
- `landing/app/[lang]/terms/content/en.tsx` (and `pt.tsx`, `es.tsx`) — no mention of a trial, 50 interactions or 7 days (grep, 2026-09-05).
- `app/src/i18n/locales/en.json:170` — the in-app banner discloses the rule, but only on `/billing`.

## Root cause

Plan 2B scoped the trial work to gating and the early-end mechanism. Disclosure stayed in
marketing copy, and no notification layer was ever built for billing. Stripe's hosted checkout
was accepted with its default wording.

## What we need to do

1. **Disclose on the checkout page itself.** In `createCheckoutSession` (`convex/billingNode.ts:39-51`) add `custom_text.submit.message` (Stripe allows up to 1200 characters): "Your free trial ends early once you reach 50 interactions (made or received), and billing starts then. Cancel before that and you pay nothing." Keep the three languages in a small map (for example `convex/lib/checkoutCopy.ts`) and add an optional `locale` arg (`en` | `pt` | `es`) to the action so the message and Stripe's own `locale` match the app language.
2. **State the rule in the Terms.** Add a "Free trial and billing" clause to `landing/app/[lang]/terms/content/{en,pt,es}.tsx` that states the card requirement, the 50-or-7-days rule, and how to cancel. ⚖️ Legal wording goes through the [[B29]] sign-off.
3. **Near-threshold state.** Add `TRIAL_WARNING_THRESHOLD = 40` and a pure `isNearThreshold(combined)` to `convex/lib/trialMilestone.ts`; return `nearThreshold` from `getTrialProgress`. The billing banner (`BillingPage.tsx:157`) turns amber with "10 interactions from your plan starting"; [[R06]] shows the same state in the sidebar.
4. **Early-path email.** In `bumpTrialInteraction` (`convex/interactions.ts:18-38`), when `crossesThreshold(combined, 1, TRIAL_WARNING_THRESHOLD)` schedule a new `internal.notifications.sendTrialNearEnd` action (new `convex/notifications.ts`, following the privacy mailers' `{ subject, html, text }` per-language pattern). Body: how many interactions remain, the plan name, the amount and interval, and a link to `/billing` to cancel. Fires at most once per user (the helper's semantics).
5. **Day-7 path.** Pick one in the brainstorm. Option 1 (zero code): enable Stripe's trial-ending reminder email and the successful-payment receipt in the Stripe Dashboard (Settings → Billing → Subscriptions and emails), per environment. Option 2: handle `customer.subscription.trial_will_end` in `convex/http.ts:136-178` and reuse the mailer from step 4 with the date. Recommendation: Option 1 for the day-7 path and our own email for the 40-of-50 path, because Stripe cannot see interactions. Never run both for the same event.
6. **User language on the backend.** `users.primaryLocale` (`convex/schema.ts:17`) is the scraped LinkedIn locale that seeds the UI language; the user can switch the UI language later, and that choice lives only in a cookie. Decide: send the current UI language with `createCheckoutSession` and persist it as `users.language`, or fall back to `primaryLocale`, then English.
7. **Do not email a user who already canceled.** Before sending, check the subscription row's status and `cancelAtPeriodEnd` from `getSubscriptionInfo`'s source (`convex/users.ts:217-223`).
8. **Tests.** Unit tests for `isNearThreshold` and the 40-threshold scheduling (extract the decision into a pure helper). A snapshot or string test per language for the email template. `pnpm verify` green.
9. **Privacy docs.** Billing notices are transactional (contract necessity), not marketing. Update `docs/PLATFORM.md` §13B data inventory (email used for billing notices) and hand the privacy-policy sentence to [[B29]].
10. **Docs.** See **Docs to update**.

## Do / Don't

For the implementing agent. Each line names the mechanism it relies on and links the source.

**Do**

- **Put the rule under the pay button**, in the checkout's own copy: "Your plan starts at 50 interactions or on {{date}}, whichever comes first. Cancel before then and you pay nothing." The fear is answered two centimetres from the button, never in a FAQ ([@richardrx · 2026-08-11](https://x.com/richardrx/status/2087142982705201423)).
- **Write it as a click trigger**: certainty on the known doubt, one line, plain words ([@richardrx · 2025-12-19](https://x.com/richardrx/status/2002076748112875558)).
- **Name the number, the amount and the date every time**: "40 of 50 · Growth, $X per year, starts at 50 or on {{date}}". A precise, traceable figure convinces; "soon" reads as a catch ([@richardrx · 2026-02-18](https://x.com/richardrx/status/2024141244717281514)).
- **Make the near-threshold email a progress email.** Lead with what the member did ("32 made, 8 received this week"), then the term. Richard's fix for trials lost to life is a progress note, never a "trial ending" alarm ([@richardrx · 2026-05-06](https://x.com/richardrx/status/2052096365128273956)).
- **Frame toward the positive pole and keep the fact exact**: "Cancel anytime before then and nothing is charged" ([@richardrx · 2026-01-06](https://x.com/richardrx/status/2008610564222672914)).
- **Use amber for the near-threshold state.** Red is an alarm and invites reactance; amber reads as information ([@richardrx · 2026-01-02](https://x.com/richardrx/status/2007100585464439150)).
- **Put the cancel path in every notice**: one link to `/billing`. Easy cancellation is the trust signal that lets the user keep the card on file ([@richardrx · 2026-03-02](https://x.com/richardrx/status/2028471666297217460)).
- **Reinforce the choice in the same message**: one line on what the plan gives, choice-supportive bias at work ([@richardrx · 2026-04-29](https://x.com/richardrx/status/2049392897598849333)).

**Don't**

- **Don't leave the rule in the Terms alone.** A term the user meets at the charge is expectation debt, collected by support and by churn ([@richardrx · 2026-04-29](https://x.com/richardrx/status/2049568514311172355)).
- **Don't write "may end early".** The rule is deterministic; vague framing beside a card field reads as "where's the catch?" ([@richardrx · 2026-01-08](https://x.com/richardrx/status/2009227121441341734)).
- **Don't send Stripe's reminder and ours for the same event.** Repetition trains the user to ignore every notice you send ([@richardrx · 2025-11-14](https://x.com/richardrx/status/1989359534251360433)).
- **Don't add promotional copy to billing notices.** They are transactional; the moment they read as marketing they need consent and stop being read.
- **Don't hide the amount behind "your plan's price"** or the date behind "soon".
- **Don't use a countdown, a red banner or urgency theatrics.** The trial end is a fact; manufactured urgency wins once and loses the next ten ([@richardrx · 2026-01-02](https://x.com/richardrx/status/2007100585464439150)).

## Acceptance criteria

- [x] Stripe test-mode checkout shows the custom message under the pay button in the user's language.
- [x] The Terms pages in en, pt and es state the trial rule and how to cancel.
- [x] A trialing test user reaching 40 combined interactions sees the amber banner and receives exactly one email.
- [ ] A trialing user receives a reminder before day 7 (Stripe's or ours, not both). — Code done (`trial_will_end` → `sendTrialEnding`); "not both" still needs Stripe's own trial-ending email switched OFF in the Dashboard (`docs/PLATFORM.md` §8, "Stripe Dashboard setup").
- [ ] The first charge produces a receipt with the amount. — Stripe Dashboard setting (successful-payment receipts ON), same table.
- [x] `pnpm verify` is green (typecheck + lint + tests).
- [x] `docs/PLATFORM.md` updated (see **Docs to update**).

## Risks / edge cases / open questions

- **Card-network rules.** Visa and Mastercard trial rules require a pre-charge reminder with amount, date and cancellation method, plus an easy cancel path. The early end currently gives none; ship this before launch.
- **Deliverability.** Resend needs a verified sending domain in production ([[B13]] / [[B24]] env). Test the sender before relying on it for billing notices.
- **Silent no-op.** `convex/lib/email.ts:2-6` documents that `sendEmail` no-ops when `RESEND_API_KEY` or `EMAIL_FROM` is unset, so an unconfigured production deploy would skip billing notices without failing. Log a Sentry warning on a skipped billing send.
- **Warning threshold.** 40 of 50 is a guess (about 80%). A user can cross 40 and 50 in one session; the email may arrive after the charge. Consider also warning at the first interaction of a day when `combined >= 40`.
- **`trial_will_end` timing.** Stripe emits it 3 days before `trial_end`; it never fires for `trial_end: 'now'`, which is why the early path needs our own mailer.
- **Copy honesty.** The message must say "ends early", not "may end early"; the rule is deterministic.

## Docs to update

- `docs/PLATFORM.md` §8 (Subscriptions & Billing) — checkout `custom_text` and `locale`, the near-threshold state, the notification table (event → channel → sender), the Stripe Dashboard email settings inside the "Stripe Dashboard setup" subsection from [[R01]].
- `docs/PLATFORM.md` §13B (Privacy & Compliance) — transactional billing emails in the data inventory.
- `docs/PLATFORM.md` §14 (BillingPage states) — the amber near-threshold banner.
- `docs/PLATFORM.md` §15 (Landing) — the Terms clause.
- `docs/PLATFORM.md` §16 (Environment variables) — only if a new env var appears (none expected).

## References

- Related: [[R01]], [[R06]], [[R14]], [[B13]], [[B24]], [[B29]].
- Prior art / plan: `convex/privacy/retention.ts:140` (existing per-language mailer pattern); `docs/PLATFORM.md` §8 "50 interactions OR 7 days" paragraph (`:960-966`).
- Principle sources: [@richardrx · 2026-04-29](https://x.com/richardrx/status/2049568514311172355), [@richardrx · 2026-08-11](https://x.com/richardrx/status/2087142982705201423).
