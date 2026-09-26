# R19 — Invite a peer from your industry (referral framed as a gift)

> **Status:** DONE 2026-09-07 · **Priority:** P2 · **Effort:** M · **Category:** Growth / Backend / Frontend / Landing
> **Depends on:** [[R03]] (the OAuth-state carrier the invite code rides on) · [[R01]] (the trial helper the gift adds a branch to) · [[R05]] and [[R15]] (the two surfaces that ask) · **Blocks:** —

## Principle

**A referral wins on framing and timing: the prize sits on the friend's side, and the ask comes at the peak of value.**
Cash makes the exchange transactional; an in-product gift reads as a gift. This product's supply is
posts from the member's own industry and country, and the feed never shows the member's own posts, so
each feed is only as full as its niche. Liquidity concentrates where supply and demand meet, and the
cheapest supply is the peer the member already knows. Every invitation is distribution the product did
not pay for, the way each Calendly invite is.
Sources: [gift to the friend, ask at the peak](https://x.com/richardrx/status/2061766945582559509),
[liquidity concentrates by niche](https://x.com/richardrx/status/2094404750229836066),
[network effect by design](https://x.com/richardrx/status/2069018184942784582).

## Summary

Give every member a short invite link. The landing accepts `?ref=` the way it accepts `?plan=`, the
OAuth state carries it, and a new member is attributed to the inviter at insert only. The ask appears
in two places the member already reaches at a good moment: the recap footer when their posts received
something ([[R15]]) and the empty feed ([[R05]]), plus a plain section in Settings. The gift is a 14-day
calendar trial for the invited peer (decided 2026-09-06): a second value for the trial parameter the
checkout call already sets, with the 50-interaction early end untouched. The referrer gets no cash and
no credit; their return is a fuller feed.

## Evidence

- `convex/feed.ts:108-122` — `isPostVisibleToViewer`: own posts are excluded (`:114`) and the industry and country allowlists filter the rest (`:115-120`); `convex/schema.ts:12-13` — `users.industry` and `users.country`.
- `backlog/revenue/R05-never-ship-a-blank-feed.md:18-19` — the current empty state says "Invite colleagues to join" while no invite feature exists.
- `convex/http.ts:21-32` — `/auth/linkedin` validates `plan` and `interval` against allowlists and stores them on the OAuth state; `:72` consumes the state on callback; `:107-110` append them to the success redirect.
- `convex/sessions.ts:109-120`, `:126-139` — `createOAuthState` and `validateAndConsumeOAuthState` carry `plan` and `interval`; `convex/schema.ts:221-229` — the `oauthStates` row.
- `convex/linkedin/auth.ts:31-54` — `upsertUserHandler` patches an existing member; `:56-71` inserts a new one. Attribution belongs in the insert branch only.
- `landing/lib/links.ts:10-13` — `SIGN_IN_URL` sends every CTA straight into OAuth; `landing/components/Hero.tsx:52`, `Nav.tsx:77`, `FinalCTA.tsx:31`, `Pricing.tsx:96` — the CTAs are static anchors built at build time.
- `landing/app/[lang]/layout.tsx` — the shared layout; `landing/components/CookieNotice.tsx:1` shows the `'use client'` pattern a small carrier component follows.
- `convex/billingNode.ts:18`, `:28`, `:43-48` — `TRIAL_PERIOD_DAYS = 7`; `requireAuthAction` returns the member row, so `referredByCode` is already in hand; `trial_period_days: TRIAL_PERIOD_DAYS` sits beside `payment_method_collection: 'always'` and `allow_promotion_codes: true`. The gift is a second value for that one parameter.
- `app/src/i18n/locales/en.json:170`, `:175` — `billing.trialBanner` and `billing.newUserTrialNote` hardcode "7 days"; `app/src/pages/BillingPage.tsx:156-159` renders the banner while trialing; `convex/users.ts:183-201` — `getTrialProgress`, the query the banner already reads, is where a `trialDays` field belongs.
- `app/src/pages/SettingsPage.tsx:300`, `:384`, `:408`, `:448` — the four Settings sections (profile, AI comments, visibility, feed filter).
- `convex/privacy/export.ts:59-67`, `convex/privacy/deletion.ts:34-46` — the `users` row is exported and erased as a whole; a code on it rides along.
- `docs/PLATFORM.md:757`, `:784` — §7 documents the OAuth state and the plan carry; `:2295` the `AuthSuccessPage` route.

## Root cause

The product has one entrance, the landing CTA, and no loop from a member who found value to the peer
who would fill their feed.

## What we need to do

1. **Schema (widen, no backfill).** `users.inviteCode: v.optional(v.string())` with index `by_invite_code` on `['inviteCode']`; `users.referredByCode: v.optional(v.string())` with index `by_referred_by_code` on `['referredByCode']`; `oauthStates.ref: v.optional(v.string())`. Codes are minted lazily, so no existing row changes.
2. **`users.getOrCreateInviteCode({ sessionToken })`** mutation: return the stored code, else mint eight lowercase characters from `crypto.randomUUID()` without dashes, check `by_invite_code`, retry once on collision, patch and return. Any signed-in member may invite.
3. **Landing carrier.** `?ref=` on any landing URL: a client component `RefCarrier` mounted in `landing/app/[lang]/layout.tsx` reads `window.location.search`, validates `^[a-z0-9]{8}$`, and appends `&ref=` to every anchor whose `href` contains `/auth/linkedin`. `ponytail:` a DOM rewrite in one place instead of threading a prop through four static CTAs; move to a prop when a fifth CTA appears.
4. **OAuth carry.** `http.ts` validates `ref` with the same regex and stores it on the state; the callback passes `ref` to `upsertUser`; `upsertUserHandler` sets `referredByCode` in the insert branch only, and only when `by_invite_code` finds a member with that code. An existing member is never re-attributed.
5. **Surfaces.** Settings gains an "Invite a peer" section after the profile block: the link, one Copy button (the existing toast), and "N peers joined with your link" from `by_referred_by_code` with `.take(101)`, shown as "100+" past the cap. The recap footer ([[R15]]) adds one line when received > 0 in the window: "A peer from your industry would see this too." with the same Copy action. The empty feed ([[R05]]) makes the invite its second action, after the composer. (Note 2026-09-06: the launch feed is pre-seeded by three or four of Henriko's contacts through the normal composer, so the empty feed will rarely render — treat it as a fallback surface and put the weight on Settings and the recap footer. The invite feature itself stays: Henriko confirmed it the same day.)
6. **The gift: a 14-day calendar trial for the invited peer (decided 2026-09-06).** One pure helper `trialDaysFor({ referredByCode })` in `convex/lib/trialMilestone.ts` returns 14 when the code is set and `TRIAL_PERIOD_DAYS` otherwise; `createCheckoutSession` passes its result as `trial_period_days`, and when the [[R01]] eligibility helper says no trial, no trial wins. The 50-interaction early end still applies. `getTrialProgress` returns `trialDays` from the same helper, `billing.trialBanner` interpolates `{{days}}` in place of the literal "7 days", and the invited peer's billing page shows `billing.giftFrom` ("Ana gave you 14 days of trial") above the banner, the name resolved from `by_invite_code`. The landing keeps "7-day" and `billing.newUserTrialNote` stays: 7 is the rule, 14 is the gift. Rejected: (a) nothing beyond the invite leaves no prize on the friend's side; (c) a promotion code has the friend type a code at checkout and reads as a discount.
7. **Copy and i18n.** `settings.invite*`, `recap.invite*`, `feed.inviteAction`, `billing.giftFrom` and the `{{days}}` interpolation in `billing.trialBanner`, in en, pt and es. The inviter's first name comes from a `by_invite_code` lookup at render time, never from the URL.
8. **Privacy.** Both codes live on the `users` row, so the export and the erasure cover them; an erased inviter leaves other members' `referredByCode` pointing at nothing, which is harmless. The product sends no email; the member shares the link themselves. One consent-gated `invite_copied` event through the [[R18]] `track()` helper.
9. **Tests.** A pure `parseRef` for the regex; `upsertUserHandler` attributes on insert and never on patch; `getOrCreateInviteCode` retries once on collision; `app/src/pages/SettingsPage.test.tsx` renders the section; a landing `RefCarrier` test rewrites hrefs and ignores an invalid ref.
10. **Docs.** See **Docs to update**.

## Do / Don't

For the implementing agent. Each line names the mechanism it relies on and links the source.

**Do**

- **Put the prize on the friend's side and say who gave it.** "Ana gave you 14 days" is a gift; "earn a month for each friend" is a commission ([@richardrx · 2026-06-02](https://x.com/richardrx/status/2061766945582559509)).
- **Ask at the peak of value.** The recap with received interactions and the moment a limit is reached are the two peaks the product can observe; the empty feed is the moment the member feels the thin niche ([@richardrx · 2026-06-02](https://x.com/richardrx/status/2061766945582559509)).
- **Invite by niche, not in general.** The copy says "a peer from your industry"; liquidity that spreads across every industry concentrates nowhere ([@richardrx · 2026-08-31](https://x.com/richardrx/status/2094404750229836066)).
- **Treat each invitation as distribution.** The link carries the landing, the plan default and the gift; nothing else needs to travel ([@richardrx · 2026-06-22](https://x.com/richardrx/status/2069018184942784582)).
- **Show the exact number of peers who joined**, or nothing. A precise count reads as a record ([@richardrx · 2026-02-18](https://x.com/richardrx/status/2024141244717281514)).
- **Design the states**: no code yet, copied, nobody joined, 100+ joined ([@richardrx · 2025-12-29](https://x.com/richardrx/status/2005682912419606553)).

**Don't**

- **Don't pay the referrer** in cash, credit or featured posts. Money makes it a transaction, and a reward on the referrer's side invites self-referral games ([@richardrx · 2026-06-02](https://x.com/richardrx/status/2061766945582559509)).
- **Don't use "boost each other" or any reciprocal-pod wording** (standing decision). The invite is about the friend's feed and the member's niche, never about trading engagement.
- **Don't turn the gift into a coupon.** The gift is trial length through `trial_period_days`; no Stripe coupon or promotion code is applied in code (standing decision; [@richardrx · 2026-01-06](https://x.com/richardrx/status/2008610564222672914)).
- **Don't add a leaderboard of inviters or a streak.** The slot-machine playbook is not this product's ([@richardrx · 2025-12-22](https://x.com/richardrx/status/2003106841199276221)).
- **Don't ask before the first value.** No invite prompt in onboarding or on a first feed visit with posts in it; the ask follows a result ([@richardrx · 2026-06-02](https://x.com/richardrx/status/2061766945582559509), [@richardrx · 2026-05-05](https://x.com/richardrx/status/2051672248348479691)).
- **Don't send invitation emails on the member's behalf.** Sending is marketing and needs the recipient's consent; the member shares the link.
- **Don't expose a user id in the link.** The code is opaque and the inviter's name is resolved server-side at render time.

## Acceptance criteria

- [x] Settings shows the member's invite link, a Copy button and the count of peers who joined through it. — shipped as: an **Invite a peer** section at the stable anchor `id="invite"` (both other surfaces deep-link to `/settings#invite`), the code minted lazily on first visit by `users.getOrCreateInviteCode` behind a `useRef` guard, the link rendered read-only as `${LANDING_URL}/${lang}?ref=<code>`, and a joined count that **caps at "100+"** (`settings.inviteJoinedMany`) because `getInviteSummary` is bounded at `.take(101)`. Copy fires `invite_copied`; the clipboard-less fallback selects the text and fires **no** event.
- [x] A landing visit with a valid `?ref=` carries the code into OAuth; a new member gets `referredByCode`; an existing member logging in with a `ref` is unchanged. — shipped as: `landing/components/RefCarrier.tsx` stamps the code onto the sign-in CTAs, `http.ts` puts it on the OAuth state, `upsertUserHandler` writes `referredByCode` **on insert only** — and only when the inviter exists **and is not banned**.
- [x] An invalid `ref` is ignored end to end (landing, OAuth start, callback). — shipped as: `INVITE_CODE_RE = /^[a-z0-9]{8}$/` checked in `RefCarrier` (a **duplicated** copy — the landing bundle must not import from `convex/`; a comment in each file says keep them in sync) and again in `http.ts` via `isInviteCode`, which coerces anything else to `undefined`.
- [x] The recap footer and the empty feed show the invite at the moments defined above and nowhere else. — shipped as: the recap footer line only when `received.current.total > 0`, and the feed's **caught-up** state only (`caughtUp && !gated`). The **R05 empty state deliberately gets no invite link**: it keeps its single composer action.
- [x] An invited peer's checkout uses a 14-day trial, and their billing page names the inviter and says 14 days; a member without `referredByCode` still gets 7, and a repeat ([[R01]]) gets none. — shipped as: `trialDaysFor(user)` feeding Stripe's `trial_period_days` and the checkout `custom_text`; `getMe` exposes `trialDays` (via `toSafeMe`, **not** `getTrialProgress` as this doc first assumed) and `inviterName` (first name only, one indexed read). **Six existing strings gained a `{{days}}` placeholder** rather than a second copy variant, with `TRIAL_PERIOD_DAYS` as the fallback while `me` loads; `billing.giftFrom` renders only pre-card.
- [x] Export and erasure cover both codes without new code paths (existing privacy tests green). — shipped as: both fields live on the `users` row, so the existing whole-row export and erasure cover them unchanged.
- [x] `pnpm verify` is green (typecheck + lint + tests). — exit 0 on 2026-09-07 (convex 456/456, app 370/370).
- [x] `docs/PLATFORM.md` updated (see **Docs to update**).

## Risks / edge cases / open questions

- **Two trial lengths.** Stripe's checkout page prints the real trial length by itself and the banner reads `trialDays` from the query, so no surface hardcodes 7 once step 6 ships. The [[R02]] Terms clause states the 7-day rule for everyone; add "up to 14 days for invited members" when both ship. The [[R02]] reminder keys off `trialEndsAt`, which Stripe mirrors, so it needs no change. The landing still says "7-day" to an invited visitor; the surprise lands in the friend's favour, and a `RefCarrier` line is the upgrade if interviews ask for it.
- **Self-referral.** Attribution happens at insert only and a member cannot be new twice; a second LinkedIn account is a new person to the system and gets the gift, the same exposure the plain trial has ([[R01]] guards repeats by subscription, not by invite).
- **Different industries.** A friend outside the inviter's industry fills nobody's feed; the copy names the industry, and the count still climbs. Acceptable.
- **Code guessing.** 36^8 codes, and a valid code only attributes; there is nothing to gain by guessing.
- **Landing SSG.** The carrier runs after hydration; a visitor who clicks the CTA before hydration loses the ref. Acceptable at launch; the ponytail note names the prop-threading upgrade.
- **Erased inviter.** The friend's billing page loses the inviter's name and shows the gift without it.

## Docs to update

Updated 2026-09-07 to the sections actually touched:

- `docs/PLATFORM.md` §5 (Data Model) — `users.inviteCode`, `users.referredByCode`, `oauthStates.ref`, the two indexes,
  and a note on the ER diagram that the self-reference is a **string-code** lookup, not a `v.id('users')` edge.
- `docs/PLATFORM.md` §7 (Authentication & Identity) — the `ref` carry beside `plan`/`interval` at every hop of the
  sequence diagram, the `isInviteCode` validation, insert-only attribution **including the banned-inviter guard**, and
  the `getOrCreateInviteCode` / `getInviteSummary` rows in the identity-function table.
- `docs/PLATFORM.md` §8 (Subscriptions & Billing) — `trial_period_days: trialDaysFor(user)`, the `{ trial, days }`
  `custom_text`, and the length-agnostic rewrite of the trial-notification prose.
- `docs/PLATFORM.md` §13B (Privacy & Compliance) — the two codes under the existing DSR/erasure coverage, and
  `sessionStorage['ref']` as functional (not tracking) storage that changes no consent banner.
- `docs/PLATFORM.md` §14 — SettingsPage (the whole invite section), BillingPage (`trialDays`, `billing.giftFrom`),
  RecapPage (the conditional footer line), the FeedPage caught-up branch, the six `{{days}}` strings under "Trial UI
  (Plan 2C)", and the i18n key entry (**+13** keys).
- `docs/PLATFORM.md` §15 (Landing) — a new `RefCarrier` subsection and the Terms §5 update.
- `docs/PLATFORM.md` §17 — `invite_copied` in the complete event list.
- `docs/PLATFORM.md` §21 — the mapping row.
- **Not touched: §1.** The tier table's "7-day trial (card required)" line is the standing offer; the gift is
  described where it is decided (§8) and where it is shown (§14, §15).

## References

- Related: [[R01]], [[R02]], [[R03]], [[R05]], [[R11]], [[R15]], [[R18]].
- Prior art / plan: [[R03]] (the `?plan=` carry this reuses); memory `landing-conversion-redesign` (CTA hrefs carry plan and interval); memory `linkedin-api-access-constraints` (no LinkedIn write access, so no in-network invitations).
- Principle sources: [@richardrx · 2026-06-02](https://x.com/richardrx/status/2061766945582559509), [@richardrx · 2026-08-31](https://x.com/richardrx/status/2094404750229836066), [@richardrx · 2026-06-22](https://x.com/richardrx/status/2069018184942784582).
