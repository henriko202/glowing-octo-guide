# Trial Correctness (R01 + R02 + R03) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan
> task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the 7-day card-required trial consumable exactly once per user, disclose the early-charge rule everywhere
the user can meet it, and honour the plan the visitor chose on the landing page.

**Architecture:** Every decision that can be a pure function is one, living in `convex/lib/*.ts` and unit-tested without
a database (the convention `access.ts` / `planLimits.ts` already follow — this repo has no `convex-test` dependency).
The Convex seams (`billingNode.ts`, `interactions.ts`, `http.ts`, `notifications.ts`) do I/O only and delegate every
branch to those helpers. The client reads new state through existing queries; no new client dependency.

**Tech Stack:** Convex (queries / mutations / actions / scheduler / HTTP webhooks), Stripe SDK + `@convex-dev/stripe`
component, Resend via `convex/lib/email.ts`, React 19 + react-router-dom + i18next, Vitest + Testing Library, Tailwind
v4 + shadcn.

**Spec:** `docs/superpowers/specs/2026-09-06-trial-correctness-design.md` — read it first; it carries the seven
decisions (D1–D7) this plan implements.

## Global Constraints

- **NEVER run `git commit`, `git push`, `git stash`, `git checkout`, `git reset`, `git restore`, `git add`, or any other
  git command that changes repository or working-tree state.** `CLAUDE.md` reserves all commits to Henriko. Read-only
  git (`git status`, `git diff`) is fine. A previous subagent ran `git stash` and stranded completed work.
- **No new npm dependency.** The shadcn Dialog, the existing `toast`, and the existing Resend mailer cover every
  requirement here.
- **Three locales in parity, always:** `en`, `pt` (pt-BR, never European Portuguese), `es` (neutral LatAm). Labels are
  sentence case. Any new key added to `app/src/i18n/locales/en.json` must be added to `pt.json` and `es.json` in the
  same task. There is no automated i18n parity test — verify by reading all three.
- **Copy rules, non-negotiable:** never "may end early" (the rule is deterministic); never a countdown, red alarm
  banner, or urgency theatrics (amber only); never promotional copy in a transactional email; never the words "trial
  abuse", a warning, or a penalty state; never print a raw tier id (`growth`) where a user can read it — use the
  localized plan name.
- **Error prefix convention:** thrown `ConvexError` messages the client branches on use `PREFIX: human sentence`,
  matching `convex/lib/access.ts:18` (`PAYMENT_REQUIRED: …`).
- **Convex has no server-side Sentry.** `app/src/lib/observability/sentry.ts` is client-only. Backend logging is
  `console.error('[billing] …', scrubError(x))` using `convex/lib/scrubError.ts`, the convention at `convex/http.ts:63`
  and `convex/lib/email.ts:49`.
- **Never widen scope to "strengthen" an item.** In particular: do not touch the SSI link-out at
  `app/src/pages/BillingPage.tsx:180-187` (that is R15), do not redesign the cancel flow (R09), do not refactor
  `convex/privacy/emails.ts`.
- **Verify command:** `pnpm lint && pnpm typecheck && pnpm -r test`. Individual suites: `pnpm --filter convex test`,
  `pnpm --filter app test`.
- **NEVER run `pnpm format`.** It is `prettier --write .` across the whole repo. `pnpm format:check` is **already red at
  HEAD** — 40 pre-existing offenders (21 files in `app/src/`, `convex/crons.ts`, `convex/seed.ts`, `plans/*.md`,
  `README.md`, `.github/workflows/ci.yml`, `landing/.open-next/.build/*`), none of them files this work touches. Every
  file in this plan's File Structure table is verified prettier-clean at HEAD, so keep it that way with a **scoped**
  check on your own files only:

  ```bash
  pnpm exec prettier --check <the files you changed>
  ```

  and fix with `pnpm exec prettier --write <those same files>`. Never a bare `.`. Repo-wide format cleanup is a separate
  piece of work (`plans/008-green-the-verify-gate.md`) and rewriting 40 unrelated files would bury this change in
  Henriko's uncommitted diff.
- **Windows line endings:** this repo has `core.autocrlf=true` and files are CRLF on disk. If you rewrite a file
  wholesale, confirm you have not flattened it to LF.

## File Structure

| File                                                       | Responsibility                                                                                          |
|------------------------------------------------------------|---------------------------------------------------------------------------------------------------------|
| `convex/lib/trialMilestone.ts` (modify)                    | All trial thresholds and subscription-row selection. Pure.                                              |
| `convex/lib/checkoutCopy.ts` (create)                      | Locale resolution + the Stripe checkout submit message. Pure.                                           |
| `convex/lib/billingEmails.ts` (create)                     | The three billing email bodies × three languages + price formatting. Pure.                              |
| `convex/lib/email.ts` (modify)                             | Add the shared `EmailContent` type. Transport unchanged.                                                |
| `convex/schema.ts` (modify)                                | `users.language`, `users.billingNotice`, `subscriptions.price*`.                                        |
| `convex/billing.ts` (modify)                               | Internal readers actions need: `listUserSubscriptions`, `getBillingContext`, `getUserBySubscriptionId`. |
| `convex/billingNode.ts` (modify)                           | The checkout guard, the conditional trial, `custom_text`, `locale`, and `cancelDuplicateSubscription`.  |
| `convex/interactions.ts` (modify)                          | Correct trialing-subscription lookup; schedule the 40-of-50 notice.                                     |
| `convex/notifications.ts` (create)                         | The three billing mailer actions. I/O only.                                                             |
| `convex/http.ts` (modify)                                  | Price passthrough, duplicate detection, `trial_will_end`.                                               |
| `convex/users.ts` (modify)                                 | `setLanguage`, `setBillingNotice`, `clearBillingNotice`, `nearThreshold`.                               |
| `app/src/pages/BillingPage.tsx` (modify)                   | Portal routing, single-primary-card layout, amber + notice banners.                                     |
| `app/src/i18n/locales/{en,pt,es}.json` (modify)            | New `billing.*` keys.                                                                                   |
| `landing/app/[lang]/terms/content/{en,pt,es}.tsx` (modify) | The free-trial clause in §5.                                                                            |
| `docs/PLATFORM.md` (modify)                                | §8, §13B, §14, §15, §19.                                                                                |

---

## Task 1: Trial helpers (pure)

**Files:**

- Modify: `convex/lib/trialMilestone.ts`
- Test: `convex/lib/trialMilestone.test.ts`

**Interfaces:**

- Consumes: nothing.
- Produces: `TRIAL_WARNING_THRESHOLD: 40`, `LIVE_SUBSCRIPTION_STATUSES`, `isNearThreshold(combined: number): boolean`,
  `findLiveSubscription<T extends { status: string }>(rows: readonly T[]): T | undefined`,
  `pickTrialingSubscription<T extends { status: string }>(rows: readonly T[]): T | undefined`,
  `trialEligible(subscriptionCount: number): boolean`.

- [ ] **Step 1: Write the failing tests**

Append to `convex/lib/trialMilestone.test.ts` (keep the existing `describe` block untouched):

```ts
import {
  crossesThreshold,
  findLiveSubscription,
  isNearThreshold,
  pickTrialingSubscription,
  trialEligible,
  TRIAL_INTERACTION_THRESHOLD,
  TRIAL_WARNING_THRESHOLD
} from './trialMilestone'

describe('isNearThreshold', () => {
  it('is true from 40 up to but not including 50', () => {
    expect(TRIAL_WARNING_THRESHOLD).toBe(40)
    expect(isNearThreshold(39)).toBe(false)
    expect(isNearThreshold(40)).toBe(true)
    expect(isNearThreshold(49)).toBe(true)
    expect(isNearThreshold(50)).toBe(false)
  })
})

describe('crossesThreshold at the warning threshold', () => {
  it('fires once, on the increment that reaches 40', () => {
    expect(crossesThreshold(39, 1, TRIAL_WARNING_THRESHOLD)).toBe(true)
    expect(crossesThreshold(40, 1, TRIAL_WARNING_THRESHOLD)).toBe(false)
  })
})

describe('findLiveSubscription', () => {
  it('finds trialing, active and past_due rows', () => {
    expect(findLiveSubscription([{ status: 'trialing' }])?.status).toBe('trialing')
    expect(findLiveSubscription([{ status: 'active' }])?.status).toBe('active')
    expect(findLiveSubscription([{ status: 'past_due' }])?.status).toBe('past_due')
  })
  it('ignores canceled and incomplete rows', () => {
    expect(findLiveSubscription([{ status: 'canceled' }, { status: 'incomplete_expired' }])).toBeUndefined()
    expect(findLiveSubscription([])).toBeUndefined()
  })
  it('finds a live row behind a canceled one', () => {
    expect(findLiveSubscription([{ status: 'canceled' }, { status: 'active' }])?.status).toBe('active')
  })
})

describe('pickTrialingSubscription', () => {
  // The bug this exists to prevent: by_user is ordered by _creationTime, so .first()
  // returns the OLDEST row — the canceled one after a cancel + re-subscribe.
  it('returns the trialing row even when an older canceled row precedes it', () => {
    const rows = [
      { status: 'canceled', stripeSubscriptionId: 'sub_old' },
      { status: 'trialing', stripeSubscriptionId: 'sub_new' }
    ]
    expect(pickTrialingSubscription(rows)?.stripeSubscriptionId).toBe('sub_new')
  })
  it('returns undefined when nothing is trialing', () => {
    expect(pickTrialingSubscription([{ status: 'active' }, { status: 'canceled' }])).toBeUndefined()
    expect(pickTrialingSubscription([])).toBeUndefined()
  })
})

describe('trialEligible', () => {
  it('grants a trial only to a user with no subscription row ever', () => {
    expect(trialEligible(0)).toBe(true)
    expect(trialEligible(1)).toBe(false)
    expect(trialEligible(3)).toBe(false)
  })
  it('the threshold constants stay put', () => {
    expect(TRIAL_INTERACTION_THRESHOLD).toBe(50)
  })
})
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `pnpm --filter convex test trialMilestone`
Expected: FAIL — `isNearThreshold is not a function` (and the other new exports).

- [ ] **Step 3: Implement**

Append to `convex/lib/trialMilestone.ts`:

```ts
// The trial's near-end warning fires at 80% of the interaction threshold. One email, one amber
// banner — the user learns the charge is coming before it arrives (card-network trial rules).
export const TRIAL_WARNING_THRESHOLD = 40

// Stripe statuses that mean "this user already holds a subscription we must not duplicate".
// 'canceled' is deliberately absent: a canceled member may re-subscribe (without a new trial).
export const LIVE_SUBSCRIPTION_STATUSES: readonly string[] = ['trialing', 'active', 'past_due']

/** True while the member is in the amber window: at or past 40 combined, not yet at 50. */
export function isNearThreshold(combined: number): boolean {
  return combined >= TRIAL_WARNING_THRESHOLD && combined < TRIAL_INTERACTION_THRESHOLD
}

/** The row that blocks a new checkout, if any. */
export function findLiveSubscription<T extends { status: string }>(rows: readonly T[]): T | undefined {
  return rows.find(r => LIVE_SUBSCRIPTION_STATUSES.includes(r.status))
}

/**
 * The row the 50-interaction early end must target. NEVER use `.first()` on the by_user index:
 * Convex appends _creationTime to every index, so `.first()` returns the OLDEST row — which after
 * a cancel + re-subscribe is the canceled one, and ending its trial is a silent no-op.
 */
export function pickTrialingSubscription<T extends { status: string }>(rows: readonly T[]): T | undefined {
  return rows.find(r => r.status === 'trialing')
}

/**
 * One trial per user, forever. Keyed on the subscription-row COUNT rather than user.trialEndsAt,
 * because syncUserSubscription (convex/stripe.ts:78) overwrites trialEndsAt with undefined for a
 * non-trial subscription — a marker that erases itself would hand a returning user a second trial.
 */
export function trialEligible(subscriptionCount: number): boolean {
  return subscriptionCount === 0
}
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `pnpm --filter convex test trialMilestone`
Expected: PASS, all describes green.

- [ ] **Step 5: Save only — do NOT commit**

Leave the changes in the working tree. Run `git status` to confirm the two files are modified. Do not stage, stash or
commit anything.

---

## Task 2: Checkout copy (pure)

**Files:**

- Create: `convex/lib/checkoutCopy.ts`
- Test: `convex/lib/checkoutCopy.test.ts`

**Interfaces:**

- Consumes: nothing.
- Produces: `type BillingLocale = 'en' | 'pt' | 'es'`,
  `resolveBillingLocale(language?: string, primaryLocale?: string): BillingLocale`,
  `stripeCheckoutLocale(locale: BillingLocale): 'en' | 'pt-BR' | 'es'`,
  `checkoutSubmitMessage(locale: BillingLocale, opts: { trial: boolean }): string`.

- [ ] **Step 1: Write the failing test**

Create `convex/lib/checkoutCopy.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { checkoutSubmitMessage, resolveBillingLocale, stripeCheckoutLocale } from './checkoutCopy'

const LOCALES = ['en', 'pt', 'es'] as const

describe('resolveBillingLocale', () => {
  it('prefers the explicit language, then primaryLocale, then english', () => {
    expect(resolveBillingLocale('pt', 'en')).toBe('pt')
    expect(resolveBillingLocale(undefined, 'es')).toBe('es')
    expect(resolveBillingLocale(undefined, undefined)).toBe('en')
  })
  it('normalises regional and cased tags', () => {
    expect(resolveBillingLocale('pt-BR')).toBe('pt')
    expect(resolveBillingLocale('ES')).toBe('es')
  })
  it('falls through an unsupported language to the next candidate', () => {
    expect(resolveBillingLocale('fr', 'pt')).toBe('pt')
    expect(resolveBillingLocale('fr', 'de')).toBe('en')
  })
})

describe('stripeCheckoutLocale', () => {
  it('maps pt to Stripe pt-BR', () => {
    expect(stripeCheckoutLocale('pt')).toBe('pt-BR')
    expect(stripeCheckoutLocale('en')).toBe('en')
    expect(stripeCheckoutLocale('es')).toBe('es')
  })
})

describe('checkoutSubmitMessage', () => {
  it('states the 50-or-7-days rule in every language on the trial path', () => {
    for (const l of LOCALES) {
      const msg = checkoutSubmitMessage(l, { trial: true })
      expect(msg).toContain('50')
      expect(msg).toContain('7')
      expect(msg.length).toBeGreaterThan(40)
    }
  })
  it('states that billing is today on the no-trial path', () => {
    for (const l of LOCALES) {
      const msg = checkoutSubmitMessage(l, { trial: false })
      expect(msg).not.toContain('50')
      expect(msg.length).toBeGreaterThan(20)
    }
  })
  it('never hedges — the rule is deterministic, not "may"', () => {
    for (const l of LOCALES) {
      for (const trial of [true, false]) {
        const msg = checkoutSubmitMessage(l, { trial }).toLowerCase()
        expect(msg).not.toContain('may end')
        expect(msg).not.toContain('pode terminar')
        expect(msg).not.toContain('puede terminar')
      }
    }
  })
  it('fits Stripe custom_text limit of 1200 characters', () => {
    for (const l of LOCALES) {
      for (const trial of [true, false]) {
        expect(checkoutSubmitMessage(l, { trial }).length).toBeLessThanOrEqual(1200)
      }
    }
  })
})
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `pnpm --filter convex test checkoutCopy`
Expected: FAIL — cannot resolve `./checkoutCopy`.

- [ ] **Step 3: Implement**

Create `convex/lib/checkoutCopy.ts`:

```ts
// convex/lib/checkoutCopy.ts
// Pure copy for the Stripe-hosted checkout page. The rule the user is agreeing to has to sit
// under the pay button, not in a FAQ: a cost learned after the card is entered is the single
// biggest cause of abandonment, and card-network trial rules expect the term stated up front.
// No I/O. Three languages, kept in parity with app/src/i18n/locales.
export type BillingLocale = 'en' | 'pt' | 'es'

const SUPPORTED: readonly string[] = ['en', 'pt', 'es']

/**
 * Which language a billing notice is written in.
 * Order: the language the member last checked out in → their scraped LinkedIn locale → English.
 * Accepts regional tags ('pt-BR') and any casing.
 */
export function resolveBillingLocale(language?: string, primaryLocale?: string): BillingLocale {
  for (const candidate of [language, primaryLocale]) {
    const short = candidate?.slice(0, 2).toLowerCase()
    if (short && SUPPORTED.includes(short)) return short as BillingLocale
  }
  return 'en'
}

/** Stripe's own locale codes differ from ours: it wants pt-BR, not pt. */
export function stripeCheckoutLocale(locale: BillingLocale): 'en' | 'pt-BR' | 'es' {
  return locale === 'pt' ? 'pt-BR' : locale
}

const TRIAL_MESSAGE: Record<BillingLocale, string> = {
  en: 'Your free trial ends as soon as you reach 50 interactions (made plus received), or after 7 days — whichever comes first. Billing starts then. Cancel before that from Subscription and you pay nothing.',
  pt: 'Seu teste grátis termina assim que você atingir 50 interações (feitas e recebidas) ou depois de 7 dias — o que vier primeiro. A cobrança começa nesse momento. Cancele antes disso em Assinatura e você não paga nada.',
  es: 'Tu prueba gratuita termina en cuanto alcances 50 interacciones (hechas y recibidas) o a los 7 días, lo que ocurra primero. La facturación comienza en ese momento. Cancela antes desde Suscripción y no pagas nada.'
}

const NO_TRIAL_MESSAGE: Record<BillingLocale, string> = {
  en: 'No trial this time — you have already used yours. You are billed today and your plan starts immediately. Cancel anytime from Subscription.',
  pt: 'Sem teste grátis desta vez — você já usou o seu. A cobrança é hoje e seu plano começa imediatamente. Cancele quando quiser em Assinatura.',
  es: 'Sin prueba gratuita esta vez: ya usaste la tuya. El cobro es hoy y tu plan comienza de inmediato. Cancela cuando quieras desde Suscripción.'
}

/** The line under Stripe's pay button. Stripe caps custom_text.submit.message at 1200 chars. */
export function checkoutSubmitMessage(locale: BillingLocale, opts: { trial: boolean }): string {
  return opts.trial ? TRIAL_MESSAGE[locale] : NO_TRIAL_MESSAGE[locale]
}
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `pnpm --filter convex test checkoutCopy`
Expected: PASS.

- [ ] **Step 5: Save only — do NOT commit**

---

## Task 3: Schema fields, user mutations, price passthrough

**Files:**

- Modify: `convex/schema.ts`, `convex/users.ts`, `convex/stripe.ts`, `convex/http.ts`
- Test: `convex/lib/trialMilestone.test.ts` already covers `isNearThreshold`; no new test file (these are validator and
  passthrough changes verified by `typecheck`).

**Interfaces:**

- Consumes: `isNearThreshold` from Task 1.
- Produces: `internal.users.setLanguage({ userId, language })`, `internal.users.setBillingNotice({ userId, notice })`,
  `api.users.clearBillingNotice({ sessionToken })`, `getTrialProgress` now returns `nearThreshold: boolean`, and
  `subscriptions` rows now carry `priceAmount` (minor units), `priceCurrency` (ISO 4217, lowercase as Stripe sends it)
  and `priceInterval` (`'month' | 'year'`).

- [ ] **Step 1: Add the schema fields**

In `convex/schema.ts`, inside the `users` table definition, after `primaryLocale` (`:18`):

```ts
    // The UI language the member last checked out in ('en' | 'pt' | 'es'). Written by
    // billingNode.createCheckoutSession and read by the billing mailers — the member's UI language
    // choice otherwise lives only in a browser cookie the backend never sees. Distinct from
    // primaryLocale (the scraped LinkedIn locale, which only seeds the initial UI language).
    language: v.optional(v.string()),
    // One-shot billing notice key, rendered as a dismissible banner on /billing (currently only
    // 'duplicate_canceled'). Set by the duplicate-subscription webhook, cleared by
    // users.clearBillingNotice. Absent ⇒ no notice. A voided subscription is never silent.
    billingNotice: v.optional(v.string()),
```

In the same file, inside the `subscriptions` table (`:174-180`), after `currentPeriodEnd`:

```ts
    // Price snapshot from the Stripe webhook payload (items.data[0].price), so a billing email can
    // state the exact amount without a second Stripe call and without a hardcoded price table that
    // drifts the day pricing changes. Minor units, e.g. 15000 + 'usd' + 'year'.
    priceAmount: v.optional(v.number()),
    priceCurrency: v.optional(v.string()),
    priceInterval: v.optional(v.string())
```

- [ ] **Step 2: Add the user mutations**

In `convex/users.ts`, add near the other billing-adjacent functions. Note `internalMutation` must be added to the import
from `./_generated/server` if it is not already imported, and `requireAuth` is already imported.

```ts
/** Records the language the member checked out in, so billing emails reach them in it. */
export const setLanguage = internalMutation({
  args: { userId: v.id('users'), language: v.string() },
  handler: async (ctx, { userId, language }) => {
    await ctx.db.patch(userId, { language })
  }
})

/** Raises a one-shot billing notice banner (see schema: users.billingNotice). */
export const setBillingNotice = internalMutation({
  args: { userId: v.id('users'), notice: v.string() },
  handler: async (ctx, { userId, notice }) => {
    await ctx.db.patch(userId, { billingNotice: notice })
  }
})

/** Dismisses the billing notice banner. Public: the owner clears their own. */
export const clearBillingNotice = mutation({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    const user = await requireAuth(ctx, sessionToken)
    await ctx.db.patch(user._id, { billingNotice: undefined })
  }
})
```

`toSafeMe` (`convex/users.ts:74-82`) strips only secrets by name, so `billingNotice` and `language` flow to the client
through `getMe` with no change there. Do **not** add `stripeCustomerId` to the safe object.

- [ ] **Step 3: Return `nearThreshold` from `getTrialProgress`**

In `convex/users.ts`, extend the import from `./lib/trialMilestone` to include `isNearThreshold`, then add one field to
the object returned by `getTrialProgress`:

```ts
      reached: combined >= TRIAL_INTERACTION_THRESHOLD,
      nearThreshold: isNearThreshold(combined),
```

- [ ] **Step 4: Accept and store the price snapshot**

In `convex/stripe.ts`, add three optional args to `syncUserSubscription`'s `args` validator:

```ts
    priceAmount: v.optional(v.number()),
    priceCurrency: v.optional(v.string()),
    priceInterval: v.optional(v.string()),
```

and include them in **both** branches of the subscriptions upsert (the `ctx.db.patch(existing._id, …)` call and the
`ctx.db.insert('subscriptions', …)` call):

```ts
        priceAmount: args.priceAmount,
        priceCurrency: args.priceCurrency,
        priceInterval: args.priceInterval
```

- [ ] **Step 5: Send the price snapshot from the webhook**

In `convex/http.ts`, in **both** the `customer.subscription.created` and `customer.subscription.updated` handlers,
replace the `const priceId = …` line with:

```ts
      const price = sub.items?.data?.[0]?.price
      const priceId = price?.id ?? ''
```

and add three fields to each `ctx.runMutation(internal.stripe.syncUserSubscription, { … })` call:

```ts
        priceAmount: typeof price?.unit_amount === 'number' ? price.unit_amount : undefined,
        priceCurrency: price?.currency ?? undefined,
        priceInterval: price?.recurring?.interval ?? undefined
```

- [ ] **Step 6: Typecheck and run the convex suite**

Run: `pnpm --filter convex exec tsc --noEmit -p tsconfig.json && pnpm --filter convex test`
Expected: tsc exits 0; all existing convex tests still pass (`convex/stripe.test.ts` included — the new args are
optional, so existing callers stay valid).

- [ ] **Step 7: Save only — do NOT commit**

---

## Task 4: The checkout guard

**Files:**

- Modify: `convex/billing.ts`, `convex/billingNode.ts`

**Interfaces:**

- Consumes: `findLiveSubscription`, `trialEligible` (Task 1); `resolveBillingLocale`, `stripeCheckoutLocale`,
  `checkoutSubmitMessage` (Task 2); `internal.users.setLanguage` (Task 3).
- Produces: `internal.billing.listUserSubscriptions({ userId }) → Doc<'subscriptions'>[]`;
  `api.billingNode.createCheckoutSession` now takes an optional `locale: string` argument and can throw
  `ConvexError('ALREADY_SUBSCRIBED: …')`.

- [ ] **Step 1: Add the internal reader**

Actions cannot touch the database, so the guard needs a query. In `convex/billing.ts`, add `internalQuery` to the import
from `./_generated/server` and append:

```ts
/**
 * Every subscription row this user has ever had, oldest first. Read by createCheckoutSession
 * (the duplicate + repeat-trial guard) and by the duplicate-subscription webhook. Bounded: a
 * user accumulates at most one row per subscription they have ever held.
 */
export const listUserSubscriptions = internalQuery({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }) =>
    ctx.db
      .query('subscriptions')
      .withIndex('by_user', q => q.eq('userId', userId))
      .collect()
})
```

- [ ] **Step 2: Guard the checkout**

In `convex/billingNode.ts`, add the imports:

```ts
import { findLiveSubscription, trialEligible } from './lib/trialMilestone'
import { checkoutSubmitMessage, resolveBillingLocale, stripeCheckoutLocale } from './lib/checkoutCopy'
```

Change `createCheckoutSession`'s `args` to add the locale, and rewrite the handler body between `requireAuthAction` and
`stripeComponent.getOrCreateCustomer`:

```ts
export const createCheckoutSession = action({
  args: { priceId: v.string(), sessionToken: v.string(), locale: v.optional(v.string()) },
  handler: async (ctx, { priceId, sessionToken, locale }) => {
    if (!ALLOWED_PRICE_IDS.has(priceId)) throw new ConvexError('Invalid price ID')

    const user = await requireAuthAction(ctx, sessionToken)
    if (!user) throw new ConvexError('User not found')

    // One live subscription per user. A card holder who wants another plan switches in the
    // Customer Portal — the client branches on this prefix and opens it (lib/access.ts:18
    // convention). The blocked path is a door, never an accusation.
    const subscriptions = await ctx.runQuery(internal.billing.listUserSubscriptions, { userId: user._id })
    if (findLiveSubscription(subscriptions)) {
      throw new ConvexError('ALREADY_SUBSCRIBED: You already have a plan. Manage it from the billing portal.')
    }

    // One trial per user, forever. A returning subscriber checks out without a trial and is told
    // so under the pay button, before the card — never discovered on the statement.
    const trial = trialEligible(subscriptions.length)
    const billingLocale = resolveBillingLocale(locale ?? user.language, user.primaryLocale)
```

Then in the session creation, make the trial conditional and add the disclosure:

```ts
    const session = await stripe().checkout.sessions.create({
      mode: 'subscription',
      customer: customer.customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        ...(trial ? { trial_period_days: TRIAL_PERIOD_DAYS } : {}),
        metadata: { convexUserId: user._id }
      },
      payment_method_collection: 'always', // card required even during the trial
      allow_promotion_codes: true, // manual free-month campaign codes (Henriko-managed)
      locale: stripeCheckoutLocale(billingLocale),
      // The rule the member is agreeing to, two centimetres from the pay button.
      custom_text: { submit: { message: checkoutSubmitMessage(billingLocale, { trial }) } },
      success_url: `${appUrl}/billing?success=true`,
      cancel_url: `${appUrl}/billing`
    })
```

Finally, after the existing `setStripeCustomerId` block, persist the language:

```ts
    // The member's UI language lives only in a browser cookie; billing emails are sent from the
    // backend long after this request, so record it here.
    if (user.language !== billingLocale) {
      await ctx.runMutation(internal.users.setLanguage, { userId: user._id, language: billingLocale })
    }
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter convex exec tsc --noEmit -p tsconfig.json`
Expected: exits 0. If `internal.users.setLanguage` is unresolved, Task 3 Step 2 was skipped.

- [ ] **Step 4: Run the convex suite**

Run: `pnpm --filter convex test`
Expected: PASS.

- [ ] **Step 5: Save only — do NOT commit**

---

## Task 5: Fix the trialing-subscription lookup

**Files:**

- Modify: `convex/interactions.ts:27-37`

**Interfaces:**

- Consumes: `pickTrialingSubscription` (Task 1).
- Produces: nothing new.

- [ ] **Step 1: Replace the lookup**

In `convex/interactions.ts`, extend the `./lib/trialMilestone` import to include `pickTrialingSubscription`, then
replace the `if (crossesThreshold(combined, 1)) { … }` block:

```ts
  if (crossesThreshold(combined, 1)) {
    // NOT .first(): by_user is ordered by _creationTime, so .first() is the OLDEST row — after a
    // cancel + re-subscribe that is the canceled subscription, and ending its trial does nothing.
    const rows = await ctx.db
      .query('subscriptions')
      .withIndex('by_user', q => q.eq('userId', userId))
      .collect()
    const sub = pickTrialingSubscription(rows)
    if (sub?.stripeSubscriptionId) {
      await ctx.scheduler.runAfter(0, internal.billingNode.endTrialEarly, {
        stripeSubscriptionId: sub.stripeSubscriptionId
      })
    }
  }
```

- [ ] **Step 2: Typecheck and run the convex suite**

Run: `pnpm --filter convex exec tsc --noEmit -p tsconfig.json && pnpm --filter convex test`
Expected: both exit 0.

- [ ] **Step 3: Save only — do NOT commit**

---

## Task 6: Billing email bodies (pure)

**Files:**

- Modify: `convex/lib/email.ts` (add one exported type)
- Create: `convex/lib/billingEmails.ts`
- Test: `convex/lib/billingEmails.test.ts`

**Interfaces:**

- Consumes: `BillingLocale` (Task 2).
- Produces: `EmailContent` (from `./email`), `formatPriceLabel(locale, { amount, currency, interval }): string`,
  `trialNearEndEmail(locale, args): EmailContent`, `trialEndingEmail(locale, args): EmailContent`,
  `duplicateSubscriptionCanceledEmail(locale, args): EmailContent`.

Do **not** refactor `convex/privacy/emails.ts`; it keeps its own local `EmailContent`.

- [ ] **Step 1: Write the failing test**

Create `convex/lib/billingEmails.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  duplicateSubscriptionCanceledEmail,
  formatPriceLabel,
  trialEndingEmail,
  trialNearEndEmail
} from './billingEmails'
import type { BillingLocale } from './checkoutCopy'

const LOCALES: BillingLocale[] = ['en', 'pt', 'es']
const BILLING_URL = 'https://app.example.com/billing'
const PRICE = { amount: 15000, currency: 'usd', interval: 'year' }

describe('formatPriceLabel', () => {
  it('renders minor units as a real amount with the interval', () => {
    const label = formatPriceLabel('en', PRICE)
    expect(label).toContain('150')
    expect(label.toLowerCase()).toContain('year')
  })
  it('degrades to an empty string when Stripe sent no price', () => {
    expect(formatPriceLabel('en', { amount: undefined, currency: undefined, interval: undefined })).toBe('')
  })
})

describe('trialNearEndEmail', () => {
  const args = { made: 32, received: 8, remaining: 10, planName: 'Growth', priceLabel: '$150 / year', billingUrl: BILLING_URL }

  it('leads with what the member did, in every language', () => {
    for (const l of LOCALES) {
      const m = trialNearEndEmail(l, args)
      expect(m.subject.length).toBeGreaterThan(0)
      expect(m.text).toContain('32')
      expect(m.text).toContain('8')
    }
  })
  it('names the number, the amount and the plan, and links the cancel path', () => {
    for (const l of LOCALES) {
      const m = trialNearEndEmail(l, args)
      expect(m.text).toContain('10')
      expect(m.text).toContain('$150 / year')
      expect(m.text).toContain('Growth')
      expect(m.text).toContain(BILLING_URL)
      expect(m.html).toContain(BILLING_URL)
    }
  })
})

describe('trialEndingEmail', () => {
  const args = { endsOn: '13 September 2026', planName: 'Growth', priceLabel: '$150 / year', billingUrl: BILLING_URL }
  it('states the date, the amount and the cancel path in every language', () => {
    for (const l of LOCALES) {
      const m = trialEndingEmail(l, args)
      expect(m.text).toContain('13 September 2026')
      expect(m.text).toContain('$150 / year')
      expect(m.text).toContain(BILLING_URL)
      expect(m.subject.length).toBeGreaterThan(0)
    }
  })
})

describe('duplicateSubscriptionCanceledEmail', () => {
  it('says plainly that the extra subscription was voided and nothing extra was charged', () => {
    for (const l of LOCALES) {
      const m = duplicateSubscriptionCanceledEmail(l, { planName: 'Growth', billingUrl: BILLING_URL })
      expect(m.subject.length).toBeGreaterThan(0)
      expect(m.text).toContain('Growth')
      expect(m.text).toContain(BILLING_URL)
    }
  })
})

describe('billing emails stay transactional', () => {
  it('carries no marketing verbs and no urgency theatrics', () => {
    const all = [
      ...LOCALES.map(l => trialNearEndEmail(l, { made: 1, received: 1, remaining: 1, planName: 'Growth', priceLabel: 'x', billingUrl: BILLING_URL })),
      ...LOCALES.map(l => trialEndingEmail(l, { endsOn: 'x', planName: 'Growth', priceLabel: 'x', billingUrl: BILLING_URL })),
      ...LOCALES.map(l => duplicateSubscriptionCanceledEmail(l, { planName: 'Growth', billingUrl: BILLING_URL }))
    ]
    for (const m of all) {
      const body = `${m.subject} ${m.text}`.toLowerCase()
      for (const banned of ['upgrade now', 'hurry', 'last chance', 'don’t miss', 'act now', 'aproveite', 'última chance', 'no te lo pierdas']) {
        expect(body).not.toContain(banned)
      }
    }
  })
})
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `pnpm --filter convex test billingEmails`
Expected: FAIL — cannot resolve `./billingEmails`.

- [ ] **Step 3: Export the shared type**

In `convex/lib/email.ts`, add above `SendEmailArgs`:

```ts
/** A rendered transactional message, ready for sendEmail. Built by pure per-flow modules. */
export interface EmailContent {
  subject: string
  html: string
  text: string
}
```

- [ ] **Step 4: Implement the builders**

Create `convex/lib/billingEmails.ts`:

```ts
// convex/lib/billingEmails.ts
// Pure transactional-email builders for billing notices, mirroring convex/privacy/emails.ts.
// No I/O — each returns { subject, html, text } for convex/lib/email.ts:sendEmail to deliver.
//
// These are contract notices (card-network trial rules require a pre-charge reminder stating the
// amount, the date and how to cancel), never marketing: no promotional copy, no countdown, no
// urgency. Each one leads with what the member DID, then the term, then one link to cancel.
import type { BillingLocale } from './checkoutCopy'
import type { EmailContent } from './email'

const APP = 'Link Into The SSI'

/** Stripe sends minor units + an ISO currency; render it once, exactly, never rounded. */
export function formatPriceLabel(
  locale: BillingLocale,
  price: { amount?: number; currency?: string; interval?: string }
): string {
  if (typeof price.amount !== 'number' || !price.currency) return ''
  const tag = locale === 'pt' ? 'pt-BR' : locale === 'es' ? 'es' : 'en'
  const amount = new Intl.NumberFormat(tag, {
    style: 'currency',
    currency: price.currency.toUpperCase(),
    minimumFractionDigits: price.amount % 100 === 0 ? 0 : 2
  }).format(price.amount / 100)
  const period: Record<BillingLocale, Record<string, string>> = {
    en: { month: 'month', year: 'year' },
    pt: { month: 'mês', year: 'ano' },
    es: { month: 'mes', year: 'año' }
  }
  const unit = price.interval ? period[locale][price.interval] : undefined
  return unit ? `${amount} / ${unit}` : amount
}

interface NearEndArgs {
  made: number
  received: number
  remaining: number
  planName: string
  priceLabel: string
  billingUrl: string
}

export function trialNearEndEmail(locale: BillingLocale, a: NearEndArgs): EmailContent {
  const copy: Record<BillingLocale, { subject: string; lead: string; term: string; cancel: string }> = {
    en: {
      subject: `${a.made + a.received} interactions so far on ${APP}`,
      lead: `You have ${a.made} interactions made and ${a.received} received — ${a.made + a.received} in total.`,
      term: `Your ${a.planName} plan (${a.priceLabel}) starts after ${a.remaining} more interactions, or on the last day of your trial, whichever comes first.`,
      cancel: `Cancel before then and you pay nothing:`
    },
    pt: {
      subject: `${a.made + a.received} interações até agora no ${APP}`,
      lead: `Você tem ${a.made} interações feitas e ${a.received} recebidas — ${a.made + a.received} no total.`,
      term: `Seu plano ${a.planName} (${a.priceLabel}) começa depois de mais ${a.remaining} interações, ou no último dia do seu teste, o que vier primeiro.`,
      cancel: `Cancele antes disso e você não paga nada:`
    },
    es: {
      subject: `${a.made + a.received} interacciones hasta ahora en ${APP}`,
      lead: `Tienes ${a.made} interacciones hechas y ${a.received} recibidas: ${a.made + a.received} en total.`,
      term: `Tu plan ${a.planName} (${a.priceLabel}) comienza después de ${a.remaining} interacciones más, o el último día de tu prueba, lo que ocurra primero.`,
      cancel: `Cancela antes y no pagas nada:`
    }
  }
  const c = copy[locale]
  return {
    subject: c.subject,
    text: `${c.lead}\n\n${c.term}\n\n${c.cancel} ${a.billingUrl}`,
    html: `<p>${c.lead}</p><p>${c.term}</p><p>${c.cancel} <a href="${a.billingUrl}">${a.billingUrl}</a></p>`
  }
}

interface EndingArgs {
  endsOn: string
  planName: string
  priceLabel: string
  billingUrl: string
}

export function trialEndingEmail(locale: BillingLocale, a: EndingArgs): EmailContent {
  const copy: Record<BillingLocale, { subject: string; term: string; cancel: string }> = {
    en: {
      subject: `Your ${APP} trial ends on ${a.endsOn}`,
      term: `Your free trial ends on ${a.endsOn}. Your ${a.planName} plan (${a.priceLabel}) starts that day.`,
      cancel: `Cancel before then and you pay nothing:`
    },
    pt: {
      subject: `Seu teste do ${APP} termina em ${a.endsOn}`,
      term: `Seu teste grátis termina em ${a.endsOn}. Seu plano ${a.planName} (${a.priceLabel}) começa nesse dia.`,
      cancel: `Cancele antes disso e você não paga nada:`
    },
    es: {
      subject: `Tu prueba de ${APP} termina el ${a.endsOn}`,
      term: `Tu prueba gratuita termina el ${a.endsOn}. Tu plan ${a.planName} (${a.priceLabel}) comienza ese día.`,
      cancel: `Cancela antes y no pagas nada:`
    }
  }
  const c = copy[locale]
  return {
    subject: c.subject,
    text: `${c.term}\n\n${c.cancel} ${a.billingUrl}`,
    html: `<p>${c.term}</p><p>${c.cancel} <a href="${a.billingUrl}">${a.billingUrl}</a></p>`
  }
}

export function duplicateSubscriptionCanceledEmail(
  locale: BillingLocale,
  a: { planName: string; billingUrl: string }
): EmailContent {
  const copy: Record<BillingLocale, { subject: string; body: string; link: string }> = {
    en: {
      subject: `We removed a duplicate subscription on ${APP}`,
      body: `A second subscription was created on your account by mistake, so we cancelled it right away. You have not been charged for it. Your ${a.planName} plan is unchanged.`,
      link: `See your subscription:`
    },
    pt: {
      subject: `Removemos uma assinatura duplicada no ${APP}`,
      body: `Uma segunda assinatura foi criada na sua conta por engano, então cancelamos na hora. Você não foi cobrado por ela. Seu plano ${a.planName} continua igual.`,
      link: `Veja sua assinatura:`
    },
    es: {
      subject: `Eliminamos una suscripción duplicada en ${APP}`,
      body: `Se creó una segunda suscripción en tu cuenta por error, así que la cancelamos de inmediato. No se te cobró por ella. Tu plan ${a.planName} sigue igual.`,
      link: `Consulta tu suscripción:`
    }
  }
  const c = copy[locale]
  return {
    subject: c.subject,
    text: `${c.body}\n\n${c.link} ${a.billingUrl}`,
    html: `<p>${c.body}</p><p>${c.link} <a href="${a.billingUrl}">${a.billingUrl}</a></p>`
  }
}
```

- [ ] **Step 5: Run the test and confirm it passes**

Run: `pnpm --filter convex test billingEmails`
Expected: PASS. If `formatPriceLabel` fails the `'150'` assertion, check the `minimumFractionDigits` branch —
`15000 % 100 === 0` so it must render `$150`, not `$150.00`.

- [ ] **Step 6: Save only — do NOT commit**

---

## Task 7: The billing mailers and the day-7 reminder

**Files:**

- Modify: `convex/billing.ts`, `convex/interactions.ts`, `convex/http.ts`
- Create: `convex/notifications.ts`

**Interfaces:**

- Consumes: `crossesThreshold`, `TRIAL_WARNING_THRESHOLD`, `pickTrialingSubscription`, `findLiveSubscription` (Task 1);
  `resolveBillingLocale` (Task 2); `listUserSubscriptions` (Task 4); the three builders + `formatPriceLabel` (Task 6).
- Produces: `internal.billing.getBillingContext({ userId })`,
  `internal.billing.getUserBySubscriptionId({ stripeSubscriptionId })`,
  `internal.notifications.sendTrialNearEnd({ userId })`,
  `internal.notifications.sendTrialEnding({ stripeSubscriptionId, trialEndsAt })`,
  `internal.notifications.sendDuplicateCanceled({ userId, planName })`.

- [ ] **Step 1: Add the context readers**

In `convex/billing.ts`, append:

```ts
/**
 * Everything a billing mailer needs about a member, in one read: who they are, what language to
 * write in, how far into the trial they are, and the price Stripe is about to charge.
 */
export const getBillingContext = internalQuery({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }) => {
    const user = await ctx.db.get(userId)
    if (!user) return null
    const subscriptions = await ctx.db
      .query('subscriptions')
      .withIndex('by_user', q => q.eq('userId', userId))
      .collect()
    return {
      email: user.email,
      language: user.language,
      primaryLocale: user.primaryLocale,
      tier: user.tier,
      subscriptionStatus: user.subscriptionStatus,
      trialEndsAt: user.trialEndsAt,
      made: user.trialInteractionsMade ?? 0,
      received: user.trialInteractionsReceived ?? 0,
      subscriptions
    }
  }
})

/** Resolves a Stripe subscription id back to our user, for webhook-driven notices. */
export const getUserBySubscriptionId = internalQuery({
  args: { stripeSubscriptionId: v.string() },
  handler: async (ctx, { stripeSubscriptionId }) => {
    const sub = await ctx.db
      .query('subscriptions')
      .withIndex('by_stripe_id', q => q.eq('stripeSubscriptionId', stripeSubscriptionId))
      .first()
    return sub ? { userId: sub.userId, status: sub.status } : null
  }
})
```

If `user.email` is not on the users table under that name, check `convex/schema.ts` for the actual field and use it;
`convex/privacy/retention.ts:113` reads `u.email`, so it exists.

- [ ] **Step 2: Write the mailer actions**

Create `convex/notifications.ts`:

```ts
// convex/notifications.ts
// Transactional billing notices. I/O only — every string comes from lib/billingEmails.ts and every
// branch from lib/trialMilestone.ts, so the copy and the rules are unit-tested without a database.
//
// Two trial-end paths exist and must never both fire for one event:
//   • 50 interactions  → endTrialEarly sets trial_end:'now', so Stripe emits no trial_will_end.
//                        Ours is the only warning, sent at 40 (lib/trialMilestone.ts).
//   • 7 elapsed days   → Stripe emits customer.subscription.trial_will_end 3 days ahead.
//                        Ours handles it; Stripe's own trial-ending email stays OFF in the
//                        Dashboard (see docs/PLATFORM.md §8, Stripe Dashboard setup).
import { internalAction } from './_generated/server'
import { v } from 'convex/values'
import { internal } from './_generated/api'
import { sendEmail } from './lib/email'
import { scrubError } from './lib/scrubError'
import { resolveBillingLocale } from './lib/checkoutCopy'
import {
  duplicateSubscriptionCanceledEmail,
  formatPriceLabel,
  trialEndingEmail,
  trialNearEndEmail
} from './lib/billingEmails'
import { pickTrialingSubscription, TRIAL_INTERACTION_THRESHOLD } from './lib/trialMilestone'

const PLAN_NAMES: Record<string, string> = {
  starter: 'Starter',
  growth: 'Growth',
  pro: 'Pro',
  contact: 'Enterprise'
}

function billingUrl(): string {
  return `${process.env.APP_URL ?? 'http://localhost:5173'}/billing`
}

/**
 * sendEmail no-ops when RESEND_API_KEY / EMAIL_FROM are unset (lib/email.ts:26). For a privacy
 * flow that is a convenience; for a pre-charge notice it is a compliance hole, so make it loud
 * in `pnpm watch:errors` and the Convex dashboard.
 */
async function deliver(kind: string, to: string, m: { subject: string; html: string; text: string }): Promise<void> {
  const result = await sendEmail({ to, subject: m.subject, html: m.html, text: m.text })
  if (result.skipped) {
    console.error('[billing] notification skipped — email not configured', scrubError({ kind }))
  }
}

/** Fired once, on the interaction that reaches 40 of 50. Progress note first, then the term. */
export const sendTrialNearEnd = internalAction({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }) => {
    const c = await ctx.runQuery(internal.billing.getBillingContext, { userId })
    if (!c?.email) return
    // Never mail someone who already left: status moved on, or they cancelled at period end.
    if (c.subscriptionStatus !== 'trialing') return
    const sub = pickTrialingSubscription(c.subscriptions)
    if (!sub) return

    const locale = resolveBillingLocale(c.language, c.primaryLocale)
    const combined = c.made + c.received
    const m = trialNearEndEmail(locale, {
      made: c.made,
      received: c.received,
      remaining: Math.max(0, TRIAL_INTERACTION_THRESHOLD - combined),
      planName: PLAN_NAMES[sub.tier] ?? PLAN_NAMES.growth,
      priceLabel: formatPriceLabel(locale, {
        amount: sub.priceAmount,
        currency: sub.priceCurrency,
        interval: sub.priceInterval
      }),
      billingUrl: billingUrl()
    })
    await deliver('trial_near_end', c.email, m)
  }
})

/** Stripe's customer.subscription.trial_will_end, 3 days before the 7-day trial elapses. */
export const sendTrialEnding = internalAction({
  args: { stripeSubscriptionId: v.string(), trialEndsAt: v.number() },
  handler: async (ctx, { stripeSubscriptionId, trialEndsAt }) => {
    const owner = await ctx.runQuery(internal.billing.getUserBySubscriptionId, { stripeSubscriptionId })
    if (!owner) return
    const c = await ctx.runQuery(internal.billing.getBillingContext, { userId: owner.userId })
    if (!c?.email || c.subscriptionStatus !== 'trialing') return
    const sub = c.subscriptions.find(s => s.stripeSubscriptionId === stripeSubscriptionId)
    if (!sub || sub.status !== 'trialing') return

    const locale = resolveBillingLocale(c.language, c.primaryLocale)
    const tag = locale === 'pt' ? 'pt-BR' : locale === 'es' ? 'es' : 'en'
    const m = trialEndingEmail(locale, {
      endsOn: new Date(trialEndsAt).toLocaleDateString(tag, { day: 'numeric', month: 'long', year: 'numeric' }),
      planName: PLAN_NAMES[sub.tier] ?? PLAN_NAMES.growth,
      priceLabel: formatPriceLabel(locale, {
        amount: sub.priceAmount,
        currency: sub.priceCurrency,
        interval: sub.priceInterval
      }),
      billingUrl: billingUrl()
    })
    await deliver('trial_ending', c.email, m)
  }
})

/** A duplicate subscription was voided by the webhook — say so, never silently. */
export const sendDuplicateCanceled = internalAction({
  args: { userId: v.id('users'), planName: v.string() },
  handler: async (ctx, { userId, planName }) => {
    const c = await ctx.runQuery(internal.billing.getBillingContext, { userId })
    if (!c?.email) return
    const locale = resolveBillingLocale(c.language, c.primaryLocale)
    await deliver('duplicate_canceled', c.email, duplicateSubscriptionCanceledEmail(locale, { planName, billingUrl: billingUrl() }))
  }
})
```

- [ ] **Step 3: Schedule the 40-of-50 notice**

In `convex/interactions.ts`, extend the `./lib/trialMilestone` import with `TRIAL_WARNING_THRESHOLD`, and insert this
**immediately before** the existing `if (crossesThreshold(combined, 1)) {` block inside `bumpTrialInteraction`:

```ts
  // 80% of the way: one heads-up before the plan starts, never an alarm. crossesThreshold's
  // semantics guarantee it fires exactly once per member.
  if (crossesThreshold(combined, 1, TRIAL_WARNING_THRESHOLD)) {
    await ctx.scheduler.runAfter(0, internal.notifications.sendTrialNearEnd, { userId })
  }
```

- [ ] **Step 4: Handle the Stripe trial_will_end event**

In `convex/http.ts`, add a handler inside the `events: { … }` object, after `'customer.subscription.deleted'`:

```ts
    // Stripe fires this 3 days before trial_end. It NEVER fires for the 50-interaction path
    // (endTrialEarly sets trial_end:'now'), which is why that path has its own 40-of-50 notice.
    // Stripe's built-in trial-ending email must stay OFF so the member gets exactly one warning.
    'customer.subscription.trial_will_end': async (ctx: StripeEvent, event: StripeEvent) => {
      const sub = event.data.object
      if (!sub.trial_end) return
      await ctx.scheduler.runAfter(0, internal.notifications.sendTrialEnding, {
        stripeSubscriptionId: sub.id,
        trialEndsAt: sub.trial_end * 1000
      })
    },
```

If `ctx.scheduler` is not available on the webhook context, call
`ctx.runAction(internal.notifications.sendTrialEnding, { … })` instead; verify against the other handlers'
`ctx.runMutation` usage in the same file and keep whichever the component's context exposes.

- [ ] **Step 5: Typecheck and run the convex suite**

Run: `pnpm --filter convex exec tsc --noEmit -p tsconfig.json && pnpm --filter convex test`
Expected: both exit 0.

- [ ] **Step 6: Save only — do NOT commit**

---

## Task 8: Void a duplicate subscription

**Files:**

- Modify: `convex/http.ts`, `convex/billingNode.ts`

**Interfaces:**

- Consumes: `findLiveSubscription` (Task 1), `internal.billing.listUserSubscriptions` (Task 4),
  `internal.users.setBillingNotice` (Task 3), `internal.notifications.sendDuplicateCanceled` (Task 7).
- Produces: `internal.billingNode.cancelDuplicateSubscription({ userId, stripeSubscriptionId, planName })`.

- [ ] **Step 1: Add the cancel action**

The guard in `createCheckoutSession` runs when the session is created; this closes the window between that check and
Stripe completing payment (two tabs, two checkouts). Append to `convex/billingNode.ts`:

```ts
/**
 * Voids a subscription created while the member already had a live one (the two-tab race the
 * checkout guard cannot see). The NEWER subscription is the one cancelled, so the member keeps the
 * plan they already had. Never silent: the caller raises an in-app notice and sends an email.
 */
export const cancelDuplicateSubscription = internalAction({
  args: { userId: v.id('users'), stripeSubscriptionId: v.string(), planName: v.string() },
  handler: async (ctx, { userId, stripeSubscriptionId, planName }) => {
    await stripe().subscriptions.cancel(stripeSubscriptionId, { prorate: false, invoice_now: false })
    console.error('[billing] voided duplicate subscription', { stripeSubscriptionId })
    await ctx.runMutation(internal.users.setBillingNotice, { userId, notice: 'duplicate_canceled' })
    await ctx.scheduler.runAfter(0, internal.notifications.sendDuplicateCanceled, { userId, planName })
  }
})
```

- [ ] **Step 2: Detect the duplicate in the webhook**

In `convex/http.ts`, inside `'customer.subscription.created'`, **after** the existing
`ctx.runMutation(internal.stripe.syncUserSubscription, { … })` call (the row must exist before we look for siblings):

```ts
      // Two tabs, two checkouts: if a LIVE subscription other than this one already exists, void
      // the one that just arrived. Guarded here rather than in checkout because the race happens
      // between session creation and Stripe completing the payment.
      const owner = await ctx.runQuery(internal.billing.getUserBySubscriptionId, {
        stripeSubscriptionId: sub.id
      })
      if (owner) {
        const rows = await ctx.runQuery(internal.billing.listUserSubscriptions, { userId: owner.userId })
        const other = rows.filter(
          (r: { stripeSubscriptionId: string; status: string }) => r.stripeSubscriptionId !== sub.id
        )
        const live = findLiveSubscription(other)
        if (live) {
          await ctx.scheduler.runAfter(0, internal.billingNode.cancelDuplicateSubscription, {
            userId: owner.userId,
            stripeSubscriptionId: sub.id,
            planName: live.tier.charAt(0).toUpperCase() + live.tier.slice(1)
          })
        }
      }
```

Add `import { findLiveSubscription } from './lib/trialMilestone'` at the top of `convex/http.ts`.

- [ ] **Step 3: Typecheck and run the convex suite**

Run: `pnpm --filter convex exec tsc --noEmit -p tsconfig.json && pnpm --filter convex test`
Expected: both exit 0.

- [ ] **Step 4: Save only — do NOT commit**

---

## Task 9: App locale keys

**Files:**

- Modify: `app/src/i18n/locales/en.json`, `pt.json`, `es.json`
- Test: `app/src/i18n/i18n.test.ts`

**Interfaces:**

- Consumes: nothing.
- Produces: the `billing.*` keys Tasks 10 and 11 render.

- [ ] **Step 1: Add the English keys**

Inside the `billing` object of `app/src/i18n/locales/en.json`, add:

```json
    "switchPlan": "Switch to {{plan}}",
    "startTrialCta": "Start 7-day {{plan}} trial",
    "seeAllPlans": "See all plans",
    "hideAllPlans": "Hide other plans",
    "chosenPlanLead": "You picked {{plan}} on the site. Its 7-day trial starts below.",
    "alreadySubscribed": "You already have a plan. Manage it from the billing portal.",
    "nearThresholdBanner": "{{remaining}} interactions from your plan starting · {{plan}}, {{price}}",
    "duplicateCanceledNotice": "A duplicate subscription was created by mistake and we cancelled it right away. You were not charged for it.",
    "dismiss": "Dismiss",
```

and change the existing `trialBanner` so it names the member's real plan:

```json
    "trialBanner": "You're on a free {{plan}} trial. You'll be billed once you reach 50 interactions or after 7 days, whichever comes first.",
```

- [ ] **Step 2: Add the Portuguese keys (pt-BR, not European)**

Same position in `pt.json`:

```json
    "switchPlan": "Mudar para {{plan}}",
    "startTrialCta": "Iniciar teste de 7 dias do {{plan}}",
    "seeAllPlans": "Ver todos os planos",
    "hideAllPlans": "Ocultar os outros planos",
    "chosenPlanLead": "Você escolheu o {{plan}} no site. O teste de 7 dias começa abaixo.",
    "alreadySubscribed": "Você já tem um plano. Gerencie pelo portal de cobrança.",
    "nearThresholdBanner": "Faltam {{remaining}} interações para seu plano começar · {{plan}}, {{price}}",
    "duplicateCanceledNotice": "Uma assinatura duplicada foi criada por engano e cancelamos na hora. Você não foi cobrado por ela.",
    "dismiss": "Dispensar",
    "trialBanner": "Você está em um teste grátis do {{plan}}. A cobrança começa ao atingir 50 interações ou depois de 7 dias, o que vier primeiro.",
```

- [ ] **Step 3: Add the Spanish keys (neutral LatAm)**

Same position in `es.json`:

```json
    "switchPlan": "Cambiar a {{plan}}",
    "startTrialCta": "Iniciar prueba de 7 días de {{plan}}",
    "seeAllPlans": "Ver todos los planes",
    "hideAllPlans": "Ocultar los otros planes",
    "chosenPlanLead": "Elegiste {{plan}} en el sitio. Su prueba de 7 días empieza abajo.",
    "alreadySubscribed": "Ya tienes un plan. Adminístralo desde el portal de facturación.",
    "nearThresholdBanner": "Faltan {{remaining}} interacciones para que empiece tu plan · {{plan}}, {{price}}",
    "duplicateCanceledNotice": "Se creó una suscripción duplicada por error y la cancelamos de inmediato. No se te cobró por ella.",
    "dismiss": "Descartar",
    "trialBanner": "Estás en una prueba gratuita de {{plan}}. El cobro empieza al llegar a 50 interacciones o después de 7 días, lo que ocurra primero.",
```

- [ ] **Step 4: Probe the new keys in the i18n test**

In `app/src/i18n/i18n.test.ts`, add one assertion per language inside the existing tests:

```ts
    expect(i18n.t('billing.seeAllPlans')).toBe('See all plans')      // in the english test
    expect(i18n.t('billing.seeAllPlans')).toBe('Ver todos os planos') // in the portuguese test
    expect(i18n.t('billing.seeAllPlans')).toBe('Ver todos los planes') // in the spanish test
```

- [ ] **Step 5: Verify all three files parse and are in parity**

Run:

```bash
node -e "const a=require('./app/src/i18n/locales/en.json'),b=require('./app/src/i18n/locales/pt.json'),c=require('./app/src/i18n/locales/es.json');const k=o=>Object.keys(o.billing).sort().join(',');if(k(a)!==k(b)||k(a)!==k(c))throw new Error('billing keys differ');console.log('billing keys in parity:',Object.keys(a.billing).length)"
```

Expected: prints the count, throws nothing.

- [ ] **Step 6: Run the app test suite**

Run: `pnpm --filter app test i18n`
Expected: PASS.

- [ ] **Step 7: Save only — do NOT commit**

---

## Task 10: BillingPage — portal routing and the new banners

**Files:**

- Modify: `app/src/pages/BillingPage.tsx`

**Interfaces:**

- Consumes: the keys from Task 9; `nearThreshold` from `getTrialProgress` (Task 3); `billingNotice` on `getMe` (Task 3);
  `api.users.clearBillingNotice` (Task 3); the `ALREADY_SUBSCRIBED` error (Task 4).
- Produces: nothing for later tasks except the file Task 11 also edits — do Task 10 first, then Task 11.

- [ ] **Step 1: Route card holders to the portal**

Replace the `hasCard` definition (`:63-64`) with:

```ts
  // A "card holder" is anyone Stripe is currently managing: they switch plans in the Customer
  // Portal, never through a second checkout. 'canceled' is deliberately excluded — a canceled
  // member re-subscribes through checkout (without a trial, enforced server-side).
  // NB: keyed on status, not stripeCustomerId — toSafeMe (convex/users.ts:79) strips that field.
  const hasCard =
    me?.subscriptionStatus === 'trialing' ||
    me?.subscriptionStatus === 'active' ||
    me?.subscriptionStatus === 'past_due'
```

- [ ] **Step 2: Show the portal to every card holder**

Change the billing-info card condition (`:116`) from `me?.subscriptionStatus === 'active'` to `hasCard` so trialing and
past_due members can reach the portal at all:

```tsx
      {subscriptionInfo && hasCard && (
```

- [ ] **Step 3: Handle ALREADY_SUBSCRIBED and add the plan-click router**

Replace `handleUpgrade` (`:83-91`) and add a dispatcher below it:

```tsx
  async function handleUpgrade(priceId: string) {
    try {
      if (!sessionToken) throw new Error(t('auth.notSignedIn'))
      const result = await createCheckout({ priceId, sessionToken, locale: i18n.language.slice(0, 2) })
      if (result?.url) {
        // Consume the landing's choice so a later visit in this tab does not re-nudge.
        sessionStorage.removeItem('chosenPlan')
        sessionStorage.removeItem('chosenInterval')
        window.location.href = result.url
      }
    } catch (err: unknown) {
      const message = friendlyError(err, String(err))
      // The server refuses a second live subscription. That is a door, not a failure: open it.
      if (message.startsWith('ALREADY_SUBSCRIBED')) {
        toast(t('billing.alreadySubscribed'))
        await handleManageSubscription()
        return
      }
      toast(t('billing.checkoutFailed', { error: message }))
    }
  }

  // Card holders switch plans in the portal; everyone else checks out.
  function handlePlanClick(priceId: string) {
    if (hasCard) return void handleManageSubscription()
    return void handleUpgrade(priceId)
  }
```

Pull `i18n` out of the existing hook call at `:40`: `const { t, i18n } = useTranslation()`.

- [ ] **Step 4: Use the dispatcher and the switch label on every plan card**

In the plan-grid button (`:279-285`), replace `onClick` and the label:

```tsx
                <Button
                  onClick={() => priceId && handlePlanClick(priceId)}
                  disabled={!priceId}
                  className={`mt-auto w-full text-[13px] ${priceId ? 'cursor-pointer opacity-100' : 'cursor-not-allowed opacity-60'}`}
                >
                  {hasCard
                    ? t('billing.switchPlan', { plan: t(`billing.plans.${planId}.name`) })
                    : t('billing.startTrialCta', { plan: t(`billing.plans.${planId}.name`) })}
                </Button>
```

- [ ] **Step 5: Make the trial banner tier-aware and add the amber near-threshold state**

Replace the trial-banner block (`:157-189`) opening lines. Keep the meter, the SSI link and the rest of the block
exactly as they are — **do not touch the SSI link (that is R15)**:

```tsx
      {/* Trial banner — accent while there is room, amber from 40 of 50 (information, not alarm) */}
      {isTrialing && !isTrialExpired && (
        <div
          className={`mb-6 rounded-xl border p-4 text-sm ${
            progress?.nearThreshold
              ? 'border-warning/30 bg-warning/10 text-warning-foreground'
              : 'border-border bg-accent text-accent-foreground'
          }`}
        >
          <p className="m-0">
            ⏳{' '}
            {progress?.nearThreshold
              ? t('billing.nearThresholdBanner', {
                  remaining: Math.max(0, (progress.threshold ?? 50) - (progress.combined ?? 0)),
                  plan: t(`billing.plans.${me?.tier ?? 'growth'}.name`),
                  price: PLAN_PRICES[billingInterval][me?.tier ?? 'growth'] ?? ''
                })
              : t('billing.trialBanner', { plan: t(`billing.plans.${me?.tier ?? 'growth'}.name`) })}
          </p>
```

If `border-warning` / `bg-warning` are not defined tokens in this project's Tailwind theme, check `app/src/index.css`
for the amber token actually in use (the `Badge` component has a `warning` variant — reuse whatever colour that variant
resolves to). **Do not introduce a raw hex or a `yellow-500`-style utility**; `app/src` is 100% token-clean in light and
dark and must stay that way.

- [ ] **Step 6: Add the duplicate-canceled notice**

Add `useMutation` to the `convex/react` import, then above the trial banner:

```tsx
      {/* A voided duplicate subscription is never silent — see convex/http.ts. */}
      {me?.billingNotice === 'duplicate_canceled' && (
        <div className="border-border bg-muted mb-6 flex items-start justify-between gap-3 rounded-xl border p-4 text-sm">
          <p className="m-0">{t('billing.duplicateCanceledNotice')}</p>
          <Button
            variant="outline"
            className="shrink-0 text-[12px]"
            onClick={() => sessionToken && void clearBillingNotice({ sessionToken })}
          >
            {t('billing.dismiss')}
          </Button>
        </div>
      )}
```

with `const clearBillingNotice = useMutation(api.users.clearBillingNotice)` beside the other hooks.

- [ ] **Step 7: Typecheck and lint**

Run: `pnpm --filter app exec tsc --noEmit && pnpm lint`
Expected: both exit 0.

- [ ] **Step 8: Save only — do NOT commit**

---

## Task 11: BillingPage — honour the chosen plan (R03)

**Files:**

- Modify: `app/src/pages/BillingPage.tsx`

**Interfaces:**

- Consumes: Task 10's `hasCard` / `handlePlanClick`; the keys from Task 9.
- Produces: nothing for later tasks.

- [ ] **Step 1: Resolve the target plan**

Add `import { useSearchParams } from 'react-router-dom'` and, beside the other hooks:

```tsx
  const [searchParams] = useSearchParams()
  // The visitor already chose a plan on the landing page (carried through OAuth into
  // sessionStorage by AuthSuccessPage, or passed directly as ?plan=). Re-asking is re-opening a
  // decision they already made. Growth stays the fallback for anyone arriving cold.
  const planParam = searchParams.get('plan')
  const stashedPlan = sessionStorage.getItem('chosenPlan')
  const isPlanId = (p: string | null): p is (typeof PLAN_IDS)[number] =>
    !!p && (PLAN_IDS as readonly string[]).includes(p)
  const chosenPlan = isPlanId(planParam) ? planParam : isPlanId(stashedPlan) ? stashedPlan : null
  const targetPlan = chosenPlan ?? 'growth'
  const [showAllPlans, setShowAllPlans] = useState(false)
```

- [ ] **Step 2: Point the recommended badge at the target plan**

Replace `:229`:

```tsx
          const isRecommended = planId === targetPlan && !hasCard
```

- [ ] **Step 3: Lead with the decision the visitor already made**

Replace the `!hasCard` lead block (`:199-204`):

```tsx
      {!hasCard && (
        <div className="mb-4">
          <p className="text-foreground text-base font-semibold">
            {chosenPlan
              ? t('billing.chosenPlanLead', { plan: t(`billing.plans.${targetPlan}.name`) })
              : t('billing.newUserLead')}
          </p>
          <p className="text-muted-foreground mt-1 text-[13px]">{t('billing.newUserTrialNote')}</p>
        </div>
      )}
```

- [ ] **Step 4: Collapse the grid to the chosen plan for pre-card members**

Give one card the weight instead of rendering three at equal weight. Change the `PLAN_IDS.map(…)` source so a pre-card
member who has not expanded sees only their plan, and add the toggle immediately above the grid:

```tsx
      {/* Pre-card: one plan, one decision. The full grid (and the Pro/Enterprise anchor that makes
          Growth look cheap) stays one click away. Card holders always see the grid — a member
          switching plans needs the comparison. */}
      {!hasCard && (
        <button
          onClick={() => setShowAllPlans(v => !v)}
          className="text-muted-foreground hover:text-foreground mb-3 text-[13px] underline"
        >
          {showAllPlans ? t('billing.hideAllPlans') : t('billing.seeAllPlans')}
        </button>
      )}

      <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4">
        {(hasCard || showAllPlans ? PLAN_IDS : PLAN_IDS.filter(p => p === targetPlan)).map(planId => {
```

The Enterprise / Contact card sits outside this `.map()` (`:292-303`) and therefore stays visible in both layouts —
leave it exactly where it is.

- [ ] **Step 5: Typecheck, lint and format**

Run: `pnpm --filter app exec tsc --noEmit && pnpm lint`
Expected: both exit 0. Then check formatting on **your files only** (never `pnpm format`, see Global Constraints):

```bash
pnpm exec prettier --check app/src/pages/BillingPage.tsx
```

Fix with `pnpm exec prettier --write app/src/pages/BillingPage.tsx` if it complains.

- [ ] **Step 6: Save only — do NOT commit**

---

## Task 12: BillingPage tests

**Files:**

- Create: `app/src/pages/BillingPage.test.tsx`

**Interfaces:**

- Consumes: everything from Tasks 9, 10 and 11.
- Produces: nothing.

There is no BillingPage test today. Follow the `app/src/pages/MyPostsPage.test.tsx` pattern: mock `../convex` so every
query and action has a stable string reference, then dispatch on it.

- [ ] **Step 1: Write the tests**

Create `app/src/pages/BillingPage.test.tsx`:

```tsx
// app/src/pages/BillingPage.test.tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

// Stable string refs so the useQuery/useAction mocks can dispatch by WHICH function was asked for.
vi.mock('../convex', () => ({
  api: {
    users: {
      getMe: 'users.getMe',
      getSubscriptionInfo: 'users.getSubscriptionInfo',
      getTrialProgress: 'users.getTrialProgress',
      clearBillingNotice: 'users.clearBillingNotice'
    },
    billing: { createPortalSession: 'billing.createPortalSession' },
    billingNode: { createCheckoutSession: 'billingNode.createCheckoutSession' }
  }
}))

let mockQueryReturns: Record<string, unknown> = {}
const mockCheckout = vi.fn(async () => ({ url: '' }))
const mockPortal = vi.fn(async () => ({ url: '' }))

vi.mock('convex/react', () => ({
  useQuery: vi.fn((ref: string) => mockQueryReturns[ref]),
  useAction: vi.fn((ref: string) => (ref === 'billing.createPortalSession' ? mockPortal : mockCheckout)),
  useMutation: vi.fn(() => vi.fn(async () => {}))
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    // Echo the key plus its interpolation so assertions can see both.
    t: (k: string, o?: Record<string, unknown>) => (o && !('returnObjects' in o) ? `${k}:${JSON.stringify(o)}` : k),
    i18n: { language: 'en' }
  })
}))

import BillingPage from './BillingPage'

function setUser(over: Record<string, unknown> = {}) {
  mockQueryReturns['users.getMe'] = { _id: 'u1', tier: 'growth', subscriptionStatus: 'none', ...over }
}

function renderPage() {
  return render(
    <MemoryRouter>
      <BillingPage />
    </MemoryRouter>
  )
}

beforeEach(() => {
  sessionStorage.clear()
  sessionStorage.setItem('sessionToken', 'tok')
  mockCheckout.mockClear()
  mockPortal.mockClear()
  mockQueryReturns = {
    'users.getSubscriptionInfo': { tier: 'growth', status: 'trialing', cancelAtPeriodEnd: false },
    'users.getTrialProgress': { made: 1, received: 1, combined: 2, threshold: 50, reached: false, nearThreshold: false }
  }
  setUser()
})

describe('plan click routing (R01)', () => {
  it('sends a pre-card member to checkout', async () => {
    renderPage()
    fireEvent.click(screen.getAllByRole('button', { name: /billing.startTrialCta/ })[0])
    await waitFor(() => expect(mockCheckout).toHaveBeenCalled())
    expect(mockPortal).not.toHaveBeenCalled()
  })

  it('sends a trialing card holder to the portal instead of a second checkout', async () => {
    setUser({ subscriptionStatus: 'trialing' })
    renderPage()
    fireEvent.click(screen.getAllByRole('button', { name: /billing.switchPlan/ })[0])
    await waitFor(() => expect(mockPortal).toHaveBeenCalled())
    expect(mockCheckout).not.toHaveBeenCalled()
  })

  it('opens the portal when the server refuses with ALREADY_SUBSCRIBED', async () => {
    mockCheckout.mockRejectedValueOnce(new Error('ALREADY_SUBSCRIBED: You already have a plan.'))
    renderPage()
    fireEvent.click(screen.getAllByRole('button', { name: /billing.startTrialCta/ })[0])
    await waitFor(() => expect(mockPortal).toHaveBeenCalled())
  })

  it('shows the Manage Subscription button to a trialing member', () => {
    setUser({ subscriptionStatus: 'trialing' })
    renderPage()
    expect(screen.getByRole('button', { name: 'billing.manageSubscription' })).toBeInTheDocument()
  })

  it('shows the Manage Subscription button to a past_due member', () => {
    setUser({ subscriptionStatus: 'past_due' })
    renderPage()
    expect(screen.getByRole('button', { name: 'billing.manageSubscription' })).toBeInTheDocument()
  })
})

describe('chosen plan (R03)', () => {
  it('follows sessionStorage.chosenPlan', () => {
    sessionStorage.setItem('chosenPlan', 'pro')
    renderPage()
    expect(screen.getByText(/billing.chosenPlanLead.*Pro/)).toBeInTheDocument()
  })

  it('falls back to growth with no stash and no query param', () => {
    renderPage()
    expect(screen.getByText('billing.newUserLead')).toBeInTheDocument()
  })

  it('shows only the chosen plan until the member asks for the rest', () => {
    sessionStorage.setItem('chosenPlan', 'pro')
    renderPage()
    expect(screen.queryByText('billing.plans.starter.name')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'billing.seeAllPlans' }))
    expect(screen.getByText('billing.plans.starter.name')).toBeInTheDocument()
  })

  it('names the real tier in the trial banner, not always Growth', () => {
    setUser({ subscriptionStatus: 'trialing', tier: 'pro', trialEndsAt: Date.now() + 86400000 })
    renderPage()
    expect(screen.getByText(/billing.trialBanner.*Pro/)).toBeInTheDocument()
  })
})

describe('near-threshold state (R02)', () => {
  it('switches the banner to the amber near-threshold copy at 40 of 50', () => {
    setUser({ subscriptionStatus: 'trialing', trialEndsAt: Date.now() + 86400000 })
    mockQueryReturns['users.getTrialProgress'] = {
      made: 32, received: 8, combined: 40, threshold: 50, reached: false, nearThreshold: true
    }
    renderPage()
    expect(screen.getByText(/billing.nearThresholdBanner/)).toBeInTheDocument()
  })
})

describe('duplicate notice', () => {
  it('renders the notice when the backend raised it', () => {
    setUser({ billingNotice: 'duplicate_canceled' })
    renderPage()
    expect(screen.getByText('billing.duplicateCanceledNotice')).toBeInTheDocument()
  })
  it('renders nothing when there is no notice', () => {
    renderPage()
    expect(screen.queryByText('billing.duplicateCanceledNotice')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test**

Run: `pnpm --filter app test BillingPage`
Expected: PASS. Adjust only the **selectors** if the rendered markup differs (for example if the plan name renders
inside a heading rather than plain text) — never weaken an assertion to make it pass. If a test reveals a real gap in
Task 10 or 11, fix the page, not the test.

- [ ] **Step 3: Run the whole app suite**

Run: `pnpm --filter app test`
Expected: PASS, no regressions.

- [ ] **Step 4: Save only — do NOT commit**

---

## Task 13: The Terms clause (landing, three locales)

**Files:**

- Modify: `landing/app/[lang]/terms/content/en.tsx`, `pt.tsx`, `es.tsx`

**Interfaces:**

- Consumes: nothing. Fully independent of every other task.
- Produces: nothing.

Two changes per file, both inside the existing **§5 Subscriptions & Billing** block. The trial rule is currently in the
landing hero, the pricing note and the FAQ, but nowhere in the Terms — and a term the member first meets at the charge
is expectation debt. The existing paragraph also says billing is **monthly**, which is wrong: annual is the default
interval and both are sold.

- [ ] **Step 1: English**

In `landing/app/[lang]/terms/content/en.tsx`, replace the first paragraph of §5 and add a trial paragraph directly after
it:

```tsx
        <p>
          Access to the Service requires an active paid subscription. Subscriptions are billed{' '}
          <strong className="text-cream">monthly or annually</strong>, according to the plan and interval you choose,
          via Stripe. By subscribing you authorise Stripe to charge the payment method you provide on that recurring
          basis until you cancel.
        </p>
        <p>
          <strong className="text-cream">Free trial.</strong> New accounts start with a{' '}
          <strong className="text-cream">7-day free trial</strong> and a payment method is required to begin it. The
          trial ends — and billing starts — as soon as you reach{' '}
          <strong className="text-cream">50 interactions</strong> (made plus received) or after{' '}
          <strong className="text-cream">7 days</strong>, whichever comes first. We notify you by email before the
          first charge. You may cancel at any time before the trial ends from the Subscription page in your account,
          and you will not be charged. One free trial is available per account; if you subscribe again after
          cancelling, billing starts immediately and this is stated at checkout.
        </p>
```

- [ ] **Step 2: Portuguese (pt-BR)**

In `pt.tsx`, the same two paragraphs:

```tsx
        <p>
          O acesso ao Serviço requer uma assinatura paga ativa. As assinaturas são cobradas{' '}
          <strong className="text-cream">mensalmente ou anualmente</strong>, conforme o plano e o intervalo que você
          escolher, via Stripe. Ao assinar você autoriza o Stripe a cobrar o método de pagamento informado de forma
          recorrente até que você cancele.
        </p>
        <p>
          <strong className="text-cream">Teste grátis.</strong> Novas contas começam com um{' '}
          <strong className="text-cream">teste grátis de 7 dias</strong> e é necessário informar um método de pagamento
          para iniciá-lo. O teste termina — e a cobrança começa — assim que você atingir{' '}
          <strong className="text-cream">50 interações</strong> (feitas e recebidas) ou depois de{' '}
          <strong className="text-cream">7 dias</strong>, o que vier primeiro. Avisamos você por e-mail antes da
          primeira cobrança. Você pode cancelar a qualquer momento antes do fim do teste, na página Assinatura da sua
          conta, e nada será cobrado. Há um teste grátis por conta; se você assinar novamente após cancelar, a cobrança
          começa imediatamente e isso é informado no checkout.
        </p>
```

- [ ] **Step 3: Spanish (neutral LatAm)**

In `es.tsx`:

```tsx
        <p>
          El acceso al Servicio requiere una suscripción de pago activa. Las suscripciones se facturan de forma{' '}
          <strong className="text-cream">mensual o anual</strong>, según el plan y el intervalo que elijas, a través de
          Stripe. Al suscribirte autorizas a Stripe a cargar el método de pago proporcionado de forma recurrente hasta
          que canceles.
        </p>
        <p>
          <strong className="text-cream">Prueba gratuita.</strong> Las cuentas nuevas comienzan con una{' '}
          <strong className="text-cream">prueba gratuita de 7 días</strong> y se requiere un método de pago para
          iniciarla. La prueba termina —y la facturación comienza— en cuanto alcanzas{' '}
          <strong className="text-cream">50 interacciones</strong> (hechas y recibidas) o a los{' '}
          <strong className="text-cream">7 días</strong>, lo que ocurra primero. Te avisamos por correo antes del
          primer cobro. Puedes cancelar en cualquier momento antes de que termine la prueba desde la página
          Suscripción de tu cuenta, y no se te cobrará. Hay una prueba gratuita por cuenta; si te suscribes de nuevo
          tras cancelar, el cobro comienza de inmediato y se indica en el checkout.
        </p>
```

Note the existing files address the reader formally in Spanish (*usted*: "Puede cancelar su suscripción"). The copy
above uses *tú*, matching the app's neutral-LatAm voice. **Match whichever register the surrounding paragraphs of that
file already use** — consistency inside the document matters more than either choice.

- [ ] **Step 4: Typecheck the landing and check formatting**

Run: `pnpm --filter landing exec tsc --noEmit`
Expected: exits 0. Then the scoped format check (never `pnpm format`, see Global Constraints):

```bash
pnpm exec prettier --check "landing/app/[lang]/terms/content/en.tsx" "landing/app/[lang]/terms/content/pt.tsx" "landing/app/[lang]/terms/content/es.tsx"
```

- [ ] **Step 5: Save only — do NOT commit**

---

## Task 14: Documentation and the full gate

**Files:**

- Modify: `docs/PLATFORM.md`, `backlog/revenue/README.md`

**Interfaces:**

- Consumes: every preceding task.
- Produces: nothing.

`CLAUDE.md` makes `docs/PLATFORM.md` part of "done" — a feature is not complete until the doc reflects it. Read the
file's final section ("Maintaining This Document") and follow its code-area → section mapping.

- [ ] **Step 1: Update §8 (Subscriptions & Billing)**

Cover, in prose matching the surrounding style:

- The checkout guard: one live subscription per user, `ALREADY_SUBSCRIBED`, card holders switch in the Customer Portal.
- One trial per user, keyed on the subscription-row count (and *why* not `trialEndsAt`).
- The corrected `bumpTrialInteraction` lookup and the `.first()` trap it replaces.
- `custom_text` + `locale` on the checkout session, and `users.language`.
- The duplicate-subscription webhook: the newer subscription is voided, `prorate: false`, notice + email.
- The price snapshot now stored on `subscriptions` rows and why.
- A notification table — event → channel → sender:

| Event                              | Channel                     | Sender                                                |
|------------------------------------|-----------------------------|-------------------------------------------------------|
| 40 of 50 interactions              | Email + amber in-app banner | Ours (`internal.notifications.sendTrialNearEnd`)      |
| 3 days before the 7-day trial ends | Email                       | Ours (`internal.notifications.sendTrialEnding`)       |
| First successful charge            | Email receipt               | Stripe                                                |
| Duplicate subscription voided      | Email + in-app notice       | Ours (`internal.notifications.sendDuplicateCanceled`) |

- The note that erasure resets the trial (a deleted account signing in again is a new user with a new Stripe customer,
  so a fresh trial — accepted).
- A new **Stripe Dashboard setup** subsection, per environment (test and live), listing: portal plan switching across
  the three products / six prices; payment-method updates and cancellation allowed; **upgrades immediate with proration,
  downgrades at period end**; **the built-in trial-ending email OFF** (ours handles it) and the payment receipt **ON**;
  and the manual test that a plan switch during a trial preserves `trial_end` and re-derives the tier.

- [ ] **Step 2: Update §13B, §14, §15 and §19**

- **§13B** — add transactional billing email to the data inventory (contract necessity, not marketing).
- **§14** — BillingPage states: the single-primary-card pre-card layout with the "See all plans" toggle, the target-plan
  resolution order (`?plan=` → `sessionStorage.chosenPlan` → Growth), the tier-aware trial banner, the amber
  near-threshold banner, the Manage-button visibility rule (`trialing | active | past_due`), and the duplicate-canceled
  notice.
- **§15** — the Terms trial clause, and that the app now consumes the `plan` query parameter.
- **§19** — remove any "plan switching deferred" note if one is present.

- [ ] **Step 3: Flip the backlog statuses**

In `backlog/revenue/README.md`, change the Status cell for R01, R02 and R03 from `TODO` to `DONE`. (`backlog/` is
gitignored, so this is local only.)

- [ ] **Step 4: Run the full gate**

Run: `pnpm lint && pnpm typecheck && pnpm -r test`
Expected: exits 0 — `lint` (`--max-warnings 0`), `typecheck` across convex + app + landing, and every test suite in the
workspace.

Then the scoped format check. **Do not run `pnpm verify` or `pnpm format`** (see Global Constraints — `format:check` is
red at HEAD on 40 pre-existing files, and `pnpm format` would rewrite all of them):

```bash
pnpm exec prettier --check $(git diff --name-only --diff-filter=d; git ls-files --others --exclude-standard) 2>&1 | tail -20
```

Every file this work created or modified must be clean. If a file you touched is listed, fix it with
`pnpm exec prettier --write <that file>`. If a file you did **not** touch is listed, leave it alone and name it in your
report.

If anything fails, fix it. Do not weaken a test or add an eslint-disable to get past the gate.

- [ ] **Step 5: Report — do NOT commit**

Run `git status` and list the changed files in your report. Leave everything in the working tree for Henriko. Do not
stage, stash, or commit.

---

## Task ordering and parallelism

```
Task 13 (landing Terms) ─────────────────────────────► independent, any time

Task 1 → Task 2 → Task 3 → Task 4 → Task 5           (convex core, strictly in order)
                                     │
                                     ├──► Task 6 → Task 7 → Task 8   (notifications)
                                     └──► Task 9 → Task 10 → Task 11 → Task 12  (client)
                                                                   │
                                            Task 14 (docs + pnpm verify) ◄── after everything
```

Tasks 3, 5, 7 and 8 all edit `convex/http.ts` or `convex/interactions.ts`, so the convex chain runs
strictly in order. The notification chain and the client chain touch disjoint files and can run in
parallel once Task 5 is done.

## Self-review notes

- **Spec coverage:** D1 → all tasks; D2 → Task 8; D3 → Task 7 Step 4 + Task 14 Step 1; D4 → Tasks 2, 3, 4; D5 → Task 11;
  D6 → Tasks 1, 7, 10; D7 → Task 14 Step 1. Every acceptance criterion in the spec maps to a step here except the five
  Stripe-Dashboard items, which are Henriko's manual steps and are documented rather than coded.
- **Type consistency:** `findLiveSubscription` / `pickTrialingSubscription` / `trialEligible` / `isNearThreshold` are
  defined in Task 1 and used with those exact names in Tasks 4, 5, 7 and 8. `EmailContent` is defined once, in
  `convex/lib/email.ts` (Task 6 Step 3), and imported by `billingEmails.ts`. `BillingLocale` is defined in Task 2 and
  imported by Task 6 and Task 7.
- **Known deviation from R01's text:** R01 step 5 says to key the Manage button on `me.stripeCustomerId`. That field is
  stripped by `toSafeMe` (`convex/users.ts:79`) and never reaches the client, so Task 10 keys on `subscriptionStatus`
  instead — which is also the better signal, since a member who abandoned a checkout has a Stripe customer but nothing
  for the portal to show.
