# LinkIntoTheSSI — Revenue-Centric Design Backlog

Generated **2026-09-05** from a Revenue-Centric Design (RCD) audit of the landing site, the app,
and the Convex backend, plus a correctness check of the 7-day card-required Stripe trial. The
audit used the 220-principle playbook distilled from [@richardrx](https://x.com/richardrx)
(skill `revenue-centric-design`). Each item below is a **self-contained doc** with verified
`file:line` evidence, the principle it applies, the mechanism it uses, and the concrete work.
Authoring format: [../_TEMPLATE.md](../_TEMPLATE.md) plus two extra sections: `## Principle` and `## Do / Don't` (rules
for the implementing agent, each naming its mechanism and source).

> **Repo rule (from `CLAUDE.md`): NEVER commit to git.** These docs are file changes only.
> Henriko makes all commits. When an item ships, update `docs/PLATFORM.md` in the **same change**.

## How these docs are meant to be used (spec-driven flow)

1. Pick an item. Read it, including its `## Do / Don't` section, and re-verify the evidence against the current code.
2. Run a brainstorming session on it (`superpowers:brainstorming`). The doc's **Risks / open questions** section lists
   the decisions the session has to close.
   Route each open question into one of the four bias families (too much information, not enough meaning, need to act
   fast, what to remember) and pick the lever from that family instead of from a list
   ([@richardrx · 2026-02-13](https://x.com/richardrx/status/2022298798194569685)).
3. Write the spec under `docs/superpowers/specs/` and the plan under `docs/superpowers/plans/`; carry the item's Do /
   Don't rules into the spec's constraints.
4. Implement, tick the acceptance criteria, update `docs/PLATFORM.md`, flip the status here.
5. Do **not** commit. Leave the changes for Henriko.

Standing decisions every item must respect (see the memory notes and `docs/PLATFORM.md` §1, §8):

- Card required, 7-day trial (14 days for a peer invited through [R19](R19-invite-a-peer.md), decided 2026-09-06),
  billing starts at 50 combined interactions or the trial's last day.
- Annual is the default interval, Growth is the recommended plan, the trial is the tier chosen on the landing.
- No fabricated proof on the landing. No claim that the app reads or shows the user's SSI. LinkedIn moved the SSI page
  behind Sales Navigator in late August 2026, so the link-out has been replaced by the in-app recap (R15); mention the
  SSI page only as a Sales Navigator note.
- The free-month campaign is a manual Stripe promotion-code campaign. Never auto-apply a coupon in code.
- Apify scraping is dev-only. Do not mention it in customer-facing or compliance copy.
- Do not re-add reciprocal-pod wording ("boost each other").
- The launch feed is never empty: three or four of Henriko's contacts load posts through the normal composer before
  sign-ups open (decided 2026-09-06). The R05 empty state and its checklist are a safety net, not a launch state. The
  invite stays a feature — [R19](R19-invite-a-peer.md) — never a line in the empty state.

## Rules for implementing agents (do / don't)

Every item carries its own `## Do / Don't` section, written for the agent that implements it. These rules apply to all
of them.

**Do**

- **Direct, never neutral.** Every screen has one dominant action; neutrality is omission
  ([@richardrx · 2026-05-05](https://x.com/richardrx/status/2051672248348479691), [@richardrx · 2026-01-22](https://x.com/richardrx/status/2014317885494059106)).
- **Value before the ask, proof before the doubt.** The user sees the result before the card, and the answer to a fear
  sits beside the button that raises it
  ([@richardrx · 2025-12-06](https://x.com/richardrx/status/1997351085426536459), [@richardrx · 2026-08-11](https://x.com/richardrx/status/2087142982705201423)).
- **Precise, traceable numbers or none.** Round nothing, link the source, date it
  ([@richardrx · 2026-02-18](https://x.com/richardrx/status/2024141244717281514)).
- **Upgrade at the limit, inline, framed as the loss at hand**
  ([@richardrx · 2026-04-21](https://x.com/richardrx/status/2046544442216054981)).
- **Retain with what the user accumulated.** Show the concrete loss in their own data and keep cancellation easy
  ([@richardrx · 2026-05-13](https://x.com/richardrx/status/2054562119962501186), [@richardrx · 2026-03-02](https://x.com/richardrx/status/2028471666297217460)).
- **Let defaults do the work**: annual, Growth, the plan chosen on the landing. Every default must be one you could
  defend to the user's face ([@richardrx · 2026-05-22](https://x.com/richardrx/status/2057872036718899256)).
- **Design every state**: empty, loading, error, one result, near the limit
  ([@richardrx · 2025-12-29](https://x.com/richardrx/status/2005682912419606553)).
- **Measure activation and time to value, never signups.** Each new moment gets a consent-gated PostHog event so the
  next audit reads data ([@richardrx · 2026-05-27](https://x.com/richardrx/status/2059616501544468624)).
- **Plain language, customer vocabulary, three locales in parity** (en, pt-BR, neutral es)
  ([@richardrx · 2026-04-08](https://x.com/richardrx/status/2041829519611371727)).
- **Test in the user's context**: mobile widths, pt and es string lengths, a slow connection
  ([@richardrx · 2026-07-14](https://x.com/richardrx/status/2077010741995917659)).
- **Triage the leak before choosing the lever.** Nobody enters: distribution, not design. Cancels in month one or two:
  onboarding or a landing promise
  ([R04](R04-value-before-the-card.md), [R14](R14-expectation-debt-ssi-timeline-vs-trial.md)). Trials that never
  convert: paywall timing or the value ladder
  ([R08](R08-upgrade-at-the-moment-of-the-limit.md), [R13](R13-pricing-decoy-and-monthly-visibility.md)). Visits without
  signups: ICP or the promise ([R11](R11-one-icp-for-the-landing.md)). Walk the journey and patch the leaks before any
  rebuild
  ([@richardrx · 2026-08-05](https://x.com/richardrx/status/2085056354360729949), [@richardrx · 2026-02-28](https://x.com/richardrx/status/2027721170569564521), [@richardrx · 2026-06-04](https://x.com/richardrx/status/2062621019978760424)).
- **Keep the member at the gate of every AI draft.** The draft is text the member reads, edits and pastes; the tap is
  the record. An automation is only as reliable as the reviewer kept outside it and the number that says whether it
  creates value ([@richardrx · 2026-06-19](https://x.com/richardrx/status/2067956930786587040)).
- **Treat page speed as a conversion test.** Largest Contentful Paint on the landing under 2.5 s on a mid-range phone,
  checked before and after every landing change; a 31% better LCP moved sales 8% in the source's A/B
  ([@richardrx · 2026-08-04](https://x.com/richardrx/status/2084589988843299217)).

**Don't**

- **No fabricated proof, counts, ratings, urgency or scarcity.** Only real, provable limits, shown in amber
  ([@richardrx · 2026-01-02](https://x.com/richardrx/status/2007100585464439150)).
- **No interrupting upsells.** No modals on load, no upgrade broadcasts, no toasts the next day
  ([@richardrx · 2026-05-05](https://x.com/richardrx/status/2051672248348479691)). One exception, decided 2026-09-07:
  an event notice about a limit that binds while the member is away ([R20](R20-email-at-the-post-interaction-cap.md)),
  once per event, the fact first, one plan sentence, one link.
- **No roach motel.** Cancel visible without scrolling, one interstitial at most, no shaming copy
  ([@richardrx · 2025-12-19](https://x.com/richardrx/status/2002003484791676948), [@richardrx · 2026-01-19](https://x.com/richardrx/status/2013339752934629537)).
- **No pre-ticked add-ons, no auto-applied coupons, no invented reference prices.** Frame the truth; never invent one
  ([@richardrx · 2026-01-06](https://x.com/richardrx/status/2008610564222672914)).
- **No colour A/B tests, no price A/B tests.** Five interviews beat an underpowered test
  ([@richardrx · 2026-06-01](https://x.com/richardrx/status/2061463480868229189)).
- **No claim that the app reads or shows the SSI.** Never "check your SSI" to free members; the recap
  ([R15](R15-interactions-recap-page.md)) is the proof.
- **No scope added to "strengthen" an item.** Each feature charges rent forever; the Swiss Knife Index only goes up
  ([@richardrx · 2026-05-26](https://x.com/richardrx/status/2059236567533650119)).
- **No new dependency for a dialog, a bar or a toast.** The shadcn Dialog and the existing toast cover it.
- **No signup count as traction, no session replay.** Read activation and return on the survival panel
  ([R18](R18-survival-panel.md)); replay stays off (`disable_session_recording: true`), so check the paper journey
  against five member interviews instead of recordings
  ([@richardrx · 2026-06-11](https://x.com/richardrx/status/2065082771987394651), [@richardrx · 2026-05-08](https://x.com/richardrx/status/2052711138572263474)).
- **No git commits.** Henriko commits (`CLAUDE.md`).

**Status:** TODO · IN PROGRESS · DONE · BLOCKED · REJECTED **Priority:** 🔴 P0 revenue leak / trust risk · 🟠 P1 high · 🟡
P2 medium · ⚪ P3 low **Tags:** ⚖️ needs a product or business decision from Henriko before engineering starts

## Trial correctness (from the 7-day card-required check)

The Stripe parameters are right: `trial_period_days: 7`, `payment_method_collection: 'always'`,
`trialEndsAt` mirrored from Stripe, and the 50-interaction early end fires once. These three items
close the gaps the check found.

| #   | Item                                                                                                              | Principle                                         | Priority | Effort | Status |
|-----|-------------------------------------------------------------------------------------------------------------------|---------------------------------------------------|----------|--------|--------|
| R01 | [Repeat-trial and duplicate-subscription guard](R01-repeat-trial-and-duplicate-subscription-guard.md)             | Trial with card, one trial per user               | 🔴 P0    | M      | DONE   |
| R02 | [Early-charge disclosure and pre-charge reminder](R02-early-charge-disclosure-and-reminder.md)                    | Promise sized to proof, expectation debt          | 🔴 P0    | M      | DONE   |
| R03 | [Honor the plan chosen on the landing, tier-aware trial copy](R03-honor-chosen-plan-and-tier-aware-trial-copy.md) | The default is the decision you made for the user | 🟠 P1    | S      | DONE   |

## Onboarding and trial (value first, ask later)

| #   | Item                                                                                                  | Principle                                                | Priority | Effort | Status |
|-----|-------------------------------------------------------------------------------------------------------|----------------------------------------------------------|----------|--------|--------|
| R04 | [Value before the card](R04-value-before-the-card.md)                                                 | Value first, ask later                                   | 🟠 P1    | M      | DONE   |
| R05 | [Never ship a blank feed](R05-never-ship-a-blank-feed.md)                                             | Never ship a blank dashboard, progress starts above zero | 🟡 P2    | S      | DONE   |
| R06 | [Trial progress where the work happens](R06-trial-progress-where-the-work-happens.md)                 | Active trial goal, Zeigarnik effect                      | 🟡 P2    | S      | DONE   |
| R07 | [Celebrate activation and reinforce the checkout](R07-celebrate-activation-and-reinforce-checkout.md) | Peak-end rule, choice-supportive bias                    | 🟡 P2    | S      | DONE   |

## Expansion and retention

| #   | Item                                                                                                   | Principle                                                                     | Priority | Effort | Status |
|-----|--------------------------------------------------------------------------------------------------------|-------------------------------------------------------------------------------|----------|--------|--------|
| R08 | [Upgrade at the moment of the limit](R08-upgrade-at-the-moment-of-the-limit.md)                        | Expansion is born of usage                                                    | 🟠 P1    | M      | DONE   |
| R20 | [Email the author when a post reaches its interaction cap](R20-email-at-the-post-interaction-cap.md)   | Expansion is born of usage (the limit that binds while the member is away)    | 🟠 P1    | M      | DONE   |
| R17 | [Buy a featured post ($5 add-on with a bigger interaction cap)](R17-buy-featured-posts.md)             | Expansion is born of usage (monetize the base)                                | 🟡 P2    | L      | DONE 2026-09-08 · Stripe rows 2026-09-10 |
| R09 | [Design the cancel flow](R09-design-the-cancel-flow.md)                                                | Retention is built, not requested                                             | 🟡 P2    | M      | DONE   |
| R15 | [Interactions recap page (the proof we can show)](R15-interactions-recap-page.md)                      | Your promise is the size of your proof, never ship a blank dashboard          | 🟠 P1    | L      | DONE   |
| R16 | [Interaction history page (your words, your posts)](R16-interaction-history-page.md)                   | Retention is built, not requested (the data vault)                            | 🟡 P2    | S      | DONE   |
| R21 | [Interacted posts leave the feed after 24 h, hide now](R21-feed-hygiene-24h-and-hide-now.md)           | A dashboard answers "what do I do now", the session that ends                 | 🟡 P2    | M      | DONE   |
| R19 | [Invite a peer from your industry (referral framed as a gift)](R19-invite-a-peer.md)                   | Gift to the friend, liquidity concentrates by niche, network effect by design | 🟡 P2    | M      | DONE   |
| R14 | [Expectation debt: the SSI timeline vs the 7-day trial](R14-expectation-debt-ssi-timeline-vs-trial.md) | Churn starts on the landing page                                              | 🟡 P2    | S      | DONE   |

## Landing and pricing

| #   | Item                                                                                            | Principle                                                      | Priority | Effort | Status                                          |
|-----|-------------------------------------------------------------------------------------------------|----------------------------------------------------------------|----------|--------|-------------------------------------------------|
| R10 | [⚖️ Verify or drop the landing SSI stats](R10-verify-or-drop-landing-ssi-stats.md)              | Your promise is the size of your proof, precise numbers        | 🟠 P1    | S      | DONE                                            |
| R11 | [⚖️ One ICP for the landing](R11-one-icp-for-the-landing.md)                                    | Who talks to everyone convinces no one                         | 🟠 P1    | M      | DONE                                            |
| R12 | [CTA microcopy and the fear beside the button](R12-cta-microcopy-and-fear-beside-the-button.md) | Specific CTAs, answer the fear two centimetres from the button | 🟡 P2    | S      | DONE                                            |
| R13 | [⚖️ Pricing decoy and monthly visibility](R13-pricing-decoy-and-monthly-visibility.md)          | Price is a filter, Good-Better-Best decoy                      | 🟡 P2    | M      | DONE 2026-09-08 · Stripe rows 2026-09-10 |

## Measurement (survival stage)

| #   | Item                                                                                          | Principle                                                             | Priority | Effort | Status |
|-----|-----------------------------------------------------------------------------------------------|-----------------------------------------------------------------------|----------|--------|--------|
| R18 | [Survival panel: activation, first value, return and trial conversion](R18-survival-panel.md) | Measure whether anyone reaches value at all, signups are not traction | 🟠 P1    | M      | DONE   |

## Suggested order and dependencies

1. **R01 → R02 → R03.** Close the trial gaps first. R01 gives trialing users a portal path that R09 reuses. R03 adds the
   `?plan=` deep-link that R04 and R08 reuse. R01, R02 and R03 done.
2. **R12** is a copy-only pass and can ship any time after R11 is decided. R12 done.
3. **R04 → R08 → R06 / R07 / R05.** The onboarding and expansion mechanics. R06 depends on the near-threshold state R02
   introduces. Done.
4. **R15** before **R10** and **R14**: both point at the recap as the proof. R15 also carries the 80% upgrade section,
   so it reuses the R08 component. **R16** right after R15 (it reuses the window toggle and the nav entry pattern). Then
   **R09**, the ⚖️ decision items **R10 / R11 / R13**, and **R14** (its email rides on the R02 notification path and the
   R15 query). Done
5. **R17** after **R08** and after the ⚖️ **R13** ladder decision: the add-on renders inside the R08 component, and its
   cap bonus changes the plan comparison (see the R17 risks). **R13 settled the ladder 2026-09-08 (Starter $10; fixed
   bonus +25/+50/+100) — R17 unblocked.**
6. **R18** first, or in parallel with anything: it reads existing tables only, and every acceptance line that says
   "measure" reads its numbers. Done 2026-09-07.
7. **R19** after **R01**, **R05** and **R15** (the 14-day gift is a branch in the R01 trial helper; the invite lives in
   the empty feed and the recap footer); it reuses the R03 OAuth-state carrier. Done 2026-09-07.
8. **R20** any time: it reuses the R08 ladder, the R03 deep link and the R02 mailer, all done, and reads the live
   `planLimits` table, so the ⚖️ R13 decision cannot stale it. Done 2026-09-07.
9. **R21** after **R05** (done), independent of **R16** (R16 is the reason R21 needs no unhide list). Ship the caught-up
   state in the same change as the 24-hour rule, never the rule alone. Done 2026-09-07.

## Principles already applied (do not undo)

- Card in the trial, trial end tied to value consumed (50 interactions), active trial goal (the X / 50 meter).
- Annual default, Growth recommended, plan and interval carried from the landing CTAs.
- Three plans plus an Enterprise anchor line, killer feature first on every plan card.
- No fabricated numbers, founder note. (The "SSI measured on LinkedIn itself" proof line is retired by R15 and R10:
  LinkedIn is closing the free SSI page.)
- "What you'll miss" loss framing on Starter during the trial, the gold-accented Billing nav while gated (the pulse was
  removed 2026-09-06: one attention point per screen), first-post prompt as declarative friction.

## References

- Skill: `C:\Users\henri\.claude\skills\revenue-centric-design\SKILL.md` and its `references/` folder (one file per
  topic, each principle links its source post).
- Engineering backlog: [../README.md](../README.md) (B-series items). B04 wired `trialEndsAt`; R01 and R02 build on it.
- Canonical docs: `docs/PLATFORM.md` §1 (tiers and trial model), §8 (billing), §9 (plan limits), §14 (app), §15
  (landing).

### How to work an item

1. Open the item's `.md`, re-verify the evidence against current code.
2. Brainstorm the open questions, write the spec and the plan, then implement.
3. Update `docs/PLATFORM.md` in the same change; flip **Status** here.
4. Do **not** commit. Leave the changes for Henriko.
