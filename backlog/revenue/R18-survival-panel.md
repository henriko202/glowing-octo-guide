# R18 — Survival panel: activation, first value, return and trial conversion

> **Status:** DONE 2026-09-07 · **Priority:** P1 · **Effort:** M · **Category:** Metrics / Backend / Frontend (admin)
> **Depends on:** none (reads tables that exist today) · **Blocks:** — (every item whose acceptance says "measure" reads this panel: [[R04]], [[R07]], [[R08]], [[R14]])

## Principle

**Between a working product and a business, the only numbers that matter say whether anyone reaches the promised result and comes back.**
Activation, time to first value, day-1 and days-2-to-7 return, trial conversion and paying members by
tier. Signups measure curiosity; the feed's first reaction measures value. The app already stores every
fact these numbers need, so the panel is a query over the database, not a new pipeline, and it counts
every member rather than the consenting sample PostHog sees. Where there is a direction there is a
measurement; otherwise the next audit argues from opinion.
Sources: [survival-stage metrics](https://x.com/richardrx/status/2066893927781748953),
[signups are not traction](https://x.com/richardrx/status/2065082771987394651),
[measure, don't argue](https://x.com/richardrx/status/2026605258152038780).

## Summary

PostHog is wired, consent-gated and EU-hosted, but it names no product moment: it captures page views and
autocaptured clicks for members who opted in, nothing else. The admin area has five tabs and no number
about the funnel. Every R item says "measure activation" and there is nothing to read it from. The
database holds the signup time, every interaction with its timestamp, the trial end and the subscription
status, so one admin query plus one tab answers the survival questions for all members. A small
`track()` helper adds the four named events the database cannot see (checkout started and returned, a
limit reached, the cancel flow opened), consent-gated like everything else in PostHog.

## Evidence

- `app/src/lib/observability/analytics.ts:24-30` — PostHog init: opted out by default, `disable_session_recording: true`, `capture_pageview` and `autocapture` on; no named `capture` call exists anywhere in `app/src`.
- `app/src/lib/observability/analytics.ts:35-44` and `app/src/components/AnalyticsConsentGate.tsx:11-16` — capture starts only for a signed-in member with the `analytics` consent; any PostHog funnel is a consenting sample.
- `app/src/pages/AdminPage.tsx:16`, `:125-129` — five tabs (settings, plan limits, users, feedback, MOTD); no metrics.
- `convex/admin.ts:366-374` — `listUsers` reads `users` newest first with a bounded `.take(1000)`; the same ceiling fits the panel.
- `convex/linkedin/auth.ts:56-71` — a new member gets `createdAt` and `lastLoginAt` at insert (`:68-70`); `:37-54` patch `lastLoginAt` (`:46`) on every later login, so it holds the last login only, never a history.
- `convex/schema.ts:349-360` — `userInteractions` rows carry `userId`, `kind` and `createdAt`; `by_user` plus the implicit `_creationTime` range is the first-interaction and returned-after lookup ([[R16]] uses the same range).
- `convex/schema.ts:40-46`, `:47` — `subscriptionStatus` (`trialing`, `active`, `canceled`, `past_due`, `none`) and `trialEndsAt`; `convex/schema.ts:174-182` — `subscriptions` carry `tier` and `status`.
- `convex/lib/trialMilestone.ts:3` — `TRIAL_INTERACTION_THRESHOLD = 50` is the trial's end condition, not the activation moment; activation is the first tap.
- `docs/PLATFORM.md:3010-3081` — the observability section documents the consent gate; `:2917-2918` the two `VITE_POSTHOG_*` variables; §12 (`:1734`) the admin queries.

## Root cause

Observability was built for compliance and errors (Sentry for necessary logging, PostHog behind consent)
and the admin area for moderation; neither was built to answer "does anyone reach value, and do they
come back".

## What we need to do

1. **Pure summary in `convex/lib/survival.ts`.** `summarizeCohort(rows, now)` takes one row per member `{ createdAt, firstInteractionAt?, firstInteractionAfterDay1At?, subscriptionStatus, trialEndsAt? }` and returns `{ signups, activated, medianMinutesToFirstInteraction, returnedDay1, returnedDays2to7, trialsEnded, converted, canceled }`. Definitions, fixed in code comments and in the tab's tooltips: **activated** = first interaction within 24 h of `createdAt`; **returned day 1** = an interaction in `[createdAt + 24 h, createdAt + 48 h)`; **returned days 2 to 7** = an interaction in `[createdAt + 24 h, createdAt + 8 d)`; **trials ended** = `trialEndsAt < now`; **converted** = ended and `subscriptionStatus === 'active'`; **canceled** = ended and `canceled`. Median over the activated only; `null` when nobody activated. UTC throughout.
2. **`admin.survivalMetrics({ sessionToken, days })` query** next to `listUsers`: `requireAuth` + `assertAdmin`; `days` validated to `7 | 28`; `users` newest first `.take(1000)`, keep `createdAt >= now - days`; per member two indexed reads on `userInteractions.by_user`: `.order('asc').first()` for the first interaction and `.gte('_creationTime', createdAt + 24 h)` then `.first()` for the first interaction after day 1 (one row answers both return windows). Also `payingByTier` across the whole window: members with `subscriptionStatus === 'active'` grouped by `tier`. `ponytail:` two indexed reads per member, bounded by the `take(1000)`; move to a nightly snapshot table when the base outgrows it.
3. **`SurvivalTab` in `AdminPage.tsx`** as the sixth tab: a 7 / 28 days toggle, then a definition list with count and share side by side (`12 of 40 · 30%`), each term carrying its definition in the `title` attribute, plus a "Paying by tier" row. Admin strings are English only (the admin area has no i18n, B17). Empty cohort: "No signups in this window" and nothing else.
4. **`track()` helper in `analytics.ts`.** `track(event: AppEvent, props?: Record<string, string | number | boolean>)` returns early unless initialised and opted in (`posthog.has_opted_in_capturing()`), then calls `posthog.capture`. `AppEvent` is a union of four names: `checkout_started` (`app/src/pages/BillingPage.tsx:83-91`, prop `tier`), `checkout_returned` (the `/billing?success=true` return, prop `outcome`), `limit_reached` (where the [[R08]] component renders, prop `kind`: `interactions | featured | posts`), `cancel_opened` ([[R09]]). Props are plan and kind names only, never text, names or ids.
5. **Tests.** `convex/lib/survival.test.ts`: empty cohort, one activated member, an even-count median, a trial ended without conversion, a member with no interactions. `app/src/pages/AdminPage.test.tsx`: the tab renders the list from a mocked query. `app/src/lib/observability/analytics.test.ts`: `track` is a no-op before init and when opted out.
6. **Docs.** See **Docs to update**.

## Do / Don't

For the implementing agent. Each line names the mechanism it relies on and links the source.

**Do**

- **Read the panel before starting any other R item, and again after.** A point of activation or conversion is worth more than a month of traffic, and only the number shows which item moved it ([@richardrx · 2026-08-24](https://x.com/richardrx/status/2091906704489271659), [@richardrx · 2026-02-25](https://x.com/richardrx/status/2026605258152038780)).
- **Define value as the first tap and measure the time to it.** Activation and time to value are the survival numbers; the exit signal is paying members who come back on their own ([@richardrx · 2026-06-16](https://x.com/richardrx/status/2066893927781748953)).
- **Audit conversion, activation and retention before any paid traffic.** Scaling on a leaky funnel buys the loss wholesale ([@richardrx · 2026-09-02](https://x.com/richardrx/status/2095131360054723045)).
- **Compute lifetime value per cohort, never ARPU divided by blended churn.** Early churn is high and settles later, so the blended formula flatters by 30 to 50%; each churn point is a cash lever, so translate it into 12-month value ([@richardrx · 2026-05-18](https://x.com/richardrx/status/2056503027922608196), [@richardrx · 2026-04-06](https://x.com/richardrx/status/2041184077106004289)).
- **Show the count beside every share.** "3 of 9" is honest at launch volumes; "33%" alone invites a conclusion the sample cannot carry ([@richardrx · 2026-02-18](https://x.com/richardrx/status/2024141244717281514)).
- **Keep the events consent-gated and free of PII.** The `track()` helper inherits the opt-in gate; props are tier and kind names (memory `observability-sentry-posthog`).

**Don't**

- **Don't read signups as traction.** They measure curiosity; the panel's first row is there for the cohort size, the rest is the business ([@richardrx · 2026-06-11](https://x.com/richardrx/status/2065082771987394651)).
- **Don't turn on session replay to see the journey.** `disable_session_recording: true` is a privacy commitment; write the journey on paper and check it against five member interviews instead of recordings ([@richardrx · 2026-05-08](https://x.com/richardrx/status/2052711138572263474)).
- **Don't ship the next feature while activation is flat.** Building on top of a step nobody completes is the first survival trap, and shipping faster only reaches churn faster ([@richardrx · 2026-06-16](https://x.com/richardrx/status/2066893927781748953), [@richardrx · 2026-04-02](https://x.com/richardrx/status/2039685818273378644)).
- **Don't add a metrics table, a cron or `posthog-node` in the first cut.** The bounded query answers the question today; the snapshot table is the upgrade path when `take(1000)` is not enough.
- **Don't show the panel to members.** Their numbers are the recap ([[R15]]); this one is the founder's.
- **Don't A/B test on these counts.** Under a few hundred members a test cannot reach power; interview instead ([@richardrx · 2026-06-01](https://x.com/richardrx/status/2061463480868229189)).

## Acceptance criteria

- [x] An admin opens the Survival tab and sees, for 7 and 28 days: signups, **started trial**, activated within 24 h, median minutes to the first interaction, returned on day 1, returned in days 2 to 7, trials ended with converted and canceled, paying members by tier, each with count and share. — shipped as: nine rows plus the by-tier block; **`startedTrial` added** (Henriko), so a card-gate leak is visible separately from an activation leak.
- [x] `summarizeCohort` is pure and unit-tested against the definitions above. — shipped as: `convex/lib/survival.ts` (`returnWindows`, `summarizeCohort`, `payingByTier`), plus the exported `share(part, base)` in `SurvivalTab` so the zero-base case is tested without rendering.
- [x] `track()` sends nothing before init or without the `analytics` consent, and the four events carry no PII. — shipped as: **no `track()` helper and no survival events at all**. The panel reads the database, so it is complete for members who refused analytics consent and works with no PostHog key. The one event added on this path is `checkout_started { plan, interval }` through the existing `captureEvent` (§17), which is consent-gated and PII-free.
- [x] The query never reads more than the `take(1000)` window plus two indexed reads per member. — shipped as: the `take(1000)` window plus **~4** indexed reads per member (subscriptions `take(5)`, the first interaction, and two `_creationTime` range reads); the `ponytail:` comment names the nightly-precompute upgrade if a 28-day cohort ever passes ~1500.
- [x] `pnpm verify` is green (typecheck + lint + tests). — exit 0 on 2026-09-07 (convex 456/456, app 370/370).
- [x] `docs/PLATFORM.md` updated (see **Docs to update**).

**Shipped as (whole-item notes).** Trials ended / converted / canceled are keyed on the **`subscriptions` row's status**, not on `users.trialEndsAt`: `stripe.syncUserSubscription` erases that field the moment a subscription activates, so a cohort built on it would under-count exactly the conversions the panel exists to measure. No nightly snapshot table and no cron. No error state on the tab either — `useQuery` has no error value, so a spinner is the only non-data state. An empty cohort renders "No signups in the last N days." in place of the funnel table (the tier table is not cohort-bound and stays), each row header carries its definition in a `title`, and the footer prints the window's two edges in UTC (review fixes, 2026-09-07 — the first cut printed a table of zeros and no definitions).

## Risks / edge cases / open questions

- **Erasure removes members from cohorts.** An erased member's rows are gone, so old cohorts shrink; acceptable, documented in §13B.
- **Small numbers.** At launch a 7-day cohort may be five people; the count beside the share is the guard, and no decision should rest on one week.
- **`take(1000)` ceiling.** Past 1000 members the 28-day cohort may be cut; the `ponytail:` comment names the snapshot upgrade.
- **Autocapture already exists.** PostHog's autocapture records clicks by element for consenting members, so the four named events cover only what autocapture cannot label (a checkout outcome, a limit kind).
- **Time zone.** Days are UTC; the tab says so in its footer.

## Docs to update

Updated 2026-09-07 to the sections actually touched:

- `docs/PLATFORM.md` §12 (Admin & Moderation) — the `survivalMetrics(days: 7|28)` row in the admin query table and a
  new **Survival panel (R18)** subsection: the read budget, the cohort-definition table, why the trial metrics are
  keyed on the subscription row, and the `payingByTier` scope note.
- `docs/PLATFORM.md` §14 (AdminPage) — the **Survival** tab, the tab-count fix (four → **six**, MOTD was already
  shipped and never listed), and `SurvivalTab` in "Reusable components".
- `docs/PLATFORM.md` §17 — `checkout_started` in the complete event list, the new total (**twelve**), and one clause
  saying the panel reads the database rather than PostHog.
- `docs/PLATFORM.md` §21 — the mapping row for `lib/survival.ts` / `admin.survivalMetrics` / `SurvivalTab`.
- **Not touched: §13B.** No new events, no new personal data and no new processing — the erasure-shrinks-cohorts point
  is already covered by the existing erasure text.

## References

- Related: [[R04]], [[R07]], [[R08]], [[R09]], [[R15]].
- Prior art / plan: memory `observability-sentry-posthog` (consent-gated PostHog, EU, no replay); `docs/PLATFORM.md` §17 observability flow (`:3061-3071`).
- Principle sources: [@richardrx · 2026-06-16](https://x.com/richardrx/status/2066893927781748953), [@richardrx · 2026-06-11](https://x.com/richardrx/status/2065082771987394651), [@richardrx · 2026-02-25](https://x.com/richardrx/status/2026605258152038780).
