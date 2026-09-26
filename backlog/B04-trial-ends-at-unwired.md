# B04 — trialEndsAt never written — trial countdown always 0

> **Status:** TODO (re-verified 2026-08-20) · **Priority:** P0 · **Effort:** S · **Category:** Billing
> **Depends on:** — · **Blocks:** trial "days remaining" UI + `isTrialExpired` gating; the date-based half of the trial system

## Summary

`users.trialEndsAt` is read by the billing UI ("N days remaining") and by `getTrialProgress`, but the only code that ever *writes* it sets it to `undefined`. A 7-day Stripe trial is created at checkout (`trial_period_days: 7`), yet its `trial_end` is never persisted back to Convex. Result: days-remaining is always `0`, `isTrialExpired` is always `false` (so the date-based expiry never fires), and only the interaction-count meter (X/50) actually works. The trial's time dimension is effectively dead.

## Evidence

- `convex/schema.ts:31` — `trialEndsAt: v.optional(v.number())` on the `users` table.
- `convex/stripe.ts:59-63` — `syncUserSubscription` patches the user and **hardcodes** `trialEndsAt: undefined` (`:62`). This is the **only** writer of the field in the codebase.
- `convex/stripe.ts:44` — `syncUserSubscription` args accept `tier`, `status`, `currentPeriodEnd` but **not** any trial-end value; the webhook has nothing to pass even if the mutation wanted it.
- `convex/http.ts:139-160` — the `customer.subscription.created` / `.updated` webhook handlers build the `syncUserSubscription` args from `event.data.object`; they read `sub.items…price.id`, `sub.status`, `sub.current_period_end`, but **never** `sub.trial_end`.
- `convex/billingNode.ts:18` `TRIAL_PERIOD_DAYS = 7`; `:43-44` checkout sets `subscription_data.trial_period_days: TRIAL_PERIOD_DAYS`. So Stripe *does* create a trial (and will emit `trial_end` on the subscription object) — it just isn't captured.
- `convex/users.ts:197` — `getTrialProgress` returns `trialEndsAt: user.trialEndsAt` (so it forwards whatever is stored — always `undefined` today).
- `app/src/pages/BillingPage.tsx:31-34` — `getTrialDaysRemaining(trialEndsAt)` returns `0` when `trialEndsAt` is falsy.
- `app/src/pages/BillingPage.tsx:51-55` — `trialEndsAt = me?.trialEndsAt`; `isTrialExpired = isTrialing && !!trialEndsAt && trialEndsAt <= Date.now()` (always `false` because `trialEndsAt` is undefined); `trialDaysRemaining = isTrialing ? getTrialDaysRemaining(trialEndsAt) : 0` (always `0`).
- `convex/billingNode.ts:66-71` — `endTrialEarly` sets Stripe `trial_end: 'now'`, which fires `customer.subscription.updated` → `syncUserSubscription`. So the same sync path handles both trial start and early-end.

## Root cause

A schema/UI-vs-writer mismatch. The field, the reader (`getTrialProgress`), and the UI were all built, but the webhook→mutation write path was never wired to Stripe's `trial_end`; the single writer stubs it to `undefined`. The interaction-based trial (X/50 counters `trialInteractionsMade`/`trialInteractionsReceived`) was implemented and works, so the date-based trial was left half-done.

## What we need to do

1. **Thread `trial_end` through the webhook.** In `convex/http.ts` `customer.subscription.created` (`:139-149`) and `customer.subscription.updated` (`:150-160`), read `sub.trial_end` (Stripe epoch **seconds**, may be `null`) and pass it to `syncUserSubscription`, e.g. `trialEndsAt: sub.trial_end ? sub.trial_end * 1000 : undefined`.
2. **Accept + persist it in the mutation.** Add `trialEndsAt: v.optional(v.number())` to `syncUserSubscription`'s args (`convex/stripe.ts:41-47`) and replace the hardcoded `trialEndsAt: undefined` (`:62`) with the passed value. Source of truth = **Stripe `trial_end`** (recommended: it stays correct through early-end and Stripe-side trial edits), not a locally computed `now + 7d`.
3. **Clear it correctly on trial end / activation.** When the subscription becomes `active` (trial elapsed or `endTrialEarly` set `trial_end:'now'`), Stripe's `trial_end` is in the past or null; passing it through will store a past/undefined value. Decide the rule: keep storing the raw Stripe `trial_end` (so `isTrialExpired` can be true briefly) **or** set `undefined` once `status === 'active'`. Simplest correct behavior: store `sub.trial_end` verbatim and let the UI's `status === 'trialing'` gate decide when to show the countdown (BillingPage already gates on `isTrialing`).
4. **Verify the readers render.** `getTrialProgress` (`users.ts:182-199`) already forwards the field; `BillingPage` (`:55`, `:65`) already renders `trialDaysRemaining`. No client change needed if the value is correct — confirm the "days remaining" copy and `isTrialExpired` now behave.
5. **Confirm the early-end path still composes.** `endTrialEarly` (`billingNode.ts:66-71`) → Stripe `trial_end:'now'` → `customer.subscription.updated` → `syncUserSubscription`. Ensure the new field write doesn't fight the interaction-based end (the X/50 path) — they should converge on the same "trial over → active" state.

## Acceptance criteria

- [ ] After a checkout with a 7-day trial, `users.trialEndsAt` holds Stripe's `trial_end` in **ms**, and BillingPage shows the correct "days remaining".
- [ ] `isTrialExpired` becomes `true` once the trial end passes (for a still-`trialing` user) instead of always `false`.
- [ ] `endTrialEarly` (interaction-threshold path) transitions the user to `active` without leaving a stale future `trialEndsAt` that misrenders.
- [ ] `getTrialProgress` returns a real `trialEndsAt`.
- [ ] `pnpm verify` is green (typecheck + lint + tests).
- [ ] `docs/PLATFORM.md` updated (see **Docs to update**).

## Risks / edge cases / open questions

- **Units:** Stripe `trial_end` is epoch **seconds**; the app stores ms everywhere (`http.ts:80`, `:147` already multiplies `current_period_end` by 1000). Mirror that ×1000.
- `sub.trial_end` can be `null` for non-trial subscriptions — guard before multiplying.
- Timezone/rounding: `getTrialDaysRemaining` uses `Math.ceil`, so a trial ending in <24h shows "1 day" — acceptable, but note it.
- No prod-data backfill needed (pre-launch, memory `prelaunch-no-prod-data`); existing dev rows can be wiped or will self-correct on the next webhook.
- `BillingPage.tsx:52` has an intentional `react-hooks/purity` eslint-disable for the `Date.now()` comparison — leave it; the fix is backend-only.

## Docs to update

- `docs/PLATFORM.md` §8 (Subscriptions & Billing) — document that `trialEndsAt` is sourced from Stripe `trial_end` via the webhook and how it interacts with the interaction-threshold trial end.
- `docs/PLATFORM.md` §14 → "Trial UI (Plan 2C)" — note the date-countdown is now live (previously only the X/50 meter worked).

## References

- Related: [[B03]] (sibling widen/wiring gap), [[B05]] (webhook write failures should be monitored)
- Prior art / plan: `docs/PLATFORM.md` §8 (Checkout flow), §14 Trial UI (Plan 2C)
- Memory: `prelaunch-no-prod-data`

## Update — 2026-08-20

Re-verified against current code after commits `8417b51` (onboarding) and `5fe86b8` (toast). **Status unchanged: TODO.** Nothing threaded Stripe `trial_end` through.

- `convex/stripe.ts:62` still hardcodes `trialEndsAt: undefined` — the only writer; `syncUserSubscription` args (`:41-47`) still accept `tier`/`status`/`currentPeriodEnd` but no trial-end value.
- `convex/http.ts:139-160` webhook handlers still read only `sub.current_period_end` (`:147`, `:158`); `sub.trial_end` is never touched.
- `convex/billingNode.ts` still creates the 7-day trial (`TRIAL_PERIOD_DAYS=7` `:18`, `subscription_data.trial_period_days` `:44`) and `endTrialEarly` still sets `trial_end:'now'` (`:69`).
- Reader/UI unchanged: `getTrialProgress` forwards `trialEndsAt` (`users.ts:197`); `BillingPage.tsx:31-34`/`:51-55` still compute `0` days / `isTrialExpired=false`.
- Only evidence line corrected: `users.ts:196`→`:197` (and the `getTrialProgress` range `:181-199`→`:182-199`). Neither commit changed `stripe.ts`, `http.ts`, `billingNode.ts`, or `BillingPage.tsx`; their cited lines are still exact.
