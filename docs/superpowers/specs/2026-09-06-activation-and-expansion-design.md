# Activation and expansion — R04, R08, R06, R07, R05

> **Date:** 2026-09-06 · **Status:** approved, not implemented · **Source:** `backlog/revenue/` (RCD audit,
> 2026-09-05) · **Sequence:** R04 → R08 → R06 → R07 → R05

Five backlog items that share four new components, one new public query and one new analytics helper.
They are specified together because building them apart would duplicate all four.

## Table of contents

1. [Scope and decisions](#1-scope-and-decisions)
2. [Shared primitives](#2-shared-primitives)
3. [R04 — Value before the card](#3-r04--value-before-the-card)
4. [R08 — Upgrade at the moment of the limit](#4-r08--upgrade-at-the-moment-of-the-limit)
5. [R06 — Trial progress where the work happens](#5-r06--trial-progress-where-the-work-happens)
6. [R07 — Celebrate activation](#6-r07--celebrate-activation)
7. [R05 — Never ship a blank feed](#7-r05--never-ship-a-blank-feed)
8. [i18n](#8-i18n)
9. [Testing](#9-testing)
10. [Docs and backlog updates](#10-docs-and-backlog-updates)
11. [Constraints for the implementing agent](#11-constraints-for-the-implementing-agent)

---

## 1. Scope and decisions

Decisions closed in the brainstorm of 2026-09-06 (Henriko):

| #  | Question                                    | Decision                                                                                                                                                                                                  |
|----|---------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| D1 | R04 gate option A, B or C                   | **Option A only.** Copy and routing. `convex/lib/access.ts` is not touched: no pre-card allowance, no free AI drafts, no locked preview.                                                                  |
| D2 | PostHog named events                        | **Add a minimal `captureEvent` helper plus four events.** Inert until `VITE_POSTHOG_KEY` exists in prod.                                                                                                  |
| D3 | Where R06's made/received line links        | **Nowhere.** Plain text until R15 ships the recap page. R15's doc records the re-point.                                                                                                                   |
| D4 | The sidebar's `linkedin.com/sales/ssi` link | **Keep it, add a Sales Navigator qualifier**, and add a **Recap** entry beside it pointing at `/feed` (the app home — `App.tsx:138` redirects `*` there) until R15 ships. R15's doc records the re-point. |

Three claims in the backlog docs were checked against the code on 2026-09-06 and are **stale**. The spec
supersedes them:

| Doc claim                                                     | Reality                                                                                                                                                                        |
|---------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| R08 step 1: "the `planLimits` query the app already exposes"  | No public plan-limits query exists. `posts.getWeeklyUsage` and `posts.getFeaturedUsage` return only the caller's **own** tier numbers. §2 adds the query.                      |
| R08 step 1: "the shared `nextTier` helper"                    | Does not exist. It was to arrive with R15 step 8. §2 adds it.                                                                                                                  |
| R04 step 6 / R07 step 5: "emit a consent-gated PostHog event" | `analytics.ts` exposes `initPostHog`, `shouldCaptureAnalytics` and `syncAnalyticsConsent` only. There is no capture helper and no named event anywhere in the app. §2 adds it. |

Two pieces of the backlog docs are **deferred out of this batch**, both recorded in `backlog/revenue/R15-*`:

- R08 step 5, the `nearCap` prop for the 80% moment. Its only consumer is R15's recap page. An unplaced
  prop is speculative; R15 adds it when it has somewhere to render it.
- R06 step 3's `/recap` link and D4's Recap nav entry (see D3, D4).

Out of scope entirely: R05 step 4's launch seeding is an operational task for Henriko, not code. This batch
adds the checklist line only (§10).

## 2. Shared primitives

Build these first, inside R04 and R08. Nothing later in the sequence may duplicate them.

### 2.1 `nextTier` — `convex/lib/planLimits.ts`

A pure function beside the existing `DEFAULTS` object, exported for both the backend and the app. The app
already imports pure helpers straight out of `convex/lib/` (`MyPostsPage.tsx` imports `isUnlimitedFeatured`
from `convex/lib/postLimit`), so this needs no new plumbing.

```ts
export type Tier = 'starter' | 'growth' | 'pro' | 'contact'

/**
 * The next tier up the ladder, or null at the top. `null` means the caller renders a contact line
 * rather than a checkout link: Pro gets the Enterprise contact line, contact gets the custom-limit
 * line (decided 2026-09-05). Callers branch on the tier itself for that, not on the null alone.
 */
export function nextTier(tier: Tier): 'growth' | 'pro' | null
```

Mapping: `starter → 'growth'`, `growth → 'pro'`, `pro → null`, `contact → null`.

### 2.2 `getTierLimits` — `convex/posts.ts`

A public, no-argument query beside `getWeeklyUsage` and `getFeaturedUsage`. It returns every tier's default
limits so a component can name the **next** tier's numbers, which no existing query can do.

```ts
// Public: the plan-limit numbers for every tier, for the upgrade-at-limit sentences.
// No auth: these are the same public pricing limits the landing page states. Per-user contact-tier
// overrides are deliberately NOT resolved here — the contact tier renders a custom-limit line, never
// a number.
export const getTierLimits = query({
  args: {},
  handler: async ctx => { /* read the four tier-default planLimits rows; fall back to DEFAULTS per tier */ }
})
```

Returns `Record<Tier, { interactionsPerPost: number; postsPerWeek: number; featuredPerMonth: number }>`.
Rows come from the `planLimits` table (the runtime source of truth, B27) with `DEFAULTS[tier]` as the
per-tier fallback when a row is missing, mirroring `getPlanLimitsHelper`'s existing safety net.

### 2.3 `captureEvent` — `app/src/lib/observability/analytics.ts`

```ts
/**
 * Fire a named product event. No-op until initPostHog has run (dev, or prod without a key).
 * Consent is inherited, not re-checked: syncAnalyticsConsent opts PostHog in and out, and
 * posthog.capture is a no-op while opted out.
 */
export function captureEvent(name: string, props?: Record<string, string | number | boolean>): void {
  if (!initialized) return
  posthog.capture(name, props)
}
```

Four events, and no others in this batch: `card_gate_opened`, `card_gate_cta_clicked`,
`checkout_success_viewed`, `upgrade_at_limit_clicked`. Each carries only non-PII props (a plan id, a limit
kind). No email, no name, no post content.

### 2.4 Components

| Component               | File                                             | Owner item |
|-------------------------|--------------------------------------------------|------------|
| `CardGateDialog`        | `app/src/components/CardGateDialog.tsx`          | R04        |
| `UpgradeAtLimit`        | `app/src/components/UpgradeAtLimit.tsx`          | R08        |
| `TrialMeter`            | `app/src/components/TrialMeter.tsx`              | R06        |
| `TrialProgressCard`     | `app/src/components/shell/TrialProgressCard.tsx` | R06        |
| `CheckoutSuccessDialog` | `app/src/components/CheckoutSuccessDialog.tsx`   | R07        |
| `EmptyFeed`             | `app/src/components/EmptyFeed.tsx`               | R05        |

All dialogs use the existing shadcn `Dialog` (`app/src/components/ui/dialog.tsx`). No new dependency for a
dialog, a bar or a toast.

## 3. R04 — Value before the card

Option A. The server-side gate is unchanged; only the order and the shape of the ask move.

### 3.1 Feed-first routing

`app/src/components/FirstPostPromptScreen.tsx:21-28`: `handleSubmit` always ends in
`window.location.reload()`. Delete the `if (gated) window.location.href = '/billing'` branch, the
`useCardGate` call at `:15` and its now-unused import. Update the comment above the branch, which currently
explains the billing funnel.

### 3.2 The hidden-post banner

In `app/src/pages/FeedPage.tsx`, above `PostComposer` (`:119`): when `gated` **and** the member has a hidden
own post, render a banner.

- Detection reuses `api.posts.getMyPosts` — subscribed only while `gated`, and a brand-new member has at most
  one row. A post is hidden when `post.hidden === true`. No new query.
- Copy: `feed.hiddenPostBanner` — "Your first post is saved and hidden until you start your trial."
- One CTA, `feed.cardGateCta` — "Start 7-day trial" — linking to `/billing?plan=${targetPlan}`, where
  `targetPlan` is resolved the way `BillingPage.tsx:65-68` already resolves it (the `?plan=` param, then the
  `chosenPlan` sessionStorage stash, then `'growth'`). Extract that resolution into a small shared helper so
  the two sites cannot drift.
- The banner never renders on an empty feed. `EmptyFeed` (§7) owns that state and carries the banner copy
  itself.

### 3.3 The gate binds at the tap

`app/src/components/PostCard.tsx`:

- `:60-62` (react), `:142-144` (comment), `:151-155` (view on LinkedIn): the buttons become **enabled** when
  `gated`. Drop `disabled={gated}` and the `title={t('feed.cardGate')}` tooltips. Each `onClick` calls a new
  optional prop `onGated?: () => void` when `gated` is true, and the real handler otherwise.
- The AI-draft control follows the same rule: tapping it opens the dialog rather than calling
  `generateComment`, so no gated member ever reaches a paid DeepInfra call.
- `FeedPage` passes `onGated={() => setCardGateOpen(true)}` and renders one `CardGateDialog`.

`CardGateDialog` copy: title `feed.cardGateTitle` — "Your post goes live and every reaction counts"; body
`feed.cardGateBody`, leading with the result before any billing mechanics; primary `feed.cardGateCta` —
"Start 7-day trial" → `/billing?plan=${targetPlan}`; secondary `feed.cardGateLater` — "Not now". Never
"Add a payment method".

The `PAYMENT_REQUIRED` mapping at `FeedPage.tsx:181` stays as the server-side fallback.

### 3.4 Untouched

`convex/lib/access.ts` — `assertCanEngage` and `postCreatedHidden` keep their current behaviour byte for
byte. `convex/ai/comments.ts:25` keeps its `assertCanEngage` call. No new counter on `users`. The security
posture in `docs/PLATFORM.md` §17 is unchanged, so it needs no edit for this item.

### 3.5 Events

`card_gate_opened` when the dialog opens (prop: the control that opened it — `react`, `comment`, `linkedin`
or `aiDraft`), `card_gate_cta_clicked` when its primary CTA is used (prop: the target plan).

## 4. R08 — Upgrade at the moment of the limit

### 4.1 The component

`app/src/components/UpgradeAtLimit.tsx`:

```ts
type LimitKind = 'weeklyPosts' | 'featured' | 'interactionCap' | 'visibility'
interface Props { limit: LimitKind; className?: string }
```

It reads the tier from `api.users.getMe`, the numbers from `api.posts.getTierLimits` (§2.2), and the current
interval from `api.users.getSubscriptionInfo`. It renders **one sentence and one link**, nothing else.

Routing, by tier:

| Tier                | Destination                                                                                                                                                                                                                                   |
|---------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `starter`, `growth` | `/billing?plan=${nextTier(tier)}&interval=${chargedInterval}` so an annual member never lands on monthly. A member who already has a card routes through the portal switch path, exactly as `BillingPage.handlePlanClick` already decides it. |
| `pro`               | The Enterprise contact line — `mailto:${SUPPORT_EMAIL}`, following the `BillingPage.tsx:424-435` pattern. Never a checkout link.                                                                                                              |
| `contact`           | The custom-limit line — same mailto, different copy. Never a number, and never the 9999 sentinel.                                                                                                                                             |

Every number in the copy is interpolated from `getTierLimits`. Nothing is hardcoded. `isUnlimitedFeatured`
(`convex/lib/postLimit.ts`) guards the featured sentinel so 9999 is never printed.

Clicking the link fires `upgrade_at_limit_clicked` with the limit kind and the target plan.

### 4.2 The four placements

1. **Weekly cap.** `app/src/pages/MyPostsPage.tsx:188` passes `<UpgradeAtLimit limit="weeklyPosts" />`
   instead of `t('myPosts.weeklyLimitReached')`. Widen `limitHint` in
   `app/src/components/PostComposer.tsx:13` from `string` to `ReactNode`.
2. **Featured cap.** At `MyPostsPage.tsx:167-177`, when `featuredAtCap`, render
   `<UpgradeAtLimit limit="featured" />` beneath the pill.
3. **Interaction cap.** In the My Posts list, a post whose `interactionLimitReached` is true gets a badge —
   "Reached {{n}} interactions and left the feed" — and `<UpgradeAtLimit limit="interactionCap" />`. The post
   shapes at `convex/posts.ts:439,473,533,567` already carry the flag, so no schema or query change is
   needed. **No toast and no notice on the next feed visit** — the item's own rules forbid interrupting.
4. **Settings visibility.** `app/src/pages/SettingsPage.tsx:440-444` replaces the
   `settings.upgradePrompt` paragraph with `<UpgradeAtLimit limit="visibility" />`.

### 4.3 Localizable backend errors

Two hardcoded English `ConvexError` messages become prefixed codes the client maps, the same shape as
`PAYMENT_REQUIRED:`:

- `convex/posts.ts:232-236` → `` new ConvexError(`WEEKLY_LIMIT:${planLimits.postsPerWeek}`) ``
- `convex/posts.ts:521-523` → `` new ConvexError(`FEATURED_LIMIT:${limits.featuredPerMonth}`) ``

Client side, add a `mapLimitError(msg, t)` helper next to `friendlyError` in `app/src/lib/errors.ts` that
turns `WEEKLY_LIMIT:<n>` and `FEATURED_LIMIT:<n>` into the localized strings, and returns the input
untouched otherwise. Wire it wherever those two submits surface an error.

Any existing convex test asserting the old English strings is updated in the same change.

## 5. R06 — Trial progress where the work happens

1. **Extract the meter.** Move the bar, count and days-left markup out of
   `app/src/pages/BillingPage.tsx:157-175` into `TrialMeter`, taking the `getTrialProgress` result as a
   prop. BillingPage renders the extracted component; its visual output does not change.
2. **Sidebar card.** `app/src/components/shell/Sidebar.tsx` renders `TrialProgressCard` above the nav **only while
   `isTrialing`** (`useCardGate` is already called at `:12`). It contains the `TrialMeter`, the
   goal sentence `shell.trialGoal` — "Interactions build your SSI habit. Your {{plan}} plan starts at 50 or
   on {{date}}." with the localized plan name from `billing.plans.<tier>.name` — and the made/received split
   `shell.trialMadeReceived` as **plain text, no link** (D3). At `progress.nearThreshold`, it switches to the
   amber state with `shell.trialNearEnd` and a link to `/billing`, matching the billing banner.
3. **Mobile.** `app/src/components/shell/TopBar.tsx` gains a compact `12/50` pill, `lg:hidden`, linking to
   `/billing`, rendered only while trialing. The sidebar is a drawer below `lg` and starts closed, so the
   meter must not live only there.
4. **Subscription cost.** `getTrialProgress` is subscribed with `'skip'` unless `isTrialing`.
5. **Sidebar footer** (D4). The `linkedin.com/sales/ssi` link stays and gains a short Sales Navigator
   qualifier (`nav.viewSsiNote`), because the page went behind that paywall in late August 2026. A new **Recap** entry
   (`nav.recap`) sits beside it, pointing at `/feed` (the app home) until R15 ships the real route.
6. **No `+1` toast** after a reaction or comment. R06 step 5 defaults it to off and the item's own rules
   argue against it.
7. The card must not push the footer below the fold on a 768px-tall viewport at the sidebar's current width.

## 6. R07 — Celebrate activation

In `app/src/pages/BillingPage.tsx` (`useSearchParams` is already imported at `:4`):

1. **Read and strip.** On `success=true`, set `justSubscribed` and call `setSearchParams({}, { replace: true })`
   so a refresh never repeats the celebration.
2. **Wait for the webhook.** While `justSubscribed` and `me.subscriptionStatus === 'none'`, render an inline
   `billing.activating` state — "Activating your trial…". `getMe` is reactive, so the webhook flip updates it.
   After ~20 seconds, fall back to `billing.activatingTimeout` — "Your payment went through; your plan will
   show here shortly" — with the Manage button visible. The copy never blames the member and never mentions
   webhooks. Report the timeout to Sentry (`scrubError`) so a genuinely lost webhook is visible.
3. **Celebrate on the flip.** `CheckoutSuccessDialog` opens once the status becomes card-backed. Title
   `billing.successTitle` — "You're in."; body `billing.successBody` — "Your {{plan}} trial is live."; plus
   `billing.successPostLive` — "Your first post is now in the feed." — only when the member had a hidden post,
   reusing §3.2's detection. Primary CTA `billing.successCta` → `/feed`; secondary `billing.successStay`.
4. **Reinforce.** One line under the title from `billing.plans.<id>.description`. No upsell, no discount, no
   fabricated number, no confetti library, no tour.
5. **Event.** `checkout_success_viewed` with the plan id.
6. A cancelled checkout returns without the parameter and changes nothing.

Copy rule for the whole dialog: keep the outcome Henriko wants (a real LinkedIn presence that gets the right people to
find you — never "the next role" or "a client": the R11 one-ICP rule says what arrives is never named; amended
2026-09-06), one idea per sentence, plain verbs, no exclamation marks, no pull-quote ending. Henriko's draft in the R07
doc is explicitly not to ship as written.

## 7. R05 — Never ship a blank feed

`EmptyFeed` replaces the paragraph at `app/src/pages/FeedPage.tsx:129-133`, for the unfiltered empty case
only. The Pro-filter empty state keeps `feed.emptyFiltered` and its existing recovery copy.

1. **One action.** Headline `feed.emptyTitle` — "Your feed fills as members post"; one line
   `feed.emptyBody`; one primary button `feed.emptyCta` — "Share your first post" — that scrolls to and
   focuses the composer. Give the composer's textarea a stable `id` and focus it by that id; no ref
   plumbing through `PostComposer` is needed.
2. **Start above zero.** For members with `combined === 0`, a three-step checklist inside the empty state:
   signed in with LinkedIn (always done), shared a first post (done when `getMyPosts` returns one), reacted
   to two posts (done when `progress.made >= 2`). The bar opens at **1 of 3** and the whole checklist
   disappears once all three are done. For a gated member the "shared a first post" line says the post is
   saved and waiting for the trial — never that it is live.
3. **Gated with a hidden post** shows the R04 banner copy instead of the checklist. One progress element per
   state: empty feed → checklist; empty feed while gated with a hidden post → banner; live feed while
   trialing → the R06 sidebar meter.
4. **Delete the invite line.** Remove `feed.empty` from `en.json`, `pt.json` and `es.json`. It advertises a
   feature that does not exist.
5. **No fabricated activity.** No placeholder posts, no invented counts, no sample data.
6. A feed holding exactly one post must not look broken in a layout built for twenty.

## 8. i18n

New keys in `app/src/i18n/locales/{en,pt,es}.json`, all three in parity, pt is pt-BR and es is neutral Latin
American, sentence case throughout:

- **R04:** `feed.cardGateTitle`, `feed.cardGateBody`, `feed.cardGateCta`, `feed.cardGateLater`,
  `feed.hiddenPostBanner`
- **R08:** `upgrade.weeklyPosts`, `upgrade.featured`, `upgrade.interactionCap`, `upgrade.visibility`,
  `upgrade.cta`, `upgrade.proContact`, `upgrade.contactCustom`, `myPosts.interactionCapBadge`,
  `errors.weeklyLimit`, `errors.featuredLimit`
- **R06:** `shell.trialGoal`, `shell.trialStartsAt`, `shell.trialNearEnd`, `shell.trialMadeReceived`,
  `shell.trialPill`, `nav.viewSsiNote`, `nav.recap`
- **R07:** `billing.successTitle`, `billing.successBody`, `billing.successPostLive`, `billing.successCta`,
  `billing.successStay`, `billing.activating`, `billing.activatingTimeout`
- **R05:** `feed.emptyTitle`, `feed.emptyBody`, `feed.emptyCta`, `feed.checklist.title`,
  `feed.checklist.signedIn`, `feed.checklist.firstPost`, `feed.checklist.reactTwice`

Removed: `feed.empty` (all three locales).

There is **no automated locale parity test** in this repo. Parity is verified by a recursive key diff across
the three files before the item is called done.

## 9. Testing

Vitest, colocated, following the existing convention. Convex tests mock `convex/server` and unit-test pure
logic only; `convex-test` is not used here.

| Area                    | Assertions                                                                                                                                                                                                                                                           |
|-------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `nextTier`              | The four mappings, including both nulls.                                                                                                                                                                                                                             |
| `getTierLimits`         | Returns DB rows; falls back to `DEFAULTS` for a missing tier row.                                                                                                                                                                                                    |
| `FirstPostPromptScreen` | Submitting reloads for a gated member; no navigation to `/billing`.                                                                                                                                                                                                  |
| `PostCard`              | While gated, react / comment / LinkedIn / AI draft call `onGated` and fire no action; while not gated, the real handlers fire.                                                                                                                                       |
| `FeedPage`              | Banner renders for gated-with-hidden-post; `EmptyFeed` renders on an empty unfiltered feed; `emptyFiltered` still renders for a filtered one; the checklist follows the mocked queries.                                                                              |
| `UpgradeAtLimit`        | Per limit kind and tier: starter and growth link to checkout with the right plan and interval; pro renders the contact line; contact renders the custom-limit line; numbers come from the mocked query, never hardcoded; the featured sentinel never prints as 9999. |
| `MyPostsPage`           | The composer hint renders the component; a capped post renders the badge.                                                                                                                                                                                            |
| `errors`                | `mapLimitError` maps both codes and passes anything else through.                                                                                                                                                                                                    |
| `Sidebar`               | The card shows while trialing and is absent for `none`, `active` and `canceled`; amber at `nearThreshold`.                                                                                                                                                           |
| `TopBar`                | The pill renders only while trialing and links to `/billing`.                                                                                                                                                                                                        |
| `BillingPage`           | `?success=true` with `trialing` opens the dialog and strips the param; with `none` shows the activating state; a plain visit shows nothing new; a refresh does not re-celebrate.                                                                                     |
| Existing convex tests   | Updated where they assert the old English cap strings.                                                                                                                                                                                                               |

Gate: `pnpm verify` (format:check, lint, typecheck, all workspace tests) exits 0.

## 10. Docs and backlog updates

`docs/PLATFORM.md`, in the same change:

- **§8** — the checkout return leg now has a client-side state; upgrade deep-link and switch-plan routing.
- **§9** — the upgrade path at each cap, and the two new error codes.
- **§11** — the client-side gate behaviour, and the author-facing post-cap state.
- **§14** — feed-first onboarding routing, the card-gate dialog and banner, the feed empty state and its
  checklist, the shell trial card and mobile pill, the shared `TrialMeter`, the BillingPage success and
  activating states, `UpgradeAtLimit`'s placements.
- **§21** — a launch-checklist line naming the minimum live posts before sign-ups open.

`backlog/revenue/`: flip R04, R05, R06, R07 and R08 to DONE, and edit `R15-interactions-recap-page.md` to
record the two deferrals — the `nearCap` prop for the 80% moment, and re-pointing both the sidebar Recap
entry and R06's made/received line at `/recap` when it ships.

## 11. Constraints for the implementing agent

- **Never run a git state-changing command.** No `commit`, no `push`, no `stash`, no `checkout`, no `reset`.
  Henriko commits. A past agent's `git stash` stranded completed work.
- **Never run `pnpm format`.** Prettier owns code and config; humans own prose. Fix formatting by hand in the
  files you touched.
- **No new dependency** for a dialog, a bar, a toast or confetti. The shadcn `Dialog` and the existing toast
  cover everything here.
- **No interrupting upsell.** No modal on load, no upgrade email, no toast the next day. Inline only.
- **No fabricated proof**: no invented counts, ratings, urgency or scarcity. Only real, provable limits.
- **No hardcoded plan numbers in copy.** `getTierLimits` is the source; admins change those rows.
- **No claim that the app reads or shows the member's SSI**, and never tell a free member to check their SSI.
- **No scope added to strengthen an item.** Anything not in this spec goes to the backlog instead.
- Design work runs under `frontend-design`, `responsive-design` and `ui-ux-pro-max`, reviewed against
  `web-design-guidelines`; code style follows `karpathy-guidelines`.
- Test at pt and es string lengths and at mobile widths, not only English on a desktop.
