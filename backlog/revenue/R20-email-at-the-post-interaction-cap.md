# R20 — Email the author when a post reaches its interaction cap

> **Status:** DONE 2026-09-07 · **Priority:** P1 · **Effort:** M · **Category:** Expansion / Notifications / Backend
> **Depends on:** [[R08]] (done: the `nextTier` ladder, the `upgrade.*` copy, the `/billing?plan=&interval=` deep link) · [[R02]] (done: the Resend mailer, `getBillingContext`, `deliver`) · **Blocks:** —

## Principle

**Expansion is born of usage: upgrade at the moment of the limit, never by interruption.**
[[R08]] put that moment inline, in My Posts. The per-post interaction cap is the one limit that
binds while the member is *away*: other members' taps fill the post, and the author learns
nothing unless they happen to open My Posts later. The moment passes unseen. The timing and
context of the gate matter more than the gate itself
([@richardrx · 2026-04-21](https://x.com/richardrx/status/2046544442216054981)); relevance is the
fit between message and moment, and context is what separates content from spam
([@richardrx · 2025-11-14](https://x.com/richardrx/status/1989359534251360433)); tell the base
about the upgrade before they want to leave
([@richardrx · 2026-05-19](https://x.com/richardrx/status/2056715097796411514)).

The standing rule "no upgrade emails" ([README](README.md) Don't, [[R08]] step 8) bans the
**interruption**: the broadcast, the next-day nudge, the digest. This item is an **event notice**
about the member's own post, sent once, at the second the limit binds, on the only channel that
reaches them at that moment. The fact is the subject line; the upgrade is one sentence beside it
with one link, the same sentence [[R08]] already shows in My Posts. The README rule gains that
carve-out in this change.

## Summary

Henriko's note (2026-09-06): "Send an email to the user when he has reached his tier's
interaction limit, so he can upgrade to another better tier, make sure to account for contact if
he's on the better tier." Scope decided 2026-09-07:

- The limit is the **per-post interaction cap** (`interactionsPerPost`), the received-side limit
  the author cannot see happen. The weekly post cap and the featured cap bind on the author's own
  action and already have their inline sentence ([[R08]]).
- **Every tier** receives it. Starter and Growth link to the next tier's checkout; Pro gets the
  Enterprise contact line and the contact tier the custom-limit line, both `mailto:`, mirroring
  `UpgradeAtLimit`.
- **One link only.** The [[R17]] $5 add-on stays in-app; the email never mentions it.
- Once per post, in the member's language, transactional in tone: it must pass the
  `billingEmails.test.ts` banned-phrase guard unchanged.

## Evidence

- `convex/interactions.ts:138-157` and `convex/interactions.ts:194-213`: the only two production
  flip sites (`shouldFlipInteractionLimit` → `interactionLimitReached: true` + `computeFeedFields`,
  patched at `:156` and `:212`). Nothing is scheduled at either; the author is not told.
- `convex/interactions.ts:127` and `:178`: both increments return early when the post is already
  at cap, so the flip runs exactly once per post. The email inherits that once-only guarantee.
- `convex/interactions.ts:30` and `:42`: `bumpTrialInteraction` already schedules
  `internal.notifications.sendTrialNearEnd` and `internal.billingNode.endTrialEarly` from inside a
  mutation with `ctx.scheduler.runAfter(0, …)`; the same pattern carries the new notice.
- `convex/interactions.ts:50` `getPost` internalQuery: the post lookup the action reuses.
- `convex/jobs/syncPosts.ts:111`, `:187-190` and `convex/jobs/processQueue.ts:84-87`: the
  create-site checks compute `reached` at insert time (Apify, dev-only; queue promotion). No flip
  event there, out of scope.
- `docs/PLATFORM.md:1752-1757`: "This is a passive, in-page state only, deliberately no toast and
  no notice surfaced on the next feed visit." The only author-facing moment today is My Posts
  (`app/src/pages/MyPostsPage.tsx:293-302`: the `myPosts.interactionCapBadge` badge plus
  `<UpgradeAtLimit limit="interactionCap" />`).
- `convex/notifications.ts:37-42` `deliver(kind, to, m)`: sends through `lib/email.ts` and logs a
  `console.error` when the mailer is unconfigured. `:45-73` `sendTrialNearEnd` is the template:
  re-read `internal.billing.getBillingContext`, skip on status, resolve the locale with
  `resolveBillingLocale(c.language, c.primaryLocale)`, build, deliver. `:28-29` `billingUrl()` is
  `${APP_URL}/billing`.
- `convex/billing.ts:57-78` `getBillingContext` returns `email`, `language`, `primaryLocale`,
  `tier`, `subscriptionStatus`, `trialEndsAt` and the `subscriptions` rows (with `priceInterval`).
- `convex/lib/billingEmails.ts:20-29` `planName`, `:61-88` `trialNearEndEmail`: the builder shape
  (a per-locale `{ subject, lead, term, cancel }` record rendered to `{ subject, text, html }`).
  Emails keep their own copy; they cannot read the app's `upgrade.*` keys.
- `convex/lib/billingEmails.test.ts:81-116`: "billing emails stay transactional", every builder
  in every locale must avoid `upgrade now`, `hurry`, `last chance`, `don't miss`, `act now`,
  `aproveite`, `última chance`, `no te lo pierdas`. The new builder joins that list.
- `convex/lib/planLimits.ts:29-34` `DEFAULTS` (25 / 50 / 200 / 200), `:53-55` `nextTier`
  (starter → growth, growth → pro, pro and contact → `null`), `:65` `getPlanLimitsHelper` and
  `:146` the `getPlanLimits` internalQuery: the live cap, admin overrides included.
- `app/src/components/UpgradeAtLimit.tsx:57` `next = nextTier(tier)`; `:60-74` Pro renders
  `upgrade.proContact` and contact `upgrade.contactCustom`, both `mailto:SUPPORT_EMAIL`; `:79`
  `chargedInterval` from the subscription's `priceInterval`; `:110` the link
  `/billing?plan=${next}&interval=${chargedInterval}` with `captureEvent('upgrade_at_limit_clicked', …)`.
  The email mirrors exactly this ladder.
- `app/src/i18n/locales/en.json:368-376` `upgrade.interactionCap`: "This post left the feed after
  reaching its interaction cap. {{nextPlan}} raises that cap to {{next}}." The email's plan
  sentence says the same thing with the same numbers.
- `app/src/lib/support.ts:2` `SUPPORT_EMAIL = 'contact@linkintothessi.com'` is client-only; the
  backend has no copy of the address (grep `SUPPORT_EMAIL` in `convex/`: none).
- `convex/lib/access.ts:10-12` `canEngage`: trialing, active, canceled. The notice uses a stricter
  set (step 2).
- `convex/schema.ts:85` `users.email` is optional (OIDC claim); `docs/PLATFORM.md:2288-2295` §13B:
  billing notices are sent on the legal basis of performance of a contract, not consent, and their
  copy is unit-tested for the absence of promotional verbs.
- `docs/PLATFORM.md:1067-1116` §8 "Trial notifications", table at `:1078-1083`: event, channel,
  sender. The new row goes there.
- `app/src/App.tsx:98` `/my-posts`, `:122` `/billing`: the two links the email carries.
- `app/src/lib/observability/analytics.ts:51` `captureEvent` (consent-gated). Existing events:
  `card_gate_cta_clicked`, `card_gate_opened`, `checkout_success_viewed`, `upgrade_at_limit_clicked`.

## Root cause

[[R08]] designed every limit as an inline sentence, and the standing rule bans upgrade emails as
interruptions. Received interactions are the one cap that binds while the author is absent, so
"inline" has no surface: the moment is lost unless the author opens My Posts, and
`docs/PLATFORM.md:1752-1757` records that silence as deliberate. The upgrade moment with the
strongest context (their own post, stopped) is the one the product never shows.

## What we need to do

1. **One flip helper.** The blocks at `interactions.ts:138-157` and `:194-213` are the same lines
   twice. Extract `flipCapIfReached(ctx, post, likeCount, commentCount)` in `convex/interactions.ts`,
   called from both increments, and schedule the notice inside it:
   `await ctx.scheduler.runAfter(0, internal.notifications.sendPostCapReached, { postId, userId: post.authorId })`.
   The existing early return on `interactionLimitReached` keeps it to one email per post.
2. **Pure rules, tested.** `convex/lib/postCapNotice.ts`:
   `capNoticeMode(tier)` → `'checkout' | 'proContact' | 'contactCustom'` (a null `nextTier` means
   Pro gets `proContact` and contact gets `contactCustom`, the split at `UpgradeAtLimit.tsx:60-74`), and
   `shouldSendCapNotice({ subscriptionStatus, cancelAtPeriodEnd, email })` → trialing or active,
   not scheduled to cancel, email present.
3. **Builder.** `postCapReachedEmail(locale, a)` in `convex/lib/billingEmails.ts`, beside
   `trialNearEndEmail`, with
   `a = { excerpt, cap, planName, mode, nextPlanName?, nextCap?, targetUrl, myPostsUrl, supportEmail }`.
   Copy per locale (en, pt-BR, es), fact first:
   - Subject: `Your post reached {cap} interactions and left the feed`.
   - Lead: `Your post "{excerpt}" collected {cap} reactions and comments, the most a {planName} post
     can collect, so it left the feed.` (`excerpt` is the post's first line, the text My Posts shows.)
   - Plan sentence by mode. `checkout`: `On {nextPlanName}, each post keeps collecting up to
     {nextCap}.` followed by one link line using the same verb as `upgrade.cta`:
     `Upgrade to {nextPlanName}: {targetUrl}`. `proContact`: `Pro is the largest self-serve plan.
     For a larger cap, write to {supportEmail}.` `contactCustom`: `Your plan has a custom cap. Write
     to {supportEmail} to change it.` No checkout link in either mailto mode.
   - Closing: `See the post in My Posts: {myPostsUrl}`.
   - `supportEmail` is a constant in the builder module (`contact@linkintothessi.com`, the value of
     `app/src/lib/support.ts:2`); the backend has none today.
4. **Sender.** `sendPostCapReached = internalAction({ args: { postId, userId } })` in
   `convex/notifications.ts`, after `sendTrialNearEnd`: load the post with
   `internal.interactions.getPost`; exit if missing, soft-deleted, not by `userId`, or no longer
   `interactionLimitReached`; `c = getBillingContext(userId)`; exit unless `shouldSendCapNotice(c)`
   (pick the live subscription row the way `sendTrialNearEnd` does); `cap` and `nextCap` from
   `internal.lib.planLimits.getPlanLimits` for the member's tier and for `nextTier(tier)`;
   `interval` from that row's `priceInterval` (`month` → `monthly`, else `annual`);
   `targetUrl = ${APP_URL}/billing?plan=${next}&interval=${interval}&src=cap_email`;
   `myPostsUrl = ${APP_URL}/my-posts`; `deliver('post_cap_reached', c.email, …)`.
5. **Measure.** `app/src/pages/BillingPage.tsx`: when the URL carries `src=cap_email`, fire
   `captureEvent('cap_email_billing_opened', { plan })` once on mount (consent-gated by
   `captureEvent` itself), then let the existing `?plan=&interval=` handling land the member on the
   right card. Sends are visible in the Resend dashboard; no server-side counter.
6. **Rules.** The README "No interrupting upsells" Don't and the two [[R08]] "no upgrade email"
   lines carry the event-notice carve-out (done with this doc).
7. **Tests.** `billingEmails.test.ts`: the builder in three locales and three modes (numbers
   present, exactly one `http` link in checkout mode, none in the mailto modes) and its entry in
   the transactional loop at `:81`. `postCapNotice.test.ts`: mode per tier, skip per status.
   `interactions`: the extracted helper with a fake ctx (pattern `convex/feed.test.ts:27-37`),
   asserting `scheduler.runAfter` runs once on the flip and not on an already-capped post.
   `BillingPage.test.tsx`: the event fires with `src=cap_email` and not without.
8. **Docs.** See **Docs to update**.

## Do / Don't

For the implementing agent. Each line names the mechanism it relies on and links the source.

**Do**

- **Lead with the fact, in the subject.** It is a status notice about the member's own post; the plan sentence comes second. Context is what separates content from spam ([@richardrx · 2025-11-14](https://x.com/richardrx/status/1989359534251360433)).
- **Frame the sentence as the loss at hand, with the live numbers.** "Collected 25, the most a Starter post can collect, so it left the feed. On Growth it keeps collecting up to 50." Loss outconverts gain and precise numbers are believed ([@richardrx · 2026-04-21](https://x.com/richardrx/status/2046544442216054981), [@richardrx · 2026-03-02](https://x.com/richardrx/status/2028471666297217460), [@richardrx · 2026-02-18](https://x.com/richardrx/status/2024141244717281514)).
- **One link for the upgrade, one for the post, one attention point.** Stacked cues cancel each other ([@richardrx · 2026-01-06](https://x.com/richardrx/status/2008610564222672914)).
- **Send it once, at the flip, never later.** The base hears about the upgrade before it wants to leave, on the alarm, not on a calendar ([@richardrx · 2026-05-19](https://x.com/richardrx/status/2056715097796411514), [@richardrx · 2025-12-02](https://x.com/richardrx/status/1996002234392248720)).
- **Mirror the in-app ladder exactly** (decided 2026-09-07): Starter → Growth, Growth → Pro, Pro → the Enterprise contact line, contact → the custom-limit line. Land the checkout link on the right plan and interval ([[R03]], [[R08]]).
- **Read the live cap from `getPlanLimits`**, for the current tier and the next one; admins change the table.
- **Measure upgrade rate per moment.** Below 5% means the timing or the framing is wrong, not the price ([@richardrx · 2026-04-21](https://x.com/richardrx/status/2046544442216054981)). `cap_email_billing_opened` over sends is the number, and `plan_switch_opened { source: 'cap_email' }` over those opens is the click behind it (card holders never fire `checkout_started` — review fix, 2026-09-07).

**Don't**

- **Don't make it a digest, a reminder or a re-send.** One event, one email; the second email is the interruption the rule bans ([@richardrx · 2026-05-05](https://x.com/richardrx/status/2051672248348479691)).
- **Don't mention the [[R17]] add-on** (decided 2026-09-07). One link, the tier; the add-on is learned where it is used ([@richardrx · 2026-05-20](https://x.com/richardrx/status/2057162392048476345)).
- **Don't use urgency, discounts or the banned verbs.** The `billingEmails.test.ts` guard must pass without edits; invented pressure is the deceptive-design line ([@richardrx · 2026-01-02](https://x.com/richardrx/status/2007100585464439150)).
- **Don't email `none`, `past_due`, `canceled` or a member scheduled to cancel.** To a member who is leaving this is a win-back email, the generic intervention; the intervention has to be specific to the alarm ([@richardrx · 2025-12-02](https://x.com/richardrx/status/1996002234392248720)).
- **Don't send from the create sites.** `syncPosts` and `processQueue` insert posts already at cap without a flip; there is no event and no moment.
- **Don't hardcode 25 / 50 / 200** in copy or tests; the numbers are arguments.
- **Don't mention the SSI** (standing rule) and don't promise reach or a timeline from the next tier; the email states the cap and nothing LinkedIn-side.
- **Don't read `users.email` for anything else.** No new personal data, no new table.

## Acceptance criteria

- [x] On the in-app flip (either increment) the author receives exactly one email per post, in their locale, whose subject names the cap number. — shipped as: both increments route through one new `flipCapIfReached`, which patches `interactionLimitReached`, recomputes the feed fields and schedules `internal.notifications.sendPostCapReached`. The flip is an edge, so a post can only cross it once — no per-post "sent" flag was needed. The subject quotes the post's **own** total (`a.total`), not the plan's cap: a downgrade can leave the cap below the number the post actually reached.
- [x] Starter and Growth get the link `/billing?plan=<next>&interval=<charged>&src=cap_email`; Pro and contact get the mailto line and no checkout link. — shipped as: `capNoticeMode(tier, cap, nextCap)` is **one function** returning `upgrade` / `proContact` / `contactCustom`; the `upgrade` sentence is dropped whenever the next tier's cap is not actually higher (`nextCap <= cap` or undefined), so the email never sells a plan that would not help. The interval comes from `billingIntervalParam(priceInterval)` (`month` → `monthly`, anything else → `annual`, the billing page's own default — the fallback was inverted to monthly until 2026-09-07; `UpgradeAtLimit` now reuses the same function).
- [x] Nothing is sent for `none`, `past_due`, `canceled`, a scheduled cancel, a soft-deleted post, a missing email, or an unconfigured mailer (loud `console.error` through `deliver`). — shipped as: `shouldSendCapNotice({ email, subscriptionStatus, cancelAtPeriodEnd })` re-evaluated **at send time**, not at schedule time; the action re-reads the post, the billing context and the plan limits before building anything.
- [x] The builder is enumerated in the `billingEmails.test.ts` transactional guard and passes it in en, pt and es.
- [x] `cap_email_billing_opened` fires once on `/billing` when `src=cap_email` is present. — shipped as: a `useRef`-latched effect, the same StrictMode-safe pattern as `cancel_completed`; `src` is read and deliberately not stripped.
- [x] `pnpm verify` green (`vitest` for `convex` and `app`, `tsc`, `lint`, Prettier check). — exit 0 on 2026-09-07 (convex 456/456, app 370/370).
- [x] `docs/PLATFORM.md` updated in the same change (see below).

**Shipped as (whole-item notes).** **The landing's last step (decided 2026-09-07, after review):** a card holder's "Switch to <plan>" on that landing deep-links into Stripe's `subscription_update_confirm` for the plan **and interval** the link named (`billingNode.createPlanSwitchSession({ sessionToken, priceId })`, sharing one portal-session frame with the R09 flows) — one confirmation from the plan, no longer the portal home four clicks away. A refused deep link (price not yet allowed in the Portal Dashboard, the plan they already hold) falls back to the portal home, silently; the return leg `/billing?switched=<tier>` shows "Switching you to X…" until the webhook moves the tier, then "You're on X now." and fires `plan_switch_completed { plan }` once — the funnel's last step. **Exactly one link per email**, enforced by construction: the `upgrade` mode emits the checkout link and drops the My Posts line, and the other two modes emit the My Posts link and close with a **plain-text** support address (not a `mailto:`), so no mode ever offers two doors. `SUPPORT_EMAIL` moved to `convex/lib/support.ts` so the backend builder and the app share one constant — `app/src/lib/support.ts` is now a re-export. **No unit test for the action or for `flipCapIfReached`**: both are I/O wiring, and every decision they make lives in the pure modules (`lib/postCapNotice.ts`, `lib/billingEmails.ts`, `lib/planLimits.ts`), which are tested.

## Risks / edge cases / open questions

- **Transactional or marketing (legal check, not ⚖️).** §13B classifies billing notices as performance of a contract with no promotional verbs. An account-event email with one plan sentence sits at the edge of that classification. Keep the subject and lead factual and the plan sentence to one line with no adjectives, and hand the classification to the lawyer-review items (B-series, `../README.md`). If it is judged marketing, the fallback is to keep the event part and put the plan sentence behind a consent, not to drop the email.
- **Two emails within minutes** are possible during a trial: a received interaction that caps a post can also cross the 40-of-50 trial threshold (`bumpTrialInteraction`). Different facts, both true; order not guaranteed. Acceptable.
- **Volume** is bounded by the weekly post caps (1 / 2 / 5 per week): no digest needed.
- **Admin overrides.** The email states the cap that applied at the flip; a later change to the `planLimits` table makes an old email stale. Acceptable.
- **`APP_URL` unset** gives localhost links, the existing `billingUrl()` behaviour.
- **Excerpt privacy.** The excerpt is the author's own post text sent to the author; no third-party data.
- **`docs/PLATFORM.md:1752-1757`** currently says "deliberately no notice"; rewrite it, do not append to it.

## Docs to update

Updated 2026-09-07 to the sections actually touched:

- `docs/PLATFORM.md` §8 — a **new "Post-cap email (R20)" subsection** with its own flow chart, rather than a row in
  the "Trial notifications" table: this is not a trial notice and the table's three columns cannot carry the mode
  rules. The builder list in the same section went from four builders to **five**.
- §9 — a "Two doors, one checkout (R20)" paragraph: the email is the fifth moment on the same ladder.
- §11 — the "deliberately no notice" paragraph replaced by the flip → schedule → send flow and the once-per-post
  guarantee.
- §13B — the transactional notice, its legal basis, and **"New personal data: none"**.
- §14 BillingPage — the `cap_email_billing_opened` event (and `checkout_started` beside it).
- §17 — both events in the complete event list.
- §21 — a mapping row after all: `lib/postCapNotice.ts` and `interactions.flipCapIfReached` are new files/seams that
  the existing Billing row does not name.
- `backlog/revenue/README.md`: **Status** flipped to DONE.

## References

- Code: `convex/interactions.ts`, `convex/notifications.ts`, `convex/lib/billingEmails.ts`, `convex/lib/billingEmails.test.ts`, `convex/lib/planLimits.ts`, `convex/billing.ts`, `app/src/components/UpgradeAtLimit.tsx`, `app/src/pages/BillingPage.tsx`.
- Related items: [[R08]] (the ladder and the copy), [[R02]] (the mailer and the transactional guard), [[R03]] (the deep link), [[R17]] (stays in-app), [[R18]] (reads the event).
- Sources: [@richardrx · 2026-05-05](https://x.com/richardrx/status/2051672248348479691), [@richardrx · 2026-04-21](https://x.com/richardrx/status/2046544442216054981), [@richardrx · 2025-11-14](https://x.com/richardrx/status/1989359534251360433), [@richardrx · 2026-05-19](https://x.com/richardrx/status/2056715097796411514), [@richardrx · 2025-12-02](https://x.com/richardrx/status/1996002234392248720), [@richardrx · 2026-02-18](https://x.com/richardrx/status/2024141244717281514), [@richardrx · 2026-03-02](https://x.com/richardrx/status/2028471666297217460), [@richardrx · 2026-01-06](https://x.com/richardrx/status/2008610564222672914), [@richardrx · 2026-05-20](https://x.com/richardrx/status/2057162392048476345), [@richardrx · 2026-01-02](https://x.com/richardrx/status/2007100585464439150).
