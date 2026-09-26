# R08 — Upgrade at the moment of the limit

> **Status:** DONE · **Priority:** P1 · **Effort:** M · **Category:** Expansion / Frontend / Backend errors
> **Depends on:** [[R03]] (the `?plan=` deep-link), [[R01]] (switch-plan path for card holders) · **Blocks:** none

## Principle

**Expansion is born of usage: upgrade at the moment of the limit, never by interruption.** The
user who just hit a cap has proof in hand that the product works for them. Frame the upgrade as
the loss they are about to take (the post that stops collecting, the second post they cannot
publish this week), name the number, and put one link beside it. A modal on login or an email the
next day is an interruption; a sentence at the cap is an answer.
Sources: [upgrade as a loss at the moment of value](https://x.com/richardrx/status/2046544442216054981),
[fear of losing beats hope of gaining](https://x.com/richardrx/status/2028471666297217460).

## Summary

Four limit moments exist and none of them offers a path. The weekly post cap shows a hint with no
link. The featured cap shows a warning pill. A post that reaches its interaction cap leaves the
feed and its author is never told. The Settings visibility prompt is plain text. The backend's
weekly-cap error is a hardcoded English string.

## Evidence

- `convex/lib/planLimits.ts:28-29` — Starter: 25 interactions, 1 post per week, 0 featured; Growth: 50, 2, 1. The `planLimits` table (`convex/schema.ts:233-241`) is the runtime source ([[B27]]).
- `convex/posts.ts:232-236` — the weekly cap throws a `ConvexError` with a hardcoded English message.
- `app/src/components/PostComposer.tsx:13-16`, `:57-58` — `limitHint` is a plain span; `app/src/pages/MyPostsPage.tsx:188` passes `t('myPosts.weeklyLimitReached')` ("Weekly limit reached", `app/src/i18n/locales/en.json:73`). No link.
- `app/src/pages/MyPostsPage.tsx:135`, `:167-177` — `featuredAtCap` and the warning pill; no path to Pro.
- `convex/interactions.ts:130-147`, `:186-200` — `shouldFlipInteractionLimit` sets `interactionLimitReached: true` and the post leaves the feed. Viewers get `convex/feed.ts:142` ("This post has reached its interaction limit."); the author gets nothing.
- `convex/posts.ts:439`, `:473`, `:533`, `:567` — the post shapes returned to the client already carry `interactionLimitReached`, so My Posts can render the moment without a schema change.
- `app/src/pages/SettingsPage.tsx:440-444` — `settings.upgradePrompt` (`en.json:144`, "Upgrade to Pro to control who sees your posts.") is plain text.
- `app/src/pages/BillingPage.tsx` — no `?plan=` handling yet ([[R03]]).

## Root cause

[[B27]] made the limits a single source of truth and every cap got a guard plus a hint. The
upgrade path was never designed as part of the limit; it lives on the billing page, which the
user is not on when the cap binds.

## What we need to do

1. **One component for every cap.** `app/src/components/UpgradeAtLimit.tsx` with a `limit` prop (`weeklyPosts` | `featured` | `interactionCap` | `visibility`). It reads the tier from `getMe`, the numbers from the `planLimits` query the app already exposes (never hardcoded), computes the next tier with the shared `nextTier` helper ([[R15]] step 8: Starter to Growth, Growth to Pro, Pro to the Enterprise contact line, contact tier to the custom-limit line), and renders one sentence of loss plus one link: `/billing?plan=<nextTier>` for Starter and Growth, `mailto:${SUPPORT_EMAIL}` for Pro and contact, the `BillingPage.tsx:291-309` Enterprise pattern (decided 2026-09-05). Card holders route to the switch-plan path from [[R01]].
2. **Weekly cap.** `MyPostsPage.tsx:188` passes the component instead of the string (widen `limitHint` to `ReactNode` in `PostComposer.tsx:13`). Copy: "You've used your 1 post this week. Growth gives you 2, each collecting up to 50 interactions."
3. **Featured cap.** At `MyPostsPage.tsx:167-177`, when at cap and the tier is below Pro: "Pro features 3 posts."; on Pro, the Enterprise contact line (step 1).
4. **The post-cap moment (strongest).** In the My Posts list, a post with `interactionLimitReached` gets a badge "Reached 25 interactions and left the feed" and the component: "On Growth it keeps collecting to 50." Decide in the brainstorm whether a one-time toast on the next feed visit is worth it.
5. **The 80% moment.** The recap page ([[R15]] part D) renders the same component when a live post reaches 80% of its cap, with the live numbers ("is at 20 of 25"); add a `nearCap` boolean prop for that wording. One component, two moments.
6. **Settings visibility.** `SettingsPage.tsx:440-444` becomes the component with `limit: 'visibility'`, linking to `/billing?plan=pro`.
7. **Localizable backend error.** `convex/posts.ts:232-236` throws a prefixed code (for example `WEEKLY_LIMIT:2`) and the client maps it, the same pattern as `PAYMENT_REQUIRED:` in `app/src/pages/FeedPage.tsx:181`.
8. **Never interrupt.** Inline only. No modal on load, no upgrade email; the [[R02]] mailer is for billing notices. (Amended 2026-09-07: the post-cap event notice is [[R20]]; it leads with the event and carries one plan sentence.)
9. **i18n.** Keys `upgrade.weeklyPosts`, `upgrade.featured`, `upgrade.interactionCap`, `upgrade.visibility`, `upgrade.cta` in en, pt and es, with the numbers interpolated.
10. **Tests.** Component per limit and tier (Starter and Growth link to checkout, Pro and contact render the mailto line, `nearCap` wording); the My Posts badge; the composer hint renders a link; the error-code mapping.
11. **Docs.** See **Docs to update**.

## Do / Don't

For the implementing agent. Each line names the mechanism it relies on and links the source.

**Do**

- **Put the sentence where the limit binds**, in the same view, at the same moment. The upsell is the better version offered when the limit is felt ([@richardrx · 2026-09-01](https://x.com/richardrx/status/2094769345821905094)); expansion is born of usage ([@richardrx · 2026-05-05](https://x.com/richardrx/status/2051672248348479691)).
- **Frame it as the loss at hand.** The post that stopped collecting, the second post that cannot go out this week; loss outconverts gain ([@richardrx · 2026-04-21](https://x.com/richardrx/status/2046544442216054981), [@richardrx · 2026-03-02](https://x.com/richardrx/status/2028471666297217460)).
- **Use the live numbers and keep them precise.** "Reached 25 interactions and left the feed. On Growth it keeps collecting to 50." ([@richardrx · 2026-02-18](https://x.com/richardrx/status/2024141244717281514)).
- **Keep one value axis across tiers** (interactions, posts, featured). A quantity against a qualitative perk in the same sentence stalls the comparison ([@richardrx · 2026-02-02](https://x.com/richardrx/status/2018357024543715480)).
- **Land the link on the right plan and interval**, one click from the cap ([[R03]] deep-link); card holders go straight to the switch ([[R01]]).
- **Treat the cap as a ladder.** Starter's limit exists to make the user feel the pain and look up; the sentence is the rung ([@richardrx · 2026-02-03](https://x.com/richardrx/status/2018693884449009956)).
- **Measure upgrade rate per moment.** Below 5% means the timing or the framing is wrong, not the price ([@richardrx · 2026-04-21](https://x.com/richardrx/status/2046544442216054981)).

**Don't**

- **Don't interrupt.** No modal on load, no upgrade email, no toast the next day ([@richardrx · 2026-05-05](https://x.com/richardrx/status/2051672248348479691)). The post-cap event notice ([[R20]], decided 2026-09-07) is the one exception: once per post, the fact first.
- **Don't send Pro or contact users to a checkout.** Pro's next step is the Enterprise contact line and the contact tier's is the custom-limit line (decided 2026-09-05); a checkout link to a plan the user already has reads as a bug.
- **Don't hardcode numbers in copy.** The `planLimits` table is the source and admins change it.
- **Don't write "Upgrade to unlock more features".** Generic gate copy is exactly what the loss framing beats ([@richardrx · 2026-04-21](https://x.com/richardrx/status/2046544442216054981)).
- **Don't attach a discount to the upgrade sentence.** The free month is a manual promo campaign (standing decision); a coupon at the cap teaches users to wait for one.
- **Don't pile persuasion cues.** One line, one link; stacked cues trigger reactance ([@richardrx · 2026-01-06](https://x.com/richardrx/status/2008610564222672914)).
- **Don't move the cap to sell more.** Changing the limits is a pricing decision for [[R13]] and Henriko, never a side effect of this item.

## Acceptance criteria

- [x] Each of the four moments shows one sentence naming the loss and one link to the next tier, with numbers from the `planLimits` table.
- [x] A Pro user sees the Enterprise contact line at a cap, never a checkout link; a contact-tier user sees the custom-limit line.
- [x] The weekly-cap error is localized in en, pt and es.
- [x] No upgrade prompt appears as a modal or on page load. (Starter's featured ask used to fire on My Posts load — fixed in the 2026-09-06 review.)
- [x] `pnpm verify` is green (typecheck + lint + tests).
- [x] `docs/PLATFORM.md` updated (see **Docs to update**).

## Risks / edge cases / open questions

- **Numbers drift.** An admin can change limits in the table; the copy must interpolate live values. The Enterprise sentinel (9999) reads as "unlimited".
- **Interval.** The deep-link should carry the user's current interval (`subscriptionInfo`) so annual users do not land on monthly.
- **Card-less users** are not upgrade targets; they need the card gate first ([[R04]]).
- **Trialing users** who switch tiers go through the portal ([[R01]]); confirm `trial_end` survives the switch. Since 2026-09-07 the switch is a `subscription_update_confirm` deep link to the price on the button (`billingNode.createPlanSwitchSession`, [[R20]]'s landing fix), not the portal home; a refused deep link still opens the portal home. The return leg (`/billing?switched=<tier>`) waits for the webhook, then names the plan and fires `plan_switch_completed { plan }` once.
- **Crowding** with the [[R06]] meter on the same screen; the cap sentence sits next to the cap, the meter stays in the shell.

## Docs to update

- `docs/PLATFORM.md` §9 (Posts, plan limits) — the upgrade path at each cap and the error code.
- `docs/PLATFORM.md` §11 (Feed & Engagement) — the author-facing post-cap state.
- `docs/PLATFORM.md` §14 (MyPostsPage, SettingsPage, PostComposer) — the component and its placements.
- `docs/PLATFORM.md` §8 (Upgrade paths) — deep-link and switch-plan routing.

## References

- Related: [[R01]], [[R03]], [[R04]], [[R06]], [[B27]].
- Prior art / plan: `docs/PLATFORM.md` §9 plan-limits table; `backlog/B27-*` (single source for tier defaults).
- Principle sources: [@richardrx · 2026-04-21](https://x.com/richardrx/status/2046544442216054981), [@richardrx · 2026-03-02](https://x.com/richardrx/status/2028471666297217460).
