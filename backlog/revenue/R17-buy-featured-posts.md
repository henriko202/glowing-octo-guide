# R17 — Buy a featured post ($5 add-on with a bigger interaction cap)

> **Status:** DONE 2026-09-08 · **Priority:** P2 · **Effort:** L · **Category:** Product / Backend / Frontend / Billing
> **Depends on:** [[R08]] (the cap component and the `?plan=` links it renders next to) · [[B07]] (no-refund featured semantics, done) · **Blocks:** —

Ladder settled by R13 (2026-09-08): fixed bonus +25/+50/+100 by tier, stored per post.

## Principle

**Expansion is born of usage: monetize the base you already paid to acquire.**
A member who reaches the featured cap, or whose post hit its interaction cap and left the feed,
is holding the one thing an upsell needs, the context to judge it. Richard's three
direct-response moments map onto this product one to one: the **order bump** (right after the
member submits a post), the **upsell** (the next tier, at the moment the limit is felt) and the
**downsell** (a $5 one-off instead of a $15 or $50 commitment). The add-on is the downsell. It
sits beside the upgrade, never in front of it, and it arrives where the member already has the
context, never as a popup.
Sources: [monetize the base](https://x.com/richardrx/status/2094769345821905094),
[upgrade at the limit, never by interruption](https://x.com/richardrx/status/2051672248348479691),
[an interface can become a revenue line](https://x.com/richardrx/status/2079592859003482207).

## Summary

Henriko's direction (2026-09-05): members can buy a featured post for **$5**, from Billing, from
My Posts and from the post itself. A purchased featured post gets an interaction cap of **the
plan's cap + 100** (Henriko: "or maybe revisit this later"). The purchase never consumes the
plan's monthly featured quota, and the plan's own featured posts keep the plan cap. Stripe
Checkout in `mode: 'payment'` takes the money; the `checkout.session.completed` webhook features
the post and stores the bonus on it. Nothing is refunded on unfeature, matching [[B07]].

## Evidence

- `convex/billingNode.ts:23-62` — `createCheckoutSession` calls the Stripe SDK directly in `mode: 'subscription'` (`:40`) with `metadata: { convexUserId }` (`:45`), `success_url`/`cancel_url` on `/billing` (`:49-50`); the price allowlist is `ALLOWED_PRICE_IDS` (`:26`, `convex/lib/stripePrices.ts:30-31`, built from the six `STRIPE_*_PRICE_ID` vars at `:13-18`).
- `convex/http.ts:220-229` — the `checkout.session.completed` handler as built: `isFeaturedPostCheckout` (`convex/lib/featuredPurchase.ts:31`) filters to a paid `mode: 'payment'` session tagged `metadata.kind === 'featured_post'`, then calls `internal.posts.applyPurchasedFeature`. Subscription checkouts fall through to the component's own handling of the other four events, unchanged.
- `convex/posts.ts:494-541` — `featurePost`: quota read on `featuredPostUsage` (`:516-520`), `isFeaturedLimitReached` throw (`:521-525`), `computeFeedFields` refresh and patch (`:528-536`), quota upsert (`:538-539`); `if (post.isFeatured) return` idempotence (`:511`). `:547-570` — `unfeaturePost` never decrements usage (the [[B07]] decision, doc comment `:480-493`).
- `convex/posts.ts:150-174` — `getFeaturedUsage` returns `usedCount` and `featuredPerMonth`; `app/src/pages/MyPostsPage.tsx:135` derives `featuredAtCap`, `:167-177` renders the pill, `:239-251` the Feature/Unfeature button, disabled at the cap with `myPosts.featureLimitReached` (`app/src/i18n/locales/en.json:66`).
- `convex/lib/planLimits.ts:27-32` — `DEFAULTS`: featured/month 0/1/3/9999 and `interactionsPerPost` 25/50/200/200; `convex/lib/postLimit.ts:14-17` — `UNLIMITED_FEATURED_SENTINEL` and `isUnlimitedFeatured` (contact has nothing to buy).
- `convex/lib/interactionLimit.ts:4-19` — `hasReachedInteractionLimit` and `shouldFlipInteractionLimit` take one `interactionsPerPost` number. Six call sites read it from `getPlanLimitsHelper(...).interactionsPerPost`: `convex/interactions.ts:128-133` and `:184-189` (in-app increments), `convex/jobs/syncPosts.ts:111` (Apify insert) and `:187-190` (Apify refresh), `convex/jobs/processQueue.ts:84-87` (queue promotion), `convex/posts.ts:339-340` (submit rejection). Only the two increments and the refresh run against an existing post; the other three create the post.
- `convex/schema.ts:124-125`, `:135` — `posts.isFeatured`, `featuredAt`, `interactionLimitReached`; `:184-188` — `featuredPostUsage`; `:289-298` — `auditLogs` (`writeAuditLog`, `convex/lib/audit.ts:22`).
- `convex/lib/feedRank.ts:25`, `:52-54` — featured posts rank first (`FEATURED_BASE + publishedAt`); `computeFeedFields` also folds `interactionLimitReached` into `inFeed`.
- `convex/feed.ts:114` — the feed never shows the viewer's own post, so "the post itself" for the owner is the My Posts card (`MyPostsPage.tsx:216-256`), not the feed card.
- `convex/lib/access.ts:10-20` — `canEngage`/`assertCanEngage` (trialing, active, canceled); `:22-24` — a member without a card posts hidden, so a purchase for them would feature a post nobody can see.
- `convex/lib/trialMilestone.ts:3` — `TRIAL_INTERACTION_THRESHOLD = 50` counts made plus received interactions; a bigger cap on a bought post can end a trial sooner.
- `convex/privacy/deletion.ts:34-46` — the `OWNED` erasure list; `convex/privacy/export.ts:59-67` — `EXPORT_TABLES`; any new table joins both.
- `app/src/pages/BillingPage.tsx:45`, `:83-91` — `createCheckout` action and `handleUpgrade` (`window.location.href = url`); `:222-289` — the plan grid; `:291-303` — the Enterprise card; `:306-312` — the "Need more?" line with `SUPPORT_EMAIL` (`app/src/lib/support.ts:2`).
- `app/src/pages/MyPostsPage.tsx:58`, `:69-71`, `:189` — `submitPost` and `handleSubmit`, the moment right after the member adds a post.
- `convex/lib/featuredPurchase.ts:19-30`, `:31-41`, `:42-57`, `:58-` — the pure helpers as built: `featuredPurchaseBlocker` (server eligibility), `isFeaturedPostCheckout` (webhook filter), `fulfilmentAction` (replay / duplicate / apply), `purchasedFeaturePatch` (the patch plus which audit action to write). `convex/posts.ts:634-643` — `assertFeaturedPurchasable` (internalQuery, throws the blocker); `:651-708` — `applyPurchasedFeature` (internalMutation, idempotent on the checkout session id, never touches `featuredPostUsage`). `convex/billingNode.ts:97-128` — `purchaseFeaturedPost` (action): `assertCanEngage`, `FEATURED_POST_PRICE_ID`, `mode: 'payment'`, `metadata: { kind: 'featured_post', convexUserId, postId }`, `success_url` carries `&post=<id>`.
- `app/src/pages/MyPostsPage.tsx:52` — `BuyFeaturedButton`, the one control shared by all three sources (`'cap' | 'billing' | 'quota'`); `app/src/pages/BillingPage.test.tsx` exists (the add-on line and its contact-tier hiding are covered there — not a file still to create).
- `convex/_generated/ai/guidelines.md:106` (validators on every function), `:224-225` (index names carry every field), `:470-471` (`"use node"` only in action-only files).
- `docs/PLATFORM.md` §8 (`:885-1034`, checkout flow at `:920`, webhook sync at `:975`), §9 (`:1035`), §10 featured semantics (`:1288-1302`), §13B (`:2014`), §16 Stripe rows (`:2838-2845`, `:2910-2915`), §14 BillingPage bullet (`:2385`) and MyPostsPage bullet (`:2361`).

## Root cause

Featured posts exist only as a monthly quota, so the moment a member wants one more, the only
answer is a tier jump: Starter to Growth for one featured post, Growth to Pro for two more. The
smaller commitment does not exist, and the cap on a featured post is the same as on any other
post, so featuring buys position but not room.

## What we need to do

1. **Constants and the cap rule.** In `convex/lib/interactionLimit.ts` add `PURCHASED_FEATURED_CAP_BONUS = 100` and an optional fourth parameter `capBonus = 0` to `hasReachedInteractionLimit` and `shouldFlipInteractionLimit` (`likeCount + commentCount >= interactionsPerPost + capBonus`). The three existing-post call sites pass `post.interactionCapBonus ?? 0` (`interactions.ts:128-133`, `:184-189`, `syncPosts.ts:187-190`); the three create sites pass nothing. Extend `interactionLimit.test.ts`: the bonus widens the cap, zero keeps today's behaviour.
2. **Schema (widen, no backfill).** On `posts`: `interactionCapBonus: v.optional(v.number())` and `featuredPurchase: v.optional(v.object({ checkoutSessionId: v.string(), amountCents: v.number(), paidAt: v.number() }))`. The bonus is stored on the post at purchase time so a later change to the constant never alters what a member already paid for. No new table: the Stripe component keeps the payment record, the post keeps the link to it.
3. **Price allowlist and env.** `STRIPE_FEATURED_POST_PRICE_ID` (a one-time $5 price) read in `convex/lib/stripePrices.ts` as `FEATURED_POST_PRICE_ID` beside `ALLOWED_PRICE_IDS`; it must never enter `buildPriceMap`, so `resolveTier` cannot map a one-off payment to a tier. Add the row to `docs/PLATFORM.md` §16 and `convex/.env.local.example`. The app needs no `VITE_` copy: the action picks the price server-side.
4. **`billingNode.purchaseFeaturedPost({ sessionToken, postId })`** next to `createCheckoutSession` (`billingNode.ts:23`). Guards, in order: `requireAuthAction`; `assertCanEngage` (`access.ts:14`); post exists, belongs to the caller, `deletedAt === undefined`, `!post.isFeatured`, no `featuredPurchase`; `!isUnlimitedFeatured(limits.featuredPerMonth)` (contact has nothing to buy, `postLimit.ts:16`). Then `stripeComponent.getOrCreateCustomer` and `stripe().checkout.sessions.create({ mode: 'payment', customer, line_items: [{ price: FEATURED_POST_PRICE_ID, quantity: 1 }], metadata: { kind: 'featured_post', convexUserId, postId }, success_url: `${appUrl}/my-posts?featured=paid&post=${postId}`, cancel_url: `${appUrl}/my-posts` })`. A card on file is offered by Checkout because the customer id is passed, so a trialing member pays with two clicks. Return `{ url }` exactly like `createCheckoutSession`. No plan-quota precondition on the server: the UI decides when to show the buy control (step 7), the server only checks eligibility.
5. **Webhook.** In `convex/http.ts:138` add `'checkout.session.completed'`: return early unless `session.mode === 'payment'`, `session.payment_status === 'paid'` and `session.metadata?.kind === 'featured_post'`; then `ctx.runMutation(internal.posts.applyPurchasedFeature, { postId, userId, checkoutSessionId: session.id, amountCents: session.amount_total ?? 500 })`. Subscription checkouts fall through to the component's own handling, unchanged.
6. **`posts.applyPurchasedFeature` (internalMutation).** Idempotent on `post.featuredPurchase?.checkoutSessionId === checkoutSessionId` (Stripe retries webhooks). Patch `isFeatured: true`, `featuredAt: Date.now()`, `interactionCapBonus: PURCHASED_FEATURED_CAP_BONUS`, `featuredPurchase`, and recompute `interactionLimitReached` with `hasReachedInteractionLimit(like, comment, limits.interactionsPerPost, bonus)` before `computeFeedFields`, so a post that had left the feed at 25 comes back with room for 100 more. No `featuredPostUsage` write. `writeAuditLog` with `action: 'featured_post_purchased'` and the session id in `metadata`. If the post was soft-deleted or the author erased between checkout and webhook, store the purchase on the post when it exists, feature nothing, and log it; the refund is manual in the Stripe dashboard (see Risks).
7. **Re-feature and unfeature.** In `featurePost` (`posts.ts:513`), a post with `featuredPurchase` skips the quota read and the throw: it was paid for, so re-featuring is free and never touches `featuredPostUsage`. `unfeaturePost` stays as is; the bonus and the purchase stay on the post, nothing is refunded ([[B07]]).
8. **The three surfaces.** All render through the [[R08]] component, with the upgrade first and the add-on second (the downsell sits beside the upsell, never above it):
   - **The post itself (My Posts card, `MyPostsPage.tsx:239-251`).** While the plan quota has room, the Feature button uses the quota as today. At the cap (`featuredAtCap`, including Starter's 0), the disabled button becomes "Feature for $5", which calls `purchaseFeaturedPost` and redirects. A post whose `interactionLimitReached` badge shows ([[R08]] step 4) gets the same control with the cap copy: "Reached 25 and left the feed. Feature it for $5 and it comes back at the top with room for 125." A bought post shows a distinct badge ("Featured · paid · cap 125") so the member can see what the $5 bought.
   - **My Posts pill (`:167-177`).** At the cap, the pill's hint becomes the [[R08]] component: upgrade link first, "or feature one post for $5" second.
   - **Billing (`BillingPage.tsx:306`).** One add-on line under the plan grid, above the "Need more?" line: "Featured post add-on · $5 each · pins one post at the top with a cap of your plan + 100 interactions." Its button links to `/my-posts?feature=buy`, where the member picks the post (the buy control on every eligible card is highlighted for that visit). No credit is sold blind: a featured post is a post, so the choice happens where the posts are. Hidden for contact (`isUnlimitedFeatured`).
   - **Order bump.** Right after `handleSubmit` succeeds (`MyPostsPage.tsx:69-71`), the toast carries one action: "Post added. Feature it for $5" when the quota is at the cap, "Feature it" (plan quota) otherwise. The card the member just added is the surface; the toast only points at it.
9. **Return trip.** `/my-posts?featured=paid&post=<id>` shows one toast ("Paid. Your post is featured with room for 125 interactions.") and clears the params; the card flips reactively when the webhook lands. If the webhook has not landed yet, the card named by `post` shows "Confirming your payment" until `featuredPurchase` arrives (poll nothing; reactive query).
10. **Copy and i18n.** Keys `myPosts.buyFeatured*`, `billing.featuredAddon*`, `myPosts.featuredPaidBadge` in en, pt and es. Every string carries the exact numbers from `getFeaturedUsage` and the plan cap plus the bonus, never "more reach".
11. **Privacy.** `posts.featuredPurchase` rides in the existing posts export and erasure; nothing new joins `EXPORT_TABLES` or `OWNED`. Add one line to the Privacy Policy's payments paragraph (Stripe already listed) that one-off purchases appear on the Stripe receipt. Document in §13B that the purchase record on the post is deleted with the post at erasure while the invoice stays in Stripe.
12. **Tests.** `interactionLimit.test.ts` (bonus); `posts` unit tests for `applyPurchasedFeature` idempotence, the re-feature-free path and the cap un-flip; `http` handler filter (subscription session ignored, unpaid session ignored, metadata kind mismatch ignored); `MyPostsPage.test.tsx` (buy control at the cap, badge on a bought post, `?featured=paid` toast); a new `BillingPage.test.tsx` (none exists today: add-on line present, hidden for contact).
13. **Docs.** See **Docs to update**.

## Do / Don't

For the implementing agent. Each line names the mechanism it relies on and links the source.

**Do**

- **Put the add-on beside the upgrade, as the downsell.** The upsell is the better version at the moment the limit is felt; the downsell is the smaller commitment offered instead of losing the sale. Upgrade first, "$5 once" second, on the same surface ([@richardrx · 2026-09-01](https://x.com/richardrx/status/2094769345821905094)).
- **Offer it at the limit, where the context already exists.** The cap pill, the disabled Feature button and the "left the feed" badge are the three moments; a member who hits none of them never sees a pitch ([@richardrx · 2026-05-05](https://x.com/richardrx/status/2051672248348479691)).
- **Frame the "left the feed" moment as a loss with the member's own numbers.** "Reached 25 and left the feed" outconverts "get more reach"; the gate timed to a known result converts best ([@richardrx · 2026-04-21](https://x.com/richardrx/status/2046544442216054981), [@richardrx · 2026-03-02](https://x.com/richardrx/status/2028471666297217460)).
- **State the whole deal in one line: $5, once, this post, cap 125.** Precise numbers read as a promise the app can keep; "more" reads as an estimate ([@richardrx · 2026-02-18](https://x.com/richardrx/status/2024141244717281514)).
- **Make the order bump a real surface, not a popup.** The toast after submit points at the card the member just added; the decision is already made, the addition is obviously related ([@richardrx · 2026-09-01](https://x.com/richardrx/status/2094769345821905094)).
- **Keep the checkout to what Stripe already has.** Customer id passed, saved card offered, no field of ours; every extra input is less conversion, and a surprise line at checkout is a reason to cancel ([@richardrx · 2025-12-12](https://x.com/richardrx/status/1999584679247134761), [@richardrx · 2026-08-12](https://x.com/richardrx/status/2087502085151424711)).
- **Reinforce the purchase on return.** The `?featured=paid&post=<id>` toast and the paid badge tell the member what the $5 bought; people look for confirmation right after they commit ([@richardrx · 2026-04-29](https://x.com/richardrx/status/2049392897598849333)).
- **Let one option dominate on every surface.** Upgrade solid, add-on as a text link or ghost button; two equal buttons is a slower decision ([@richardrx · 2026-01-22](https://x.com/richardrx/status/2014317885494059106)).
- **Say what it costs during a trial.** "Charged today, separate from your trial" keeps the no-charge-before-day-7 promise intact; a stated limit beside the offer is a certainty signal ([@richardrx · 2026-01-15](https://x.com/richardrx/status/2011791634401284185)).
- **Keep the bought position visible to other members.** The ★ Featured badge already renders above the embed on every feed card (`app/src/components/PostCard.tsx:95-103`); status is what having it says to others, so never move it to an owner-only surface ([@richardrx · 2026-01-05](https://x.com/richardrx/status/2008195743664799855)).

**Don't**

- **Don't add the add-on to the subscription checkout, pre-ticked or not.** A pre-selected extra at checkout is where the default stops being legal ([@richardrx · 2026-01-19](https://x.com/richardrx/status/2013339752934629537), [@richardrx · 2026-05-22](https://x.com/richardrx/status/2057872036718899256)).
- **Don't sell credits blind from Billing.** An unused credit is a support ticket and a refund question; the purchase happens on a post ([@richardrx · 2026-05-26](https://x.com/richardrx/status/2059236567533650119)).
- **Don't stack bonuses** ("+100 interactions +7 days at the top +…"). Past one relevant addition the buyer starts wondering what is wrong with the core offer ([@richardrx · 2025-10-23](https://x.com/richardrx/status/1981338127592570944)).
- **Don't put the add-on on the pricing grid as a fourth card**, on Billing or on the landing. Four choices stall the reader; it stays a line under the grid ([@richardrx · 2026-05-28](https://x.com/richardrx/status/2059951433827426437)).
- **Don't promise reach, an SSI move or a timeline from a featured post.** The app can show position and the cap, nothing LinkedIn-side; a claim it cannot show is expectation debt ([@richardrx · 2026-04-29](https://x.com/richardrx/status/2049568514311172355)).
- **Don't fake scarcity** ("only 3 featured slots left today"). There is no slot limit in `computeFeedFields`; invented pressure is the deceptive-design line ([@richardrx · 2026-01-15](https://x.com/richardrx/status/2011791634401284185)).
- **Don't announce it by email.** The base learns about it where it is used, at the cap ([@richardrx · 2026-05-20](https://x.com/richardrx/status/2057162392048476345)). Not in the [[R20]] cap email either (decided 2026-09-07: that email carries one link, the next tier).
- **Don't refund on unfeature**, and say so before the click ([[B07]]).
- **Don't show the buy control to contact**, and don't let the server accept it (`isUnlimitedFeatured`).
- **Don't count the purchase toward `featuredPostUsage`.** The quota is the plan's; the add-on is outside it, or the member paid for something the plan already gave them.
- **Don't sell the feed to anyone but its members.** A featured post is a member's own post ranked higher; a sponsored post or an ad is someone else's message inside a flow the member trusts, and the product pays the reputational cost of whatever it sells ([@richardrx · 2026-08-28](https://x.com/richardrx/status/2093310753088434487)).

## Acceptance criteria

- [x] A member at the featured cap can buy a featured post from the My Posts card, from the pill and from the Billing add-on line; the Stripe session is `mode: 'payment'` for the configured $5 price, `metadata.kind === 'featured_post'`.
- [x] On `checkout.session.completed` the post is featured with its tier's per-tier `FEATURED_CAP_BONUS` (25/50/100), `featuredPurchase` set, `featuredPostUsage` untouched, an audit row written; a duplicate event changes nothing.
- [x] A bought post reaches its cap at plan cap + its tier's `FEATURED_CAP_BONUS` on in-app increments and on the Apify refresh; a post that had left the feed at the plan cap returns to the feed on purchase.
- [x] Re-featuring a bought post costs no quota; unfeaturing refunds nothing.
- [x] Contact-tier members see no buy control and the action rejects them; members without a card are rejected with the `PAYMENT_REQUIRED:` prefix.
- [x] `?featured=paid&post=<id>` shows one toast and the card flips reactively.
- [x] en, pt and es carry every new string with the exact numbers.
- [x] `pnpm verify` is green (typecheck + lint + tests).
- [x] `docs/PLATFORM.md` updated (see **Docs to update**).
- [x] Stripe Dashboard: one-time $5 Price + `STRIPE_FEATURED_POST_PRICE_ID` + `checkout.session.completed` on the
      endpoint — **done 2026-09-10** (test mode, `dev:shocking-dragon-458`; manual — PLATFORM §8).

## Risks / edge cases / open questions

- **⚖️ Ladder math (decide before implementation, with [[R13]]).** A flat +100 lets a cheaper path beat the next tier on the one number the buyer sees. Starter ($5) plus one add-on ($5) gives one featured post with a cap of 125; Growth ($15) gives one featured post with a cap of 50. Growth plus two add-ons ($25) gives three featured posts, two of them at 150, against Pro ($50) with three at 200 and five posts a week. Pro still wins on posts per week and on plan-featured caps, but the featured post is the visible number. Options: (a) keep +100 as Henriko set it and watch the mix; (b) a per-tier bonus stored in `DEFAULTS` (for example +25/+50/+100) so the bought post never outranks the next tier's plan cap; (c) cap the add-on at N per month per tier. The spec above stores the bonus on the post, so any of the three is a constant change, not a migration.
- **Trial members.** A card on file makes the purchase two clicks; the copy must say it is charged today. A bought post's bigger cap can push `TRIAL_INTERACTION_THRESHOLD` sooner, which ends the trial early by design; state it nowhere, it is the existing rule.
- **Webhook races.** Purchase applied to a post the member deleted or unfeatured in the meantime: the mutation stores the purchase and features nothing when deleted; refund by hand in Stripe. An erased author has no post: the handler logs and exits. Both are rare and visible in the audit log.
- **Failed or abandoned checkout.** Nothing happens; `cancel_url` returns to My Posts with no toast.
- **Apify refresh and the bonus.** `syncPosts.ts:187-190` caches the cap per author; the bonus is per post, so it must be added after the cache read, never cached with it.
- **Currency and tax.** $5 in the existing currency; Stripe Tax settings apply as they do for subscriptions. The price id lives in env, so the amount can change without a deploy.
- **Refund policy.** The Terms' no-refund line covers subscriptions; extend it to one-off purchases (human/legal, [[B31]]).
- **Landing.** Not in the first cut; the pricing section stays three cards ([[R13]]). Revisit once the add-on has a month of data.

## Docs to update

- `docs/PLATFORM.md` §5 (Data Model) — `posts.interactionCapBonus` and `posts.featuredPurchase`.
- `docs/PLATFORM.md` §8 (Subscriptions & Billing) — new subsection "Featured post add-on (one-time checkout)" with a Mermaid sequence (action → Stripe Checkout → webhook → `applyPurchasedFeature`), plus the `checkout.session.completed` row in the webhook table.
- `docs/PLATFORM.md` §9 (Plan Limits System) — the per-post cap is `interactionsPerPost + interactionCapBonus`.
- `docs/PLATFORM.md` §10 (Posts & Content Pipeline) — featured semantics: purchased posts, re-feature free, no quota write.
- `docs/PLATFORM.md` §11 (Feed & Engagement) — the cap flip reads the bonus at the three existing-post sites.
- `docs/PLATFORM.md` §13B (Privacy & Compliance) — purchase record on the post, invoice retained in Stripe.
- `docs/PLATFORM.md` §14 (BillingPage, MyPostsPage) — the three surfaces and the `?featured=paid&post=<id>` / `?feature=buy` params.
- `docs/PLATFORM.md` §16 (Environment Variables) — `STRIPE_FEATURED_POST_PRICE_ID`.
- `docs/PLATFORM.md` §21 mapping row for `billingNode.ts` and `http.ts`.

## References

- Related: [[R08]], [[R13]], [[R15]], [[R06]], [[B07]].
- Prior art / plan: `docs/superpowers/plans/2026-06-20-plan-2a-billing-checkout.md` (the subscription checkout this mirrors); memory `p1-backlog-execution` (B07 no-refund, tier defaults); memory `linkedin-api-access-constraints` (never promise an SSI move).
- Principle sources: [@richardrx · 2026-09-01](https://x.com/richardrx/status/2094769345821905094), [@richardrx · 2026-05-05](https://x.com/richardrx/status/2051672248348479691), [@richardrx · 2026-07-21](https://x.com/richardrx/status/2079592859003482207), [@richardrx · 2026-04-21](https://x.com/richardrx/status/2046544442216054981).
