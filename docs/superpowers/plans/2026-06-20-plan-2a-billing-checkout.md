# Plan 2A — Billing & Checkout (Annual + Card-Required Trial + Promo Codes)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:
> executing-plans. Steps use checkbox (`- [ ]`) tracking.

**Goal:** Make the Stripe integration support (1) **annual** billing alongside monthly, (2) a **card-required 7-day
trial** at checkout, and (3) **promotion codes** (for the founder's manual free-month campaign) — and keep Apify dormant
on activation. This is the billing foundation that **Plan 2B** (trial gate + feed reciprocity + in-app progress) builds
on.

**Architecture:** `@convex-dev/stripe@0.1.4`'s `createCheckoutSession` accepts no trial / promo / card params (verified
in its `.d.ts`). So checkout moves to a **direct Stripe Node SDK** call in a new `"use node"` Convex action, while the
component still handles the **customer** (`getOrCreateCustomer`) and **webhook sync**. The 7-day Stripe trial is the "7
days" half of Plan 2B's "50 interactions OR 7 days" gate; an `endTrialEarly` action (also direct SDK) lets 2B bill early
at 50 interactions. Promo codes ride on Stripe's hosted-checkout `allow_promotion_codes` — no coupon system is built.

**Tech Stack:** Convex (TS), `@convex-dev/stripe@0.1.4`, the `stripe` Node SDK (direct), React 19 + Vite (app). Package
manager **pnpm**.

**Design source:** [spec §6](../specs/2026-06-20-landing-conversion-redesign-design.md) · **Backend maps:** this plan
was written from a full read of `convex/billing.ts`, `convex/stripe.ts`, `convex/http.ts`, `convex/lib/apify.ts`, and
`app/src/pages/BillingPage.tsx`.

## Global Constraints

- **NEVER commit.** Agent edits files only; Henriko commits at each checkpoint. No `git commit`/`push`/`add`.
- **Keep Apify dormant.** The only billing→Apify trigger is `syncUserSubscription` (stripe.ts). Any activation path MUST
  be gated by the existing `isApifyPostSyncEnabled(settings)` helper (`convex/lib/apify.ts`).
- **No auto-coupon.** The free month is a **manual Stripe promotion-code campaign Henriko runs**. We only enable
  `allow_promotion_codes`; we never create or auto-apply coupons.
- **Annual = monthly × 10** (2 months free): Starter $50/yr, Growth $150/yr, Pro $500/yr. (Display strings only; the
  real amounts live in the Stripe annual Prices.)
- **Trial = 7-day Stripe trial, card required** (`trial_period_days: 7`, `payment_method_collection: 'always'`).
- **Pure logic gets a unit test** (project convention: Vitest, mock `convex/server`, test pure functions only — no
  `convex-test`). Convex actions/mutations are verified by typecheck + Stripe **test-mode** manual check.
- **Secrets:** `STRIPE_SECRET_KEY` is read from `process.env` inside the node action — never logged, never returned.

### Verification commands

```bash
pnpm --filter convex exec tsc --noEmit -p tsconfig.json   # convex typecheck
pnpm --filter app exec tsc --noEmit                        # app typecheck
pnpm -r test                                               # vitest (pure-logic tests)
pnpm lint                                                  # eslint . --max-warnings 0
# Manual: with Stripe TEST keys + a test annual Price, run the app, click Upgrade (annual),
# confirm the hosted checkout shows a card field, a 7-day trial, and a "promotion code" link.
```

---

## File Structure

| Action | Path                                   | Responsibility                                                                                                      |
|--------|----------------------------------------|---------------------------------------------------------------------------------------------------------------------|
| Create | `convex/lib/stripePrices.ts`           | Pure: build priceId→tier map from env (monthly + annual), `ALLOWED_PRICE_IDS`, `getTierFromPriceId`                 |
| Create | `convex/lib/stripePrices.test.ts`      | Unit tests for the pure mapping                                                                                     |
| Modify | `convex/stripe.ts`                     | Drop local `getTierFromPriceId` (import from lib); gate the activation Apify schedule with `isApifyPostSyncEnabled` |
| Modify | `convex/http.ts`                       | Import `getTierFromPriceId` from `./lib/stripePrices` (was `./stripe`)                                              |
| Create | `convex/billingNode.ts`                | `"use node"`: direct-SDK `createCheckoutSession` (trial+card+promo) and `endTrialEarly` internalAction              |
| Modify | `convex/billing.ts`                    | Remove `createCheckoutSession` + `ALLOWED_PRICE_IDS` (moved); keep `createPortalSession` + `setStripeCustomerId`    |
| Modify | `convex/package.json`                  | Add the `stripe` dependency                                                                                         |
| Modify | `app/src/pages/BillingPage.tsx`        | Monthly/annual toggle; annual price IDs; call `api.billingNode.createCheckoutSession`                               |
| Modify | `app/src/i18n/locales/{en,pt,es}.json` | Toggle + billing strings                                                                                            |
| Modify | `docs/PLATFORM.md`                     | §8 + §16: annual price IDs, card-required trial, promo codes, Apify guard                                           |

---

## Task 1: Pure price-ID module (+ tests)

**Files:** Create `convex/lib/stripePrices.ts`, `convex/lib/stripePrices.test.ts`

**Interfaces — Produces:**

- `buildPriceMap(env): Record<string, Tier>` (pure)
- `resolveTier(map, priceId): Tier` (pure)
- `ALLOWED_PRICE_IDS: Set<string>` (built from `process.env`)
- `getTierFromPriceId(priceId: string): Tier` (uses module map)
- `type Tier = 'starter' | 'growth' | 'pro'`

- [ ] **Step 1: Write the failing test** — `convex/lib/stripePrices.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { buildPriceMap, resolveTier } from './stripePrices'

const ENV = {
  STRIPE_STARTER_PRICE_ID: 'price_s_m',
  STRIPE_GROWTH_PRICE_ID: 'price_g_m',
  STRIPE_PRO_PRICE_ID: 'price_p_m',
  STRIPE_STARTER_ANNUAL_PRICE_ID: 'price_s_y',
  STRIPE_GROWTH_ANNUAL_PRICE_ID: 'price_g_y',
  STRIPE_PRO_ANNUAL_PRICE_ID: 'price_p_y'
}

describe('stripePrices', () => {
  it('maps every monthly and annual id to its tier', () => {
    const map = buildPriceMap(ENV)
    expect(resolveTier(map, 'price_s_m')).toBe('starter')
    expect(resolveTier(map, 'price_g_y')).toBe('growth')
    expect(resolveTier(map, 'price_p_y')).toBe('pro')
  })

  it('defaults unknown or blank ids to starter', () => {
    const map = buildPriceMap(ENV)
    expect(resolveTier(map, 'price_unknown')).toBe('starter')
    expect(resolveTier(map, '')).toBe('starter')
  })

  it('omits unset env vars from the map (no blank-key collision)', () => {
    const map = buildPriceMap({ STRIPE_GROWTH_PRICE_ID: 'price_g_m' })
    expect(Object.keys(map)).toEqual(['price_g_m'])
    expect(map['']).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run it — expect FAIL** (`pnpm -r test` → "Cannot find module './stripePrices'").

- [ ] **Step 3: Implement** — `convex/lib/stripePrices.ts`

```ts
// Single source of truth: Stripe price IDs (monthly + annual) → our tier.
// Pure helpers (buildPriceMap/resolveTier) are unit-tested; the module-level
// ALLOWED_PRICE_IDS / getTierFromPriceId read process.env once at load.
export type Tier = 'starter' | 'growth' | 'pro'

type Env = Record<string, string | undefined>

export function buildPriceMap(env: Env): Record<string, Tier> {
  const map: Record<string, Tier> = {}
  const add = (id: string | undefined, tier: Tier) => {
    if (id) map[id] = tier
  }
  add(env.STRIPE_STARTER_PRICE_ID, 'starter')
  add(env.STRIPE_GROWTH_PRICE_ID, 'growth')
  add(env.STRIPE_PRO_PRICE_ID, 'pro')
  add(env.STRIPE_STARTER_ANNUAL_PRICE_ID, 'starter')
  add(env.STRIPE_GROWTH_ANNUAL_PRICE_ID, 'growth')
  add(env.STRIPE_PRO_ANNUAL_PRICE_ID, 'pro')
  return map
}

export function resolveTier(map: Record<string, Tier>, priceId: string): Tier {
  if (!priceId || !(priceId in map)) {
    console.error(`resolveTier: unknown/blank priceId "${priceId}" — defaulting to starter`)
    return 'starter'
  }
  return map[priceId]
}

const PRICE_MAP = buildPriceMap(process.env)
export const ALLOWED_PRICE_IDS = new Set(Object.keys(PRICE_MAP))
export function getTierFromPriceId(priceId: string): Tier {
  return resolveTier(PRICE_MAP, priceId)
}
```

- [ ] **Step 4: Run it — expect PASS** (`pnpm -r test`).

- [ ] **Step 5: Checkpoint** — ready to commit (`feat(billing): pure stripe price→tier map with monthly+annual`).

---

## Task 2: Rewire `getTierFromPriceId` to the shared module

**Files:** Modify `convex/stripe.ts`, `convex/http.ts`

- [ ] **Step 1: stripe.ts** — delete the local `function getTierFromPriceId(...)` (the block currently at lines ~38–50)
  **and** the `export { getTierFromPriceId }` line at the bottom. (`stripe.ts` itself does not call it — only `http.ts`
  does.)

- [ ] **Step 2: http.ts** — change the import so `getTierFromPriceId` comes from the shared module. Find the existing
  import (near the top, currently `import { ... getTierFromPriceId } from './stripe'` or a dedicated import) and repoint
  it:

```ts
import { getTierFromPriceId } from './lib/stripePrices'
```

(Leave the `internal.stripe.syncUserSubscription` references as-is — those still live in `stripe.ts`.)

- [ ] **Step 3: Verify** — `pnpm --filter convex exec tsc --noEmit -p tsconfig.json` (0 errors; catches any dangling
  import).

- [ ] **Step 4: Checkpoint** — (`refactor(billing): single-source getTierFromPriceId`).

---

## Task 3: Gate the activation Apify schedule (keep Apify dormant)

**Files:** Modify `convex/stripe.ts`

The only billing→Apify trigger is in `syncUserSubscription`. Wrap it in the existing kill-switch.

- [ ] **Step 1: Add the import** (top of `stripe.ts`):

```ts
import { isApifyPostSyncEnabled, type ApifyFlags } from './lib/apify'
```

- [ ] **Step 2: Replace the activation block.** Find (currently ~lines 83–88):

```ts
    // Trigger immediate post fetch when subscription becomes active
    if (becameActive) {
      await ctx.scheduler.runAfter(0, internal.jobs.syncPostsApify.syncUserPostsViaApify, {
        userId: user._id
      })
    }
```

Replace with:

```ts
    // Trigger immediate post fetch when subscription becomes active — ONLY if Apify is enabled.
    // Apify is dormant at launch (compliance gate); this guard prevents re-enabling it via billing.
    if (becameActive) {
      const settings = await ctx.db.query('appSettings').first()
      if (isApifyPostSyncEnabled(settings as ApifyFlags)) {
        await ctx.scheduler.runAfter(0, internal.jobs.syncPostsApify.syncUserPostsViaApify, {
          userId: user._id
        })
      }
    }
```

- [ ] **Step 3: Verify** — convex typecheck passes.

- [ ] **Step 4: Checkpoint** — (`fix(billing): gate activation Apify sync behind dormant kill-switch`).

---

## Task 4: Add the `stripe` SDK dependency to convex

**Files:** Modify `convex/package.json`

The direct SDK (Task 5) needs `stripe` as a first-party dependency (it's currently only transitive via the component).

- [ ] **Step 1: Install** (pins the version compatible with `@convex-dev/stripe`):

```bash
pnpm --filter convex add stripe
```

- [ ] **Step 2: Verify** — `convex/package.json` lists `stripe` under `dependencies`;
  `pnpm --filter convex exec tsc --noEmit -p tsconfig.json` still passes.

- [ ] **Step 3: Checkpoint** — (`chore(convex): add stripe SDK dependency`).

---

## Task 5: Direct-SDK checkout + early-trial-end (`"use node"`)

**Files:** Create `convex/billingNode.ts`

**Interfaces — Produces:**

- `api.billingNode.createCheckoutSession({ priceId, sessionToken }) → { url }` (public action)
- `internal.billingNode.endTrialEarly({ stripeSubscriptionId })` (internalAction; Plan 2B calls this when the
  50-interaction milestone fires)
- **Consumes:** `internal.billing.setStripeCustomerId` (stays in `billing.ts`), `ALLOWED_PRICE_IDS` (Task 1)

- [ ] **Step 1: Create the file**

```ts
'use node'
import Stripe from 'stripe'
import { action, internalAction } from './_generated/server'
import { v } from 'convex/values'
import { components, internal } from './_generated/api'
import { StripeSubscriptions } from '@convex-dev/stripe'
import { requireAuthAction } from './lib/auth'
import { ALLOWED_PRICE_IDS } from './lib/stripePrices'

const stripeComponent = new StripeSubscriptions(components.stripe, {})

function stripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('STRIPE_SECRET_KEY is not configured')
  return new Stripe(key)
}

const TRIAL_PERIOD_DAYS = 7

// Card-required 7-day trial checkout. The component's createCheckoutSession can't set a
// trial / card-collection / promo codes, so we call the Stripe SDK directly here. The
// component still owns the customer record and webhook sync.
export const createCheckoutSession = action({
  args: { priceId: v.string(), sessionToken: v.string() },
  handler: async (ctx, { priceId, sessionToken }) => {
    if (!ALLOWED_PRICE_IDS.has(priceId)) throw new Error('Invalid price ID')

    const user = await requireAuthAction(ctx, sessionToken)
    if (!user) throw new Error('User not found')

    const customer = await stripeComponent.getOrCreateCustomer(ctx, {
      userId: user._id,
      email: user.email,
      name: user.name
    })

    const appUrl = process.env.APP_URL ?? 'http://localhost:5173'

    const session = await stripe().checkout.sessions.create({
      mode: 'subscription',
      customer: customer.customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        trial_period_days: TRIAL_PERIOD_DAYS,
        metadata: { convexUserId: user._id }
      },
      payment_method_collection: 'always', // card required even during the trial
      allow_promotion_codes: true, // manual free-month campaign codes (Henriko-managed)
      success_url: `${appUrl}/billing?success=true`,
      cancel_url: `${appUrl}/billing`
    })

    if (!user.stripeCustomerId) {
      await ctx.runMutation(internal.billing.setStripeCustomerId, {
        userId: user._id,
        stripeCustomerId: customer.customerId
      })
    }

    return { url: session.url }
  }
})

// Ends the Stripe trial now → billing starts immediately. Plan 2B schedules this when a
// trialing user reaches 50 combined interactions before the 7-day trial elapses.
export const endTrialEarly = internalAction({
  args: { stripeSubscriptionId: v.string() },
  handler: async (_ctx, { stripeSubscriptionId }) => {
    await stripe().subscriptions.update(stripeSubscriptionId, { trial_end: 'now' })
  }
})
```

- [ ] **Step 2: Verify** — `pnpm --filter convex exec tsc --noEmit -p tsconfig.json` (0 errors). Confirm Convex accepts
  the `"use node"` file (`npx convex dev` compiles it without a runtime error — Henriko runs convex dev).

- [ ] **Step 3: Checkpoint** — (`feat(billing): card-required trial checkout + endTrialEarly via Stripe SDK`).

---

## Task 6: Trim `billing.ts` (checkout moved out)

**Files:** Modify `convex/billing.ts`

- [ ] **Step 1:** Delete the `ALLOWED_PRICE_IDS` const (lines ~12–16) and the entire `createCheckoutSession` action (
  lines ~18–62). **Keep** `createPortalSession` and `setStripeCustomerId`, and the `stripeClient` + imports they use (
  `StripeSubscriptions`, `requireAuthAction`, `action`, `internalMutation`, `components`, `internal`, `v`). Remove any
  import left unused after the deletion (let `pnpm lint` flag them).

- [ ] **Step 2: Verify** — convex typecheck + `pnpm lint` (0 unused-import warnings).

- [ ] **Step 3: Checkpoint** — (`refactor(billing): move checkout to billingNode, keep portal`).

---

## Task 7: App — annual/monthly toggle + new checkout action

**Files:** Modify `app/src/pages/BillingPage.tsx`, `app/src/i18n/locales/{en,pt,es}.json`

- [ ] **Step 1: BillingPage.tsx** — replace the price-id/price maps and the checkout hook, and add an interval toggle.
  Concretely:

Replace the `PLAN_PRICE_IDS` + `PLAN_PRICES` consts (lines ~11–21) with:

```tsx
type Interval = 'monthly' | 'annual'

const PLAN_PRICE_IDS: Record<Interval, Record<string, string | undefined>> = {
  monthly: {
    starter: import.meta.env.VITE_STRIPE_STARTER_PRICE_ID as string | undefined,
    growth: import.meta.env.VITE_STRIPE_GROWTH_PRICE_ID as string | undefined,
    pro: import.meta.env.VITE_STRIPE_PRO_PRICE_ID as string | undefined
  },
  annual: {
    starter: import.meta.env.VITE_STRIPE_STARTER_ANNUAL_PRICE_ID as string | undefined,
    growth: import.meta.env.VITE_STRIPE_GROWTH_ANNUAL_PRICE_ID as string | undefined,
    pro: import.meta.env.VITE_STRIPE_PRO_ANNUAL_PRICE_ID as string | undefined
  }
}

const PLAN_PRICES: Record<Interval, Record<string, string>> = {
  monthly: { starter: '$5/mo', growth: '$15/mo', pro: '$50/mo' },
  annual: { starter: '$50/yr', growth: '$150/yr', pro: '$500/yr' }
}
```

Change the checkout hook (line ~33) from `api.billing.createCheckoutSession` to:

```tsx
const createCheckout = useAction(api.billingNode.createCheckoutSession)
```

Add interval state inside the component (near the other `useState`):

```tsx
const [interval, setInterval] = useState<Interval>('annual') // default annual
```

Add a toggle above the plans grid (before the `<div className="grid ...">` at line ~127):

```tsx
<div className="mb-4 inline-flex items-center gap-2 rounded-full border p-1 text-sm">
  <button
    onClick={() => setInterval('annual')}
    className={`rounded-full px-3 py-1 ${interval === 'annual' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
  >
    {t('billing.annual')}
  </button>
  <button
    onClick={() => setInterval('monthly')}
    className={`rounded-full px-3 py-1 ${interval === 'monthly' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
  >
    {t('billing.monthly')}
  </button>
</div>
```

In the plans map (line ~131), read price id + display price by interval:

```tsx
const priceId = PLAN_PRICE_IDS[interval][planId]
// ...
<p className="text-foreground my-2 text-2xl font-bold">{PLAN_PRICES[interval][planId]}</p>
```

- [ ] **Step 2: i18n** — add to each of `en.json`, `pt.json`, `es.json` under the `billing` object:

```jsonc
// en.json
"annual": "Annual · 2 months free",
"monthly": "Monthly",
// pt.json
"annual": "Anual · 2 meses grátis",
"monthly": "Mensal",
// es.json
"annual": "Anual · 2 meses gratis",
"monthly": "Mensual",
```

- [ ] **Step 3: Verify** — `pnpm --filter app exec tsc --noEmit` (0 errors), `pnpm --filter app build`, `pnpm lint`.
  Manually: toggle defaults to Annual; switching shows `$150/yr` ↔ `$15/mo` for Growth; Upgrade routes to Stripe
  checkout.

- [ ] **Step 4: Checkpoint** — (`feat(billing): annual/monthly toggle wired to billingNode checkout`).

---

## Task 8: Env vars + docs

**Files:** Modify `docs/PLATFORM.md` (§8 and §16), and any `.env.example` that lists `STRIPE_*_PRICE_ID` /
`VITE_STRIPE_*_PRICE_ID`.

- [ ] **Step 1:** Document the **six new env vars** (Henriko creates the annual Prices in Stripe and sets these):
    - Convex (dashboard): `STRIPE_STARTER_ANNUAL_PRICE_ID`, `STRIPE_GROWTH_ANNUAL_PRICE_ID`,
      `STRIPE_PRO_ANNUAL_PRICE_ID`
    - App (`VITE_` build env): `VITE_STRIPE_STARTER_ANNUAL_PRICE_ID`, `VITE_STRIPE_GROWTH_ANNUAL_PRICE_ID`,
      `VITE_STRIPE_PRO_ANNUAL_PRICE_ID`

- [ ] **Step 2:** Update §8 (Subscriptions & Billing) to reflect: checkout now runs through
  `billingNode.createCheckoutSession` (direct Stripe SDK) with a **7-day card-required trial** and
  `allow_promotion_codes`; the price→tier map (`lib/stripePrices.ts`) covers monthly + annual; the activation Apify sync
  is gated by `isApifyPostSyncEnabled`. Note that the **early-trial-end** (`endTrialEarly`) and the **50-interaction
  milestone** are implemented in **Plan 2B**.

- [ ] **Step 3: Checkpoint** — (`docs(platform): annual billing + card-required trial + promo codes`).

---

## Task 9: Full verification

- [ ] **Step 1:** `pnpm --filter convex exec tsc --noEmit -p tsconfig.json` · `pnpm --filter app exec tsc --noEmit` ·
  `pnpm -r test` · `pnpm lint` — all green.
- [ ] **Step 2: Stripe test-mode manual check** (Henriko, with test keys + a test annual Price): from the app
  `/billing`, toggle **Annual**, click **Upgrade** on Growth → the hosted checkout shows a **card field**, a **7-day
  trial** ("$0.00 due today, then $150/yr after 7 days"), and an **"Add promotion code"** link. Completing it creates a
  `trialing` subscription; the `customer.subscription.created` webhook sets the user `trialing` (no Apify sync fires
  while dormant).
- [ ] **Step 3: Checkpoint** — ready for Henriko to commit.

---

## Self-Review (plan author)

**Spec coverage:** annual billing ✓ (T1/T7/T8) · card-required trial ✓ (T5) · promo codes ✓ (T5, manual) · Apify dormant
✓ (T3) · no auto-coupon ✓ (T5 comment + constraints). **Deferred to Plan 2B:** the 50-interaction counter + calling
`endTrialEarly`, the `effectiveTier` (Growth-level trial), feed reciprocity, the card-gate screen, and the in-app X/50
progress + SSI link-out.

**Placeholder scan:** none. The only env "placeholders" are real env vars Henriko sets (T8).

**Type consistency:** `Tier` is shared from `lib/stripePrices`; `getTierFromPriceId` signature unchanged (so `http.ts`
and `syncUserSubscription`'s `tier` arg still align); `createCheckoutSession` keeps
`{ priceId, sessionToken } → { url }` so the app call site only changes module (`billing` → `billingNode`).

**Risks:** (1) The `stripe` SDK in a Convex `"use node"` action — standard, but Henriko must confirm `npx convex dev`
compiles `billingNode.ts`. (2) `payment_method_collection: 'always'` + `trial_period_days` requires the Stripe account
to allow trials without immediate charge — default behavior. (3) The app's `current plan` logic already treats
trialing-starter as "show Subscribe" (BillingPage:130) — unaffected.

---

## Next: Plan 2B

Plan 2B (separate doc) implements: the `effectiveTier(user)` helper (`trialing → growth`) used by `buildFeedFilter` +
`getPlanLimitsHelper`; the combined interaction counter on `users` (incremented in `incrementCommentCount`/
`incrementLikeCount` for both maker and author) that schedules `internal.billingNode.endTrialEarly` at 50; feed
reciprocity (`isAuthorFeedEligible` + the `hidden:` at submit, no backfill — pre-launch); the frontend card-gate screen;
and the in-app **X/50 progress** element + **SSI → linkedin.com/sales/ssi** link-out, coordinated with the in-flight
app/ UI revamp.
