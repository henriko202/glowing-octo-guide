# Plan 2B — Trial Backend (Card-Gated, Always-Growth, 50-or-7-day Milestone, Feed Reciprocity)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development or superpowers:executing-plans.
> Checkbox (`- [ ]`) tracking. **Depends on Plan 2A** (needs `internal.billingNode.endTrialEarly`).

**Goal:** Implement the trial *behaviour* on the backend: new users have **no trial until they add a card** (status
`none`); engaging requires a card (enforced server-side, unbypassable); the trial is a real **Growth** Stripe
subscription (so `tier` is `growth` naturally — no `effectiveTier` helper); a **combined 50-interaction milestone** (
made + received) ends the Stripe trial early; and **trialing users' posts are visible** in the feed (reciprocity). The
app-facing UI (card-gate visuals, X/50 progress, SSI link-out, downgrade prompt) is **Plan 2C, deferred until after the
app/ UI revamp**.

**Architecture:** No `effectiveTier` is needed because the trial subscription *is* Growth (the webhook sets
`tier: 'growth'`). Server-side enforcement (`assertCanEngage`) gates `commentOnPost` / `reactToPost` / `submitPost` on
`subscriptionStatus ∈ {trialing, active}`. The milestone is two `users` counters (`trialInteractionsMade`,
`trialInteractionsReceived`) bumped in the existing `incrementCommentCount` / `incrementLikeCount` mutations (reliable,
not the best-effort `recordInteraction`); crossing 50 schedules `internal.billingNode.endTrialEarly`. The 7-day side of
the gate is Stripe's own `trial_period_days` (Plan 2A). Pre-launch → **no data backfill**.

**Tech Stack:** Convex (TS), Vitest (pure-logic tests, mock `convex/server`). pnpm.

**Source reads:** written from full reads of `convex/interactions.ts`, `convex/linkedin/auth.ts`, `convex/feed.ts`,
`convex/posts.ts` (submit), `convex/stripe.ts`, `convex/schema.ts` (users/subscriptions).

## Global Constraints

- **NEVER commit.** Agent edits only; Henriko commits at each checkpoint.
- **No `effectiveTier`.** Trial = real Growth subscription → `tier` is already `growth`. Do not add a tier-mapping shim.
- **Card-on-file gate, server-enforced.** Engaging requires `subscriptionStatus ∈ {trialing, active}`. The pretty in-app
  gate (disabled buttons + pulsing billing tab) is **Plan 2C**; this plan makes the rule real at the API.
- **Milestone reliability.** Counters live in `incrementCommentCount`/`incrementLikeCount` (awaited, reliable) — NOT in
  `recordInteraction` (best-effort/swallowed). Fire `endTrialEarly` exactly once (crossing 50), and only while
  `subscriptionStatus === 'trialing'`.
- **No backfill.** Pre-launch (dev disposable). Removing the trialing feed-hide does not require un-hiding historical
  posts.
- **Pure logic gets a unit test** (Vitest; mock `convex/server`; no `convex-test`).
- **Apify stays dormant** (untouched here; Plan 2A added the guard).

### Verification

```bash
pnpm --filter convex exec tsc --noEmit -p tsconfig.json
pnpm -r test
pnpm lint
```

---

## File Structure

| Action | Path                                          | Responsibility                                                                                        |
|--------|-----------------------------------------------|-------------------------------------------------------------------------------------------------------|
| Modify | `convex/schema.ts`                            | Add `trialInteractionsMade` / `trialInteractionsReceived` to `users`                                  |
| Create | `convex/lib/access.ts` (+ `.test.ts`)         | `canEngage(status)` / `assertCanEngage(user)` — the card-on-file gate                                 |
| Create | `convex/lib/trialMilestone.ts` (+ `.test.ts`) | `TRIAL_INTERACTION_THRESHOLD`, `crossesThreshold(current, delta)`                                     |
| Modify | `convex/linkedin/auth.ts` (+ `auth.test.ts`)  | New users → `subscriptionStatus: 'none'`; remove the 3-day app trial                                  |
| Modify | `convex/interactions.ts`                      | Card-gate `commentOnPost`/`reactToPost`; thread `actorId`; bump trial counters + fire `endTrialEarly` |
| Modify | `convex/posts.ts`                             | Card-gate `submitPost`; `hidden: false` (reciprocity)                                                 |
| Modify | `convex/feed.ts` (+ `feed.test.ts`)           | `isAuthorFeedEligible`: drop the `trialing` exclusion                                                 |
| Modify | `docs/PLATFORM.md`                            | §1/§8/§9/§11 reflect the new trial model                                                              |

---

## Task 1: Schema — trial interaction counters

**Files:** Modify `convex/schema.ts`

- [ ] **Step 1:** In the `users` table definition, add two optional counters (alongside `trialEndsAt`):

```ts
    trialInteractionsMade: v.optional(v.number()),
    trialInteractionsReceived: v.optional(v.number()),
```

- [ ] **Step 2: Verify** — `pnpm --filter convex exec tsc --noEmit -p tsconfig.json` (0 errors). (Optional fields → no
  migration needed; pre-launch.)

- [ ] **Step 3: Checkpoint** — (`feat(trial): add trial interaction counters to users`).

---

## Task 2: The card-on-file gate (pure + assert)

**Files:** Create `convex/lib/access.ts`, `convex/lib/access.test.ts`

**Interfaces — Produces:** `canEngage(status): boolean`, `assertCanEngage(user): void` (throws `PAYMENT_REQUIRED: …`)

- [ ] **Step 1: Failing test** — `convex/lib/access.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { canEngage, assertCanEngage } from './access'

describe('access', () => {
  it('allows engaging only with a card-backed status', () => {
    expect(canEngage('trialing')).toBe(true)
    expect(canEngage('active')).toBe(true)
    expect(canEngage('none')).toBe(false)
    expect(canEngage('canceled')).toBe(false)
    expect(canEngage('past_due')).toBe(false)
  })

  it('assertCanEngage throws PAYMENT_REQUIRED when no card', () => {
    expect(() => assertCanEngage({ subscriptionStatus: 'none' })).toThrow(/PAYMENT_REQUIRED/)
    expect(() => assertCanEngage({ subscriptionStatus: 'trialing' })).not.toThrow()
  })
})
```

- [ ] **Step 2: Run → FAIL.**

- [ ] **Step 3: Implement** — `convex/lib/access.ts`

```ts
import type { Doc } from '../_generated/dataModel'

type Status = Doc<'users'>['subscriptionStatus']

// Card-on-file gate: a user may engage (comment / react / submit) only once a card-backed
// trial or paid subscription exists. New users start at 'none' and must add a card first.
export function canEngage(status: Status): boolean {
  return status === 'trialing' || status === 'active'
}

export function assertCanEngage(user: Pick<Doc<'users'>, 'subscriptionStatus'>): void {
  if (!canEngage(user.subscriptionStatus)) {
    // Prefixed so the app can detect this case and show the card-gate (Plan 2C).
    throw new Error('PAYMENT_REQUIRED: Add a payment method to start engaging.')
  }
}
```

- [ ] **Step 4: Run → PASS.**

- [ ] **Step 5: Checkpoint** — (`feat(trial): card-on-file engage gate (pure + assert)`).

---

## Task 3: Signup starts at `none` (no app trial)

**Files:** Modify `convex/linkedin/auth.ts` and `convex/linkedin/auth.test.ts`

The real trial now starts when a card is added (Plan 2A's Stripe trial). New users get no app-side trial.

- [ ] **Step 1: auth.ts** — delete the `const TRIAL_DURATION_MS = ...` line (19) and the `const trialEndsAt = ...`
  line (57). In the new-user `db.insert('users', { ... })`, change the subscription fields:

```ts
    tier: 'starter' as const,
    subscriptionStatus: 'none' as const,
```

(Remove the `trialEndsAt,` property entirely from the insert.)

- [ ] **Step 2: auth.test.ts** — update the new-user assertions: a freshly-inserted user now has
  `subscriptionStatus: 'none'` and **no** `trialEndsAt`. Find the test that asserts
  `subscriptionStatus === 'trialing'` / a `trialEndsAt` value and change it to expect `'none'` and
  `trialEndsAt === undefined`. (Keep the existing-user / patch tests unchanged.)

- [ ] **Step 3: Verify** — `pnpm -r test` (auth tests green), convex typecheck.

- [ ] **Step 4: Checkpoint** — (`feat(trial): new users start at status none; trial begins on card-add`).

---

## Task 4: Enforce the card gate on engagement actions

**Files:** Modify `convex/interactions.ts`, `convex/posts.ts`

- [ ] **Step 1: interactions.ts** — add the import:

```ts
import { assertCanEngage } from './lib/access'
```

In `commentOnPost`, immediately after `const user = (await requireAuthAction(ctx, sessionToken)) as Doc<'users'>` (
line ~121) and the `linkedinAccessToken` check, add:

```ts
    assertCanEngage(user)
```

Do the same in `reactToPost` after its `requireAuthAction` (line ~172).

- [ ] **Step 2: posts.ts** — in `submitPost`, add `import { assertCanEngage } from './lib/access'` and call
  `assertCanEngage(user)` immediately after the user is resolved via `requireAuthAction` (before any post composition).

- [ ] **Step 3: Verify** — convex typecheck. (Behaviour: a `none`/`canceled`/`past_due` user calling these actions now
  gets `PAYMENT_REQUIRED`.)

- [ ] **Step 4: Checkpoint** — (`feat(trial): server-enforce card-on-file on comment/react/submit`).

---

## Task 5: Milestone crossing helper (pure + test)

**Files:** Create `convex/lib/trialMilestone.ts`, `convex/lib/trialMilestone.test.ts`

- [ ] **Step 1: Failing test** — `convex/lib/trialMilestone.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { crossesThreshold, TRIAL_INTERACTION_THRESHOLD } from './trialMilestone'

describe('trialMilestone', () => {
  it('threshold is 50', () => {
    expect(TRIAL_INTERACTION_THRESHOLD).toBe(50)
  })
  it('crosses only on the +1 that reaches 50', () => {
    expect(crossesThreshold(49, 1)).toBe(true)
    expect(crossesThreshold(48, 1)).toBe(false)
    expect(crossesThreshold(50, 1)).toBe(false) // already past — fire once only
    expect(crossesThreshold(0, 1)).toBe(false)
  })
})
```

- [ ] **Step 2: Run → FAIL.**

- [ ] **Step 3: Implement** — `convex/lib/trialMilestone.ts`

```ts
// The trial converts (Stripe trial ends early) at this many combined interactions
// (made + received). The 7-day side of "50 OR 7 days" is Stripe's own trial_period_days.
export const TRIAL_INTERACTION_THRESHOLD = 50

// True only on the increment that first reaches the threshold, so endTrialEarly fires once.
export function crossesThreshold(current: number, delta: number, threshold = TRIAL_INTERACTION_THRESHOLD): boolean {
  return current < threshold && current + delta >= threshold
}
```

- [ ] **Step 4: Run → PASS.**

- [ ] **Step 5: Checkpoint** — (`feat(trial): pure 50-interaction crossing helper`).

---

## Task 6: Bump counters + end trial early

**Files:** Modify `convex/interactions.ts`

- [ ] **Step 1: Add imports + a shared bump helper** near the top of `interactions.ts`:

```ts
import { crossesThreshold } from './lib/trialMilestone'
import type { Id } from './_generated/dataModel'

// Bump one side of a trialing user's interaction counter; when their combined count first
// reaches the threshold, schedule the early end of their Stripe trial (billing starts now).
async function bumpTrialInteraction(
  ctx: { db: any; scheduler: any },
  userId: Id<'users'>,
  kind: 'made' | 'received'
): Promise<void> {
  const u = await ctx.db.get(userId)
  if (!u || u.subscriptionStatus !== 'trialing') return
  const made = u.trialInteractionsMade ?? 0
  const received = u.trialInteractionsReceived ?? 0
  const combined = made + received
  if (kind === 'made') await ctx.db.patch(userId, { trialInteractionsMade: made + 1 })
  else await ctx.db.patch(userId, { trialInteractionsReceived: received + 1 })

  if (crossesThreshold(combined, 1)) {
    const sub = await ctx.db
      .query('subscriptions')
      .withIndex('by_user', (q: any) => q.eq('userId', userId))
      .first()
    if (sub?.stripeSubscriptionId) {
      await ctx.scheduler.runAfter(0, internal.billingNode.endTrialEarly, {
        stripeSubscriptionId: sub.stripeSubscriptionId
      })
    }
  }
}
```

(The `: any` ctx/query types here are deliberate — these mutations don't have a clean exported ctx type to import, and
this mirrors the file's existing internal style. If `pnpm lint` flags `no-explicit-any`, narrow `ctx` to
`{ db: GenericDatabaseWriter<DataModel>; scheduler: Scheduler }` via the generated types.)

- [ ] **Step 2: Thread `actorId` into the increment mutations.** Change `incrementCommentCount` args to
  `{ postId: v.id('posts'), actorId: v.id('users') }` and, right after
  `await ctx.db.patch(postId, { commentCount: newCommentCount })`, add:

```ts
    await bumpTrialInteraction(ctx, actorId, 'made')
    if (post.authorId !== actorId) await bumpTrialInteraction(ctx, post.authorId, 'received')
```

Do the same in `incrementLikeCount` (args add `actorId`; after the `likeCount` patch, the same two
`bumpTrialInteraction` lines). Leave the existing `interactionLimitReached` logic intact.

- [ ] **Step 3: Update the call sites.** In `commentOnPost` (line ~149) change `incrementCommentCount, { postId }` →
  `incrementCommentCount, { postId, actorId: user._id }`. In `reactToPost` (line ~200) change
  `incrementLikeCount, { postId }` → `incrementLikeCount, { postId, actorId: user._id }`.

- [ ] **Step 4: Verify** — convex typecheck + `pnpm -r test` (the existing interaction-limit logic is unchanged; pure
  milestone helper covered in Task 5).

- [ ] **Step 5: Checkpoint** — (`feat(trial): count made+received and end Stripe trial at 50`).

---

## Task 7: Feed reciprocity (trialing posts visible)

**Files:** Modify `convex/feed.ts`, `convex/feed.test.ts`, `convex/posts.ts`

- [ ] **Step 1: feed.ts** — in `isAuthorFeedEligible`, delete the line:

```ts
  if (author.subscriptionStatus === 'trialing') return false
```

Keep the `!author` and `deletionScheduledAt` guards. (Trialing authors now have a card-backed Growth trial; their posts
belong in the feed.)

- [ ] **Step 2: feed.test.ts** — update/extend the `isAuthorFeedEligible` tests: a `trialing` author is now **eligible
  ** (`true`); a `deletionScheduledAt` author and a `null` author remain ineligible. If an existing test asserts
  `trialing → false`, flip it to `true`.

- [ ] **Step 3: posts.ts** — at the `upsertPost` call in `submitPost` (line ~253), change:

```ts
      hidden: user.subscriptionStatus === 'trialing',
```

to:

```ts
      hidden: false,
```

(Only card-backed `trialing`/`active` users reach `submitPost` now — Task 4 — and their posts should be visible. No
backfill: pre-launch.)

- [ ] **Step 4: Verify** — `pnpm -r test` (feed tests green), convex typecheck.

- [ ] **Step 5: Checkpoint** — (`feat(trial): trialing users' posts are visible in the feed`).

---

## Task 8: Docs + full verification

**Files:** Modify `docs/PLATFORM.md`

- [ ] **Step 1:** Update §1 (tiers), §8 (billing/trial lifecycle), §9 (plan limits — note trial = real Growth sub, so
  Growth limits apply naturally), and §11 (feed — trialing authors now eligible). State the model: new users `none` →
  add card → Growth 7-day Stripe trial → bills at **50 combined interactions OR 7 days, whichever first** → card-gate
  enforced server-side via `assertCanEngage`. Note the app-facing UI is **Plan 2C (deferred to post-revamp)**.

- [ ] **Step 2: Full verify** — `pnpm --filter convex exec tsc --noEmit -p tsconfig.json` · `pnpm -r test` ·
  `pnpm lint` — all green.

- [ ] **Step 3: Checkpoint** — ready for Henriko to commit.

---

## Self-Review (plan author)

**Spec coverage:** card-required (server-enforced) ✓ T2/T4 · always-Growth trial (real Growth sub → no effectiveTier)
✓ (architecture) · 50-or-7-day gate ✓ T5/T6 (50 here; 7 days = Stripe trial from 2A) · made+received combined ✓ T6 ·
feed reciprocity, no backfill ✓ T7 · signup-no-trial ✓ T3. **Deferred (Plan 2C, post-revamp):** the in-app card-gate
visuals (disabled actions + pulsing billing tab), X/50 progress, SSI→LinkedIn link-out, and the "what you'll miss"
downgrade prompt. **Interim:** until 2C, the gate surfaces as a `PAYMENT_REQUIRED` error on action attempts rather than
disabled buttons — acceptable pre-launch; pull 2C's card-gate forward if that UX matters sooner.

**Placeholder scan:** none. The `: any` ctx in `bumpTrialInteraction` is called out with a concrete narrowing if lint
objects.

**Type consistency:** `assertCanEngage(user)` takes `Pick<Doc<'users'>,'subscriptionStatus'>`;
`crossesThreshold(current, delta)` matches its call (`combined, 1`); `incrementCommentCount`/`incrementLikeCount` gain
`actorId: v.id('users')`, matched at both call sites; `endTrialEarly({ stripeSubscriptionId })` matches Plan 2A's
signature.

**Risks:** (1) `endTrialEarly` requires the user to already have a Stripe subscription — guaranteed, since only
card-backed `trialing` users can engage (Task 4) and `trialing` implies a completed checkout. (2) `crossesThreshold`
fires once per direction-crossing; an active (post-trial) user is skipped by the `subscriptionStatus !== 'trialing'`
guard in `bumpTrialInteraction`. (3) `subscriptions.by_user` returns one row per user (the component upserts per
subscription) — `.first()` is correct for the single active trial.

---

## Plan 2C (app UI) — deferred until after the app/ UI revamp

When the revamp ([ui-revamp spec](../specs/2026-06-20-ui-revamp-design.md)) has restyled `BillingPage`/`Sidebar`, Plan
2C adds: the **card-gate UX** (disable comment/react/show-on-LinkedIn, "add a card to use the app" message, **pulsing
billing nav** in the brand color) driven by `subscriptionStatus === 'none'` + the `PAYMENT_REQUIRED` error; a *
*`getTrialProgress`** query + **X/50** element; the **SSI → linkedin.com/sales/ssi** link-out; the **always-Growth**
checkout (card-gate CTA passes the Growth price); and the **"what you'll miss"** comparison when a trialing user selects
a lower plan.
