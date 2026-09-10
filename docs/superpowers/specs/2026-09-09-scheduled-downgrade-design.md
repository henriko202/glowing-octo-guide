# Scheduled cross-tier downgrade (no credit at period end) — design

**Date:** 2026-09-09 · **Status:** approved in chat, awaiting spec review · **Branch:** feat/initial-setup (uncommitted;
Henriko commits)

Source docs: `docs/PLATFORM.md` §8 ("Cancel, downgrade and resume (R09)", "Plan switch (R08 / R20)", the ⛔
paragraph under "Stripe Dashboard setup"), backlog B07 (no refund), decision D7 (portal `always_invoice`,
2026-09-09). Stripe references verified this session: Subscription Schedules guide (two-call pattern, per-phase
`proration_behavior`, "Stripe removes omitted parameters" on a current-phase update, `end_behavior: 'release'`,
release semantics) and the Customer Portal guide (Manage-downgrades schedules are same-product only).

## 1. Scope

One change: **a cross-tier downgrade no longer credits the member.** A Growth or Pro member who moves to a cheaper
tier keeps what they paid for until `current_period_end`, the item price swaps there with
`proration_behavior: 'none'`, and the tier moves on the webhook that fires when the swap applies.

In scope:

1. A Stripe **subscription schedule** written by our backend for the cheaper-tier direction, from both entry points
   (`createCancelFlowSession(flow:'downgrade')` and `createPlanSwitchSession`).
2. A **pending state** on our `subscriptions` row, cleared by the webhook when the swap applies or the schedule
   disappears, surfaced on `BillingPage` ("Starter from {{date}}") with an **undo**.
3. Refusals that keep the schedule the **only** writer of a scheduled subscription (no portal update, no cancel deep
   link, while a downgrade is pending).
4. Tests, locales, `docs/PLATFORM.md`, and a **test-mode proof** that a real downgrade produces no credit.

Out of scope (deliberate): upgrades and same-tier interval switches (they stay on the portal exactly as today);
trialing and past-due downgrades (they stay on the portal, §3.1); any restructure of Stripe products (ruled out
2026-09-09, `400 For each product, its price must have unique billing intervals`); subscribing to any
`subscription_schedule.*` webhook event; an analytics event for the undo; a Sentry alert for a schedule that never
applies; email about the pending change.

## 2. Standing constraints (apply to every task)

- **Never run `git commit`, `git push`, `git stash`, `git checkout --`, `git reset` or any other git state change.**
  Henriko commits. A prior subagent ran `git stash` and stranded work.
- Change files only with the Edit and Write tools. Bash is for reading, tests, lint, typecheck.
- **No Stripe writes from the assistant.** The tool classifier allows Stripe API reads and refuses writes. Every
  write (test-mode subscriptions, test clocks, Dashboard clicks, `npx convex run` against the dev deployment) is
  handed to Henriko as an exact command or Dashboard path, and the output is read back before anything is called
  done (§6).
- `docs/PLATFORM.md` is updated in the same task as the code it describes (§21 mapping: schema → §5;
  billing/Stripe → §8 + §1; cancel/downgrade/resume → §8 + §14; app UI → §14; PostHog inventory in §14).
- pnpm only; convex CLI from the repo root; never `pnpm format` (Prettier owns code and config, humans own prose;
  `pnpm verify` runs `format:check`; `docs/` and `*.md` are Prettier-ignored). Doc tables are hand-aligned: keep a
  cell inside its column or re-pad every row.
- i18n: `app/src/i18n/locales/{en,pt,es}.json` stay in exact key parity with the same placeholder sets. pt is pt-BR,
  es is neutral Latin American, labels in sentence case. No parity test exists: verify by recursive key diff and
  placeholder-set diff, report the counts (arrays-as-one and raw leaves).
- Convex testing convention: no `convex-test`. Decision logic lives in pure exported functions under `convex/lib/`
  with plain vitest tests; a mutation is testable through an exported handler taking `(ctx, args)`; actions are not
  unit-tested (typecheck + the manual proof cover them).
- Compare tiers by **rank**, never by `unit_amount` or price id order. The one rank source is `tierToRank` in
  `convex/lib/planLimits.ts` (contact 4, pro 3, growth 2, starter 1). No second rank helper.
- Apify is dev-only and never appears in customer-facing or compliance copy.
- `'use node'` files (`billingNode.ts`) hold actions only; queries and mutations live in `billing.ts` / `stripe.ts`.

## 3. Design

### 3.1 The five calls (Henriko, 2026-09-09, "approved, go ahead")

1. **Who gets the schedule? `active` subscriptions only.** A trialing member has paid nothing, so there is nothing
   to credit; the portal path stays (immediate, and the portal's `trial_update_behavior: continue_trial` keeps the
   trial). A past-due member has an unpaid invoice that Stripe's dunning owns; the portal path stays. The schedule
   is for a member who has paid for the current period.
2. **Cancel while a downgrade is pending? Release the schedule first, then open the portal cancel flow.** The
   portal then acts on a plain subscription. Consequence: a member who abandons the portal cancel page has lost the
   pending downgrade (the release's webhook clears the pending cell); they can schedule it again.
3. **Upgrade or interval switch while pending? Refuse with `PENDING_DOWNGRADE`.** The page toasts "Undo your
   scheduled change first." A portal update on a scheduled subscription would race our schedule. A **second
   downgrade** click while pending is not a refusal: it re-targets the same schedule (§3.3), which is also what
   makes a double tap idempotent.
4. **Promotion codes (Checkout sets `allow_promotion_codes`)? The discount carries into the cheaper phase.** Phase
   0 must repeat it anyway (Stripe unsets what the current-phase update omits), and dropping it from phase 1 would
   break a running `repeating` / `forever` code. Ceiling: an already-consumed `once` code may apply once more on
   the first cheaper invoice (marked `ponytail:` in code).
5. **Analytics for the undo? None in v1.** The pending cell's copy and the schedule's own effect are the record.
   Add `downgrade_undone` only if the save-rate funnel needs it.

### 3.2 Routing (the single decision table)

Direction is `planChangeDirection(fromTier, toTier)` over `tierToRank`: `'up' | 'down' | 'same'`. `fromTier` is the
live row's `tier`; `toTier` is `getTierFromPriceId(priceId)` (grid) or `'starter'` (interstitial). "Pending" is
read from **Stripe** on the retrieved subscription (`cancel_at_period_end`, `schedule`), never from our row, which
is a mirror that can lag a webhook. "grid" = `createPlanSwitchSession`, "interstitial" =
`createCancelFlowSession(flow:'downgrade')`, "cancel link" = `createCancelFlowSession(flow:'cancel')`, "undo" =
`undoScheduledDowngrade`.

| Entry        | Status                | Pending          | Direction                           | Result                                                              |
|--------------|-----------------------|------------------|-------------------------------------|---------------------------------------------------------------------|
| grid         | any                   | any              | same price                          | throw `ALREADY_ON_PLAN` (unchanged)                                 |
| interstitial | any                   | any              | already Starter                     | throw `ALREADY_STARTER` (unchanged)                                 |
| grid         | any                   | none             | `up`, or `same` tier other interval | portal `subscription_update_confirm`, `{ url }` (unchanged)         |
| grid         | any                   | downgrade        | `up`, or `same` tier other interval | throw `PENDING_DOWNGRADE`                                           |
| either       | `active`              | cancel           | `down`                              | throw `CANCEL_PENDING`                                              |
| either       | `active`              | none / downgrade | `down`                              | **schedule** (§3.3), `{ url: null }`                                |
| either       | `trialing`/`past_due` | any              | `down`                              | portal `subscription_update_confirm`, `{ url }` (call 1, unchanged) |
| cancel link  | any                   | downgrade        | –                                   | release + clear, then portal `subscription_cancel` (call 2)         |
| cancel link  | any                   | none             | –                                   | portal `subscription_cancel` (unchanged)                            |
| undo         | any                   | downgrade        | –                                   | release + clear, `null`                                             |
| undo         | any                   | none             | –                                   | `null`, no Stripe call (idempotent)                                 |

Both public flow actions keep returning an object; the shape widens to `{ url: string | null }`, where `null` means
"done here, nothing to redirect to". The return markers `?switched=<tier>` / `?downgraded=<tier>` are only ever
appended to a **portal** URL, so the page's landing state is never reached by a scheduled downgrade. Trap 1 (the
20-second wait, the Sentry exception, the lost completion event) is closed at the source, not patched on the page.

### 3.3 The schedule write (`convex/billingNode.ts`)

Private helper `scheduleDowngrade(ctx, live, targetPriceId)` used by the grid and the interstitial:

1. `sub = stripe().subscriptions.retrieve(live.stripeSubscriptionId)`. The existing `singleItem` retrieve is
   widened to return the subscription and its item together (one retrieve, not two).
2. Status not `active` → return the portal flow exactly as today (call 1). `sub.cancel_at_period_end` → throw
   `CANCEL_PENDING`.
3. `scheduleId = sub.schedule` (a string or an object; take the id). If none:
   `stripe().subscriptionSchedules.create({ from_subscription: sub.id })`. Stripe answers with **one phase**
   matching the current period. Reusing an existing schedule is what makes a re-target and a double tap
   idempotent: there is **one schedule per subscription**, ever.
4. `schedule = stripe().subscriptionSchedules.retrieve(scheduleId)` when reused (the create already returns it).
5. `stripe().subscriptionSchedules.update(scheduleId, { phases: buildDowngradePhases(schedule, targetPriceId),
   proration_behavior: 'none', end_behavior: 'release' })`.
6. `pendingAt = phases[1].start_date * 1000` from the **response**, then
   `ctx.runMutation(internal.billing.setPendingDowngrade, { stripeSubscriptionId, pendingTier, pendingAt })`.
   Stripe first, row second: a failed Stripe write leaves no phantom pending state.
7. Return `{ url: null }`.

`buildDowngradePhases(schedule, targetPriceId)` (pure, `convex/lib/downgrade.ts`) returns exactly two phases:

- **Phase 0 = the current phase, repeated.** Found by `schedule.current_phase.start_date` against
  `phases[].start_date` (throws `ConvexError('Schedule has no current phase')` when `current_phase` is null).
  Carries `start_date`, `end_date`, `items[]` as `{ price: <id>, quantity }` (Stripe returns the price as a string
  or an object; take the id), `discounts[]` mapped to ids (`{ discount }` when Stripe returned a discount id, else
  `{ coupon }`, else `{ promotion_code }`), and `metadata` (Checkout stamps `convexUserId` for Dashboard support
  lookups; omitting it here would unset it). `trial_end` is **not** carried: this path runs for `active`
  subscriptions only, whose trial is over, and Stripe rejects a `trial_end` in the past.
- **Phase 1 = the cheaper tier.** `{ items: [{ price: targetPriceId, quantity: 1 }],
  duration: { interval: <the target price's interval>, interval_count: 1 }, proration_behavior: 'none',
  discounts: <same as phase 0> }`. The duration makes the phase exactly one billing interval of the target price;
  `end_behavior: 'release'` then hands the subscription back to Stripe on the target price with no schedule
  attached. A phase's `proration_behavior` governs the transition **into** that phase, so `'none'` here is the line
  that prevents the credit; the top-level `proration_behavior: 'none'` covers the current-phase rewrite.

  **Not `iterations`.** That parameter is gone from the API version Stripe SDK 20.4.1 targets: the update params
  carry `duration: { interval, interval_count? }` and no `iterations`, and Stripe's own update-a-schedule example
  builds its phase with `duration`. Verified 2026-09-09 against `stripe/types/SubscriptionSchedulesResource.d.ts`
  and the API reference. `new Stripe(key)` pins no `apiVersion`, so the SDK sends the version its types describe.

The target price is `starterPriceIdFor(process.env, interval)` for the interstitial (interval from the retrieved
item, `priceInterval` as fallback, unchanged) and the clicked `priceId` for the grid. **Annual stays annual** on the
interstitial path, as today. Missing price env → `ConvexError('Starter price not configured')`, unchanged.

Phase 1's own interval comes from a new pure helper beside the existing price map, **not** from the current
subscription (the grid can send a monthly member to an annual price):

```ts
// convex/lib/stripePrices.ts
/** The billing interval of one of our six prices — phase 1's `duration` needs the TARGET's, not the current one. */
export function intervalForPriceId(env: Env, priceId: string): 'month' | 'year' | undefined
```

It reads the three `*_ANNUAL_PRICE_ID` vars for `'year'`, the three monthly vars for `'month'`, and returns
`undefined` for anything else — which `scheduleDowngrade` turns into `ConvexError('Unknown price interval')`. No
extra Stripe call, and it keeps price knowledge in the module that already owns the six env vars.

Ceiling, marked in code: `// ponytail: a portal-scheduled interval switch (same product) is overwritten by this
update; read the existing phase 1 first if that ever matters.` A Growth-annual member who scheduled Growth-monthly
in the portal and then taps "Move to Starter" gets Starter-annual and loses the interval switch.

### 3.4 Release (`convex/billingNode.ts`)

`internal.billingNode.releaseSubscriptionSchedule({ stripeSubscriptionId })` (internalAction, the
`cancelDuplicateSubscription` pattern): retrieve the subscription; when `sub.schedule` is set,
`stripe().subscriptionSchedules.release(<id>)`. Stripe accepts `release` only for `not_started` / `active`
schedules; a failure for any other status is logged through `scrubError` and swallowed. A release leaves the
subscription exactly as it is (current price, current period) and fires `customer.subscription.updated` with
`schedule: null`.

Three callers: the sync mutation via `ctx.scheduler.runAfter(0, …)` when the swap has **applied** (§3.6), the cancel
path (call 2) and `undoScheduledDowngrade`. The last two run inside an action already and call the same private
helper inline.

Why release on "applied" at all: with `end_behavior: 'release'` Stripe self-releases only when phase 1 ends, one
cheaper period later (a year, on annual). Until then the subscription carries a schedule, and every other flow
treats "has a schedule" as "downgrade pending" (§3.2). Releasing on the swap returns the subscription to the plain
state the rest of §8 assumes. The self-release is the backstop if the scheduled action never runs.

### 3.5 Data (`convex/schema.ts`, `convex/billing.ts`; PLATFORM §5)

Two optional fields on `subscriptions` (pre-launch: widen, no backfill):

| Field         | Type                               | Meaning                                                                                                    |
|---------------|------------------------------------|------------------------------------------------------------------------------------------------------------|
| `pendingTier` | `'starter' \| 'growth'` (optional) | The tier the schedule swaps to at `pendingAt`. Absent ⇒ nothing pending. Never `pro`: nothing is above it. |
| `pendingAt`   | number (optional)                  | The swap instant (ms): phase 1 `start_date`, which equals `current_period_end` when scheduled.             |

No schedule id is stored. The actions read `sub.schedule` from the subscription they already retrieve, and the sync
only needs whether a schedule exists. Stripe's own best-practice line ("discard the ids when released") is honoured
by never holding one.

`internal.billing.setPendingDowngrade({ stripeSubscriptionId, pendingTier?, pendingAt? })` (internalMutation in
`convex/billing.ts`, next to `setStripeCustomerId`): patches the `by_stripe_id` row; absent args **unset** the
fields (`ctx.db.patch(id, { pendingTier: undefined, pendingAt: undefined })`). One mutation for set and clear.

### 3.6 Webhook (`convex/http.ts`, `convex/stripe.ts`; PLATFORM §8 webhook table)

`syncArgs(event)` gains `stripeScheduleId: typeof sub.schedule === 'string' ? sub.schedule : sub.schedule?.id`
(`string | undefined`). `syncUserSubscription` gains the optional arg and, once past the stale / out-of-order
guards, folds this rule into the row patch (the user-doc decision is unchanged):

```ts
// convex/lib/downgrade.ts — pure
export type PendingOutcome = 'none' | 'keep' | 'clear' | 'applied'
export function resolvePendingDowngrade(
  existing: { tier: string; pendingTier?: string } | null,
  incoming: { tier: string; stripeScheduleId?: string }
): PendingOutcome
```

- `none` — the row has no `pendingTier`: nothing to do.
- `applied` — `incoming.tier !== existing.tier`: the row's tier moved while a downgrade was pending. Normally that
  is the swap; a Dashboard edit that moves the price counts too. Unset both fields **and** schedule
  `releaseSubscriptionSchedule` (§3.4).
- `clear` — no `stripeScheduleId` on the event: the schedule was released or canceled elsewhere (undo, cancel
  path, Dashboard). Unset both fields.
- `keep` — a schedule is attached and the tier has not moved (the schedule-creation event, a card update, a
  re-target). Leave the fields alone.

The order is the test's spine: `applied` is checked before `clear`, because the swap event and the release event
both arrive and only the first may schedule a release. No new Stripe event is subscribed:
`customer.subscription.updated` fires on schedule attach, on the phase swap ("switching from one plan to another")
and on release. `EVENTS` in `scripts/stripe-provision.mjs` and the `registerRoutes` map stay as they are. The
webhook table row for `created` / `updated` and the sync mermaid gain the pending rule.

Race noted, not solved: the `keep` event from the schedule write can arrive before `setPendingDowngrade` runs; both
orders end in the same state (pending set, schedule attached). If the action dies between the Stripe write and the
mutation (schedule attached, no pending on the row), the member sees no pending cell, the swap still applies at
period end, the `applied` rule never fires (no `pendingTier`), and Stripe self-releases the schedule after one
cheaper period. Not worth a repair path pre-launch.

### 3.7 Public actions (`convex/billingNode.ts`, `convex/users.ts`)

- `createCancelFlowSession({ sessionToken, flow })` → `{ url: string | null }`. `downgrade`: §3.2 (schedule when
  `active` and not cancel-pending; portal otherwise). `cancel`: now retrieves the subscription; when it carries a
  schedule, release it and clear pending before building the cancel link.
- `createPlanSwitchSession({ sessionToken, priceId })` → `{ url: string | null }`. `ALLOWED_PRICE_IDS` and
  `ALREADY_ON_PLAN` first, as today; then the direction: `down` → §3.3; otherwise `PENDING_DOWNGRADE` when a
  schedule is attached, else the portal link as today.
- `undoScheduledDowngrade({ sessionToken })` → `null`. Resolves the live row (`NO_LIVE_SUBSCRIPTION` when none),
  retrieves the subscription; no schedule → clear pending and return `null` without a Stripe write; else release +
  clear. Idempotent by construction, like `resumeSubscription`.

`portalFlowSession` keeps its shape; its first half (auth → live row → `NO_LIVE_SUBSCRIPTION`) becomes a small
`liveSubscriptionFor(ctx, sessionToken)` shared by all four actions, so the schedule path pays for no portal
customer lookup. `getSubscriptionInfo` (`convex/users.ts`) returns `pendingTier` and `pendingAt` from our row (both
`undefined` in the no-subscription shape).

### 3.8 Frontend (`app/src/**`; PLATFORM §14)

**BillingPage**

- New `undoDowngrade = useAction(api.billingNode.undoScheduledDowngrade)`.
- Renewal cell, third branch: when `subscriptionInfo.pendingTier` is set and not cancel-pending, label
  `billing.pendingChange` ("Plan change"), value `billing.pendingFrom` ("{{plan}} from {{date}}") with `pendingAt`
  formatted like `currentPeriodEnd`. The cancel-pending branch keeps precedence in the render order; call 2 makes
  the two states mutually exclusive except for the beat between a release and its webhook.
- Where "Resume plan" sits: when pending, a `Button` `billing.pendingKeep` ("Keep {{plan}}", the current tier's
  name) calling `handleUndoDowngrade` (`await undoDowngrade({ sessionToken })`, toast `billing.pendingKept`
  ("Your plan stays as it is."), error → the existing `billing.cancel.resumeFailed`). The "Cancel plan" link stays
  visible while pending (call 2 handles the sequence).
- Under it, `billing.pendingUntil` ("You keep {{plan}} until then.") in place of `billing.cancel.postsLeave`.
- `handlePlanClick` passes its `plan` on to `handlePlanSwitch(priceId, plan)`. A `null` url means scheduled:
  `captureEvent('downgrade_scheduled', { from: me.tier, to: plan })` and toast `billing.pendingScheduled` ("You
  move to {{plan}} at the end of your period."), no redirect. The toast names the plan only: `pendingAt` reaches
  the page a beat later through the reactive query, so a date in the toast would race it. Known refusal codes toast
  instead of falling back to the portal: `PENDING_DOWNGRADE` → `billing.pendingUndoFirst` ("Undo your scheduled
  change first."), `CANCEL_PENDING` → `billing.pendingResumeFirst` ("Resume your plan first."). Every other error
  keeps today's fallback to `handleManageSubscription`.
- The landing state (`?switched=` / `?downgraded=`) is untouched. It still serves the portal cases, including a
  trialing member's immediate downgrade, where `cancel_alternative_completed { from }` keeps firing on the landing.
- Plan names come from the existing `billing.plans.<tier>.name` keys.

**CancelInterstitial**

- New prop `pendingTier?: string`. "Move to Starter" is hidden when `tier === 'starter'` (as today) **or** a
  downgrade is pending.
- `go('downgrade')`: a `null` url closes the dialog, toasts `billing.pendingScheduled`, and fires
  `cancel_alternative_completed { from: tier }`. The save-rate funnel's completion moves from the webhook landing to
  the schedule write, which is the moment the save now happens. `cancel_alternative_taken` stays where it is.

**Locales** (`en`, then pt-BR and neutral-LatAm es, sentence case, same placeholders), eight keys per locale:
`billing.pendingChange`, `billing.pendingFrom`, `billing.pendingKeep`, `billing.pendingKept`,
`billing.pendingUntil`, `billing.pendingScheduled`, `billing.pendingUndoFirst`, `billing.pendingResumeFirst`.

### 3.9 Edge cases

- **Double tap / re-target.** One schedule per subscription; the update replaces `phases`, so a second call is the
  same write. Pro→Starter pending, then "Switch to Growth": phase 1 becomes Growth, `pendingTier: 'growth'`.
- **Undo, then downgrade again.** Release, then create: Stripe allows a new schedule on a released subscription.
- **Period end arrives while the tab is open.** The swap's `updated` event moves the tier and clears pending
  reactively; no marker, no timeout, no Sentry.
- **Payment fails on the first cheaper invoice.** `invoice.payment_failed` → `markPastDue` as today; the schedule
  has already applied and self-releases; nothing new.
- **Dashboard release or cancel of the schedule.** The `updated` event carries no schedule → `clear`.
- **Contact tier.** `tierToRank('contact')` is 4, so every allowlisted price reads as `down` from it — including
  Pro, which `pendingTier` cannot hold. The direction function stays general; the call site guards with
  `targetTier !== 'pro'`, which falls through to the portal. It is unreachable in practice (the sync only ever
  writes `starter` / `growth` / `pro` to a row, because contact is admin-assigned and has no price), so the guard
  exists to keep the type honest rather than to serve a real member.
- **Dev / prod env drift.** The target price comes from the same six env vars as `getTierFromPriceId`, so a price
  the webhook cannot name cannot be scheduled either.

### 3.10 Tests

- `convex/lib/downgrade.test.ts` — `planChangeDirection` (all nine tier pairs plus `contact` and an unknown
  string); `buildDowngradePhases` (carries items / discounts / metadata, drops `trial_end`, phase 1 shape including
  `duration`, throws on a null `current_phase`, price as string vs object, each discount id form);
  `resolvePendingDowngrade` (the four outcomes, `applied` when the row's tier moved, checked before `clear`).
- `convex/lib/stripePrices.test.ts` — `intervalForPriceId` for all six prices, an unknown id and a blank id.
- `convex/stripe.test.ts` — unchanged (pure helpers only).
- `app/src/pages/BillingPage.test.tsx` — the pending cell renders label / value / Keep / until line; Keep calls the
  undo action and toasts; a `null` switch result fires `downgrade_scheduled` and does not redirect;
  `PENDING_DOWNGRADE` and `CANCEL_PENDING` toast without opening the portal; other errors still fall back; the
  existing `?switched=` tests stay green.
- `app/src/components/CancelInterstitial.test.tsx` — "Move to Starter" hidden when pending; a `null` url closes,
  toasts and fires `cancel_alternative_completed`; a url still redirects.
- Locale parity by recursive key diff + placeholder sets (counts reported).

### 3.11 Docs (`docs/PLATFORM.md`)

- §5 `subscriptions` table: the two fields.
- §8 "Cancel, downgrade and resume (R09)": the downgrade paragraph rewritten around the schedule, the refusals, the
  undo, call 2; the mermaid gains the schedule branch and the undo. "Plan switch (R08 / R20)": the direction table,
  `{ url: null }`, the refusal toasts; the sentence "A cross-tier downgrade still credits" replaced. Webhook table
  row for `created` / `updated` + the sync mermaid: the pending rule and the release. The ⛔ paragraph under "Stripe
  Dashboard setup": "Not built; not scheduled." becomes the build note with the proof date and the read-backs (§6).
  The proration row in the Dashboard table notes that the portal's `always_invoice` no longer reaches a cross-tier
  downgrade.
- §14 BillingPage bullets (pending cell, Keep button, the two toasts) and the CancelInterstitial line; PostHog
  inventory: `downgrade_scheduled { from, to }` added, `cancel_alternative_completed` re-described (fires on the
  schedule write for the scheduled path, on the landing for the portal path).
- §21 last-updated block.

## 4. Verification gates (all must pass before "done")

1. `pnpm verify` — format check, lint, typecheck, app and convex tests (baseline 2026-09-09: convex 486, app 421).
2. Locale parity: recursive key diff and placeholder-set diff across en / pt / es, counts reported.
3. The manual test-mode proof in §6, read back by the assistant (reads are allowed) or pasted by Henriko where a
   read needs his key.

## 5. Execution plan (subagent-driven; implementer + reviewer per task)

| # | Task          | Files                                                                                                      | Agent notes                                                         |
|---|---------------|------------------------------------------------------------------------------------------------------------|---------------------------------------------------------------------|
| 1 | Pure logic    | `convex/lib/downgrade.ts` (+ test), `convex/lib/stripePrices.ts` (+ test)                                  | TDD; Henriko may write `resolvePendingDowngrade` (learning mode)    |
| 2 | Data + sync   | `convex/schema.ts`, `convex/billing.ts`, `convex/http.ts`, `convex/stripe.ts`, `convex/users.ts`           | convex tests + typecheck; PLATFORM §5, §8 webhook row + mermaid     |
| 3 | Actions       | `convex/billingNode.ts`                                                                                    | typecheck (no action tests, repo convention); PLATFORM §8 R09 + R08 |
| 4 | Frontend      | `app/src/pages/BillingPage.tsx` (+ test), `app/src/components/CancelInterstitial.tsx` (+ test), locales ×3 | app tests; locale parity; PLATFORM §14 + PostHog inventory          |
| 5 | Proof + close | §6 hand-off, read-backs, PLATFORM ⛔ paragraph + §21, memory note                                          | no commit; not "done" before the read-backs                         |

Subagent rules, verbatim in every prompt: no git state changes; Edit/Write for file changes; never `pnpm format`;
pnpm from the repo root; no Stripe writes; report test output faithfully.

## 6. Manual proof for Henriko (test mode; the assistant reads, Henriko writes)

Goal: one real downgrade, three read-backs, zero credit. Dev deployment: its webhook endpoint already points at the
dev Convex site, which is how Checkout works today. `<…>` are ids to fill from the previous command's output.

1. **Setup (Stripe CLI, test key).** A customer under a test clock, with a card, attached to a dev user **before**
   the subscription exists (the sync warns and drops events for a customer it cannot map).

   ```bash
   stripe test_helpers test_clocks create -d frozen_time=<now unix seconds> -d name=downgrade-proof
   stripe customers create -d test_clock=<clock> -d email=<dev user email> -d name="Downgrade proof"
   stripe payment_methods attach pm_card_visa -d customer=<cus>
   stripe customers update <cus> -d "invoice_settings[default_payment_method]=<pm>"
   ```

   From the repo root (internal mutation, dev deployment):

   ```bash
   npx convex run billing:setStripeCustomerId '{"userId":"<users id>","stripeCustomerId":"<cus>"}'
   ```

   Then the Growth **monthly** subscription:

   ```bash
   stripe subscriptions create -d customer=<cus> -d "items[0][price]=<STRIPE_GROWTH_PRICE_ID>"
   ```

   Expected in the app: the dev user is a Growth member, `active`, renewal one month out.

2. **Downgrade.** Tap "Cancel plan" → "Move to Starter" in the app. Expected: no redirect, the toast, "Starter from
   <date>" on the billing card, a "Keep Growth" button.
3. **Read-back A (scheduled, nothing credited).**

   ```bash
   stripe subscriptions retrieve <sub>
   stripe subscription_schedules retrieve <sched>
   stripe customers retrieve <cus>
   stripe invoices list -d customer=<cus>
   ```

   Expected: `schedule` set and the item still on the Growth price; two phases, phase 1 `proration_behavior: none`,
   `start_date == current_period_end`, item price = Starter monthly; `balance: 0`; only the first invoice.
4. **Undo (read-back C).** Tap "Keep Growth". Expected: subscription `schedule: null`, the schedule
   `status: released`, item price unchanged, pending cell gone, `balance: 0`.
5. **Schedule again, and look at the portal.** Repeat step 2. While it is pending, open "Manage subscription" and
   record what the portal home shows for a scheduled subscription (it may say the plan is managed by a schedule).
   Information for §8, not a gate.
6. **Advance the clock.**

   ```bash
   stripe test_helpers test_clocks advance <clock> -d frozen_time=<current_period_end + 3600>
   ```

7. **Read-back B (applied, nothing credited).** Same four reads as step 3. Expected: item price = Starter monthly;
   `schedule: null` (released by the sync's scheduled action; if it still reads `active`, say so and read again a
   minute later); the new invoice carries **one** Starter line and **no** negative proration line, `amount_due` =
   the Starter price; `balance: 0`. In the app: tier Starter, no pending cell, no Sentry event.

Every output comes back to the assistant, which records the read-backs in PLATFORM §8. Nothing in this spec is
"done" before read-backs A, B and C are on file.
