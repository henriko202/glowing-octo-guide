# Scheduled Cross-Tier Downgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:
> executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A member moving from Growth or Pro to a cheaper tier keeps what they paid for until the period ends and is
never credited, closing the contradiction between the Customer Portal's proration and the no-refund line in the Terms.

**Architecture:** Cross-tier downgrades leave Stripe's hosted Customer Portal. Our backend writes a **subscription
schedule** whose second phase swaps the item price at `current_period_end` with `proration_behavior: 'none'`; the tier
moves on the `customer.subscription.updated` webhook that fires when the swap applies, and the same webhook releases the
spent schedule. Upgrades and same-tier interval switches keep using the portal untouched. A pending swap is mirrored on
our `subscriptions` row so the billing page can show it and offer an undo.

**Tech Stack:** Convex (queries/mutations in `convex/*.ts`, `'use node'` actions in `convex/billingNode.ts`), Stripe
Node SDK 20.4.1, React 19 + react-i18next + Tailwind in `app/`, Vitest everywhere, pnpm workspaces.

**Spec:** `docs/superpowers/specs/2026-09-09-scheduled-downgrade-design.md` — read it before Task 1. Its §3.2 routing
table is the contract every task implements a slice of.

## Global Constraints

Copied from the spec's §2. Every task's requirements implicitly include this section.

- **NEVER run `git commit`, `git push`, `git stash`, `git checkout --`, `git reset`, or any other git state-changing
  command.** Henriko makes all commits. No task in this plan ends with a commit; each ends with a green test run and a
  report. A prior subagent ran `git stash` and stranded completed work.
- **Change files only with the Edit and Write tools.** No bash heredocs, no `sed -i`, no node replace scripts. Bash is
  for reading, tests, lint and typecheck only.
- **No Stripe API writes.** The tool classifier permits Stripe reads and refuses writes. Every write is handed to
  Henriko as an exact command (§Task 6).
- **Never run `pnpm format`.** Prettier owns code and config; prose is hand-maintained. `pnpm verify` runs
  `format:check` — if it fails on a file you touched, fix that file's formatting by hand with Edit.
- **pnpm, never npm.** Run every command from the repo root `D:\ERP\LinkIntoTheSSI\LinkIntoTheSSI`. Running the convex
  CLI from inside `convex/` wipes the deployment.
- **`docs/PLATFORM.md` is updated in the same task as the code it describes.** Its tables are hand-aligned for display
  width: keep a new cell inside its existing column, or re-pad every row of that table.
- **i18n:** `app/src/i18n/locales/{en,pt,es}.json` stay in exact key parity with identical placeholder sets. `pt` is
  pt-BR (never European), `es` is neutral Latin American, labels in sentence case. There is no parity test — verify with
  a recursive key diff and report the counts.
- **Convex testing convention:** no `convex-test`. Decision logic goes in pure exported functions under `convex/lib/`
  with plain Vitest tests. Actions are never unit-tested; typecheck plus the manual proof cover them.
- **Tier comparison is by rank only.** `tierToRank` in `convex/lib/planLimits.ts` (contact 4, pro 3, growth 2, starter
  1, unknown 1) is the single rank source. Never compare `unit_amount` or price-id order, and never add a second rank
  helper.
- **Stripe SDK 20.4.1 shapes (verified 2026-09-09, do not substitute from memory):** a schedule update phase takes
  `duration: { interval, interval_count? }` — **`iterations` does not exist**;
  `subscriptionSchedules.create({ from_subscription })`; `subscriptionSchedules.release(id)`; `Subscription.schedule` is
  `string | SubscriptionSchedule | null`.

---

## File Structure

| File                                        | Responsibility                                                                                                                                   |
|---------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------|
| `convex/lib/downgrade.ts` (new)             | Pure decisions: direction by rank, the two schedule phases, the webhook's pending rule. No Stripe import, no Convex import except `ConvexError`. |
| `convex/lib/downgrade.test.ts` (new)        | Vitest for all three of the above.                                                                                                               |
| `convex/lib/stripePrices.ts`                | Gains `intervalForPriceId` — phase 1's `duration` needs the target price's interval.                                                             |
| `convex/lib/stripePrices.test.ts`           | Gains the `intervalForPriceId` cases.                                                                                                            |
| `convex/schema.ts`                          | `subscriptions.pendingTier` + `subscriptions.pendingAt`.                                                                                         |
| `convex/billing.ts`                         | `setPendingDowngrade` internal mutation (set and clear in one).                                                                                  |
| `convex/http.ts`                            | `syncArgs` carries `stripeScheduleId` off `sub.schedule`.                                                                                        |
| `convex/stripe.ts`                          | `syncUserSubscription` folds in the pending rule and schedules the release.                                                                      |
| `convex/users.ts`                           | `getSubscriptionInfo` exposes the two pending fields.                                                                                            |
| `convex/billingNode.ts`                     | The schedule write, the release, the undo, and the rerouted cancel/downgrade/switch actions.                                                     |
| `app/src/pages/BillingPage.tsx`             | The pending cell, the Keep button, the scheduled/refusal toasts, `downgrade_scheduled`.                                                          |
| `app/src/components/CancelInterstitial.tsx` | Hides the alternative while pending; completes the funnel on a `null` url.                                                                       |
| `app/src/i18n/locales/{en,pt,es}.json`      | Eight new `billing.*` keys each.                                                                                                                 |
| `docs/PLATFORM.md`                          | §5 fields, §8 R09/R08/webhook/⛔, §14 + PostHog inventory, §21.                                                                                  |

---

## Task 1: Pure decision logic

**Files:**

- Create: `convex/lib/downgrade.ts`
- Create: `convex/lib/downgrade.test.ts`
- Modify: `convex/lib/stripePrices.ts` (append after `starterPriceIdFor`)
- Modify: `convex/lib/stripePrices.test.ts` (append a describe block)

**Interfaces:**

- Consumes: `tierToRank` from `convex/lib/planLimits.ts`; the `Env` type already declared in `stripePrices.ts`.
- Produces, relied on by Tasks 2 and 3:
    - `planChangeDirection(fromTier: string, toTier: string): 'up' | 'down' | 'same'`
    -
  `buildDowngradePhases(schedule: ScheduleIn, targetPriceId: string, targetInterval: 'month' | 'year'): [SchedulePhaseOut, SchedulePhaseOut]`
  -
  `resolvePendingDowngrade(existing: { tier: string; pendingTier?: string } | null, incoming: { tier: string; stripeScheduleId?: string }): 'none' | 'keep' | 'clear' | 'applied'`
    - `intervalForPriceId(env: Env, priceId: string): 'month' | 'year' | undefined`

- [ ] **Step 1: Write the failing test file**

Create `convex/lib/downgrade.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { buildDowngradePhases, planChangeDirection, resolvePendingDowngrade } from './downgrade'

// A schedule as Stripe returns it right after create({ from_subscription }): ONE phase, matching
// the period the member has already paid for.
const SCHEDULE = {
  current_phase: { start_date: 1_000, end_date: 2_000 },
  phases: [
    {
      start_date: 1_000,
      end_date: 2_000,
      items: [{ price: 'price_growth_month', quantity: 1 }],
      discounts: [],
      metadata: { convexUserId: 'u1' }
    }
  ]
}

describe('planChangeDirection', () => {
  it('reads a cheaper tier as down and a dearer one as up', () => {
    expect(planChangeDirection('pro', 'starter')).toBe('down')
    expect(planChangeDirection('growth', 'starter')).toBe('down')
    expect(planChangeDirection('pro', 'growth')).toBe('down')
    expect(planChangeDirection('starter', 'growth')).toBe('up')
    expect(planChangeDirection('starter', 'pro')).toBe('up')
    expect(planChangeDirection('growth', 'pro')).toBe('up')
  })

  it('reads the same tier as same, which is what an interval switch is', () => {
    expect(planChangeDirection('starter', 'starter')).toBe('same')
    expect(planChangeDirection('growth', 'growth')).toBe('same')
    expect(planChangeDirection('pro', 'pro')).toBe('same')
  })

  it('ranks contact above pro and treats an unknown tier as starter', () => {
    expect(planChangeDirection('contact', 'pro')).toBe('down')
    expect(planChangeDirection('pro', 'contact')).toBe('up')
    expect(planChangeDirection('mystery', 'growth')).toBe('up')
    expect(planChangeDirection('growth', 'mystery')).toBe('down')
  })
})

describe('buildDowngradePhases', () => {
  it('repeats the current phase and appends the cheaper one', () => {
    const [keep, next] = buildDowngradePhases(SCHEDULE, 'price_starter_month', 'month')
    expect(keep).toEqual({
      items: [{ price: 'price_growth_month', quantity: 1 }],
      start_date: 1_000,
      end_date: 2_000,
      metadata: { convexUserId: 'u1' }
    })
    expect(next).toEqual({
      items: [{ price: 'price_starter_month', quantity: 1 }],
      duration: { interval: 'month', interval_count: 1 },
      proration_behavior: 'none'
    })
  })

  it('never prorates into the cheaper phase — the whole point of the schedule', () => {
    const [, next] = buildDowngradePhases(SCHEDULE, 'price_starter_year', 'year')
    expect(next.proration_behavior).toBe('none')
    expect(next.duration).toEqual({ interval: 'year', interval_count: 1 })
  })

  it('takes the id when Stripe expands the price into an object', () => {
    const expanded = {
      ...SCHEDULE,
      phases: [{ ...SCHEDULE.phases[0], items: [{ price: { id: 'price_growth_month' }, quantity: 2 }] }]
    }
    const [keep] = buildDowngradePhases(expanded, 'price_starter_month', 'month')
    expect(keep.items).toEqual([{ price: 'price_growth_month', quantity: 2 }])
  })

  it('defaults a missing quantity to 1', () => {
    const noQty = { ...SCHEDULE, phases: [{ ...SCHEDULE.phases[0], items: [{ price: 'price_growth_month' }] }] }
    const [keep] = buildDowngradePhases(noQty, 'price_starter_month', 'month')
    expect(keep.items).toEqual([{ price: 'price_growth_month', quantity: 1 }])
  })

  it('carries a discount into BOTH phases, preferring an existing discount id over the coupon', () => {
    const discounted = {
      ...SCHEDULE,
      phases: [
        {
          ...SCHEDULE.phases[0],
          discounts: [{ coupon: 'co_free_month', discount: 'di_live', promotion_code: null }]
        }
      ]
    }
    const [keep, next] = buildDowngradePhases(discounted, 'price_starter_month', 'month')
    expect(keep.discounts).toEqual([{ discount: 'di_live' }])
    expect(next.discounts).toEqual([{ discount: 'di_live' }])
  })

  it('falls back to the coupon, then the promotion code, and expands objects to ids', () => {
    const build = (d: Record<string, unknown>) =>
      buildDowngradePhases(
        { ...SCHEDULE, phases: [{ ...SCHEDULE.phases[0], discounts: [d] }] },
        'price_starter_month',
        'month'
      )[0].discounts
    expect(build({ coupon: 'co_x', discount: null, promotion_code: null })).toEqual([{ coupon: 'co_x' }])
    expect(build({ coupon: null, discount: null, promotion_code: 'promo_x' })).toEqual([{ promotion_code: 'promo_x' }])
    expect(build({ coupon: { id: 'co_obj' }, discount: null, promotion_code: null })).toEqual([{ coupon: 'co_obj' }])
  })

  it('omits discounts and metadata entirely when there are none — an empty array would unset nothing but says nothing either', () => {
    const bare = { ...SCHEDULE, phases: [{ ...SCHEDULE.phases[0], discounts: [], metadata: {} }] }
    const [keep, next] = buildDowngradePhases(bare, 'price_starter_month', 'month')
    expect('discounts' in keep).toBe(false)
    expect('metadata' in keep).toBe(false)
    expect('discounts' in next).toBe(false)
  })

  it('drops trial_end: this path runs for active subscriptions only, and a past trial_end is rejected', () => {
    const trialing = { ...SCHEDULE, phases: [{ ...SCHEDULE.phases[0], trial_end: 1_500 }] }
    const [keep] = buildDowngradePhases(trialing, 'price_starter_month', 'month')
    expect('trial_end' in keep).toBe(false)
  })

  it('refuses a schedule with no current phase rather than guessing which one to keep', () => {
    expect(() => buildDowngradePhases({ ...SCHEDULE, current_phase: null }, 'price_starter_month', 'month')).toThrow(
      'Schedule has no current phase'
    )
  })

  it('refuses when no phase matches current_phase.start_date', () => {
    expect(() =>
      buildDowngradePhases({ ...SCHEDULE, current_phase: { start_date: 999, end_date: 2_000 } }, 'p', 'month')
    ).toThrow('Schedule has no current phase')
  })

  it('keeps the phase that is current, not the first one, when a spent phase is still listed', () => {
    const twoPhase = {
      current_phase: { start_date: 2_000, end_date: 3_000 },
      phases: [
        SCHEDULE.phases[0],
        {
          start_date: 2_000,
          end_date: 3_000,
          items: [{ price: 'price_pro_month', quantity: 1 }],
          discounts: [],
          metadata: {}
        }
      ]
    }
    const [keep] = buildDowngradePhases(twoPhase, 'price_starter_month', 'month')
    expect(keep.items).toEqual([{ price: 'price_pro_month', quantity: 1 }])
    expect(keep.start_date).toBe(2_000)
  })
})

describe('resolvePendingDowngrade', () => {
  const pendingRow = { tier: 'growth', pendingTier: 'starter' }

  it('does nothing when the row has no pending downgrade', () => {
    expect(resolvePendingDowngrade({ tier: 'growth' }, { tier: 'growth', stripeScheduleId: 'sub_sched_1' })).toBe(
      'none'
    )
    expect(resolvePendingDowngrade(null, { tier: 'growth' })).toBe('none')
  })

  it('keeps the pending state while the schedule is attached and the tier has not moved', () => {
    expect(resolvePendingDowngrade(pendingRow, { tier: 'growth', stripeScheduleId: 'sub_sched_1' })).toBe('keep')
  })

  it('reads a moved tier as applied — the swap landed', () => {
    expect(resolvePendingDowngrade(pendingRow, { tier: 'starter', stripeScheduleId: 'sub_sched_1' })).toBe('applied')
  })

  it('reads a vanished schedule as cleared — released, canceled, or undone elsewhere', () => {
    expect(resolvePendingDowngrade(pendingRow, { tier: 'growth' })).toBe('clear')
  })

  it('checks applied BEFORE clear, so the swap event schedules the release and the release event does not', () => {
    // The swap arrives with the schedule still attached, then the release arrives without it.
    expect(resolvePendingDowngrade(pendingRow, { tier: 'starter' })).toBe('applied')
  })

  it('reads a tier that moved somewhere other than the pending target as applied too', () => {
    // A Dashboard price edit while pending: the mirror is stale either way, so clear it.
    expect(resolvePendingDowngrade(pendingRow, { tier: 'pro', stripeScheduleId: 'sub_sched_1' })).toBe('applied')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter convex exec vitest run lib/downgrade.test.ts`
Expected: FAIL — `Failed to resolve import "./downgrade"`.

- [ ] **Step 3: Write `convex/lib/downgrade.ts`**

```ts
// convex/lib/downgrade.ts
// backlog/B07 — the scheduled cross-tier downgrade, decided here so it can be tested.
//
// Why a schedule at all: the Customer Portal runs proration_behavior 'always_invoice' (D7) and only
// defers a switch between prices that share a PRODUCT. Starter/Growth/Pro are three products, and
// no rearrangement fixes that — Stripe refuses a portal config whose product carries two prices of
// the same interval ("For each product, its price must have unique billing intervals", proven
// 2026-09-09). So a cross-tier downgrade leaves the portal: our own subscription schedule swaps the
// item price at current_period_end with proration_behavior 'none', and nothing is ever credited.
//
// This module holds only decisions. The Stripe calls live in billingNode.ts (a 'use node' action
// file, which the repo's test setup cannot run) and the row writes in stripe.ts (a Convex mutation).
import { ConvexError } from 'convex/values'
import { tierToRank } from './planLimits'

export type PlanChangeDirection = 'up' | 'down' | 'same'

/**
 * Which way a plan change goes — by TIER RANK, never by price amount or price-id order (a decoy
 * ladder makes amounts a liar, and ids carry no order at all). tierToRank is the one rank source.
 * Same tier, different interval reads as `same`: that is not a downgrade, and the portal already
 * defers it to period end with no credit, because both prices sit on one product.
 */
export function planChangeDirection(fromTier: string, toTier: string): PlanChangeDirection {
  const from = tierToRank(fromTier)
  const to = tierToRank(toTier)
  if (to < from) return 'down'
  if (to > from) return 'up'
  return 'same'
}

// ── Schedule phases ──────────────────────────────────────────────────────────────────────────────
// Structural mirrors of the Stripe SDK's shapes, narrow enough to build a fixture by hand. Stripe's
// real SubscriptionSchedule is assignable to ScheduleIn, and SchedulePhaseOut is assignable to
// SubscriptionScheduleUpdateParams.Phase — the compiler checks both at the call site.

type PriceRef = string | { id: string }
type DiscountIn = { coupon?: unknown; discount?: unknown; promotion_code?: unknown }

export interface SchedulePhaseIn {
  start_date: number
  end_date: number
  items: Array<{ price: PriceRef; quantity?: number | null }>
  discounts?: DiscountIn[] | null
  metadata?: Record<string, string> | null
}

export interface ScheduleIn {
  current_phase: { start_date: number } | null
  phases: SchedulePhaseIn[]
}

export interface SchedulePhaseOut {
  items: Array<{ price: string; quantity: number }>
  start_date?: number
  end_date?: number
  duration?: { interval: 'month' | 'year'; interval_count: number }
  proration_behavior?: 'none'
  discounts?: Array<{ coupon?: string; discount?: string; promotion_code?: string }>
  metadata?: Record<string, string>
}

const idOf = (value: unknown): string | undefined => {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object' && 'id' in value) {
    const id = (value as { id: unknown }).id
    if (typeof id === 'string') return id
  }
  return undefined
}

/**
 * One discount as the update endpoint wants it: exactly ONE of the three id fields. An existing
 * `discount` id wins, because reusing it keeps a consumed `once` coupon consumed; a raw `coupon` or
 * `promotion_code` would mint a fresh discount instead.
 */
function carryDiscount(d: DiscountIn): { coupon?: string; discount?: string; promotion_code?: string } | null {
  const discount = idOf(d.discount)
  if (discount) return { discount }
  const coupon = idOf(d.coupon)
  if (coupon) return { coupon }
  const promotion_code = idOf(d.promotion_code)
  if (promotion_code) return { promotion_code }
  return null
}

/**
 * The two phases of a downgrade schedule: the period the member has already paid for, then the
 * cheaper tier for one interval.
 *
 * Phase 0 repeats the current phase IN FULL because Stripe removes whatever an update omits from it
 * ("Include all items and settings of the current phase in the update… Stripe removes omitted
 * parameters"). `trial_end` is the one thing deliberately not carried: this path runs for `active`
 * subscriptions only, whose trial is over, and Stripe rejects a trial_end in the past.
 *
 * Phase 1 carries `proration_behavior: 'none'` — a phase's setting governs the transition INTO it,
 * so this single line is what closes the credit gap. Its `duration` is one billing interval of the
 * TARGET price, after which `end_behavior: 'release'` hands the subscription back untouched.
 * (`iterations` is gone from the current API; `duration` replaced it.)
 *
 * A promotion code from Checkout (`allow_promotion_codes`) carries into both phases: dropping it
 * from phase 1 would break a running repeating/forever code. Ceiling: an already-consumed `once`
 * code can apply once more on the first cheaper invoice.
 */
export function buildDowngradePhases(
  schedule: ScheduleIn,
  targetPriceId: string,
  targetInterval: 'month' | 'year'
): [SchedulePhaseOut, SchedulePhaseOut] {
  const startDate = schedule.current_phase?.start_date
  const current = startDate === undefined ? undefined : schedule.phases.find(p => p.start_date === startDate)
  // A schedule with no current phase has not started (or has ended). Guessing which phase to keep
  // would rewrite the wrong period, so refuse and let the caller surface it.
  if (!current) throw new ConvexError('Schedule has no current phase')

  const discounts = (current.discounts ?? [])
    .map(carryDiscount)
    .filter((d): d is { coupon?: string; discount?: string; promotion_code?: string } => d !== null)
  const carried = discounts.length > 0 ? { discounts } : {}

  const keep: SchedulePhaseOut = {
    items: current.items.map(i => ({ price: idOf(i.price) ?? '', quantity: i.quantity ?? 1 })),
    start_date: current.start_date,
    end_date: current.end_date,
    ...carried,
    // Checkout stamps convexUserId for Dashboard support lookups; omitting it here would unset it.
    ...(current.metadata && Object.keys(current.metadata).length > 0 ? { metadata: current.metadata } : {})
  }

  const next: SchedulePhaseOut = {
    items: [{ price: targetPriceId, quantity: 1 }],
    duration: { interval: targetInterval, interval_count: 1 },
    proration_behavior: 'none',
    ...carried
  }

  return [keep, next]
}

// ── The webhook's pending rule ───────────────────────────────────────────────────────────────────

export type PendingOutcome = 'none' | 'keep' | 'clear' | 'applied'

/**
 * What a `customer.subscription.updated` event means for the pending-downgrade mirror on our row.
 * `applied` is checked BEFORE `clear` on purpose: the swap event and the release event both arrive,
 * and only the first may schedule the release.
 *
 * - `none`    — nothing is pending; the event says nothing about a downgrade.
 * - `applied` — the row's tier moved while a downgrade was pending: the swap landed (or someone
 *               changed the price in the Dashboard). Clear the mirror AND release the spent schedule.
 * - `clear`   — no schedule on the event: it was released, canceled or undone elsewhere.
 * - `keep`    — a schedule is attached and the tier has not moved: still waiting.
 */
export function resolvePendingDowngrade(
  existing: { tier: string; pendingTier?: string } | null,
  incoming: { tier: string; stripeScheduleId?: string }
): PendingOutcome {
  if (!existing?.pendingTier) return 'none'
  if (incoming.tier !== existing.tier) return 'applied'
  if (!incoming.stripeScheduleId) return 'clear'
  return 'keep'
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter convex exec vitest run lib/downgrade.test.ts`
Expected: PASS, 19 tests.

- [ ] **Step 5: Add `intervalForPriceId` to `convex/lib/stripePrices.ts`**

Append immediately after `starterPriceIdFor` (before the `FEATURED_POST_PRICE_ID` block):

```ts
/**
 * The billing interval of one of our six prices. A downgrade schedule's second phase needs the
 * TARGET price's interval for its `duration`, and the plan grid can send a monthly member to an
 * annual price — so this cannot be read off the current subscription. `undefined` for anything that
 * is not one of the six, which the caller turns into a refusal rather than a guess.
 */
export function intervalForPriceId(env: Env, priceId: string): 'month' | 'year' | undefined {
  if (!priceId) return undefined
  const annual = [env.STRIPE_STARTER_ANNUAL_PRICE_ID, env.STRIPE_GROWTH_ANNUAL_PRICE_ID, env.STRIPE_PRO_ANNUAL_PRICE_ID]
  if (annual.includes(priceId)) return 'year'
  const monthly = [env.STRIPE_STARTER_PRICE_ID, env.STRIPE_GROWTH_PRICE_ID, env.STRIPE_PRO_PRICE_ID]
  if (monthly.includes(priceId)) return 'month'
  return undefined
}
```

- [ ] **Step 6: Add its tests to `convex/lib/stripePrices.test.ts`**

The file already declares an `ENV` fixture with all six ids. Add `intervalForPriceId` to the import list on line 2, then
append this describe block at the end of the file:

```ts
describe('intervalForPriceId', () => {
  it('names the interval of every one of the six prices', () => {
    expect(intervalForPriceId(ENV, 'price_s_m')).toBe('month')
    expect(intervalForPriceId(ENV, 'price_g_m')).toBe('month')
    expect(intervalForPriceId(ENV, 'price_p_m')).toBe('month')
    expect(intervalForPriceId(ENV, 'price_s_y')).toBe('year')
    expect(intervalForPriceId(ENV, 'price_g_y')).toBe('year')
    expect(intervalForPriceId(ENV, 'price_p_y')).toBe('year')
  })

  it('returns undefined for an unknown or blank id rather than guessing monthly', () => {
    expect(intervalForPriceId(ENV, 'price_featured')).toBeUndefined()
    expect(intervalForPriceId(ENV, '')).toBeUndefined()
  })

  it('returns undefined when the env has no prices configured', () => {
    expect(intervalForPriceId({}, 'price_s_m')).toBeUndefined()
  })
})
```

- [ ] **Step 7: Run the whole convex suite**

Run: `pnpm --filter convex test`
Expected: PASS. Baseline was 486 tests; this task adds 22, so expect 508.

- [ ] **Step 8: Report — do not commit**

State the test counts before and after. Do not run any git command.

---

## Task 2: Data and webhook sync

**Files:**

- Modify: `convex/schema.ts` (the `subscriptions` table, after `cancelAtPeriodEnd`)
- Modify: `convex/billing.ts` (after `setStripeCustomerId`)
- Modify: `convex/http.ts` (`syncArgs`)
- Modify: `convex/stripe.ts` (`syncUserSubscription`)
- Modify: `convex/users.ts` (`getSubscriptionInfo`)
- Modify: `docs/PLATFORM.md` (§5 subscriptions table, §8 webhook table row + sync mermaid)

**Interfaces:**

- Consumes: `resolvePendingDowngrade` from Task 1.
- Produces, relied on by Tasks 3 and 4:
  -
  `internal.billing.setPendingDowngrade({ stripeSubscriptionId: string, pendingTier?: 'starter' | 'growth', pendingAt?: number })` —
  omitting both optional args **clears** them.
    - `internal.billingNode.releaseSubscriptionSchedule({ stripeSubscriptionId: string })` — **defined in Task 3**. This
      task references it from the scheduler call, so typecheck for this task alone will fail on that name until Task 3
      lands. Run Task 2's `tsc` only after Task 3, or implement Tasks 2 and 3 back to back.
    - `users.getSubscriptionInfo` gains `pendingTier?: 'starter' | 'growth'` and `pendingAt?: number`.

- [ ] **Step 1: Widen the schema**

In `convex/schema.ts`, inside `subscriptions: defineTable({ … })`, immediately after the `cancelAtPeriodEnd` field and
its comment:

```ts
    // backlog/B07 — a cross-tier downgrade is SCHEDULED, never prorated: our own Stripe subscription
    // schedule swaps the item price at current_period_end with proration_behavior 'none'. These two
    // mirror that pending swap so the billing page can show "Starter from <date>" and offer an undo.
    // Stripe stays the source of truth (the actions read sub.schedule); this is a mirror, cleared by
    // the webhook once the swap applies or the schedule is released. Never 'pro' — nothing sits
    // above it on a Stripe-synced row, since contact is admin-assigned and has no price.
    pendingTier: v.optional(v.union(v.literal('starter'), v.literal('growth'))),
    pendingAt: v.optional(v.number()),
```

- [ ] **Step 2: Add the mirror mutation**

In `convex/billing.ts`, after `setStripeCustomerId`:

```ts
/**
 * Mirrors a pending cross-tier downgrade (backlog/B07) onto the subscriptions row. Called with both
 * fields by the schedule write, and with NEITHER to clear them — `ctx.db.patch` unsets a field set
 * to undefined, so one mutation covers set and clear. Silent when the row has not been created yet:
 * the webhook that creates it will carry the schedule and set the mirror on its own.
 */
export const setPendingDowngrade = internalMutation({
  args: {
    stripeSubscriptionId: v.string(),
    pendingTier: v.optional(v.union(v.literal('starter'), v.literal('growth'))),
    pendingAt: v.optional(v.number())
  },
  handler: async (ctx, { stripeSubscriptionId, pendingTier, pendingAt }) => {
    const sub = await ctx.db
      .query('subscriptions')
      .withIndex('by_stripe_id', q => q.eq('stripeSubscriptionId', stripeSubscriptionId))
      .first()
    if (!sub) return
    await ctx.db.patch(sub._id, { pendingTier, pendingAt })
  }
})
```

- [ ] **Step 3: Carry the schedule id off the webhook payload**

In `convex/http.ts`, inside `syncArgs`, add this entry right after `cancelAtPeriodEnd`:

```ts
    // backlog/B07 — the subscription schedule attached to this subscription, if any. Its PRESENCE is
    // how the sync tells "downgrade still pending" from "applied or released"; the id itself is
    // never stored (Stripe's own advice: discard schedule ids once released).
    stripeScheduleId: typeof sub.schedule === 'string' ? sub.schedule : (sub.schedule?.id as string | undefined),
```

- [ ] **Step 4: Fold the pending rule into the sync**

In `convex/stripe.ts`:

Add the import to the existing line 14 group:

```ts
import { resolvePendingDowngrade } from './lib/downgrade'
```

Add the arg after `cancelAtPeriodEnd` in `syncUserSubscription`'s `args`:

```ts
    // backlog/B07 — presence of an attached subscription schedule. See lib/downgrade.
    stripeScheduleId: v.optional(v.string()),
```

Inside the `} else {` branch (the non-stale path), replace the `const fields = { … }` block with:

```ts
      // backlog/B07 — decided on the row as it stands BEFORE this patch, because "the tier moved"
      // is precisely the signal that the schedule's swap landed.
      const pending = resolvePendingDowngrade(existing ?? null, {
        tier: args.tier,
        stripeScheduleId: args.stripeScheduleId
      })
      const fields = {
        tier: args.tier,
        status: args.status,
        currentPeriodEnd: args.currentPeriodEnd,
        priceAmount: args.priceAmount,
        priceCurrency: args.priceCurrency,
        priceInterval: args.priceInterval,
        cancelAtPeriodEnd: args.cancelAtPeriodEnd,
        stripeCreated: args.stripeCreated ?? existing?.stripeCreated,
        lastEventAt: args.eventCreated ?? existing?.lastEventAt,
        // 'keep' leaves the mirror alone and 'none' has nothing to leave, so the keys stay OUT of the
        // patch for both — including them as undefined would unset a mirror that is still true.
        ...(pending === 'applied' || pending === 'clear' ? { pendingTier: undefined, pendingAt: undefined } : {})
      }
      if (existing) {
        await ctx.db.patch(existing._id, fields)
      } else {
        await ctx.db.insert('subscriptions', {
          userId: user._id,
          stripeSubscriptionId: args.stripeSubscriptionId,
          ...fields
        })
      }
      // The swap landed. end_behavior 'release' only fires when the cheaper phase ENDS — a whole
      // period away, a year on annual — and until then every other flow reads "has a schedule" as
      // "downgrade pending". Hand it back now; the self-release is the backstop if this never runs.
      if (pending === 'applied') {
        await ctx.scheduler.runAfter(0, internal.billingNode.releaseSubscriptionSchedule, {
          stripeSubscriptionId: args.stripeSubscriptionId
        })
      }
```

- [ ] **Step 5: Expose the mirror to the client**

In `convex/users.ts`, in `getSubscriptionInfo`'s `activeSub` return object, after
`priceCurrency: ourSub?.priceCurrency`:

```ts
        ,
        // backlog/B07 — the pending cross-tier downgrade, for the billing card's "Starter from
        // <date>" cell and its Keep button. Absent ⇒ nothing is scheduled.
        pendingTier: ourSub?.pendingTier,
        pendingAt: ourSub?.pendingAt
```

And in the no-subscription return shape, after `priceCurrency: undefined`:

```ts
      ,
      pendingTier: undefined,
      pendingAt: undefined
```

Fix the comma placement by hand so the object literal stays Prettier-clean: put the comma at the end of the preceding
line rather than leading, matching the rest of the file.

- [ ] **Step 6: Update `docs/PLATFORM.md` §5**

In the `subscriptions` field table (the table starting at the `| Field | Type | Req | Meaning |` header under `#### \`
subscriptions\` — Stripe subscription mirror`), add two rows after `cancelAtPeriodEnd`. The table is hand-aligned: pad
the new cells to the existing column widths exactly.

- `pendingTier` / `` `'starter'\|'growth'` `` / `–` / "The tier a **scheduled** cross-tier downgrade swaps to at
  `pendingAt` (backlog/B07). Set by `billingNode`'s schedule write, cleared by the webhook once the swap applies or the
  schedule is released. Stripe is the source of truth — this is a mirror for the billing card. Absent ⇒ nothing
  pending."
- `pendingAt` / `number` / `–` / "The swap instant (ms) — phase 1's `start_date`, which equals `current_period_end` when
  the schedule is written."

- [ ] **Step 7: Update `docs/PLATFORM.md` §8 webhook table and mermaid**

In the `customer.subscription.created` / `updated` row of the webhook table, append to the existing cell text, before
the closing "Returns the **duplicate to void**…" sentence:

> Also resolves the **pending cross-tier downgrade** (`lib/downgrade.resolvePendingDowngrade`): the row's `tier` moving
> while `pendingTier` is set means the schedule's swap landed, so the mirror is cleared **and**
> `billingNode.releaseSubscriptionSchedule` is scheduled; an event carrying no schedule clears the mirror (released or
> undone elsewhere); a schedule with an unmoved tier leaves it alone.

In the sync mermaid, after the `ORD -->|no| P3[…]` node, add:

```
    ORD -->|no| PD{"pendingTier set?"}
    PD -->|"tier moved"| PDA["clear mirror + scheduler → releaseSubscriptionSchedule"]
    PD -->|"no schedule on the event"| PDC["clear mirror"]
    PD -->|"schedule still attached"| PDK["leave the mirror alone"]
```

- [ ] **Step 8: Typecheck and test**

Run: `pnpm --filter convex test`
Expected: PASS, still 508 (this task adds no tests — the pure rule is already covered, and mutations that only patch are
not unit-tested per the repo convention).

Run: `pnpm --filter convex exec tsc --noEmit -p tsconfig.json`
Expected: **one** error, `Property 'releaseSubscriptionSchedule' does not exist`, until Task 3 lands. If any other error
appears, fix it now.

- [ ] **Step 9: Report — do not commit**

Name the one expected typecheck error explicitly so the reviewer does not read it as a failure.

---

## Task 3: The Stripe actions

**Files:**

- Modify: `convex/billingNode.ts` (replace lines 169–285, the portal deep-link section)
- Modify: `docs/PLATFORM.md` (§8 "Cancel, downgrade and resume (R09)" and "Plan switch (R08 / R20)", the ⛔ paragraph,
  the proration row)

**Interfaces:**

- Consumes: `planChangeDirection`, `buildDowngradePhases` (Task 1); `intervalForPriceId` (Task 1);
  `internal.billing.setPendingDowngrade` (Task 2).
- Produces, relied on by Task 4:
    - `billingNode.createCancelFlowSession({ sessionToken, flow }) → { url: string | null }`
    - `billingNode.createPlanSwitchSession({ sessionToken, priceId }) → { url: string | null }`
    - `billingNode.undoScheduledDowngrade({ sessionToken }) → null`
    - `internal.billingNode.releaseSubscriptionSchedule({ stripeSubscriptionId })`
    - Refusal codes thrown as `ConvexError` messages: `PENDING_DOWNGRADE`, `CANCEL_PENDING` (plus the existing
      `ALREADY_ON_PLAN`, `ALREADY_STARTER`, `NO_LIVE_SUBSCRIPTION`).

- [ ] **Step 1: Extend the imports**

Line 9 becomes:

```ts
import {
  ALLOWED_PRICE_IDS,
  FEATURED_POST_PRICE_ID,
  getTierFromPriceId,
  intervalForPriceId,
  starterPriceIdFor
} from './lib/stripePrices'
```

Add after line 13:

```ts
import { buildDowngradePhases, planChangeDirection } from './lib/downgrade'
```

- [ ] **Step 2: Replace the whole portal section**

Replace everything from the `// ── Customer Portal deep links …` banner comment (line 169) to the end of the file with:

```ts
// ── Plan changes: the portal for upgrades, our own schedule for downgrades ─────────────────────
// Stripe's hosted portal owns the confirmation UI for an upgrade or an interval switch, and we only
// deep-link into the right flow (the @convex-dev/stripe component's createCustomerPortalSession
// cannot set flow_data, so this uses the SDK directly, as createCheckoutSession does).
//
// A cross-tier DOWNGRADE cannot go through it. The portal runs proration_behavior 'always_invoice'
// (D7) and defers a switch only between prices sharing a PRODUCT — and Starter/Growth/Pro are three
// products, which no rearrangement fixes (Stripe refuses a portal product carrying two prices of one
// interval; proven 2026-09-09). A portal downgrade therefore credits the unused period in cash,
// against the no-refund line in the Terms (B07). So we write our own subscription schedule instead:
// the item price swaps at current_period_end with proration_behavior 'none'. Sync lands via the
// existing customer.subscription.updated webhook either way.
type FlowData = Stripe.BillingPortal.SessionCreateParams.FlowData

const appOrigin = (): string => process.env.APP_URL ?? 'http://localhost:5173'

/** The member and their live subscription row — where every billing action starts. */
async function liveSubscriptionFor(
  ctx: ActionCtx,
  sessionToken: string
): Promise<{ user: Doc<'users'>; live: Doc<'subscriptions'> }> {
  const user = await requireAuthAction(ctx, sessionToken)
  const subscriptions = await ctx.runQuery(internal.billing.listUserSubscriptions, { userId: user._id })
  const live = findLiveSubscription(subscriptions)
  if (!live) throw new ConvexError('NO_LIVE_SUBSCRIPTION')
  return { user, live }
}

/** Mints the portal deep link. The flow is already decided by the caller. */
async function portalSession(ctx: ActionCtx, user: Doc<'users'>, flow: FlowData): Promise<{ url: string }> {
  const customer = await stripeComponent.getOrCreateCustomer(ctx, {
    userId: user._id,
    email: user.email,
    name: user.name
  })
  const session = await stripe().billingPortal.sessions.create({
    customer: customer.customerId,
    return_url: `${appOrigin()}/billing`,
    flow_data: flow
  })
  return { url: session.url }
}

/**
 * Stripe's copy of the subscription plus its single item. Both halves are needed on every path —
 * the item to name a price in a portal flow, the subscription to read `status`,
 * `cancel_at_period_end` and `schedule` — so it is one retrieve, not two.
 */
async function retrieveWithItem(
  stripeSubscriptionId: string
): Promise<{ sub: Stripe.Subscription; item: Stripe.SubscriptionItem }> {
  const sub = await stripe().subscriptions.retrieve(stripeSubscriptionId)
  const item = sub.items.data[0]
  if (!item) throw new ConvexError('Subscription has no item')
  return { sub, item }
}

/** The id of the schedule attached to a subscription, if any — the "downgrade pending" signal. */
function scheduleIdOf(sub: Stripe.Subscription): string | undefined {
  return typeof sub.schedule === 'string' ? sub.schedule : (sub.schedule?.id ?? undefined)
}

/**
 * Moves the member to `targetPriceId` at current_period_end with NO proration, and mirrors the
 * pending swap onto our row.
 *
 * Idempotent by construction: a subscription carries at most ONE schedule, so a double tap — or a
 * re-target to a different cheaper plan — rewrites the same one instead of racing a second.
 */
async function scheduleDowngrade(
  ctx: ActionCtx,
  sub: Stripe.Subscription,
  targetPriceId: string,
  targetTier: 'starter' | 'growth'
): Promise<{ url: null }> {
  // Phase 1's duration needs the TARGET price's interval; the grid can send a monthly member to an
  // annual price, so it cannot come off the subscription we just retrieved.
  const interval = intervalForPriceId(process.env, targetPriceId)
  if (!interval) throw new ConvexError('Unknown price interval')

  const existingId = scheduleIdOf(sub)
  // from_subscription answers with one phase matching the period already paid for; the phases
  // themselves are set by the update below, which is the documented two-call pattern.
  const schedule = existingId
    ? await stripe().subscriptionSchedules.retrieve(existingId)
    : await stripe().subscriptionSchedules.create({ from_subscription: sub.id })

  // ponytail: a portal-scheduled interval switch (same product) is overwritten by this update; read
  // the existing phase 1 first if that ever matters.
  const updated = await stripe().subscriptionSchedules.update(schedule.id, {
    phases: buildDowngradePhases(schedule, targetPriceId, interval),
    // The current phase is rewritten wholesale above (Stripe removes what an update omits), so say
    // out loud that rewriting it settles no money.
    proration_behavior: 'none',
    // Once the cheaper phase has run, hand the subscription back untouched. Our webhook normally
    // releases it the moment the swap lands; this is the backstop.
    end_behavior: 'release'
  })

  // Stripe's own answer, never our arithmetic: the instant phase 1 begins.
  const startsAt = updated.phases[1]?.start_date
  await ctx.runMutation(internal.billing.setPendingDowngrade, {
    stripeSubscriptionId: sub.id,
    pendingTier: targetTier,
    pendingAt: startsAt ? startsAt * 1000 : undefined
  })
  return { url: null }
}

/**
 * Hands a scheduled subscription back to Stripe untouched — same price, same period — and clears our
 * mirror. Silent when nothing is attached (that is the idempotent undo), and forgiving when Stripe
 * refuses: `release` is valid only for a not_started/active schedule, and every other status means
 * the work is already done.
 */
async function releaseScheduleOn(ctx: ActionCtx, sub: Stripe.Subscription): Promise<void> {
  const scheduleId = scheduleIdOf(sub)
  if (scheduleId) {
    try {
      await stripe().subscriptionSchedules.release(scheduleId)
    } catch (err) {
      console.error('[billing] could not release subscription schedule', scrubError(err))
    }
  }
  await ctx.runMutation(internal.billing.setPendingDowngrade, { stripeSubscriptionId: sub.id })
}

/**
 * Releases the schedule once its swap has applied — scheduled by syncUserSubscription, so the
 * subscription returns to the plain state every other flow assumes instead of carrying a spent
 * schedule for a whole cheaper period.
 */
export const releaseSubscriptionSchedule = internalAction({
  args: { stripeSubscriptionId: v.string() },
  handler: async (ctx, { stripeSubscriptionId }) => {
    const sub = await stripe().subscriptions.retrieve(stripeSubscriptionId)
    await releaseScheduleOn(ctx, sub)
  }
})

export const createCancelFlowSession = action({
  args: { sessionToken: v.string(), flow: v.union(v.literal('cancel'), v.literal('downgrade')) },
  handler: async (ctx, { sessionToken, flow }): Promise<{ url: string | null }> => {
    const { user, live } = await liveSubscriptionFor(ctx, sessionToken)
    const { sub, item } = await retrieveWithItem(live.stripeSubscriptionId)

    if (flow === 'cancel') {
      // A pending downgrade and a pending cancellation both want the period end. The cancellation
      // wins: release the schedule so the portal acts on a plain subscription. A member who then
      // abandons the portal has lost the downgrade and can schedule it again.
      await releaseScheduleOn(ctx, sub)
      return portalSession(ctx, user, {
        type: 'subscription_cancel',
        subscription_cancel: { subscription: sub.id },
        after_completion: { type: 'redirect', redirect: { return_url: `${appOrigin()}/billing?canceled=true` } }
      })
    }

    if (live.tier === 'starter') throw new ConvexError('ALREADY_STARTER')
    // The retrieved item carries the authoritative interval; our snapshot (optional) is the fallback.
    const stripeInterval = item.price.recurring?.interval
    const interval = stripeInterval === 'month' || stripeInterval === 'year' ? stripeInterval : live.priceInterval
    const price = starterPriceIdFor(process.env, interval)
    if (!price) throw new ConvexError('Starter price not configured')

    if (sub.status === 'active') {
      if (sub.cancel_at_period_end) throw new ConvexError('CANCEL_PENDING')
      return scheduleDowngrade(ctx, sub, price, 'starter')
    }
    // Trialing (nothing paid, so nothing to credit — and the portal's trial_update_behavior keeps
    // the trial) and past_due (Stripe's dunning owns the unpaid invoice) keep the immediate switch.
    return portalSession(ctx, user, {
      type: 'subscription_update_confirm',
      subscription_update_confirm: { subscription: sub.id, items: [{ id: item.id, price, quantity: 1 }] },
      after_completion: {
        type: 'redirect',
        redirect: { return_url: `${appOrigin()}/billing?downgraded=${live.tier}` }
      }
    })
  }
})

// A card holder's "Switch to <plan>" (the plan grid, and the post-cap email's landing). An upgrade
// or an interval switch lands on Stripe's confirmation for THAT price — never the portal home, four
// clicks away. A cheaper tier is scheduled instead, and returns no URL at all.
export const createPlanSwitchSession = action({
  args: { sessionToken: v.string(), priceId: v.string() },
  handler: async (ctx, { sessionToken, priceId }): Promise<{ url: string | null }> => {
    if (!ALLOWED_PRICE_IDS.has(priceId)) throw new ConvexError('Invalid price ID')
    const { user, live } = await liveSubscriptionFor(ctx, sessionToken)
    const { sub, item } = await retrieveWithItem(live.stripeSubscriptionId)
    // Nothing to confirm. A trialing member sees a Switch button for their own plan (no "current"
    // badge during a trial), so name it; the client falls back to the portal home.
    if (item.price.id === priceId) throw new ConvexError('ALREADY_ON_PLAN')

    const targetTier = getTierFromPriceId(priceId)
    // Rank, never price amount: the decoy ladder makes amounts a liar (lib/downgrade).
    const direction = planChangeDirection(live.tier, targetTier)

    // `targetTier !== 'pro'` keeps pendingTier's union honest. It is unreachable in practice — only
    // a `contact` row would rank Pro as cheaper, and the sync never writes contact to a row — so the
    // fall-through to the portal is a type guard, not a member-facing path.
    if (direction === 'down' && targetTier !== 'pro' && sub.status === 'active') {
      if (sub.cancel_at_period_end) throw new ConvexError('CANCEL_PENDING')
      return scheduleDowngrade(ctx, sub, priceId, targetTier)
    }
    // The portal writes the same subscription our schedule owns, so an upgrade taken while one is
    // attached would race it. Ask for the undo first; BillingPage says exactly that.
    if (direction !== 'down' && scheduleIdOf(sub)) throw new ConvexError('PENDING_DOWNGRADE')

    return portalSession(ctx, user, {
      type: 'subscription_update_confirm',
      subscription_update_confirm: { subscription: sub.id, items: [{ id: item.id, price: priceId, quantity: 1 }] },
      // BillingPage reads the tier back: "Switching you to X…" until the webhook moves `me.tier`,
      // then "You're on X now." and plan_switch_completed, once. Never appended to a scheduled
      // downgrade, which is why that path can never reach the 20-second wait or its Sentry report.
      after_completion: {
        type: 'redirect',
        redirect: { return_url: `${appOrigin()}/billing?switched=${targetTier}` }
      }
    })
  }
})

/**
 * Undo a scheduled downgrade: the subscription keeps the plan it is on, at the price it is on.
 * Idempotent, like resumeSubscription — a subscription with no schedule (stale tab, double tap) is a
 * silent success that clears the mirror and calls no Stripe write.
 */
export const undoScheduledDowngrade = action({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }): Promise<null> => {
    const { live } = await liveSubscriptionFor(ctx, sessionToken)
    const sub = await stripe().subscriptions.retrieve(live.stripeSubscriptionId)
    await releaseScheduleOn(ctx, sub)
    return null
  }
})

// Undo a pending period-end cancellation. The webhook's customer.subscription.updated clears
// cancelAtPeriodEnd on our row; the page reacts to that, so nothing is returned. Idempotent: a
// subscription that is already not cancelling (stale tab, double tap) is a silent success.
export const resumeSubscription = action({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }): Promise<null> => {
    const { live } = await liveSubscriptionFor(ctx, sessionToken)
    if (!live.cancelAtPeriodEnd) return null
    await stripe().subscriptions.update(live.stripeSubscriptionId, { cancel_at_period_end: false })
    return null
  }
})
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter convex exec tsc --noEmit -p tsconfig.json`
Expected: exit 0, no errors. Task 2's one expected error is now resolved.

If `buildDowngradePhases(schedule, …)` reports a type mismatch, the structural types in `downgrade.ts` are too narrow —
widen `ScheduleIn`/`SchedulePhaseIn` to match what the SDK declares; do **not** cast at the call site.

- [ ] **Step 4: Lint**

Run: `pnpm lint`
Expected: exit 0. `portalFlowSession` and `singleItem` are gone; if the linter reports either as unused, an old
reference survived the replacement.

- [ ] **Step 5: Rewrite `docs/PLATFORM.md` §8 "Cancel, downgrade and resume (R09)"**

Replace the `**\`downgrade\`** →` bullet with a description of the schedule path: `active
` subscriptions get a subscription schedule whose phase 1 carries the Starter price of the same interval, `
proration_behavior: 'none'`, starting at `current_period_end`; the action returns `{ url: null }
` and the member never leaves the app; trialing and past-due keep the portal's `subscription_update_confirm`; `
CANCEL_PENDING` is thrown when a cancellation is already pending.

Add a paragraph covering: the mirror on the row, `undoScheduledDowngrade` and its idempotence, the cancel path releasing
the schedule first, and the release-on-applied.

In the R09 mermaid, replace the `Move to Starter` branch so it reads `I ->> N: createCancelFlowSession(downgrade)` →
`N ->> S: subscriptionSchedules.create + update (phase 1 proration_behavior none)` →
`N -->> I: { url: null } (cancel_alternative_completed)`, and add the undo leg `U ->> B: Keep <plan>` →
`B ->> N: undoScheduledDowngrade` → `N ->> S: subscriptionSchedules.release`.

- [ ] **Step 6: Rewrite `docs/PLATFORM.md` §8 "Plan switch (R08 / R20)"**

Replace the sentence ending "A cross-tier downgrade still credits, and §8 explains why that cannot be fixed by
rearranging the products." with: the portal still runs `always_invoice`, so an upgrade taken there is invoiced on the
spot and a same-product interval switch defers with no credit; **a cross-tier downgrade no longer reaches the portal at
all** — it is scheduled, returns no URL, and never prorates.

Add the routing table from spec §3.2 and note the two refusal codes with the toasts they produce.

In the R08 mermaid, add the branch `N ->> N: direction by tierToRank` with `down + active` going to the schedule and
returning `{ url: null }`.

- [ ] **Step 7: Close the ⛔ paragraph under "Stripe Dashboard setup"**

Replace the closing "Not built; not scheduled." with a build note: what was built (the schedule path, the mirror, the
undo, the release), the file it lives in, and that the test-mode proof is pending until Task 6's read-backs land. Leave
the whole preceding record of the failed one-product restructure intact — it is the evidence for why this exists.

In the Dashboard table's proration row, append that `always_invoice` no longer reaches a cross-tier downgrade, which is
scheduled by `billingNode` instead.

- [ ] **Step 8: Report — do not commit**

---

## Task 4: The billing page and the interstitial

**Files:**

- Modify: `app/src/pages/BillingPage.tsx`
- Modify: `app/src/pages/BillingPage.test.tsx`
- Modify: `app/src/components/CancelInterstitial.tsx`
- Modify: `app/src/components/CancelInterstitial.test.tsx`
- Modify: `app/src/i18n/locales/en.json`, `pt.json`, `es.json`
- Modify: `docs/PLATFORM.md` (§14 BillingPage bullets, the CancelInterstitial line, the PostHog inventory)

**Interfaces:**

- Consumes: `users.getSubscriptionInfo`'s `pendingTier` / `pendingAt` (Task 2); `billingNode.undoScheduledDowngrade`,
  the `{ url: string | null }` return, and the `PENDING_DOWNGRADE` / `CANCEL_PENDING` refusals (Task 3).
- Produces: the PostHog event `downgrade_scheduled { from, to }`.

- [ ] **Step 1: Add the eight English keys**

In `app/src/i18n/locales/en.json`, inside the `billing` object next to the other renewal keys:

```json
    "pendingChange": "Plan change",
    "pendingFrom": "{{plan}} from {{date}}",
    "pendingKeep": "Keep {{plan}}",
    "pendingKept": "Your plan stays as it is.",
    "pendingUntil": "You keep {{plan}} until then.",
    "pendingScheduled": "You move to {{plan}} at the end of your period.",
    "pendingUndoFirst": "Undo your scheduled change first.",
    "pendingResumeFirst": "Resume your plan first.",
```

- [ ] **Step 2: Add the pt-BR keys**

In `app/src/i18n/locales/pt.json`, same position, Brazilian Portuguese, sentence case, same placeholders:

```json
    "pendingChange": "Mudança de plano",
    "pendingFrom": "{{plan}} a partir de {{date}}",
    "pendingKeep": "Manter {{plan}}",
    "pendingKept": "Seu plano continua como está.",
    "pendingUntil": "Você fica no {{plan}} até lá.",
    "pendingScheduled": "Você muda para {{plan}} no fim do seu período.",
    "pendingUndoFirst": "Desfaça sua mudança agendada primeiro.",
    "pendingResumeFirst": "Retome seu plano primeiro.",
```

- [ ] **Step 3: Add the neutral Latin American Spanish keys**

In `app/src/i18n/locales/es.json`, same position:

```json
    "pendingChange": "Cambio de plan",
    "pendingFrom": "{{plan}} desde el {{date}}",
    "pendingKeep": "Mantener {{plan}}",
    "pendingKept": "Tu plan sigue igual.",
    "pendingUntil": "Sigues en {{plan}} hasta esa fecha.",
    "pendingScheduled": "Cambias a {{plan}} al final de tu período.",
    "pendingUndoFirst": "Primero deshaz tu cambio programado.",
    "pendingResumeFirst": "Primero reanuda tu plan.",
```

- [ ] **Step 4: Verify locale parity**

Run this from the repo root:

```bash
python -c "
import json,io
def leaves(o,p=''):
    if isinstance(o,dict):
        for k,v in o.items():
            yield from leaves(v,p+'.'+k if p else k)
    elif isinstance(o,list): yield p
    else: yield p
L={n:set(leaves(json.load(io.open('app/src/i18n/locales/%s.json'%n,encoding='utf-8')))) for n in ('en','pt','es')}
for a in ('pt','es'):
    print(a,'missing',sorted(L['en']-L[a]),'extra',sorted(L[a]-L['en']))
print({k:len(v) for k,v in L.items()})
"
```

Expected: no missing, no extra, all three counts identical.

- [ ] **Step 5: Wire the page's action and handler**

In `app/src/pages/BillingPage.tsx`, after `const resumeSubscription = useAction(api.billingNode.resumeSubscription)`:

```ts
  const undoDowngrade = useAction(api.billingNode.undoScheduledDowngrade)
```

Add after `handleResume`:

```ts
  // backlog/B07 — cancel the scheduled cross-tier downgrade. The webhook clears the mirror on our
  // row, so the cell disappears reactively and nothing is returned. Idempotent server-side.
  async function handleUndoDowngrade() {
    if (!sessionToken) return
    setResumeLoading(true)
    try {
      await undoDowngrade({ sessionToken })
      toast(t('billing.pendingKept'))
    } catch (err: unknown) {
      toast(t('billing.cancel.resumeFailed', { error: friendlyError(err, String(err)) }))
    } finally {
      setResumeLoading(false)
    }
  }
```

- [ ] **Step 6: Route the scheduled result and the two refusals**

Replace `handlePlanClick`'s call `return void handlePlanSwitch(priceId)` with
`return void handlePlanSwitch(priceId, planId)`, and replace `handlePlanSwitch` with:

```ts
  // Lands the member on Stripe's confirmation for the price on the button they clicked (R08, and the
  // R20 email's landing). A cheaper tier returns NO url: it was scheduled for the period end
  // (backlog/B07), so there is nothing to redirect to and nothing to wait for. Whatever else stops
  // the deep link — the price not yet allowed in the Customer Portal, the plan they are already on —
  // still opens the portal home: a door, never a dead end. The two refusals that name a fix say it.
  async function handlePlanSwitch(priceId: string, planId: string) {
    if (!sessionToken) return
    setPortalLoading(true)
    try {
      const result = await createPlanSwitch({ sessionToken, priceId })
      // eslint-disable-next-line react-hooks/immutability -- a browser redirect, not a React mutation
      if (result?.url) window.location.href = result.url
      else {
        captureEvent('downgrade_scheduled', { from: me?.tier, to: planId })
        // Plan only, no date: pendingAt reaches this component a beat later, through the query.
        toast(t('billing.pendingScheduled', { plan: t(`billing.plans.${planId}.name`) }))
      }
    } catch (err: unknown) {
      const message = friendlyError(err, String(err))
      if (message.startsWith('PENDING_DOWNGRADE')) return void toast(t('billing.pendingUndoFirst'))
      if (message.startsWith('CANCEL_PENDING')) return void toast(t('billing.pendingResumeFirst'))
      await handleManageSubscription()
    } finally {
      setPortalLoading(false)
    }
  }
```

- [ ] **Step 7: Render the pending cell, the Keep button and the until-line**

In the billing info card, change the renewal cell's condition and its three branches. Replace the whole
`{(subscriptionInfo.cancelAtPeriodEnd || periodEndDate) && ( … )}` block with:

```tsx
            {(subscriptionInfo.cancelAtPeriodEnd || subscriptionInfo.pendingTier || periodEndDate) && (
              <div>
                <p className="text-muted-foreground m-0 text-xs">
                  {subscriptionInfo.cancelAtPeriodEnd
                    ? periodEndDate
                      ? t('billing.cancelsOn')
                      : t('billing.renewal')
                    : subscriptionInfo.pendingTier
                      ? t('billing.pendingChange')
                      : t('billing.nextBilling')}
                </p>
                <p
                  className={`mt-1 text-sm font-semibold ${subscriptionInfo.cancelAtPeriodEnd ? 'text-destructive' : 'text-foreground'}`}
                >
                  {subscriptionInfo.cancelAtPeriodEnd
                    ? periodEndDate
                      ? t('billing.accessUntil', { date: periodEndDate })
                      : t('billing.cancelPending')
                    : subscriptionInfo.pendingTier
                      ? t('billing.pendingFrom', {
                          plan: t(`billing.plans.${subscriptionInfo.pendingTier}.name`),
                          date: pendingDate
                        })
                      : t('billing.renewsOn', { date: periodEndDate })}
                </p>
              </div>
            )}
```

Add `pendingDate` beside the existing `periodEndDate`:

```ts
  // backlog/B07 — when the scheduled downgrade takes effect. Falls back to the renewal date: they
  // are the same instant when the schedule is written, and the mirror can lag by one webhook.
  const pendingDate =
    subscriptionInfo?.pendingAt != null
      ? new Date(subscriptionInfo.pendingAt).toLocaleDateString(i18n.language)
      : periodEndDate
```

In the button row, replace the `cancelAtPeriodEnd ? <Resume> : <cancel link>` ternary with a three-way: Resume when
cancel-pending, **Keep {{plan}}** when `pendingTier` is set, the cancel link otherwise. The cancel link stays reachable
while pending, because `createCancelFlowSession('cancel')` releases the schedule first:

```tsx
            {subscriptionInfo.cancelAtPeriodEnd ? (
              <Button
                onClick={handleResume}
                disabled={resumeLoading}
                aria-busy={resumeLoading}
                className="cursor-pointer text-[13px]"
              >
                {resumeLoading ? '...' : t('billing.cancel.resume')}
              </Button>
            ) : (
              <>
                {subscriptionInfo.pendingTier && (
                  <Button
                    onClick={handleUndoDowngrade}
                    disabled={resumeLoading}
                    aria-busy={resumeLoading}
                    className="cursor-pointer text-[13px]"
                  >
                    {resumeLoading ? '...' : t('billing.pendingKeep', { plan: t(`billing.plans.${me?.tier}.name`) })}
                  </Button>
                )}
                <button
                  type="button"
                  onClick={() => setCancelOpen(true)}
                  className="text-muted-foreground min-h-10 text-[13px] underline-offset-4 hover:underline"
                >
                  {t('billing.cancel.link')}
                </button>
              </>
            )}
```

Under the card, extend the existing cancel-pending footnote so the pending downgrade gets its own line:

```tsx
          {subscriptionInfo.cancelAtPeriodEnd && periodEndDate ? (
            <p className="text-muted-foreground mt-2 mb-0 text-xs">
              {t('billing.cancel.postsLeave', { date: periodEndDate })}
            </p>
          ) : subscriptionInfo.pendingTier ? (
            <p className="text-muted-foreground mt-2 mb-0 text-xs">
              {t('billing.pendingUntil', { plan: t(`billing.plans.${me?.tier}.name`) })}
            </p>
          ) : null}
```

- [ ] **Step 8: Pass the pending tier to the interstitial**

Find the `<CancelInterstitial … />` usage in `BillingPage.tsx` and add `pendingTier={subscriptionInfo?.pendingTier}`.

- [ ] **Step 9: Update `CancelInterstitial.tsx`**

Add `pendingTier` to the props type and destructuring:

```tsx
export default function CancelInterstitial({
  open,
  onOpenChange,
  tier,
  isTrialing,
  periodEndDate,
  pendingTier
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  tier: string
  isTrialing: boolean
  periodEndDate: string | null
  /** backlog/B07 — a downgrade already scheduled for the period end. Hides the alternative. */
  pendingTier?: string
}) {
```

Change the alternative's condition:

```tsx
        {tier !== 'starter' && !pendingTier && (
```

And handle the `null` url in `go`, replacing the `const { url } = …` lines:

```tsx
      const { url } = await createCancelFlow({ sessionToken, flow })
      if (url) {
        // eslint-disable-next-line react-hooks/immutability -- a browser redirect, not a React mutation
        window.location.href = url
        return
      }
      // No url means the downgrade was SCHEDULED for the period end (backlog/B07): nowhere to send
      // them, and the save has already happened here rather than on a Stripe return leg — so this is
      // where cancel_alternative_taken's completion belongs.
      setPending(false)
      if (flow === 'downgrade') {
        captureEvent('cancel_alternative_completed', { from: tier })
        toast(t('billing.pendingScheduled', { plan: t('billing.plans.starter.name') }))
        onOpenChange(false)
      }
```

- [ ] **Step 10: Write the failing BillingPage tests**

Add to `app/src/pages/BillingPage.test.tsx`. First register the new action in the mock api object and the `ACTIONS` map:

```ts
      billingNode: {
        createCheckoutSession: 'billingNode.createCheckoutSession',
        createCancelFlowSession: 'billingNode.createCancelFlowSession',
        createPlanSwitchSession: 'billingNode.createPlanSwitchSession',
        resumeSubscription: 'billingNode.resumeSubscription',
        undoScheduledDowngrade: 'billingNode.undoScheduledDowngrade'
      },
```

```ts
const mockUndo = vi.fn(async () => null)
```

```ts
  'billingNode.undoScheduledDowngrade': mockUndo,
```

Add `mockUndo.mockClear()` to `beforeEach`. Then append this describe block:

```tsx
describe('scheduled downgrade (B07)', () => {
  const PENDING = {
    tier: 'growth',
    status: 'active',
    cancelAtPeriodEnd: false,
    currentPeriodEnd: Date.parse('2026-10-01T00:00:00Z'),
    pendingTier: 'starter',
    pendingAt: Date.parse('2026-10-01T00:00:00Z')
  }

  it('names the plan and the date the member moves down on', () => {
    mockQueryReturns['users.getSubscriptionInfo'] = PENDING
    setUser({ subscriptionStatus: 'active' })
    renderPage()
    expect(screen.getByText('billing.pendingChange')).toBeInTheDocument()
    expect(screen.getByText(/billing\.pendingFrom.*Starter/)).toBeInTheDocument()
  })

  it('offers Keep <current plan>, not Keep <the plan they are leaving for>', () => {
    mockQueryReturns['users.getSubscriptionInfo'] = PENDING
    setUser({ subscriptionStatus: 'active' })
    renderPage()
    expect(screen.getByRole('button', { name: /billing\.pendingKeep.*Growth/ })).toBeInTheDocument()
  })

  it('undoes the scheduled downgrade and says the plan stays', async () => {
    mockQueryReturns['users.getSubscriptionInfo'] = PENDING
    setUser({ subscriptionStatus: 'active' })
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /billing\.pendingKeep/ }))
    await waitFor(() => expect(mockUndo).toHaveBeenCalledWith({ sessionToken: 'tok' }))
  })

  it('keeps the cancel link reachable while a downgrade is pending', () => {
    mockQueryReturns['users.getSubscriptionInfo'] = PENDING
    setUser({ subscriptionStatus: 'active' })
    renderPage()
    expect(screen.getByRole('button', { name: 'billing.cancel.link' })).toBeInTheDocument()
  })

  it('treats a null url as scheduled: no redirect, an event, and a toast', async () => {
    mockSwitch.mockResolvedValueOnce({ url: null } as unknown as { url: string })
    setUser({ subscriptionStatus: 'active', tier: 'growth' })
    renderPage()
    fireEvent.click(screen.getAllByRole('button', { name: /billing\.switchPlan/ })[0])
    await waitFor(() =>
      expect(captureEvent).toHaveBeenCalledWith('downgrade_scheduled', { from: 'growth', to: 'starter' })
    )
    expect(mockPortal).not.toHaveBeenCalled()
  })

  it('asks for the undo instead of opening the portal when the server refuses PENDING_DOWNGRADE', async () => {
    mockSwitch.mockRejectedValueOnce(new Error('PENDING_DOWNGRADE'))
    setUser({ subscriptionStatus: 'active' })
    renderPage()
    fireEvent.click(screen.getAllByRole('button', { name: /billing\.switchPlan/ })[0])
    await waitFor(() => expect(mockSwitch).toHaveBeenCalled())
    expect(mockPortal).not.toHaveBeenCalled()
  })

  it('asks for the resume instead of opening the portal when the server refuses CANCEL_PENDING', async () => {
    mockSwitch.mockRejectedValueOnce(new Error('CANCEL_PENDING'))
    setUser({ subscriptionStatus: 'active' })
    renderPage()
    fireEvent.click(screen.getAllByRole('button', { name: /billing\.switchPlan/ })[0])
    await waitFor(() => expect(mockSwitch).toHaveBeenCalled())
    expect(mockPortal).not.toHaveBeenCalled()
  })

  it('still falls back to the portal home for any other refusal', async () => {
    mockSwitch.mockRejectedValueOnce(new Error('ALREADY_ON_PLAN'))
    setUser({ subscriptionStatus: 'active' })
    renderPage()
    fireEvent.click(screen.getAllByRole('button', { name: /billing\.switchPlan/ })[0])
    await waitFor(() => expect(mockPortal).toHaveBeenCalled())
  })
})
```

`friendlyError` is what turns a thrown error into the string these branches match. If a refusal test fails because the
message arrives wrapped, read `app/src/lib/errors.ts` and match what it actually produces rather than loosening the
branch in the page.

- [ ] **Step 11: Write the failing CancelInterstitial tests**

Append to `app/src/components/CancelInterstitial.test.tsx`:

```tsx
describe('scheduled downgrade (B07)', () => {
  it('hides the Starter alternative when a downgrade is already scheduled', () => {
    renderIt({ pendingTier: 'starter' })
    expect(screen.queryByRole('button', { name: 'billing.cancel.alternativeCta' })).not.toBeInTheDocument()
  })

  it('closes, toasts and completes the save funnel when the downgrade returns no url', async () => {
    const onOpenChange = vi.fn()
    mockCancelFlow.mockResolvedValueOnce({ url: null } as unknown as { url: string })
    renderIt({ onOpenChange })
    fireEvent.click(screen.getByRole('button', { name: 'billing.cancel.alternativeCta' }))
    await waitFor(() => expect(captureEvent).toHaveBeenCalledWith('cancel_alternative_completed', { from: 'growth' }))
    expect(captureEvent).toHaveBeenCalledWith('cancel_alternative_taken', { from: 'growth' })
    expect(toast).toHaveBeenCalled()
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('still redirects when the server does return a portal url (a trialing member)', async () => {
    mockCancelFlow.mockResolvedValueOnce({ url: 'https://portal.test/x' })
    renderIt()
    fireEvent.click(screen.getByRole('button', { name: 'billing.cancel.alternativeCta' }))
    await waitFor(() => expect(mockCancelFlow).toHaveBeenCalledWith({ sessionToken: 'tok', flow: 'downgrade' }))
    expect(captureEvent).not.toHaveBeenCalledWith('cancel_alternative_completed', { from: 'growth' })
  })
})
```

The existing file's `t` mock returns the raw key, so the alternative button's accessible name is
`billing.cancel.alternativeCta`. If it is not, read the file's `react-i18next` mock and match it — do not change the
component to fit the test.

- [ ] **Step 12: Run the app suite**

Run: `pnpm --filter app test`
Expected: PASS. Baseline was 421; this task adds 11, so expect 432. Every pre-existing test must still pass — in
particular the `?switched=` landing tests, which this change deliberately leaves alone.

- [ ] **Step 13: Update `docs/PLATFORM.md` §14 and the PostHog inventory**

In the BillingPage bullets, add `undoScheduledDowngrade` to the function list, and a sub-bullet describing the pending
cell ("Plan change" / "{{plan}} from {{date}}"), the "Keep {{plan}}" button next to a still-reachable cancel link, the
"You keep {{plan}} until then." footnote, and the two refusal toasts. Name the eight keys.

In the CancelInterstitial paragraph, note that the alternative is hidden while a downgrade is pending, and that a `null`
url closes the dialog and completes the funnel in place.

In the PostHog inventory, add:

> - `downgrade_scheduled` — `BillingPage.handlePlanSwitch`, when the plan grid's switch returns **no url** because the
    change was scheduled for the period end (**B07**). Props: `from` (the tier they keep until then), `to` (the tier
    they move to).

And amend `cancel_alternative_completed`: it now fires **in the interstitial** when the schedule is written, and still
on the `?downgraded=<tier>` landing for the portal path a trialing or past-due member takes.

- [ ] **Step 14: Report — do not commit**

---

## Task 5: Full verification

**Files:** none — this task only runs gates and fixes what they catch.

- [ ] **Step 1: Run the whole gate**

Run: `pnpm verify`
Expected: exit 0. It chains `format:check`, `lint`, `typecheck` (convex + app + landing), then `pnpm -r test`.

- [ ] **Step 2: Fix a `format:check` failure by hand**

If Prettier flags a file this batch touched, open it and fix the formatting with Edit. **Never run `pnpm format`** — it
would reformat hand-aligned prose across the repo.

- [ ] **Step 3: Re-verify locale parity and report the counts**

Re-run the Step 4 command from Task 4. Report the three leaf counts and confirm the placeholder sets match:
`pendingFrom` takes `plan` + `date`; `pendingKeep`, `pendingUntil` and `pendingScheduled` take `plan`; the rest take
none.

- [ ] **Step 4: Confirm §21's last-updated block**

Update `docs/PLATFORM.md`'s `_Last updated:_` block to 2026-09-09 with a paragraph naming this change: the cross-tier
downgrade left the Customer Portal, why the portal could never defer it, and that the proof is a test-mode read-back
rather than a code review.

- [ ] **Step 5: Report — do not commit**

State the final test counts (convex and app), and list every file changed so Henriko can review before committing.

---

## Task 6: The test-mode proof (Henriko writes, the assistant reads)

**Files:** `docs/PLATFORM.md` (§8 ⛔ paragraph — record the read-backs)

This task cannot be completed by an agent. The tool classifier permits Stripe reads and refuses Stripe writes, so every
command below goes to Henriko, and his output comes back before anything here is called done. Nothing in this plan is
finished until read-backs A, B and C are on file: a green test suite proves the code runs, not that Stripe issues no
credit.

- [ ] **Step 1: Hand Henriko the setup commands**

Test-mode Stripe CLI, and `npx convex run` from the repo root. The customer must be attached to a dev user **before**
the subscription exists — `syncUserSubscription` warns and drops an event for a customer it cannot map.

```bash
stripe test_helpers test_clocks create -d frozen_time=<now unix seconds> -d name=downgrade-proof
```

```bash
stripe customers create -d test_clock=<clock> -d email=<dev user email> -d name="Downgrade proof"
```

```bash
stripe payment_methods attach pm_card_visa -d customer=<cus>
```

```bash
stripe customers update <cus> -d "invoice_settings[default_payment_method]=<pm>"
```

```bash
npx convex run billing:setStripeCustomerId '{"userId":"<users id>","stripeCustomerId":"<cus>"}'
```

```bash
stripe subscriptions create -d customer=<cus> -d "items[0][price]=<STRIPE_GROWTH_PRICE_ID>"
```

- [ ] **Step 2: Ask him to take the downgrade in the app**

"Cancel plan" → "Move to Starter". Expected: no redirect, a toast, "Starter from <date>" on the billing card, a "Keep
Growth" button.

- [ ] **Step 3: Read back A — scheduled, nothing credited**

```bash
stripe subscriptions retrieve <sub>
```

```bash
stripe subscription_schedules retrieve <sched>
```

```bash
stripe customers retrieve <cus>
```

```bash
stripe invoices list -d customer=<cus>
```

Assert: `schedule` set and the item still on the Growth price; two phases; phase 1 has `proration_behavior: "none"`,
`start_date` equal to the subscription's `current_period_end`, and the Starter monthly price; customer `balance: 0`; no
invoice beyond the first.

- [ ] **Step 4: Read back C — the undo**

Have him tap "Keep Growth", then re-run the first two reads. Assert: subscription `schedule: null`, schedule
`status: "released"`, item price unchanged, the pending cell gone from the page, `balance: 0`.

- [ ] **Step 5: Schedule again and look at the portal**

Repeat Step 2, then open "Manage subscription" while pending and record what the portal home shows for a scheduled
subscription. Information for §8, not a gate.

- [ ] **Step 6: Advance the clock**

```bash
stripe test_helpers test_clocks advance <clock> -d frozen_time=<current_period_end + 3600>
```

- [ ] **Step 7: Read back B — applied, nothing credited**

Same four reads as Step 3. Assert: item price is Starter monthly; `schedule: null` (released by the sync's scheduled
action — if it still reads `active`, say so and read again a minute later rather than calling it green); the new invoice
has exactly **one** line, the Starter price, and **no** negative proration line; `amount_due` equals the Starter price;
`balance: 0`. In the app: tier Starter, no pending cell, and no Sentry event.

- [ ] **Step 8: Record the read-backs in `docs/PLATFORM.md` §8**

Replace the "proof pending" note left by Task 3 with the dated result: what was read, what it showed, and the invoice
line that proves no credit.

- [ ] **Step 9: Report — do not commit**

---

## Self-Review

**Spec coverage.** Every numbered spec section maps to a task: §3.1's five calls are implemented across Tasks 3 and 4
(call 1 in `createCancelFlowSession`'s status branch, call 2 in its cancel branch, call 3 in `createPlanSwitchSession`'s
`PENDING_DOWNGRADE`, call 4 in `buildDowngradePhases`'s carried discounts, call 5 by the absence of an undo event); §3.2
in Task 3; §3.3 in Tasks 1 and 3; §3.4 in Task 3; §3.5 in Task 2; §3.6 in Tasks 1 and 2; §3.7 in Task 3; §3.8 in Task 4;
§3.9's edge cases are covered by the tests in Tasks 1 and 4 plus the guards in Task 3; §3.10 in Tasks 1 and 4; §3.11
across Tasks 2, 3 and 4; §4's gates in Task 5; §6's proof in Task 6.

**Known gap, deliberate:** the spec's §3.6 race note (the action dying between the Stripe write and the mirror mutation)
gets no repair path, as specified. Pre-launch, with no production data, the swap still applies and Stripe self-releases.

**Type consistency.** `pendingTier` is `'starter' | 'growth'` in the schema (Task 2), in `setPendingDowngrade`'s args
(Task 2), and in `scheduleDowngrade`'s `targetTier` parameter (Task 3), which is why Task 3 guards
`targetTier !== 'pro'` rather than casting. `stripeScheduleId` is `string | undefined` in `syncArgs` (Task 2),
`v.optional(v.string())` in the mutation args (Task 2), and `stripeScheduleId?: string` in `resolvePendingDowngrade`'s
`incoming` (Task 1). `buildDowngradePhases` takes `(schedule, targetPriceId, targetInterval)` in Task 1 and is called
with exactly those three in Task 3. Both public flow actions return `{ url: string | null }` in Task 3 and are consumed
as such in Task 4.
