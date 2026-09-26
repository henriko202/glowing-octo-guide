# R06 — Trial progress where the work happens

> **Status:** DONE · **Priority:** P2 · **Effort:** S · **Category:** Frontend / Trial UX
> **Depends on:** [[R02]] (near-threshold flag) · **Blocks:** none

## Principle

**Give the trial an active goal, and show the open loop where the work happens.** Wispr Flow
turns a passive trial into "100 words a day"; the X / 50 meter already does that for this app, but
it lives on the billing page, which a trialing user has no reason to revisit. The Zeigarnik effect
only works when the unfinished bar is in view while the user acts. The same element can reinforce
the decision the user just made (choice-supportive bias) by naming what the interactions build.
Sources: [active trial goal](https://x.com/richardrx/status/2037316988981174464),
[never ship a blank dashboard, progress started above zero](https://x.com/richardrx/status/2054283657934758021),
[reinforce the decision](https://x.com/richardrx/status/2049392897598849333).

## Summary

The X / 50 meter and the days-remaining count render only on `/billing`. The feed and the sidebar,
where reactions and comments happen, show nothing about the trial. The meter's copy
("12 / 50 interactions") reads as a countdown to a charge rather than progress toward a habit.

## Evidence

- `app/src/pages/BillingPage.tsx:157-175` — the meter and the banner render only on the billing page; `:76` builds the "free trial · X/50 · N days" header string for the same page.
- `app/src/components/shell/Sidebar.tsx:12` — the sidebar already calls `useCardGate`; `:46` pulses the Billing item while gated; `:63` links out to `linkedin.com/sales/ssi`. No trial element.
- `app/src/hooks/useCardGate.ts:13` — exposes `isTrialing`.
- `convex/users.ts:183-201` — `getTrialProgress` is a public, one-row query already consumed by `BillingPage.tsx:44`; it returns `made`, `received`, `combined`, `threshold`, `trialEndsAt`.
- `app/src/i18n/locales/en.json:171` — "{{combined}} / {{threshold}} interactions"; `:166-167` days remaining. Neutral countdown phrasing.
- `app/src/pages/FeedPage.tsx` — no use of `getTrialProgress`; no feedback after a reaction or comment succeeds (grep, 2026-09-05).

## Root cause

Plan 2C put the trial UI on the billing page because that is where the card ask lived. The meter
was built as a billing status, not as an activation goal.

## What we need to do

1. **Extract the meter.** Move the bar markup from `BillingPage.tsx:160-175` into a shared `TrialMeter` component (`app/src/components/TrialMeter.tsx`) that takes `progress` and renders the bar, the count and the days left. BillingPage uses it too.
2. **Sidebar card.** In `Sidebar.tsx`, when `isTrialing`, render `TrialProgressCard` above the nav or the SSI link: the meter plus goal copy: "Interactions build your SSI habit. Your {{plan}} plan starts at 50 or on {{date}}." Use the localized plan name from `billing.plans.<tier>.name`. When `progress.nearThreshold` ([[R02]]) is true, switch to the amber state with "10 to go" and a link to `/billing`.
3. **Made vs received.** Show both counters ("made 8 · received 4") so the user sees their own post working, not only their taps. Link the line to `/recap` ([[R15]]), which shows the same split over 7 and 30 days and outlives the trial.
4. **Mobile.** `app/src/components/shell/AppShell.tsx:59` renders `TopBar`; the sidebar becomes a drawer below `lg` (`AppShell.tsx:48-51`). Add a compact "12/50" pill to `TopBar.tsx` that links to `/billing` on small screens.
5. **Optional feedback on action (brainstorm).** After a successful react or comment in `FeedPage.tsx`, a short toast "+1 · 13/50". Decide whether this is motivating or noise; default to off.
6. **Copy in three languages.** Keys `shell.trialGoal`, `shell.trialStartsAt`, `shell.trialNearEnd`, `shell.trialMadeReceived` in en, pt and es.
7. **Tests.** `Sidebar.test.tsx` with a mocked `getTrialProgress`: card shown while trialing, hidden for `none` and `active`, amber at `nearThreshold`.
8. **Docs.** See **Docs to update**.

## Do / Don't

For the implementing agent. Each line names the mechanism it relies on and links the source.

**Do**

- **Put the bar where the taps happen.** An open loop only pulls while it is in view as the user acts ([@richardrx · 2025-11-17](https://x.com/richardrx/status/1990429269487386865)).
- **Attach meaning to the number.** "12 of 50 · made 8 · received 4" plus what it builds; a count without context is spam on the wall ([@richardrx · 2025-12-16](https://x.com/richardrx/status/2000930776636940333)).
- **Name the plan start every time the number appears.** Goal and term in one sentence, so the goal never reads as a trap; a broken goal breaks the emotional contract ([@richardrx · 2026-02-04](https://x.com/richardrx/status/2019019293761941566)).
- **Keep the meter as the only progress element on a live feed.** The [[R05]] checklist owns the empty feed.
- **Show made and received.** Received is the user's own post working, the proof the landing promised; link the line to `/recap` ([[R15]]).
- **Treat the amber state as a decaying item**: what changes if they do nothing today ([@richardrx · 2026-07-27](https://x.com/richardrx/status/2081757132639097341)).
- **Reinforce the choice in the goal copy**, "Your Growth plan starts at 50 or on {{date}}", so the meter also tells the user they chose right ([@richardrx · 2026-04-29](https://x.com/richardrx/status/2049392897598849333)).

**Don't**

- **Don't turn the meter into a countdown to a charge** ("38 left before billing"). Loss-framed pressure toward the threshold triggers reactance; the frame decides the answer ([@richardrx · 2026-01-06](https://x.com/richardrx/status/2008610564222672914)).
- **Don't ship the "+1" toast on by default.** Predictable rewards build tolerance and every extra element is noise ([@richardrx · 2026-01-30](https://x.com/richardrx/status/2017274698699067466), [@richardrx · 2025-11-04](https://x.com/richardrx/status/1985828780838097317)).
- **Don't start the bar at zero for a user who already posted.** Credit effort already spent ([@richardrx · 2026-04-16](https://x.com/richardrx/status/2044785090832543998)).
- **Don't hide the meter on mobile.** The drawer is closed by default; the pill carries it.
- **Don't show the trial counters next to the [[R15]] lifetime counts without labels** (two counters, two meanings).
- **Don't celebrate 50 here.** The peak is the checkout success ([[R07]]); the meter is the road.

## Acceptance criteria

- [x] A trialing user sees the meter in the sidebar (desktop) and a pill in the mobile header on every page.
- [x] The card disappears once the status is `active` or `canceled`.
- [x] The amber near-threshold state matches the billing banner.
- [x] Copy frames the goal and states the plan start honestly (50 or the date).
- [x] `pnpm verify` is green (typecheck + lint + tests).
- [x] `docs/PLATFORM.md` updated (see **Docs to update**).

## Risks / edge cases / open questions

- **Goal vs countdown.** Motivating users toward 50 also brings the charge forward. The copy must name the plan start every time the number appears; [[R02]] owns the honesty rules.
- **One more subscription per shell.** `getTrialProgress` is a single-row read, cheap, but keep it subscribed only while `isTrialing`.
- **Sidebar space.** The revamped sidebar is narrow; the card must fit without pushing the SSI link below the fold.

## Docs to update

- `docs/PLATFORM.md` §14 (App shell, Sidebar) — the trial card, the mobile pill, the shared `TrialMeter`.
- `docs/PLATFORM.md` §14 (Trial UI, Plan 2C) — the meter now renders in the shell as well as on the billing page.

## References

- Related: [[R02]], [[R04]], [[R07]].
- Prior art / plan: `docs/PLATFORM.md` §14 "Trial UI (Plan 2C)"; memory `ui-revamp-design` (sidebar shell).
- Principle sources: [@richardrx · 2026-03-26](https://x.com/richardrx/status/2037316988981174464), [@richardrx · 2026-05-12](https://x.com/richardrx/status/2054283657934758021), [@richardrx · 2026-04-29](https://x.com/richardrx/status/2049392897598849333).
