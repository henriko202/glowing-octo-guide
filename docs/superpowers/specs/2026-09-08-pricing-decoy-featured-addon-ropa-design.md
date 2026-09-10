# Pricing decoy (R13), featured-post add-on (R17), ROPA reconciliation — design

**Date:** 2026-09-08 · **Status:** approved in chat, awaiting spec review · **Branch:** feat/initial-setup (uncommitted;
Henriko commits)

Source docs: `backlog/revenue/R13-pricing-decoy-and-monthly-visibility.md`,
`backlog/revenue/R17-buy-featured-posts.md`, `backlog/revenue/README.md` (rules block),
`docs/compliance/DATA-INVENTORY.md`. Both R docs' evidence line numbers are stale; this spec
names files and symbols, and the plan re-derives line numbers at execution time.

## 1. Scope

Three items, executed in this order:

1. **R13** — Starter $10 / $100 a year, monthly behind a low-emphasis link on the landing, one
   value axis on every plan card.
2. **R17** — buy a featured post for $5 through Stripe Checkout (`mode: 'payment'`), with a
   per-tier interaction-cap bonus stored on the post.
3. **ROPA** — reconcile `docs/compliance/DATA-INVENTORY.md` with the current schema and flows (docs only, runs last).

**Dropped:** "landing mobile hero fix". Verified 2026-09-07 in the browser at 375×812 in pt and
es with the cookie notice visible: no overlap. The memory note that listed it was stale; fix the
memory index in the final task.

**Out of scope:** the app Billing page's monthly/annual toggle (stays a pill; it defaults to annual
and is seeded from the landing choice already); a highlight ring on a just-added post; Enterprise
as a fourth card; a free plan; A/B price tests; any landing copy for R17; a `POLICY_VERSION` bump (launch-time rule).

## 2. Standing constraints (apply to every task)

- **Never run `git commit`, `git push`, `git stash`, `git checkout --`, `git reset` or any other
  git state change.** Henriko commits. A prior subagent ran `git stash` and stranded work.
- Change files only with the Edit and Write tools. Bash is for reading, tests, lint, build.
- `docs/PLATFORM.md` is updated in the same task as the code it describes (§21 mapping).
- pnpm only; convex CLI from the repo root; never `pnpm format` (Prettier owns code and config,
  humans own prose; `pnpm verify` runs `format:check`).
- i18n: three app locales (`app/src/i18n/locales/{en,pt,es}.json`) and three landing
  dictionaries (`landing/i18n/dictionaries/{en,pt,es}.json`) stay in exact key parity, same
  placeholder sets. pt is pt-BR, es is neutral Latin American, labels in sentence case. No parity
  test exists: verify by recursive key diff and report the counts (arrays-as-one and raw leaves).
- Copy states exact numbers from the plan limits, never "more reach". No fabricated proof, no
  struck-through "was" prices, no urgency. Upgrade first, add-on second, on every surface.
- Apify is dev-only and never appears in customer-facing or compliance copy.
- Stripe is the source of truth for what is charged; client price strings are labels.

## 3. R13 — pricing decoy and monthly visibility

### 3.1 Decisions (Henriko, 2026-09-07)

- Structure (a)+ (d): Starter **$10 / $100 yr**, Growth $15 / $150, Pro $50 / $500. Annual is
  the visible price; monthly sits behind a text link. Enterprise stays a text line.
- Value axis: **interactions counted per post** (25 / 50 / 200) leads every card.
- Growth and Pro cards gain a featured-posts line ("1 featured post a month", "3 featured posts a
  month"). Approved as the one copy addition.
- The app Billing toggle is unchanged (deliberate non-change).

Reasoning to record in PLATFORM §15: at $5 → $15 → $50 each step is ~3×, nothing reads as the
deal. At $10 → $15 → $50 the first step is 1.5× for double the cap, double the posts and a
featured post; the second is 3.3×. Growth is the deal by construction, not by the badge. Monthly
next to annual at equal weight anchors the eye on the smaller number, so monthly is a link.

### 3.2 Landing — `landing/components/Pricing.tsx`

- `MONTHLY_PRICES.starter` 5 → 10. `priceLabel` math unchanged (annual = monthly × 10;
  per-month = annual / 12), so "2 months free" stays true by construction.
- Remove the pill toggle. In its place, one centered text control: a `<button type="button">`
  styled as low-emphasis text (muted colour, underline on hover, visible focus ring, ≥44 px tap
  target on mobile) that flips the existing `annual` state. Label `pricing.seeMonthly` while
  annual shows, `pricing.seeAnnual` while monthly shows. No `aria-pressed`: the label itself
  states the destination.
- Each card, directly under the price block and above the feature list: one line `plan.axis`
  set brighter than the feature rows (`text-cream` vs the muted feature colour). The interactions
  line leaves the feature array.
- Feature arrays reordered by serial position: killer feature first, "Everything in X" in the
  middle, posts per week last (next to the CTA). Growth adds "1 featured post a month", Pro adds
  "3 featured posts a month" (placed after the "Everything in" line).
- CTA `href` keeps `?plan=<id>&interval=<annual|monthly>`; the §15 RefCarrier capture-phase click
  invariant is untouched. Trial note, subheadline, badge and Enterprise line unchanged.

### 3.3 Landing dictionaries — `landing/i18n/dictionaries/{en,pt,es}.json`

Keys under `pricing`:

- Remove `toggleAnnual`, `toggleAnnualSuffix`, `toggleMonthly`.
- Add `seeMonthly` (en: "Prefer to pay monthly? See monthly prices") and `seeAnnual`
  (en: "Back to annual · 2 months free").
- Add `plans.{starter,growth,pro}.axis` (en: "25 interactions counted per post", "50 …",
  "200 …").
- Edit the three `features` arrays as in 3.2.

`en.json` is the `Dictionary` type source (`landing/i18n/getDictionary.ts`), so all three files
change together; the landing build fails on drift. pt/es follow the locale rules in §2.

### 3.4 App

- `app/src/lib/planPrices.ts`: `PLAN_PRICES.monthly.starter = '$10/mo'`,
  `PLAN_PRICES.annual.starter = '$100/yr'`. This table feeds the plan grid, the card gate's
  no-trial price line and the upgrade-at-limit line, so no other price string changes.
- `billing.plans.{starter,growth,pro}.features` in the three app locales: reorder so the
  interactions line is first on each card. No wording change.
- New `app/src/lib/planPrices.test.ts`: for each plan, the annual label equals 10 × the monthly
  amount; Starter reads `$10/mo` and `$100/yr`. (Nothing guards the Starter price today.)

### 3.5 Backend and env

- No convex code change. `convex/lib/stripePrices.ts` maps env price ids to tiers and carries no
  amounts; trial emails quote the price from the Stripe snapshot; Stripe Checkout prints the
  post-trial amount beside the custom text, so R13 step 5 (first-charge disclosure) is already
  satisfied. `checkoutCopy.ts` is not touched.
- `convex/.env.local.example`: the Starter comment that mentions `$50/yr` → `$100/yr`.
- Manual (Henriko, per environment): create Stripe Prices Starter $10 monthly and $100 annual;
  repoint `STRIPE_STARTER_PRICE_ID`, `STRIPE_STARTER_ANNUAL_PRICE_ID` and the two `VITE_` copies.
  Listed in PLATFORM §8 under the existing "not yet applied" Dashboard steps.

### 3.6 Docs

- `docs/PLATFORM.md`: §1 tier table price row; §8 billing-intervals paragraph (landing link,
  Starter amounts, the manual Price step); §15 pricing paragraph rewritten plus a "Pricing
  structure and reasoning" block (decoy ratio, one axis, annual visible with monthly as a link,
  Enterprise as a line, app toggle unchanged); the two §15 mentions of the landing toggle; §16 env
  rows that quote `$50/yr`.
- `README.md` tier table: `Starter ($5/mo)` → `Starter ($10/mo)`.
- `backlog/revenue/R13-…md`: status DONE, decision recorded under "What we need to do" step 1,
  evidence lines corrected (`PLAN_PRICES` lives in `app/src/lib/planPrices.ts`, not BillingPage),
  acceptance boxes ticked. `backlog/revenue/README.md`: table status and suggested-order note.

### 3.7 Verification

- `pnpm --filter landing lint` and `pnpm --filter landing build` (12 SSG pages as today).
- App tests (`planPrices.test.ts`, BillingPage suite unchanged).
- Browser at 375 px in pt and es: link wraps without overflow, cards stack, no horizontal
  scroll; desktop: link centered where the toggle was.

## 4. R17 — buy a featured post

### 4.1 Decisions

- Purchase mechanics: Stripe Checkout `mode: 'payment'` + `checkout.session.completed` webhook (over an off-session
  PaymentIntent or an invoice item). Same customer id as the subscription so
  the saved card is offered; no field of ours.
- Cap bonus (Henriko, 2026-09-07): fixed per-tier table, **+25 / +50 / +100** → bought-post caps
  Starter 50, Growth 100, Pro 300. Contact 0 (nothing to buy).
- Order bump kept (Henriko, 2026-09-08): a message toast after a My Posts submit.
- A bought post that reaches its new cap flips again and receives the R20 cap notice again (a
  second real event at a new number, not a broadcast).
- No timeout on the "Confirming your payment" state: showing the buy button again before the
  webhook lands is how a member pays twice.
- Tier is read at fulfilment, not checkout. Metadata carries three strings only.

### 4.2 Data — `convex/schema.ts` (widen only, no backfill)

```
posts.interactionCapBonus: v.optional(v.number())
posts.featuredPurchase: v.optional(v.object({
  checkoutSessionId: v.string(),
  amountCents: v.number(),
  paidAt: v.number()
}))
```

`getMyPosts` returns whole documents, so both fields reach the client with no plumbing. Both
ride in the existing posts export and erasure; nothing joins `EXPORT_TABLES` or `OWNED`.

### 4.3 Constants and cap rule

- `convex/lib/planLimits.ts`: `export const FEATURED_CAP_BONUS: Record<Tier, number> =
  { starter: 25, growth: 50, pro: 100, contact: 0 }` beside `DEFAULTS`. One source for server and
  client (the app already imports from `convex/lib`).
- `convex/lib/interactionLimit.ts`: `export function effectiveInteractionCap(planCap: number,
  bonus: number | undefined): number` → `planCap + (bonus ?? 0)`. Existing helper signatures do
  not change.
- The three existing-post cap checks pass the effective cap instead of the bare plan cap:
    - `convex/interactions.ts` `flipCapIfReached` (`shouldFlipInteractionLimit(…)`), and its
      comment "a second email for the same post cannot happen" is corrected to describe the
      purchase reset.
    - `convex/jobs/syncPosts.ts` recompute after the per-author `capCache` read
      (`hasReachedInteractionLimit(u.likeCount, u.commentCount, cap)` → effective cap from the post
      being updated).
    - `convex/lib/recap.ts` near-cap filter (`isNearInteractionLimit(…, cap)`).
- Creation-time checks (`syncPosts.ts` insert path, `jobs/processQueue.ts`, `posts.ts`
  `submitPost`) stay as they are: a new post has no bonus.

### 4.4 Env and price id

- `STRIPE_FEATURED_POST_PRICE_ID` (convex env; one-time $5 Price per environment). Added to
  `convex/.env.local.example` and PLATFORM §16.
- `convex/lib/stripePrices.ts`: `export const FEATURED_POST_PRICE_ID =
  process.env.STRIPE_FEATURED_POST_PRICE_ID`. It is never added to `buildPriceMap`, so it can never
  resolve to a tier and never enters `ALLOWED_PRICE_IDS`.
- No `VITE_` copy: the client never names the price id.

### 4.5 Purchasability guard — `convex/lib/featuredPurchase.ts` (pure, tested)

```
export type FeaturedPurchaseBlocker = 'POST_NOT_FOUND' | 'ALREADY_PURCHASED' | 'NOTHING_TO_BUY'
export function featuredPurchaseBlocker(
  post: { authorId: string; deletedAt?: number; featuredPurchase?: unknown } | null,
  userId: string,
  limits: { featuredPerMonth: number }
): FeaturedPurchaseBlocker | null
```

Order: null, wrong owner or soft-deleted → `POST_NOT_FOUND` (no ownership leak); existing
`featuredPurchase` → `ALREADY_PURCHASED`; `isUnlimitedFeatured(limits.featuredPerMonth)` →
`NOTHING_TO_BUY`; else null. Same file:

```
export function isFeaturedPostCheckout(session: {
  mode?: string; payment_status?: string; metadata?: Record<string, string> | null
}): boolean
```

true only for `mode === 'payment'`, `payment_status === 'paid'`, `metadata.kind === 'featured_post'`.

`convex/posts.ts` gains `assertFeaturedPurchasable` (internalQuery, args `postId: v.id('posts')`,
`userId: v.id('users')`): loads the post and the author's limits through `getPlanLimitsHelper`,
runs the pure guard, throws `new ConvexError(code)` on a blocker, returns `null`.

### 4.6 Checkout — `convex/billingNode.ts`

`purchaseFeaturedPost` (action, `"use node"` file), args `{ sessionToken: v.string(),
postId: v.id('posts') }`, returns `{ url: string }`:

1. `requireAuthAction` → user.
2. `assertCanEngage(user)` (existing, `convex/lib/access.ts`): no card / past due reject with the
   existing `PAYMENT_REQUIRED:` code. Trialing members pass.
3. `if (!FEATURED_POST_PRICE_ID) throw new ConvexError('FEATURED_PRICE_UNSET')`.
4. `ctx.runQuery(internal.posts.assertFeaturedPurchasable, { postId, userId: user._id })`.
5. `stripeComponent.getOrCreateCustomer(ctx, { userId, email, name })` → `customerId` (same call
   as `createCheckoutSession`).
6. `stripe().checkout.sessions.create({ mode: 'payment', customer: customerId,
   line_items: [{ price: FEATURED_POST_PRICE_ID, quantity: 1 }],
   metadata: { kind: 'featured_post', convexUserId: user._id, postId },
   success_url: `${appUrl}/my-posts?featured=paid&post=${postId}`,
   cancel_url: `${appUrl}/my-posts`, locale: stripeCheckoutLocale(billingLocale) })`, with
   `appUrl` and `billingLocale` resolved exactly as `createCheckoutSession` does.
7. Return `{ url: session.url }`.

The server allows any eligible post at any time; the UI decides where to offer it. No new
client error copy: every new code is unreachable from the UI (the control is hidden in those
states), so `friendlyError` falls back to `myPosts.updateError`.

### 4.7 Webhook — `convex/http.ts`

Add `'checkout.session.completed'` to the existing `registerRoutes` `events` map, following the
five handlers' shape:

- `const s = event.data.object`; `if (!isFeaturedPostCheckout(s)) return` (subscription
  checkouts pass through untouched).
- `await ctx.runMutation(internal.posts.applyPurchasedFeature, { postId: s.metadata.postId,
  checkoutSessionId: s.id, amountCents: s.amount_total ?? 0, paidAt: eventCreatedMs })` —
  `postId` validated as `v.string()` and normalised inside the mutation so a malformed id logs and
  returns instead of failing validation (a thrown validator error would 500 and make Stripe retry
  forever). `metadata.convexUserId` is not passed: the author comes from the post, and the
  metadata field exists for support lookups in the Stripe Dashboard.

### 4.8 Fulfilment — `convex/posts.ts` `applyPurchasedFeature` (internalMutation)

1. `const postId = ctx.db.normalizeId('posts', args.postId)`; null → `console.error`, return.
2. Load the post; null → `console.error`, return.
3. `if (post.featuredPurchase) return` — one post is bought once, so any redelivery is a no-op.
4. `const purchase = { checkoutSessionId, amountCents, paidAt }`.
5. Soft-deleted post: `patch({ featuredPurchase: purchase })`, audit
   `post.featured_purchase_orphaned`, return (the invoice stays in Stripe; nothing is featured).
6. Otherwise: `author = db.get(post.authorId)`; `limits = getPlanLimitsHelper(ctx, author._id,
   author.tier ?? 'starter')`; `bonus = FEATURED_CAP_BONUS[tier]`;
   `reached = hasReachedInteractionLimit(post.likeCount, post.commentCount,
   effectiveInteractionCap(limits.interactionsPerPost, bonus))`;
   `patch({ isFeatured: true, featuredAt: now, interactionCapBonus: bonus,
   featuredPurchase: purchase, interactionLimitReached: reached,
   ...computeFeedFields({ …post fields, isFeatured: true, interactionLimitReached: reached }) })`.
7. `writeAuditLog(ctx.db, { actor: 'system', action: 'post.featured_purchased',
   targetUserId: author._id, metadata: JSON.stringify({ postId, checkoutSessionId, amountCents,
   bonus }) })`. No `featuredPostUsage` write.

`featurePost`: the monthly-quota read and the usage upsert are skipped when
`post.featuredPurchase` exists (re-featuring a bought post is free forever). `unfeaturePost`
unchanged. The cap flag on a bought post keeps counting against the effective cap through the
three sites in 4.3.

### 4.9 Frontend

**`app/src/lib/planPrices.ts`**: `export const FEATURED_POST_PRICE = '$5'` (display label; Stripe
charges the Price).

**Derived numbers on the client** (My Posts and Billing): `tier = me.tier ?? 'starter'`,
`cap = tierLimits[tier].interactionsPerPost`, `newCap = effectiveInteractionCap(cap,
FEATURED_CAP_BONUS[tier])`, both imported from `convex/lib`. A bought post's badge uses
`effectiveInteractionCap(cap, post.interactionCapBonus)`.

**My Posts (`app/src/pages/MyPostsPage.tsx`) — one `BuyFeaturedButton` component**

- Eligibility per card: `!post.featuredPurchase && !isUnlimitedFeatured(featuredPerMonth) &&
  !gated` (`useCardGate().gated`; the server would reject a gated member anyway).
- Placement, exactly two:
    1. Cap-badge row, when `post.interactionLimitReached`: after the existing `<UpgradeAtLimit
     limit="interactionCap" />` (upgrade first, add-on second). Lead line
       `myPosts.buyFeaturedCapped` with `{{cap}}` and `{{newCap}}`, then the control.
    2. Feature-button slot, when `!post.isFeatured && (featuredAtCap || buyMode)`: the disabled
       Feature button becomes the ghost button `myPosts.buyFeatured`.
- Under the control, visible text (never a tooltip): `myPosts.buyFeaturedHint` (numbers + no
  refund); when `useCardGate().isTrialing`, one more line `myPosts.buyFeaturedTrial`.
- Click: `captureEvent('featured_purchase_started', { source })` with `source` `'cap'` (placement
  1), `'billing'` (placement 2 while `buyMode`), else `'quota'`; then
  `await purchaseFeaturedPost({ sessionToken, postId })` and `window.location.assign(url)`.
  Errors → `setActionError(friendlyError(err, t('myPosts.updateError')))` (existing banner).
- **Buy mode:** `?feature=buy` read once at render, stripped with `setSearchParams({}, { replace:
  true })`, latched in state for the visit (BillingPage's one-shot pattern). While set, placement
  2 shows on every eligible unfeatured post.
- **Return leg:** `?featured=paid&post=<id>` read once and stripped; `captureEvent(
  'featured_purchase_completed')` once (useRef latch); `toast(t('myPosts.featuredPaidToast',
  { newCap }))`; `confirmingPostId` state = `<id>`. While `confirmingPostId === post._id &&
  !post.featuredPurchase`, that card shows `myPosts.confirmingPayment` in place of any buy or
  Feature control. No timeout; clears when the reactive document carries the purchase or on
  reload.
- **Paid badge:** when `post.featuredPurchase`, the star badge reads `myPosts.featuredPaidBadge`
  with `{{cap}}` = effective cap for that post, replacing the plain featured badge.
- **Order bump:** in `handleSubmit`, after `await submitPost(...)` resolves:
  `toast(t(featuredAtCap ? 'myPosts.postAddedBuy' : 'myPosts.postAddedFeature', { price }))`.
  No action in the toast; the just-added card carries the control. Feed and first-post submits
  unchanged.

**`app/src/components/UpgradeAtLimit.tsx`**: when `limit === 'featured'` and the tier is not
unlimited, a second, quieter line `upgrade.featuredAddon` under the upgrade sentence (plain
text, no link: the cards are below). Only My Posts renders `limit="featured"`.

**`app/src/pages/BillingPage.tsx`**: one line under the plan grid, above "Need more?":
`billing.featuredAddon` (price + `newCap`) and a `<Link to="/my-posts?feature=buy">`
labelled `billing.featuredAddonCta`. Hidden when `isUnlimitedFeatured` for the member's tier or
`useCardGate().gated`. No event on this click (the purchase event fires on the card with
`source: 'billing'`).

**PostHog:** `featured_purchase_started { source }`, `featured_purchase_completed`. Named events
15 → 17 (list in PLATFORM §14).

### 4.10 Copy — twelve keys in `app/src/i18n/locales/{en,pt,es}.json` (en shown)

| Key                         | en                                                                                                       |
|-----------------------------|----------------------------------------------------------------------------------------------------------|
| `myPosts.buyFeatured`       | Feature for {{price}}                                                                                    |
| `myPosts.buyFeaturedHint`   | Once, this post only. Room for {{newCap}} interactions. No refund if you unfeature it.                   |
| `myPosts.buyFeaturedTrial`  | Charged today, separate from your trial.                                                                 |
| `myPosts.buyFeaturedCapped` | Reached {{cap}} and left the feed. Featured, it comes back at the top with room for {{newCap}}.          |
| `myPosts.featuredPaidBadge` | Featured · paid · cap {{cap}}                                                                            |
| `myPosts.featuredPaidToast` | Paid. Your post is featured with room for {{newCap}} interactions.                                       |
| `myPosts.confirmingPayment` | Confirming your payment…                                                                                 |
| `myPosts.postAddedBuy`      | Post added. Feature it for {{price}} below.                                                              |
| `myPosts.postAddedFeature`  | Post added. Feature it below.                                                                            |
| `upgrade.featuredAddon`     | Or feature any post below for {{price}}, once.                                                           |
| `billing.featuredAddon`     | Featured post add-on · {{price}} each · one post pinned at the top with room for {{newCap}} interactions |
| `billing.featuredAddonCta`  | Pick a post                                                                                              |

App locales: 387 raw leaves → 399 (arrays-as-one 377 → 389). pt-BR and es per §2.

### 4.11 Privacy

One sentence appended to the "Billing" paragraph of `landing/app/[lang]/privacy/content/
{en,pt,es}.tsx`: one-off purchases (a featured post) are charged by Stripe and appear on your
Stripe receipt; we store the purchase record on the post. No `POLICY_VERSION` bump.

### 4.12 Edge cases

| Case                                           | Behaviour                                                                                                                                                                                                                                                                                                                                                      |
|------------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Stripe redelivers `checkout.session.completed` | `applyPurchasedFeature` returns on an existing `featuredPurchase`                                                                                                                                                                                                                                                                                              |
| Member reloads before the webhook lands        | The confirming state is per-visit, so after a reload the buy control shows again until the purchase lands (seconds). A second Checkout is possible only in that window and only by completing Stripe's page again; after fulfilment the server's `ALREADY_PURCHASED` guard blocks it. Accepted; this is why the confirming state has no timeout within a visit |
| Post deleted between checkout and webhook      | Purchase stored, nothing featured, audit `post.featured_purchase_orphaned`                                                                                                                                                                                                                                                                                     |
| Metadata id malformed or post missing          | Logged, 200 returned, no retry storm                                                                                                                                                                                                                                                                                                                           |
| Tier changes between checkout and webhook      | Bonus from the tier at fulfilment                                                                                                                                                                                                                                                                                                                              |
| Bought post reaches its new cap                | Flips again, R20 notice sent again (decision 4.1)                                                                                                                                                                                                                                                                                                              |
| Contact tier / unlimited featured              | Server `NOTHING_TO_BUY`; every surface hidden                                                                                                                                                                                                                                                                                                                  |
| Card-gated or past-due member                  | Server `PAYMENT_REQUIRED:`; every surface hidden                                                                                                                                                                                                                                                                                                               |
| `STRIPE_FEATURED_POST_PRICE_ID` unset          | Server `FEATURED_PRICE_UNSET`; client shows the generic error banner                                                                                                                                                                                                                                                                                           |
| Unfeature then re-feature a bought post        | Free, no quota row                                                                                                                                                                                                                                                                                                                                             |

### 4.13 Tests

Convex (colocated `*.test.ts`, mocked `convex/server` per repo convention):

- `lib/interactionLimit.test.ts`: `effectiveInteractionCap` (undefined bonus → plan cap).
- `lib/featuredPurchase.test.ts`: every blocker branch and the null case; `isFeaturedPostCheckout`
  rejects subscription mode, unpaid, wrong kind, missing metadata; accepts the valid shape.
- `lib/planLimits.test.ts`: `FEATURED_CAP_BONUS` ladder — `DEFAULTS[t].interactionsPerPost +
  FEATURED_CAP_BONUS[t] <= DEFAULTS[nextTier(t)].interactionsPerPost` for starter and growth (Pro excluded: Contact is
  per-user custom).
- `posts.test.ts`: `applyPurchasedFeature` with a mock ctx — redelivery no-op; deleted post stores
  the purchase and features nothing; a Starter post capped at 25 with 30 interactions comes back
  `inFeed` at cap 50 with `interactionCapBonus: 25`; no `featuredPostUsage` insert; audit row
  written. `featurePost` on a purchased post reads no quota.

App (colocated `*.test.tsx`):

- `MyPostsPage.test.tsx`: control shown in the Feature slot at the quota cap; capped post shows
  the capped copy with 25 and 50; hidden for contact, for a bought post, and when card-gated;
  `?feature=buy` shows the control on an eligible card and strips the param; `?featured=paid&post=`
  shows the toast once, the confirming state on that card, and strips the params; paid badge names
  the effective cap; order-bump toast text for both quota states; `featured_purchase_started`
  carries the right `source`.
- `UpgradeAtLimit.test.tsx`: add-on line present for growth at the featured cap, absent for contact.
- `BillingPage.test.tsx` (existing suite, extend): add-on line and link present for growth, absent
  for contact, absent when gated.
- `planPrices.test.ts`: `FEATURED_POST_PRICE === '$5'`.

### 4.14 Docs

`docs/PLATFORM.md`: §5 posts fields (`interactionCapBonus`, `featuredPurchase`); §8 new
subsection "Featured post add-on (one-time Checkout)" with a Mermaid sequence (member → My Posts →
`purchaseFeaturedPost` → Stripe Checkout → `checkout.session.completed` → `applyPurchasedFeature`
→ reactive badge), the webhook table row, and the manual Dashboard step; §9 effective cap and the
bonus table; §10 purchased posts, free re-feature, no quota; §11 the three cap sites and the
second-notice rule; §13B purchase record deleted with the post at erasure, invoice retained in
Stripe; §14 My Posts surfaces, both params, the order bump, the Billing and UpgradeAtLimit lines,
PostHog list 17; §16 env row plus the §8 price-id paragraph and the §16 allowlist note, both
stating that the featured price never enters `buildPriceMap` or `ALLOWED_PRICE_IDS`; §21 mapping
rows.

`backlog/revenue/R17-…md`: status DONE, decisions (bonus table, Checkout mode, second notice,
order bump kept, no confirming timeout), evidence corrected (`flipCapIfReached` is one helper so
two existing-post sites plus the recap filter; checkout metadata precedent; `BillingPage.test.tsx`
exists — extend, not create; pill moved to `PlanUsagePills.tsx`), acceptance boxes ticked.
`backlog/revenue/README.md`: table status; the "no upgrade emails" rule already carries the
event-notice carve-out that covers the second cap notice.

## 5. ROPA reconciliation — `docs/compliance/DATA-INVENTORY.md`

Docs-only, runs last so it sees R17's fields.

**Method:** diff every table and field in `convex/schema.ts`, every email sender (the callers of
`convex/lib/email.ts`: `lib/billingEmails.ts`, `notifications.ts`, `feedback/emails.ts`,
`privacy/emails.ts`), every PostHog event in `app/src`, and every admin surface in PLATFORM §13
against the data elements listed per activity. Add what is missing under the matching activity (or a new numbered
activity when no existing one fits, following the file's own template).
Remove nothing without a code citation showing the element is gone. No legal claims, no
retention periods that the code does not enforce, DRAFT banner kept, "Last updated" → 2026-09-08.
Apify never appears.

**Known gaps to close:** admin `motds` and `appSettings`; users' invite fields (R19
`inviteCode` / `referredByCode`) and `chosenPlan`; `subscriptions` stamps (`lastEventAt`,
`stripeCreated`, price snapshot / interval); the `cancellation` feedback category; trial reminder,
`trial_converted` and R20 cap emails under the email activity; `userPostState.hiddenAt` (R21); the
interaction log as the source of Recap and History (R15/R16); R18 admin survival aggregates as
derived, unstored data; the 17 PostHog named events under analytics; R17 `posts.featuredPurchase`
and one-off payments under billing. The reconciling agent reports every element it added or
could not place.

## 6. Verification gates (all must pass before "done")

1. `pnpm verify` — format check, lint, typecheck, app and convex tests.
2. `pnpm --filter landing lint` and `pnpm --filter landing build` — 12 SSG pages.
3. Locale parity by recursive key diff + placeholder sets: app en/pt/es and landing en/pt/es.
   Report counts (arrays-as-one and raw leaves).
4. Browser at 375 px, pt and es: landing pricing section. The app's buy control gets the same
   pass only if a Convex dev backend is available for the app server; otherwise say so and rely
   on the tests.

## 7. Execution plan (subagent-driven; implementer + reviewer per task)

| # | Task                   | Files                                                                                                                                                                                                                                                                                                                        | Agent notes                                                                                                                                         |
|---|------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------|
| 1 | R13 landing            | `landing/components/Pricing.tsx`, `landing/i18n/dictionaries/{en,pt,es}.json`                                                                                                                                                                                                                                                | UI subagent loads `/responsive-design`, `/frontend-design:frontend-design`, `/web-design-guidelines`, `/ui-ux-pro-max`; lint + build + browser pass |
| 2 | R13 app + docs         | `app/src/lib/planPrices.ts` (+ test), app locales ×3, `convex/.env.local.example`, `README.md`, PLATFORM §1/§8/§15/§16, backlog R13 + README                                                                                                                                                                                 | app tests                                                                                                                                           |
| 3 | R17 backend core       | `convex/schema.ts`, `convex/lib/planLimits.ts` (+ test), `convex/lib/interactionLimit.ts` (+ test), `convex/interactions.ts`, `convex/jobs/syncPosts.ts`, `convex/lib/recap.ts`, `convex/lib/featuredPurchase.ts` (+ test), `convex/posts.ts` (`assertFeaturedPurchasable`, `applyPurchasedFeature`, `featurePost`; + tests) | convex tests                                                                                                                                        |
| 4 | R17 checkout + webhook | `convex/lib/stripePrices.ts`, `convex/billingNode.ts`, `convex/http.ts`, `convex/.env.local.example`, PLATFORM §8/§16/§21                                                                                                                                                                                                    | typecheck; no action/http tests (repo convention)                                                                                                   |
| 5 | R17 frontend           | `app/src/lib/planPrices.ts` (+ test), `app/src/pages/MyPostsPage.tsx` (+ test), `app/src/components/UpgradeAtLimit.tsx` (+ test), `app/src/pages/BillingPage.tsx` (+ test), app locales ×3                                                                                                                                   | UI subagent with the four design skills; app tests; locale parity                                                                                   |
| 6 | R17 docs + privacy     | PLATFORM §5/§9/§10/§11/§13B/§14, `landing/app/[lang]/privacy/content/{en,pt,es}.tsx`, backlog R17 + README                                                                                                                                                                                                                   | landing build                                                                                                                                       |
| 7 | ROPA                   | `docs/compliance/DATA-INVENTORY.md`                                                                                                                                                                                                                                                                                          | docs-only agent; reports additions                                                                                                                  |
| 8 | Final                  | gates §6, whole-batch review (code + revenue rules), fix wave, memory index fixes (webhook ordering DONE, AI gating DONE, landing Plan 2 DONE, hero overlap does not reproduce)                                                                                                                                              | no commit                                                                                                                                           |

Subagent rules, verbatim in every prompt: no git state changes; Edit/Write for file changes;
never `pnpm format`; pnpm from the repo root; report test output faithfully.

## 8. Manual steps for Henriko (recorded in PLATFORM §8 as "not yet applied")

1. Per environment: Stripe Prices Starter $10 monthly and $100 annual; repoint
   `STRIPE_STARTER_PRICE_ID`, `STRIPE_STARTER_ANNUAL_PRICE_ID`, `VITE_STRIPE_STARTER_PRICE_ID`,
   `VITE_STRIPE_STARTER_ANNUAL_PRICE_ID`.
2. Per environment: one-time $5 Price "Featured post"; set `STRIPE_FEATURED_POST_PRICE_ID`.
3. Confirm the webhook endpoint delivers `checkout.session.completed` if it filters events.
4. The three Customer Portal rows already listed in §8.
