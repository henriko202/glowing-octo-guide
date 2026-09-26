# R14 — Expectation debt: the SSI timeline vs the 7-day trial

> **Status:** DONE 2026-09-07 · **Priority:** P2 · **Effort:** S · **Category:** Landing copy / Product / Notifications
> **Depends on:** [[R02]] (the mailer for the day-7 recap), [[R15]] (the recap numbers) · **Blocks:** none

## Principle

**Churn starts on the landing page: every claim the product cannot show inside the trial becomes
expectation debt, and the user collects it at the first charge.** The FAQ says most members see
their SSI move within one to two weeks. The trial lasts seven days or fifty interactions, the
app cannot read the SSI, and since late August 2026 most members cannot read it either: LinkedIn
is moving the SSI page behind Sales Navigator. A user who converts on day 7 without seeing the
promised movement carries that debt into the first paid month and cancels at day 30.
Sources: [churn starts on the landing page](https://x.com/richardrx/status/2049568514311172355),
[expectation debt](https://x.com/richardrx/status/2064685590902141246).

## Summary

The landing promises a measured outcome ("most members see it move within 1–2 weeks") that
nobody has measured (there are no members yet), on a timeline longer than the trial, for a metric
the app cannot observe and the member soon cannot check for free. The honest path is to promise
the mechanism, show the member the interactions the app can count ([[R15]]), and close the loop
at the end of the trial with those numbers.

## Evidence

- `landing/i18n/dictionaries/en.json:213-214` — "Most members see it move within 1–2 weeks of consistent engagement." and
  "You can check your real score on LinkedIn anytime." (pt and es carry the same claims).
- LinkedIn's SSI page shows free members a discontinuation banner since 2026-08-27: "Your access to the Social Selling
  Index (SSI) page will be discontinued soon. SSI is a Sales Navigator feature." Sources in [[R15]].
- `landing/i18n/dictionaries/en.json:18` — hero: "Show up where it matters, and your SSI climbs."
- `convex/billingNode.ts:18` — `TRIAL_PERIOD_DAYS = 7`; `convex/lib/trialMilestone.ts:3` — or 50 interactions. The trial
  ends before the FAQ's timeline in most cases.
- `app/src/components/shell/Sidebar.tsx:63` — the app links out to `linkedin.com/sales/ssi`; the SSI is not readable
  through LinkedIn's API (memory `linkedin-api-access-constraints`), so nothing in-app can show movement. [[R15]] retires
  the link.
- `convex/schema.ts` — `users` has no SSI field (grep `ssi`, 2026-09-05).
- Pre-launch: no production users exist (memory `prelaunch-no-prod-data`), so "most members" is not a measured claim.

## Root cause

The FAQ answer was written to reassure a visitor who asks "how fast". Nobody reconciled the
timeline with the trial length, with the fact that the app cannot observe the metric it sells, or
with LinkedIn closing the page where the member could check it.

## What we need to do

1. **⚖️ Rewrite the FAQ answer** in en, pt and es to a claim we can keep: what the SSI measures (LinkedIn's four
   pillars: establish your brand, find the right people, engage with insights, build relationships), that LinkedIn
   recalculates it daily, that consistent engagement inside your industry is what moves the "engage" and "relationships"
   pillars, and that the app shows the member every interaction made and received ([[R15]]). Say plainly that the SSI
   page itself is a Sales Navigator feature. Drop "You can check your real score on LinkedIn anytime." No timeline until
   one is measured. Henriko approves the wording; [[R10]] and [[R11]] set the surrounding proof and audience.
2. **No self-reported SSI baseline.** The first draft of this item proposed `ssiBaseline` on `users` and a Settings
   field. Only Sales Navigator subscribers can still read the number, so the field would serve a minority and invite
   typos. Do not build it. The recap ([[R15]]) is the in-app number.
3. **Close the loop at day 7.** Through the [[R02]] mailer, at trial conversion send the 7-day recap from the [[R15]]
   query: "Your trial converted today. In 7 days you made {{made}} interactions and your posts received {{received}}."
   with a link to `/recap`. The user sees the value at the moment of billing instead of wondering later.
4. **Privacy.** The email carries the member's own counts only, no other member's name or post, and adds no
   personal-data field. It is a trial-status notice, so no marketing consent is needed; keep it that way.
5. **Measure before promising.** A timeline goes back into the FAQ only when measured: from the recap distribution across
   members, or from members who volunteer their SSI (Sales Navigator subscribers). Until then, no number.
6. **Tests.** The day-7 email renders both counts and the recap link (alongside the [[R02]] mailer tests); locale parity
   for the FAQ keys.
7. **Docs.** See **Docs to update**.

## Do / Don't

For the implementing agent. Each line names the mechanism it relies on and links the source.

**Do**

- **Promise the mechanism, never the timeline.** Which pillars move with engagement and how the app shows the member every
  interaction; a mechanism the reader understands makes the alternative unacceptable
  ([@richardrx · 2026-02-19](https://x.com/richardrx/status/2024479659883204633)).
- **Close the loop at conversion with the member's own numbers.** "You made 32, your posts received 9" beats "your
  trial ended" ([@richardrx · 2026-05-06](https://x.com/richardrx/status/2052096365128273956)).
- **Keep the email a trial-status notice**: their data, one link, their language. Relevance is fit to the moment
  ([@richardrx · 2025-11-14](https://x.com/richardrx/status/1989359534251360433)).
- **Say plainly that the SSI page is a Sales Navigator feature.** A stated limit beside the promise is a certainty
  signal ([@richardrx · 2026-08-11](https://x.com/richardrx/status/2087142982705201423)).
- **Measure before promising.** A timeline returns only when the recap distribution across members shows it
  ([@richardrx · 2026-05-27](https://x.com/richardrx/status/2059616501544468624)).
- **Gloss "pillars" in one line.** The curse of knowledge is why the FAQ needs the plain version
  ([@richardrx · 2026-04-08](https://x.com/richardrx/status/2041829519611371727),
  [@richardrx · 2026-06-04](https://x.com/richardrx/status/2062509937037590997)).

**Don't**

- **Don't write "most members see it move within 1–2 weeks"** or any timeline the trial cannot show; the user collects
  the debt at the first charge ([@richardrx · 2026-04-29](https://x.com/richardrx/status/2049568514311172355),
  [@richardrx · 2026-06-10](https://x.com/richardrx/status/2064685590902141246)).
- **Don't add an SSI field, a self-reported baseline or an "SSI estimate".** The app never claims to read or show the
  SSI (standing decision).
- **Don't tell free members to "check your SSI".** Mention the page only as a Sales Navigator note (standing decision).
- **Don't put promotional copy in the day-7 email.** It becomes marketing and needs consent.
- **Don't invent pillar weights or a formula.** Quote LinkedIn's pillar names as they stand at implementation time.
- **Don't send the email before the [[R15]] query exists.** A recap with zeros is a blank dashboard by mail
  ([@richardrx · 2026-05-12](https://x.com/richardrx/status/2054283657934758021)).

## Acceptance criteria

- [x] The FAQ in en, pt and es carries no unmeasured timeline and no "check your score on LinkedIn" line.
- [x] A converting user receives the day-7 recap with their made and received counts and a link to `/recap`.
- [x] No SSI field exists on `users`.
- [x] `pnpm verify` is green (typecheck + lint + tests).
- [x] `docs/PLATFORM.md` updated (see **Docs to update**).

## Risks / edge cases / open questions

- **Never claim to show the SSI in-app** (locked decision). The recap shows interactions counted in the app, never an SSI
  number; the only SSI mention left in the app is the Sales Navigator note on the recap page ([[R15]] step 9).
- **Order.** The FAQ rewrite can ship alone; the email waits for the [[R15]] query.
- **Transactional vs marketing.** The recap email must stay a trial-status notice with the user's own data; no promotional
  copy, or it needs consent.
- **Pillar names change.** Quote LinkedIn's pillar names as they appear on its SSI page at implementation time; that page
  may move again.

## Docs to update

- `docs/PLATFORM.md` §15 (Landing FAQ) — the new answer.
- `docs/PLATFORM.md` §8 (Notifications) — the day-7 recap email.

## References

- Related: [[R02]], [[R10]], [[R11]], [[R15]].
- Prior art / plan: memory `linkedin-api-access-constraints` (SSI not readable via API; the SSI page is a Sales Navigator
  feature since late August 2026); `docs/PLATFORM.md` §8.

## Decisions (2026-09-07)

- FAQ SSI answer: no timeline, no "check your score"; cancel answer drops the click count. Conversion email sent once
  from `syncUserSubscription` on trialing → active, skipped at 0 recorded interactions (Henriko 2026-09-06).
- **The trigger is the webhook handler, not a cron.** `isTrialConversion(existing?.status, args.status)` is evaluated
  **before** the subscription row is patched (the old status is still readable) and the send is scheduled **after** the
  user doc is patched, so the mailer re-reads a settled member rather than racing the write it was triggered by.
- **Four skip conditions, all re-read at send time** (`notifications.sendTrialConverted`): no email on the member,
  `subscriptionStatus` no longer `active`, no live subscription row, or `made + received === 0`. The last one is the
  R15 "never mail a blank dashboard" rule — a zero-activity member gets silence, not an empty summary.
- **The email links to `/recap`, never to an upsell**, and carries only the member's own two counts, so it stays a
  trial-status notice and needs no marketing consent (item 4 above holds).
- **Webhook ordering — fixed 2026-09-07 (PLATFORM §8):** Stripe does not guarantee webhook ordering, so
  `syncUserSubscription` now stamps each applied event's `created` on the row (`subscriptions.lastEventAt`) and skips an
  older one; a late `customer.subscription.updated` can no longer regress the status and — through
  `isTrialConversion` — re-send this email. Same-event replays were already safe.
- **Trigger timing — decided 2026-09-07, keep for launch:** the email keys on `trialing → active` only. Stripe marks
  the subscription `active` about an hour before it attempts the trial-end charge, so a failed first card is not known
  at send time, and a trial that converts via `past_due → active` gets no email. Accepted pre-launch; revisit after
  launch (first-paid-invoice trigger via `invoice.paid`, or a row flag for the first `active` after a `trialing`).
- **No box is left open by a spec §10 deferral for this item.** The self-reported SSI baseline was dropped by design
  (item 2), not deferred, and a timeline returns only when measured (item 5).
- Principle
  sources: [@richardrx · 2026-04-29](https://x.com/richardrx/status/2049568514311172355), [@richardrx · 2026-06-10](https://x.com/richardrx/status/2064685590902141246).
