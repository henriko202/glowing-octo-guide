# R04 — Value before the card

> **Status:** DONE · **Priority:** P1 · **Effort:** M (Option A is S) · **Category:** Onboarding / Frontend (Options B and C touch the backend)
> **Depends on:** [[R03]] (deep-link to the chosen plan) · **Blocks:** [[R07]] (the celebration needs an activation moment to celebrate)

## Principle

**Value first, ask later.** Proof must arrive before the user questions their choice. Richard's
onboarding sequence is quick win, then problem recognition, then a firm paywall: show value inside
30 seconds, start from the user's biggest pain, and present the price once they are hooked.
Keeping the card is right (it filters intent); the order is what is wrong.
Sources: [onboarding as a behavioral trigger](https://x.com/richardrx/status/1997351085426536459),
[card in the trial, optimize for the ICP](https://x.com/richardrx/status/2055247161349054950),
[calibrate the first step to the user's willingness](https://x.com/richardrx/status/2036461688505909250).

## Summary

A new user's path is: LinkedIn sign-in, consent screen, first-post screen, then straight to the
billing page. The feed is readable, but every action that demonstrates the product (react, comment,
open on LinkedIn, AI draft) is disabled until a card exists, and the user's own first post is
hidden. No micro-win happens before the ask. The landing promised "Start free with LinkedIn"; the
first screens after sign-in are two forms and a card wall.

## Evidence

- `app/src/App.tsx:53-63` — the gate chain: banned, deletion, policy version, consent prompt (`:59`), first-post prompt (`:63`), then the shell.
- `app/src/components/FirstPostPromptScreen.tsx:21-28` — after the first post, a gated user is sent to `/billing` (`:25`); everyone else reloads into the feed.
- `app/src/hooks/useCardGate.ts:12` — `gated` is true for `none` and `past_due`.
- `convex/lib/access.ts:10-19` — `assertCanEngage` blocks comment, react and AI drafting for `none`; `:28-31` `postCreatedHidden` hides the first post until a card exists.
- `convex/ai/comments.ts:25` — `generateComment` calls `assertCanEngage`, so even a preview of the AI draft is behind the card.
- `app/src/components/PostCard.tsx:60-62`, `:142-144`, `:151-155` — react, comment and "view on LinkedIn" are disabled with a tooltip when gated.
- `app/src/pages/FeedPage.tsx:181` and `app/src/i18n/locales/en.json:44` — the gate message: "Add a payment method on the Billing page to start engaging."
- `app/src/components/shell/Sidebar.tsx:56` — the Billing nav item takes a static gold accent while gated. It used to pulse; the pulse was removed 2026-09-06 (RCD review, Henriko's call): the gate binds at the tap (CardGateDialog) and in the feed banner, and a permanent pulse gave the most salience to administrative friction — see the Don't below.
- `landing/i18n/dictionaries/en.json:20-21` — the landing CTA reads "Start free with LinkedIn" with the card disclaimer beneath.

## Root cause

Plan 2B put the card gate on every engagement to stop free-riders from getting reach without
paying. That protection is right for posts and for sustained engagement, but it was applied to the
first thirty seconds as well, so the product never demonstrates its mechanism before asking.

## What we need to do

Option A is copy and routing only and keeps every backend gate unchanged. Options B and C change
what a `none` user may do and need the brainstorm's decision.

**Option A (recommended first step, S):**

1. **Land on the feed, not on billing.** In `FirstPostPromptScreen.tsx:24-28` reload into the feed for everyone; drop the `/billing` branch.
2. **Show the user what they own.** Above the composer in `FeedPage.tsx`, when `gated` and the user has a hidden own post, render a `CardGateBanner`: "Your first post is saved and hidden until you start your trial." with one CTA "Start 7-day trial" linking to `/billing?plan=<targetPlan>` ([[R03]]). Detect the hidden post with the query MyPostsPage already uses; add a lighter `posts.hasHiddenOwnPost` only if that one is too heavy for the feed.
3. **Let the gate bind on the tap.** Replace the disabled buttons in `PostCard.tsx:60-62`, `:142-144`, `:151-155` with enabled buttons that call `onGated()`. `onGated` opens a `CardGateDialog` (shadcn `Dialog`, the [[B18]] pattern) whose copy names the benefit at hand ("This reaction counts toward your SSI habit, and your post goes live") and offers "Start 7-day trial" plus "Not now". Keep the server-side `PAYMENT_REQUIRED` path (`FeedPage.tsx:181`) as the fallback.
4. **i18n.** New keys `feed.cardGateTitle`, `feed.cardGateBody`, `feed.cardGateCta`, `feed.cardGateLater`, `feed.hiddenPostBanner`, in en, pt and es.
5. **Tests.** `FirstPostPromptScreen.test.tsx` (routing), `PostCard.test.tsx` (gated click opens the dialog, no action fires), `FeedPage` banner rendering for a gated user.
6. **Measure.** Emit a consent-gated PostHog event when the dialog opens and when its CTA is clicked, so activation (card added within 24 h of sign-in) can be read later.

**Option B (pre-card allowance, M):** let a `none` user make a small number of real interactions
(for example 3 reactions or comments) before the gate binds. Server side: a counter on `users`
(for example `preCardEngagements`), a helper `assertCanEngageOrSample(user)` used by
`commentOnPost`, `reactToPost` and `generateComment`, and a bump inside those mutations. Client
side: "2 free interactions left" in the gate dialog. Received interactions still count for the
author. AI drafting stays excluded or gets a single free draft.

**Option C (preview lock, M):** `generateComment` for a `none` user returns the reaction and the
first sentence of the draft with `locked: true` (server-side truncation, rate-limited to a few per
day). The UI shows the rest blurred with "Unlock with your trial". The user sees the exact value
they are buying.

## Do / Don't

For the implementing agent. Each line names the mechanism it relies on and links the source.

**Do**

- **Let the gate bind at the tap, with the benefit named.** Busuu put the padlock on the next lesson with the trial offer on it and lifted conversion 83%; the user meets the boundary while motivation is live, never on a pricing page they have no reason to open ([@richardrx · 2026-08-31](https://x.com/richardrx/status/2094479242956283961)).
- **Show the user what they already own.** The hidden first post is theirs; people value what they helped build about three times more, so the banner names the post and the CTA makes it live ([@richardrx · 2026-01-30](https://x.com/richardrx/status/2017274698699067466)).
- **Keep the first ask small**: one tap, one dialog, one CTA. A first task that looks big paralyses; a step that looks small gets started ([@richardrx · 2026-03-24](https://x.com/richardrx/status/2036461688505909250)).
- **Lead the dialog with the result**, "Your post goes live and every reaction counts", before any mechanics of billing ([@richardrx · 2026-04-16](https://x.com/richardrx/status/2044785090832543998)).
- **Keep the card inside the trial.** The card filters intent (31.4% vs 8.9%); this item changes the order of the ask, never its existence ([@richardrx · 2026-05-15](https://x.com/richardrx/status/2055247161349054950), [@richardrx · 2026-05-21](https://x.com/richardrx/status/2057436163841941980)).
- **If Option B or C is chosen, size the sample for one instance of the job.** Free proves value once and leaves the paid plan as the only route to doing the job ([@richardrx · 2026-08-31](https://x.com/richardrx/status/2094479242956283961)).
- **Measure activation, not dialog opens**: card added within 24 hours, and time to the first live post ([@richardrx · 2026-05-27](https://x.com/richardrx/status/2059616501544468624)).
- **Keep declarative steps, cut administrative ones.** Industry and country shape the feed match (`convex/feed.ts:115-120`), so keep them and say why; a field the product never visibly uses is administrative friction and goes, and any qualification beyond that happens by behaviour inside the product ([@richardrx · 2026-05-07](https://x.com/richardrx/status/2052350703541039324), [@richardrx · 2026-04-10](https://x.com/richardrx/status/2042558822825239030), [@richardrx · 2025-12-23](https://x.com/richardrx/status/2003495704849760387)).
- **Map every step from the landing CTA to the first reaction on paper, then fix the steepest drop.** The leak is usually mid-journey, where effort is high and proof has not arrived, not at the top ([@richardrx · 2026-07-08](https://x.com/richardrx/status/2074814716824731651)).

**Don't**

- **Don't send a new user to `/billing` before they have seen the feed.** "Welcome, here is the price" is the day-one order that loses the trial ([@richardrx · 2026-06-18](https://x.com/richardrx/status/2067591574138052804)).
- **Don't grey out the buttons with a tooltip.** A disabled control is a dead click, and dead clicks stack into "nothing works here" ([@richardrx · 2026-07-22](https://x.com/richardrx/status/2079900733957136737)).
- **Don't give away AI drafts without a cap.** Each draft is a paid token call; for an AI product the free user was never free ([@richardrx · 2026-06-30](https://x.com/richardrx/status/2071962778072469560)).
- **Don't show the gate dialog on an empty feed.** There is nothing to bind to; pair with [[R05]].
- **Don't stack the banner, the dialog and the pulsing nav in one view.** One attention point per screen ([@richardrx · 2026-02-17](https://x.com/richardrx/status/2023777916673220817)).
- **Don't reveal hidden posts or drop the post gate.** Reach without a card is the free-rider case the gate exists for.
- **Don't label the CTA "Add a payment method".** The user buys the result; the button says "Start 7-day trial" and the line under it says what it costs ([@richardrx · 2026-05-25](https://x.com/richardrx/status/2058875777739866490)).

## Acceptance criteria

- [x] A new user reaches the feed after the first post (or after skipping it), not the billing page.
- [x] A gated user sees their hidden first post named in a banner with one CTA to the chosen plan.
- [x] The first tap on React, Comment or View on LinkedIn opens the gate dialog; no server call fails.
- [x] Backend gates in `convex/lib/access.ts` are unchanged unless Option B or C is chosen and specified. (Option A shipped; `access.ts` untouched.)
- [x] `pnpm verify` is green (typecheck + lint + tests).
- [x] `docs/PLATFORM.md` updated (see **Docs to update**).

## Risks / edge cases / open questions

- **Does an allowance weaken the intent filter?** Option A does not touch the filter. Options B and C give away a small, capped amount of value. Decide the cap and whether AI drafts (paid DeepInfra calls) are included.
- **Free-rider protection stays.** Posts by `none` users stay hidden in every option, so nobody gets reach without a card.
- **Empty feed.** A gate dialog on an empty feed has nothing to bind to; pair with [[R05]].
- **Rate limits** for `none` users under Option B or C: reuse `@convex-dev/rate-limiter` with a tighter bucket.
- **Security posture doc** (§17) lists the card gate as a control; Options B and C must update it.

## Docs to update

- `docs/PLATFORM.md` §14 (onboarding chain, card-gate UX) — feed-first routing, banner, dialog.
- `docs/PLATFORM.md` §11 (Feed & Engagement) — the client-side gate behaviour.
- `docs/PLATFORM.md` §8, §11A, §17 — only if Option B or C changes `canEngage` or `generateComment`.

## References

- Related: [[R03]], [[R05]], [[R06]], [[R07]], [[B18]].
- Prior art / plan: memory `landing-conversion-redesign` (Plan 2B soft card gate decision); `docs/PLATFORM.md` §14 "Trial UI (Plan 2C)".
- Principle sources: [@richardrx · 2025-12-06](https://x.com/richardrx/status/1997351085426536459), [@richardrx · 2026-05-15](https://x.com/richardrx/status/2055247161349054950), [@richardrx · 2026-03-24](https://x.com/richardrx/status/2036461688505909250).
