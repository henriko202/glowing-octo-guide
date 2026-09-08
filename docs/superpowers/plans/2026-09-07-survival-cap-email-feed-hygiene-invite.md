# Survival Panel, Cap Email, Feed Hygiene & Invite a Peer — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:
> executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship backlog/revenue R18 (admin survival panel), R20 (one email when a post reaches its interaction cap), R21
(24-hour feed hygiene + Hide) and R19 (invite a peer with a 14-day trial), in that order, with docs and backlog updated
in the same change and nothing committed.

**Architecture:** Every new rule lives in a pure `convex/lib/*` module with a unit test; the Convex functions
(`admin.survivalMetrics`, `interactions.flipCapIfReached` / `hidePost` / `getCaughtUp`,
`notifications.sendPostCapReached`, `users.getOrCreateInviteCode` / `getInviteSummary`, the OAuth `ref` hop) are thin
I/O wrappers around them. The app adds one admin tab, a done-card footer on the feed, a Settings invite section and four
consent-gated PostHog events; the landing adds a client-only `RefCarrier`. Schema changes are widen-only (five optional
fields, two indexes), no backfill.

**Tech Stack:** Convex (queries/mutations/internalActions, `ConvexError`, `v` validators), TypeScript, React 19 +
react-router-dom + `convex/react`, react-i18next (en / pt-BR / neutral LatAm es), shadcn primitives (Button, Input,
Dialog, Tabs, Table, toast), Tailwind v4 tokens, vitest + @testing-library/react (jest-dom matchers are installed via
`app/src/test/setup.ts`), Resend via `convex/lib/email.ts`, Next.js landing (no test runner).

**Spec:** `docs/superpowers/specs/2026-09-07-survival-cap-email-feed-hygiene-invite-design.md` — read it first; this
plan argues from it. Two deliberate departures from the spec are marked **DEVIATION** inline (Task 1:
trials-ended/converted keyed on the subscription row, not `users.trialEndsAt`, because `convex/stripe.ts:151` erases
`trialEndsAt` once a subscription is active; Task 2: no `Flash` in `SurvivalTab` because `useQuery` has no error return
value).

## Global Constraints

- **Never commit. Never run any git state-changing command** (`commit`, `push`, `add`, `stash`, `checkout`, `reset`,
  `restore`, `clean`). Henriko commits everything himself. Read-only git (`git status`, `git diff`) is fine.
- **Change files only with the Edit and Write tools.** Bash is for read-only work and for running tests, lint, typecheck
  and Prettier. Never rewrite a file through `sed`, heredocs or a script — the repo mixes CRLF and LF and shell rewrites
  have failed repeatedly.
- **Never run `pnpm format`.** After each task run `pnpm exec prettier --write <the code files you touched>` (from the
  repo root) on code and config files only, never on Markdown prose. The root gate is `pnpm verify` (=
  `pnpm format:check && pnpm lint && pnpm typecheck && pnpm -r test`) and it must stay green.
- **pnpm, never npm.** Test one file with `pnpm --filter ./convex test <path>` or `pnpm --filter ./app test <path>`;
  lint the landing with `pnpm --filter ./landing lint`, build it with `pnpm --filter ./landing build`.
- **Convex rules** (`convex/_generated/ai/guidelines.md`): every function declares `args` validators; internal callers
  use `internalQuery` / `internalMutation` / `internalAction` and the `internal.*` refs; reads are bounded (`.take(n)`,
  `.first()`, `.unique()`, `.paginate`); use `.withIndex()` with equality fields first and `_creationTime` ranges after;
  no `ctx.db` in actions; schedule with `ctx.scheduler.runAfter(0, internal.x.y, args)`; `'use node'` only in
  `convex/billingNode.ts`. New pure `convex/lib/*` modules need no registration.
- **Schema is widen-only** (pre-launch, dev data disposable): optional fields, new indexes, no backfills, no data
  migrations.
- **Three locales in parity**: `app/src/i18n/locales/{en,pt,es}.json` are line-aligned; pt is pt-BR, es is neutral
  Latin-American Spanish, labels are sentence case; plurals use `_one` / `_other`. There is no parity test — Task 11
  diffs the key sets and the `{{placeholder}}` sets.
- **Copy rules**: emails carry no marketing verbs, no urgency, no exclamation marks; never tell a member to check their
  SSI; never claim the app reads or shows the SSI; Apify never appears in member-facing copy; upgrade inline at the
  limit, never by interruption; no modals on load, no broadcasts, no upsell toasts. Admin UI is hardcoded English
  (existing convention).
- **Lint rules in force**: `react-hooks/purity` (no `Date.now()` in render — use
  `const [now] = useState(() => Date.now())`), `react-hooks/set-state-in-effect` (no synchronous `setState` inside
  `useEffect`), `react-hooks/refs` (no ref reads during render), `react/no-unescaped-entities` in the landing (curly
  apostrophes `’` in JSX text).
- **Scratch files** go to the session scratchpad directory, never inside the repo (a stray `.superpowers/` folder breaks
  lint).
- **Docs travel with the code**: `docs/PLATFORM.md` and `backlog/revenue/*` are updated in Task 10 of this same change
  (`backlog/` is gitignored — its edits are local-only, that is expected).
- Analytics only through `captureEvent(name, props?)` from `@/lib/observability/analytics` (consent-gated, no PII in
  props).

---

## File Map

| Path                                                                                                                    | Task  | Responsibility                                                                                        |
|-------------------------------------------------------------------------------------------------------------------------|-------|-------------------------------------------------------------------------------------------------------|
| `convex/lib/survival.ts` (+ `.test.ts`)                                                                                 | 1     | Pure cohort maths: `returnWindows`, `summarizeCohort`, `payingByTier`.                                |
| `convex/admin.ts`                                                                                                       | 1     | `survivalMetrics` query (admin-only, ≤ 1000 users, 4 indexed reads per cohort member).                |
| `app/src/components/SurvivalTab.tsx` (+ `.test.tsx`)                                                                    | 2     | Admin tab: 7/28 toggle, metrics table, paying-by-tier table.                                          |
| `app/src/pages/AdminPage.tsx` (+ `.test.tsx`)                                                                           | 2     | Sixth tab `survival`.                                                                                 |
| `app/src/pages/BillingPage.tsx` (+ `.test.tsx`)                                                                         | 2,4,8 | `checkout_started`, `cap_email_billing_opened`, gift line, `{{days}}` strings.                        |
| `convex/lib/support.ts`, `app/src/lib/support.ts`                                                                       | 3     | One `SUPPORT_EMAIL` constant; the app re-exports it.                                                  |
| `convex/lib/postCapNotice.ts` (+ `.test.ts`)                                                                            | 3     | Cap-email rules: mode per tier, send guard, interval param, upgrade-sentence rule.                    |
| `convex/lib/billingEmails.ts` (+ `.test.ts`)                                                                            | 3     | `postCapReachedEmail` builder, three locales, banned-phrase guard.                                    |
| `convex/interactions.ts`                                                                                                | 4,5   | `flipCapIfReached` helper + schedule; `commentedAt` upsert; `hidePost`; `getCaughtUp`.                |
| `convex/notifications.ts`                                                                                               | 4     | `sendPostCapReached` internalAction.                                                                  |
| `convex/schema.ts`                                                                                                      | 5,7   | `userPostState.commentedAt/hiddenAt`; `users.inviteCode/referredByCode` + indexes; `oauthStates.ref`. |
| `convex/lib/feedHygiene.ts` (+ `.test.ts`)                                                                              | 5     | Pure viewer-state rules: `lastInteractedAt`, `viewerPostStatus`, `canHide`, `toFeedViewerState`.      |
| `convex/feed.ts` (+ `feed.test.ts`)                                                                                     | 5     | `fetchFeedPage` drops gone posts, attaches `viewerState`.                                             |
| `app/src/components/PostCard.tsx` (+ `.test.tsx`)                                                                       | 6     | Done footer (status · countdown · remaining action · Hide).                                           |
| `app/src/pages/FeedPage.tsx` (+ `.test.tsx`)                                                                            | 6     | `hidePost` wiring, `post_hidden`, bounded auto-load, caught-up state.                                 |
| `app/src/components/EmptyFeed.tsx` (+ `.test.tsx`)                                                                      | 6     | `caughtUp` variant + invite text link.                                                                |
| `app/src/i18n/locales/{en,pt,es}.json`                                                                                  | 6,8   | New `feed.*`, `settings.*`, `billing.giftFrom`, `recap.inviteLine`; six `{{days}}` strings.           |
| `convex/lib/invite.ts` (+ `.test.ts`)                                                                                   | 7     | `INVITE_CODE_RE`, `isInviteCode`, `generateInviteCode`, `firstName`.                                  |
| `convex/lib/trialMilestone.ts` (+ `.test.ts`), `convex/lib/checkoutCopy.ts` (+ `.test.ts`)                              | 7     | `TRIAL_PERIOD_DAYS`, `INVITED_TRIAL_PERIOD_DAYS`, `trialDaysFor`; `{ trial, days }` message.          |
| `convex/billingNode.ts`, `convex/users.ts`, `convex/http.ts`, `convex/sessions.ts`                                      | 7     | 14-day trial on checkout; `trialDays` / `inviterName` / invite code + summary; `ref` hop.             |
| `convex/linkedin/auth.ts` (+ `.test.ts`)                                                                                | 7     | Insert-branch attribution through `by_invite_code`.                                                   |
| `app/src/pages/SettingsPage.tsx` (+ `.test.tsx`), `RecapPage.tsx` (+ `.test.tsx`)                                       | 8     | Invite section (`#invite`); recap footer invite line.                                                 |
| `app/src/components/CardGateBanner.tsx`, `CardGateDialog.tsx` (+ `.test.tsx`), `UpgradeAtLimit.tsx`                     | 8     | `{{days}}` from `useCardGate().me?.trialDays`.                                                        |
| `landing/components/RefCarrier.tsx`, `landing/app/[lang]/layout.tsx`, `landing/app/[lang]/terms/content/{en,pt,es}.tsx` | 9     | `?ref` carry-through; Terms 14-day clause.                                                            |
| `docs/PLATFORM.md`, `backlog/revenue/README.md`, `backlog/revenue/R17..R21*.md`                                         | 10    | Documentation and backlog status.                                                                     |

---

### Task 1: R18 backend — `lib/survival.ts` + `admin.survivalMetrics`

**Files:**

- Create: `convex/lib/survival.ts`
- Create: `convex/lib/survival.test.ts`
- Modify: `convex/admin.ts` (imports at lines 6-9; append the query after `listUsers`, line 387)

**Interfaces:**

- Consumes: `Tier` from `convex/lib/planLimits.ts` (`'starter' | 'growth' | 'pro' | 'contact'`);
  `findLiveSubscription<T extends { status: string }>(rows)` from `convex/lib/trialMilestone.ts`;
  `requireAuth(ctx, sessionToken)` from `convex/lib/auth.ts`; `assertAdmin(user)` in `convex/admin.ts`.
- Produces: `api.admin.survivalMetrics({ sessionToken: string, days: 7 | 28 })` →
  `{ days, since: number, generatedAt: number, cohort: CohortSummary, payingByTier: Record<Tier, number> }`;
  `CohortSummary` fields
  `signups, startedTrial, activated, medianMinutesToFirstInteraction (number | null), returnedDay1, returnedDays2to7, trialsEnded, converted, canceled`
  (all numbers). Task 2 renders exactly these names.

**DEVIATION from spec §3.2:** `CohortRow` has no `trialEndsAt` and `summarizeCohort` takes no `now`.
`convex/stripe.ts:151` patches `trialEndsAt: args.trialEndsAt`, which is `undefined` for an active (post-trial)
subscription, so "converted = trial ended by date && active" could never count anyone. Instead: `trialsEnded` = started
a trial and `subscriptionStatus` is `active`, `canceled` or `past_due` (the trial phase is over, whichever way);
`converted` = started a trial and `active`; `canceled` = `canceled` or cancel-pending. Say so in the final report.

- [ ] **Step 1: Write the failing unit test**

Create `convex/lib/survival.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { DAY_MS, payingByTier, returnWindows, summarizeCohort, type CohortRow } from './survival'

const T0 = 1_700_000_000_000

function row(over: Partial<CohortRow> = {}): CohortRow {
  return {
    createdAt: T0,
    subscriptionStatus: 'none',
    startedTrial: false,
    cancelPending: false,
    returnedDay1: false,
    returnedDays2to7: false,
    ...over
  }
}

describe('returnWindows', () => {
  it('is half-open and relative to signup: day 1 = [24 h, 48 h), days 2–7 = [24 h, 8 d)', () => {
    expect(returnWindows(T0)).toEqual({
      day1: [T0 + DAY_MS, T0 + 2 * DAY_MS],
      days2to7: [T0 + DAY_MS, T0 + 8 * DAY_MS]
    })
  })
})

describe('summarizeCohort', () => {
  it('activates only a first interaction strictly under 24 h after signup', () => {
    const s = summarizeCohort([
      row({ firstInteractionAt: T0 + DAY_MS - 1 }),
      row({ firstInteractionAt: T0 + DAY_MS }), // exactly 24 h is NOT activated
      row()
    ])
    expect(s.signups).toBe(3)
    expect(s.activated).toBe(1)
  })

  it('median minutes: odd count, even count (mean of the two middles, rounded), none', () => {
    const odd = summarizeCohort([
      row({ firstInteractionAt: T0 + 60_000 }),
      row({ firstInteractionAt: T0 + 180_000 }),
      row({ firstInteractionAt: T0 + 600_000 })
    ])
    expect(odd.medianMinutesToFirstInteraction).toBe(3)
    const even = summarizeCohort([row({ firstInteractionAt: T0 + 60_000 }), row({ firstInteractionAt: T0 + 120_000 })])
    expect(even.medianMinutesToFirstInteraction).toBe(2) // (1 + 2) / 2 = 1.5 → 2
    expect(summarizeCohort([row()]).medianMinutesToFirstInteraction).toBeNull()
    expect(summarizeCohort([]).medianMinutesToFirstInteraction).toBeNull()
  })

  it('trials ended / converted need a started trial; canceled counts a pending cancel', () => {
    const s = summarizeCohort([
      row({ startedTrial: true, subscriptionStatus: 'active' }),
      row({ startedTrial: true, subscriptionStatus: 'trialing' }),
      row({ startedTrial: true, subscriptionStatus: 'trialing', cancelPending: true }),
      row({ startedTrial: true, subscriptionStatus: 'canceled' }),
      row({ startedTrial: true, subscriptionStatus: 'past_due' }),
      row({ subscriptionStatus: 'active' }) // no subscription row → never "ended", never "converted"
    ])
    expect(s.startedTrial).toBe(5)
    expect(s.trialsEnded).toBe(3)
    expect(s.converted).toBe(1)
    expect(s.canceled).toBe(2)
  })

  it('sums the return flags', () => {
    const s = summarizeCohort([row({ returnedDay1: true, returnedDays2to7: true }), row({ returnedDays2to7: true })])
    expect(s.returnedDay1).toBe(1)
    expect(s.returnedDays2to7).toBe(2)
  })

  it('is all zeros and a null median for an empty cohort', () => {
    expect(summarizeCohort([])).toEqual({
      signups: 0,
      startedTrial: 0,
      activated: 0,
      medianMinutesToFirstInteraction: null,
      returnedDay1: 0,
      returnedDays2to7: 0,
      trialsEnded: 0,
      converted: 0,
      canceled: 0
    })
  })
})

describe('payingByTier', () => {
  it('counts active members only and defaults a missing tier to starter', () => {
    expect(
      payingByTier([
        { subscriptionStatus: 'active', tier: 'growth' },
        { subscriptionStatus: 'active' },
        { subscriptionStatus: 'trialing', tier: 'pro' },
        { subscriptionStatus: 'canceled', tier: 'pro' },
        { subscriptionStatus: 'active', tier: 'contact' }
      ])
    ).toEqual({ starter: 1, growth: 1, pro: 0, contact: 1 })
  })
})
```

- [ ] **Step 2: Run it to see it fail**

Run: `pnpm --filter ./convex test lib/survival.test.ts`
Expected: FAIL — cannot resolve `./survival`.

- [ ] **Step 3: Write the pure module**

Create `convex/lib/survival.ts`:

```ts
// convex/lib/survival.ts
// Pure cohort maths for the admin Survival tab (backlog/R18). No I/O: admin.survivalMetrics reads
// the rows and this file turns them into the nine numbers the panel shows. Every number is one the
// admin could re-derive from the database by hand — nothing here comes from PostHog.
import type { Tier } from './planLimits'

export const DAY_MS = 86_400_000
export const ACTIVATION_WINDOW_MS = DAY_MS

export type CohortRow = {
  createdAt: number
  subscriptionStatus: string // users.subscriptionStatus
  startedTrial: boolean // any subscriptions row exists
  cancelPending: boolean // the live subscription row has cancelAtPeriodEnd === true
  firstInteractionAt?: number // earliest userInteractions row, any time
  returnedDay1: boolean // any interaction in [createdAt + 24 h, createdAt + 48 h)
  returnedDays2to7: boolean // any interaction in [createdAt + 24 h, createdAt + 8 d)
}

export type CohortSummary = {
  signups: number
  startedTrial: number
  activated: number // firstInteractionAt - createdAt < 24 h
  medianMinutesToFirstInteraction: number | null // over rows with a first interaction; null when none
  returnedDay1: number
  returnedDays2to7: number
  trialsEnded: number // started a trial and the status moved past 'trialing'
  converted: number // started a trial and is 'active'
  canceled: number // 'canceled', or cancel pending on the live row
}

/** Half-open windows relative to signup: day 1 = [24 h, 48 h), days 2–7 = [24 h, 8 d). */
export function returnWindows(createdAt: number): { day1: [number, number]; days2to7: [number, number] } {
  return {
    day1: [createdAt + DAY_MS, createdAt + 2 * DAY_MS],
    days2to7: [createdAt + DAY_MS, createdAt + 8 * DAY_MS]
  }
}

// Whole minutes: the middle element, or the mean of the two middles when even.
function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  const m = sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
  return Math.round(m)
}

// A trial is "over" once the user's status left 'trialing' in any direction. users.trialEndsAt is
// NOT usable here: stripe.syncUserSubscription erases it once the subscription is active.
const ENDED_STATUSES = ['active', 'canceled', 'past_due']

export function summarizeCohort(rows: CohortRow[]): CohortSummary {
  const minutes: number[] = []
  let activated = 0
  for (const r of rows) {
    if (r.firstInteractionAt === undefined) continue
    const delta = r.firstInteractionAt - r.createdAt
    minutes.push(delta / 60_000)
    if (delta < ACTIVATION_WINDOW_MS) activated++
  }
  const trialed = rows.filter(r => r.startedTrial)
  return {
    signups: rows.length,
    startedTrial: trialed.length,
    activated,
    medianMinutesToFirstInteraction: median(minutes),
    returnedDay1: rows.filter(r => r.returnedDay1).length,
    returnedDays2to7: rows.filter(r => r.returnedDays2to7).length,
    trialsEnded: trialed.filter(r => ENDED_STATUSES.includes(r.subscriptionStatus)).length,
    converted: trialed.filter(r => r.subscriptionStatus === 'active').length,
    canceled: rows.filter(r => r.subscriptionStatus === 'canceled' || r.cancelPending).length
  }
}

const TIERS: readonly Tier[] = ['starter', 'growth', 'pro', 'contact']

/** Paying = status 'active'. A member without a tier counts as starter (the app's default tier). */
export function payingByTier(users: { subscriptionStatus: string; tier?: string }[]): Record<Tier, number> {
  const out: Record<Tier, number> = { starter: 0, growth: 0, pro: 0, contact: 0 }
  for (const u of users) {
    if (u.subscriptionStatus !== 'active') continue
    const tier = TIERS.find(t => t === u.tier) ?? 'starter'
    out[tier]++
  }
  return out
}
```

- [ ] **Step 4: Run the test to see it pass**

Run: `pnpm --filter ./convex test lib/survival.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Add the admin query**

In `convex/admin.ts`, extend the imports (after line 9, `import { type ApifyFlags, ... } from './lib/apify'`):

```ts
import { DAY_MS, payingByTier, returnWindows, summarizeCohort, type CohortRow } from './lib/survival'
import { findLiveSubscription } from './lib/trialMilestone'
```

Append after `listUsers` (after line 387, before the `// Sets a user's tier.` comment):

```ts
// ─── Survival panel (backlog/R18) ────────────────────────────────────────────
// "Who survives the first week", from the database only. Cohort = members who signed up inside the
// window, taken from the same newest-1000 slice listUsers reads (newest first, so a 7- or 28-day
// cohort is always inside it). Date.now() in a query matches getFeed/getRecap; the panel tolerates
// staleness. No new index: the two return windows range over the _creationTime tail Convex appends
// to userInteractions.by_user (createdAt and _creationTime are written in the same mutation).
// ponytail: ~4 indexed reads per cohort member; precompute nightly if a 28-day cohort passes ~1500.
export const survivalMetrics = query({
  args: { sessionToken: v.string(), days: v.union(v.literal(7), v.literal(28)) },
  handler: async (ctx, { sessionToken, days }) => {
    const admin = await requireAuth(ctx, sessionToken)
    assertAdmin(admin)

    const now = Date.now()
    const since = now - days * DAY_MS
    const users = await ctx.db.query('users').order('desc').take(1000)
    const cohort = users.filter(u => u.createdAt >= since)

    const rows: CohortRow[] = await Promise.all(
      cohort.map(async u => {
        const subs = await ctx.db
          .query('subscriptions')
          .withIndex('by_user', q => q.eq('userId', u._id))
          .take(5)
        // by_user is ordered by _creationTime, so .first() is the member's OLDEST interaction.
        const first = await ctx.db
          .query('userInteractions')
          .withIndex('by_user', q => q.eq('userId', u._id))
          .first()
        const { day1, days2to7 } = returnWindows(u.createdAt)
        const returnedIn = async ([a, b]: [number, number]): Promise<boolean> =>
          (await ctx.db
            .query('userInteractions')
            .withIndex('by_user', q => q.eq('userId', u._id).gte('_creationTime', a).lt('_creationTime', b))
            .first()) !== null
        return {
          createdAt: u.createdAt,
          subscriptionStatus: u.subscriptionStatus,
          startedTrial: subs.length > 0,
          cancelPending: findLiveSubscription(subs)?.cancelAtPeriodEnd === true,
          firstInteractionAt: first?.createdAt,
          returnedDay1: await returnedIn(day1),
          returnedDays2to7: await returnedIn(days2to7)
        }
      })
    )

    return { days, since, generatedAt: now, cohort: summarizeCohort(rows), payingByTier: payingByTier(users) }
  }
})
```

- [ ] **Step 6: Typecheck and run the convex suite**

Run (from the repo root — neither package has its own `typecheck` script, the root one runs `tsc --noEmit` for convex,
app and landing): `pnpm typecheck && pnpm --filter ./convex test`
Expected: exit 0; every existing test still green.

- [ ] **Step 7: Prettier the touched files, do NOT commit**

Run: `pnpm exec prettier --write convex/lib/survival.ts convex/lib/survival.test.ts convex/admin.ts`
Then `git status` (read-only) to confirm only those three files changed. Do not commit.

### Task 2: R18 UI — `SurvivalTab`, sixth admin tab, `checkout_started`

**Files:**

- Create: `app/src/components/SurvivalTab.tsx`
- Create: `app/src/components/SurvivalTab.test.tsx`
- Modify: `app/src/pages/AdminPage.tsx` (line 9 imports, line 16 `TabValue`, lines 124-130 triggers, after line 294
  content)
- Modify: `app/src/pages/AdminPage.test.tsx` (lines 32-37 fixture dispatch; add one test)
- Modify: `app/src/pages/BillingPage.tsx` (lines 227-253 `handleUpgrade` / `handlePlanClick`, line 527 button)
- Modify: `app/src/pages/BillingPage.test.tsx` (append one `describe`)

**Interfaces:**

- Consumes: `api.admin.survivalMetrics({ sessionToken, days })` from Task 1 (shape repeated below as `SurvivalMetrics`);
  `Table*` primitives from `app/src/components/ui/table.tsx`; `Button` (`variant`
  default/outline/secondary/ghost/destructive, `size` default/xs/sm/lg/icon...); `LoadingSpinner`;
  `captureEvent(name, props?)`.
- Produces: `SurvivalTab({ sessionToken, isAdmin })`, exported `share(part, base)` and `SurvivalMetrics` type;
  `/admin?tab=survival`; `checkout_started` event `{ plan, interval }`.

**DEVIATION from spec §4.2:** no `Flash` for a query error — `useQuery` never returns an error (Convex throws to the
nearest error boundary), so there is nothing to render. Loading = spinner, that is the only non-data state.

- [ ] **Step 1: Write the failing component test**

Create `app/src/components/SurvivalTab.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../convex', () => ({ api: { admin: { survivalMetrics: 'admin.survivalMetrics' } } }))
const mockUseQuery = vi.fn()
vi.mock('convex/react', () => ({ useQuery: (...args: unknown[]) => mockUseQuery(...args) }))

import SurvivalTab, { share, type SurvivalMetrics } from './SurvivalTab'

const FIXTURE: SurvivalMetrics = {
  days: 7,
  since: 0,
  generatedAt: 0,
  cohort: {
    signups: 10,
    startedTrial: 6,
    activated: 4,
    medianMinutesToFirstInteraction: 12,
    returnedDay1: 3,
    returnedDays2to7: 5,
    trialsEnded: 4,
    converted: 2,
    canceled: 1
  },
  payingByTier: { starter: 1, growth: 2, pro: 0, contact: 0 }
}

beforeEach(() => {
  mockUseQuery.mockReset()
  mockUseQuery.mockReturnValue(FIXTURE)
})

describe('share', () => {
  it('rounds to a whole percent and renders – on a zero base', () => {
    expect(share(1, 3)).toBe('33%')
    expect(share(2, 4)).toBe('50%')
    expect(share(0, 0)).toBe('–')
  })
})

describe('SurvivalTab', () => {
  it('renders every metric with its count and, where defined, its share of signups', () => {
    render(
      <SurvivalTab
        sessionToken="tok"
        isAdmin
      />
    )
    expect(screen.getByRole('row', { name: /signed up/i })).toHaveTextContent('10')
    const activated = screen.getByRole('row', { name: /activated within 24 h/i })
    expect(activated).toHaveTextContent('4')
    expect(activated).toHaveTextContent('40%')
    expect(screen.getByRole('row', { name: /median minutes/i })).toHaveTextContent('12')
    // Converted is a share of trials ended (2 of 4), not of signups.
    expect(screen.getByRole('row', { name: /^converted/i })).toHaveTextContent('50%')
    expect(screen.getByRole('row', { name: /growth/i })).toHaveTextContent('2')
    expect(screen.getByText(/newest 1000 members/i)).toBeInTheDocument()
  })

  it('renders – for a null median', () => {
    mockUseQuery.mockReturnValue({
      ...FIXTURE,
      cohort: { ...FIXTURE.cohort, medianMinutesToFirstInteraction: null }
    })
    render(
      <SurvivalTab
        sessionToken="tok"
        isAdmin
      />
    )
    expect(screen.getByRole('row', { name: /median minutes/i })).toHaveTextContent('–')
  })

  it('re-queries with days: 28 when the toggle is pressed and marks it pressed', () => {
    render(
      <SurvivalTab
        sessionToken="tok"
        isAdmin
      />
    )
    expect(screen.getByRole('button', { name: '7 days' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: '28 days' }))
    expect(mockUseQuery).toHaveBeenLastCalledWith('admin.survivalMetrics', { sessionToken: 'tok', days: 28 })
    expect(screen.getByRole('button', { name: '28 days' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: '7 days' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('skips the query and shows the spinner while loading', () => {
    mockUseQuery.mockReturnValue(undefined)
    render(
      <SurvivalTab
        sessionToken={undefined}
        isAdmin
      />
    )
    expect(mockUseQuery).toHaveBeenCalledWith('admin.survivalMetrics', 'skip')
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run it to see it fail**

Run: `pnpm --filter ./app test src/components/SurvivalTab.test.tsx`
Expected: FAIL — cannot resolve `./SurvivalTab`.

- [ ] **Step 3: Write the component**

Create `app/src/components/SurvivalTab.tsx`:

```tsx
import { useState } from 'react'
import { useQuery } from 'convex/react'
import { api } from '../convex'
import LoadingSpinner from './LoadingSpinner'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

type Days = 7 | 28
type Tier = 'starter' | 'growth' | 'pro' | 'contact'

// Mirrors admin.survivalMetrics (convex/admin.ts) — the tab's only data source.
export type SurvivalMetrics = {
  days: Days
  since: number
  generatedAt: number
  cohort: {
    signups: number
    startedTrial: number
    activated: number
    medianMinutesToFirstInteraction: number | null
    returnedDay1: number
    returnedDays2to7: number
    trialsEnded: number
    converted: number
    canceled: number
  }
  payingByTier: Record<Tier, number>
}

type Props = {
  sessionToken: string | undefined
  isAdmin: boolean | undefined
}

const TIER_ORDER: Tier[] = ['starter', 'growth', 'pro', 'contact']

/** "40%" — a whole percent, or "–" when the base is zero. A gauge, not an invoice. */
export function share(part: number, base: number): string {
  return base > 0 ? `${Math.round((part / base) * 100)}%` : '–'
}

// Admin-only, English-only like the other admin tabs. Every number comes from one query the admin
// could re-run; nothing is read from PostHog (backlog/R18).
export default function SurvivalTab({ sessionToken, isAdmin }: Props) {
  const [days, setDays] = useState<Days>(7)
  const metrics = useQuery(api.admin.survivalMetrics, sessionToken && isAdmin ? { sessionToken, days } : 'skip') as
    | SurvivalMetrics
    | undefined

  if (metrics === undefined) {
    return <LoadingSpinner />
  }

  const c = metrics.cohort
  const rows: { label: string; count: string; share: string }[] = [
    { label: 'Signed up', count: String(c.signups), share: '' },
    { label: 'Started trial', count: String(c.startedTrial), share: share(c.startedTrial, c.signups) },
    { label: 'Activated within 24 h', count: String(c.activated), share: share(c.activated, c.signups) },
    {
      label: 'Median minutes to first interaction',
      count: c.medianMinutesToFirstInteraction === null ? '–' : String(c.medianMinutesToFirstInteraction),
      share: ''
    },
    { label: 'Returned day 1', count: String(c.returnedDay1), share: share(c.returnedDay1, c.signups) },
    { label: 'Returned days 2–7', count: String(c.returnedDays2to7), share: share(c.returnedDays2to7, c.signups) },
    { label: 'Trials ended', count: String(c.trialsEnded), share: '' },
    { label: 'Converted', count: String(c.converted), share: share(c.converted, c.trialsEnded) },
    { label: 'Canceled', count: String(c.canceled), share: '' }
  ]

  return (
    <div>
      <div
        role="group"
        aria-label="Cohort window"
        className="mb-3 flex gap-1"
      >
        {([7, 28] as Days[]).map(d => (
          <Button
            key={d}
            size="sm"
            variant={days === d ? 'default' : 'outline'}
            aria-pressed={days === d}
            onClick={() => setDays(d)}
          >
            {d} days
          </Button>
        ))}
      </div>

      <Table className="table-fixed">
        <TableHeader>
          <TableRow>
            <TableHead>Metric</TableHead>
            <TableHead className="w-[90px] text-right">Count</TableHead>
            <TableHead className="w-[90px] text-right">Share</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(r => (
            <TableRow key={r.label}>
              <th
                scope="row"
                className="text-foreground px-4 py-3 text-left align-middle font-medium"
              >
                {r.label}
              </th>
              <TableCell className="text-right tabular-nums">{r.count}</TableCell>
              <TableCell className="text-muted-foreground text-right tabular-nums">{r.share}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <h2 className="text-foreground mt-6 mb-2 text-base font-semibold">Paying by tier</h2>
      <Table className="table-fixed">
        <TableHeader>
          <TableRow>
            <TableHead>Tier</TableHead>
            <TableHead className="w-[90px] text-right">Members</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {TIER_ORDER.map(tier => (
            <TableRow key={tier}>
              <th
                scope="row"
                className="text-foreground px-4 py-3 text-left align-middle font-medium capitalize"
              >
                {tier}
              </th>
              <TableCell className="text-right tabular-nums">{metrics.payingByTier[tier]}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <p className="text-muted-foreground mt-3 text-xs">
        UTC · cohort = members who signed up in the window · newest 1000 members
      </p>
    </div>
  )
}
```

- [ ] **Step 4: Run the component test to see it pass**

Run: `pnpm --filter ./app test src/components/SurvivalTab.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 5: Add the sixth tab to `AdminPage`**

In `app/src/pages/AdminPage.tsx`:

After line 9 (`import MotdTab from '../components/MotdTab'`) add:

```tsx
import SurvivalTab from '../components/SurvivalTab'
```

Replace line 16:

```tsx
type TabValue = 'settings' | 'planLimits' | 'users' | 'feedback' | 'motd' | 'survival'
```

After line 129 (`<TabsTrigger value="motd">MOTD</TabsTrigger>`) add:

```tsx
          <TabsTrigger value="survival">Survival</TabsTrigger>
```

After the MOTD `TabsContent` block (line 294, `</TabsContent>`) and before `</Tabs>` add:

```tsx
        {/* Survival tab (backlog/R18) */}
        <TabsContent value="survival">
          <SurvivalTab
            sessionToken={sessionToken}
            isAdmin={isAdmin}
          />
        </TabsContent>
```

- [ ] **Step 6: Extend the `AdminPage` test**

In `app/src/pages/AdminPage.test.tsx` replace the `beforeEach` dispatch (lines 32-37) so the new query returns a fixture
instead of `[]`:

```tsx
  vi.mocked(useQuery).mockImplementation((ref: unknown, ..._rest: unknown[]) => {
    const name = getFunctionName(ref as Parameters<typeof getFunctionName>[0])
    if (name === 'admin:checkIsAdmin') return true as never
    if (name === 'admin:getSettings') return undefined as never
    if (name === 'admin:survivalMetrics') return SURVIVAL_FIXTURE as never
    return [] as never
  })
```

and add the fixture above `beforeEach` (after line 24, `import AdminPage from './AdminPage'`):

```tsx
const SURVIVAL_FIXTURE = {
  days: 7,
  since: 0,
  generatedAt: 0,
  cohort: {
    signups: 1,
    startedTrial: 0,
    activated: 0,
    medianMinutesToFirstInteraction: null,
    returnedDay1: 0,
    returnedDays2to7: 0,
    trialsEnded: 0,
    converted: 0,
    canceled: 0
  },
  payingByTier: { starter: 0, growth: 0, pro: 0, contact: 0 }
}
```

Add to the `describe('AdminPage tabs', ...)` block:

```tsx
  it('renders the Survival tab and reads ?tab=survival', () => {
    mockSearchParams.set('tab', 'survival')
    render(<AdminPage />)
    expect(screen.getByRole('tab', { name: /survival/i })).toBeInTheDocument()
    expect(screen.getByText(/paying by tier/i)).toBeInTheDocument()
    expect(screen.queryByText(/apify post sync/i)).not.toBeInTheDocument()
  })
```

Run: `pnpm --filter ./app test src/pages/AdminPage.test.tsx`
Expected: PASS (6 tests).

- [ ] **Step 7: Write the failing `checkout_started` test**

Append to `app/src/pages/BillingPage.test.tsx`:

```tsx
// R18: one consent-gated event per checkout attempt, carrying the plan and the interval the price
// belongs to, fired right before the checkout call — never on the portal path.
describe('checkout_started (R18)', () => {
  it('fires once with the plan and the interval before checkout', async () => {
    renderPage()
    fireEvent.click(screen.getAllByRole('button', { name: /billing\.startTrialCta/ })[0])
    await waitFor(() => expect(mockCheckout).toHaveBeenCalled())
    expect(captureEvent).toHaveBeenCalledWith('checkout_started', { plan: 'growth', interval: 'annual' })
    expect(captureEvent).toHaveBeenCalledTimes(1)
  })

  it('does not fire when a card holder is routed to the portal', async () => {
    setUser({ subscriptionStatus: 'trialing' })
    renderPage()
    fireEvent.click(screen.getAllByRole('button', { name: /billing\.switchPlan/ })[0])
    await waitFor(() => expect(mockPortal).toHaveBeenCalled())
    expect(captureEvent).not.toHaveBeenCalled()
  })
})
```

Run: `pnpm --filter ./app test src/pages/BillingPage.test.tsx`
Expected: the first new test FAILS (`captureEvent` not called with `checkout_started`).

- [ ] **Step 8: Fire the event in `BillingPage`**

In `app/src/pages/BillingPage.tsx` replace lines 227-253 (`handleUpgrade` and `handlePlanClick`):

```tsx
  async function handleUpgrade(planId: string, priceId: string) {
    try {
      if (!sessionToken) throw new Error(t('auth.notSignedIn'))
      // R18: the card-entry step, so the survival panel can tell a card-gate leak from an activation leak.
      captureEvent('checkout_started', { plan: planId, interval: billingInterval })
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
  function handlePlanClick(planId: string, priceId: string) {
    if (hasCard) return void handleManageSubscription()
    return void handleUpgrade(planId, priceId)
  }
```

Replace line 527:

```tsx
                  onClick={() => priceId && handlePlanClick(planId, priceId)}
```

Run: `pnpm --filter ./app test src/pages/BillingPage.test.tsx`
Expected: PASS (all, including the two new tests).

- [ ] **Step 9: Lint, typecheck, Prettier, do NOT commit**

Run (from the repo root): `pnpm lint && pnpm typecheck`, then
`pnpm exec prettier --write app/src/components/SurvivalTab.tsx app/src/components/SurvivalTab.test.tsx app/src/pages/AdminPage.tsx app/src/pages/AdminPage.test.tsx app/src/pages/BillingPage.tsx app/src/pages/BillingPage.test.tsx`
Expected: exit 0 everywhere. Do not commit.

---

### Task 3: R20 pure modules — support address, cap-notice rules, the cap email

**Files:**

- Create: `convex/lib/support.ts`
- Modify: `app/src/lib/support.ts` (becomes a re-export; 2 lines)
- Create: `convex/lib/postCapNotice.ts`
- Create: `convex/lib/postCapNotice.test.ts`
- Modify: `convex/lib/billingEmails.ts` (add two imports after line 8; append `CapReachedArgs` + `postCapReachedEmail`
  at the end of the file)
- Modify: `convex/lib/billingEmails.test.ts` (import line 2-9; the `all` array inside
  `describe('billing emails stay transactional')` at line 117-154; append a new describe)

**Interfaces:**

- Consumes: `Tier` from `convex/lib/planLimits.ts` (`'starter' | 'growth' | 'pro' | 'contact'`); `BillingLocale` from
  `convex/lib/checkoutCopy.ts`; `EmailContent` from `convex/lib/email.ts`; `escapeHtml(input: string): string` from
  `convex/feedback/emails.ts`.
- Produces (Task 4 imports all of these):
    - `SUPPORT_EMAIL: string` (`convex/lib/support.ts`)
    - `type CapNoticeMode = 'upgrade' | 'proContact' | 'contactCustom'`
    - `capNoticeMode(tier: Tier, cap: number, nextCap: number | undefined): CapNoticeMode`
    - `shouldSendCapNotice(c: { email?: string; subscriptionStatus?: string; cancelAtPeriodEnd?: boolean }): boolean`
    - `billingIntervalParam(priceInterval: string | undefined): 'annual' | 'monthly'`
    -
  `interface CapReachedArgs { excerpt: string; cap: number; planName: string; mode: CapNoticeMode; nextPlanName?: string; nextCap?: number; upgradeUrl?: string; myPostsUrl: string; supportEmail: string }`
    - `postCapReachedEmail(locale: BillingLocale, a: CapReachedArgs): EmailContent`

**DEVIATION from the spec (report it):** the spec had two functions, `capNoticeMode(tier)` and
`includeUpgradeSentence(mode, cap, nextCap)`. They collapse into one `capNoticeMode(tier, cap, nextCap)`: when the next
tier's cap is not bigger (contact-tier overrides can make it equal or smaller), the email says the truthful support line
instead of "upgrade" to a cap that is not higher. One function, one decision, one test file.

- [ ] **Step 1: Create the shared support constant and make the app re-export it**

Create `convex/lib/support.ts`:

```ts
// convex/lib/support.ts
/**
 * The one monitored support / data-subject-rights address. The app re-exports it from
 * app/src/lib/support.ts so the cap email (backlog/R20), the banned screen and the
 * upgrade-at-limit mailto can never drift apart.
 */
export const SUPPORT_EMAIL = 'contact@linkintothessi.com'
```

Replace the whole content of `app/src/lib/support.ts` (Write tool) with:

```ts
/** Monitored support / data-subject-rights address, shown on gate screens and the billing page. */
export { SUPPORT_EMAIL } from '../../../convex/lib/support'
```

(The app already imports `convex/lib/*` modules relatively — see `TRIAL_INTERACTION_THRESHOLD` in
`app/src/pages/BillingPage.tsx:7` — so this path resolves under both Vite and `tsc`.)

- [ ] **Step 2: Write the failing tests for the cap-notice rules**

Create `convex/lib/postCapNotice.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { billingIntervalParam, capNoticeMode, shouldSendCapNotice } from './postCapNotice'

describe('capNoticeMode', () => {
  it('offers the upgrade when the next tier caps higher', () => {
    expect(capNoticeMode('starter', 25, 50)).toBe('upgrade')
    expect(capNoticeMode('growth', 50, 100)).toBe('upgrade')
  })

  it('falls back to the support line when there is no bigger cap one tier up', () => {
    expect(capNoticeMode('pro', 100, undefined)).toBe('proContact')
    expect(capNoticeMode('growth', 50, undefined)).toBe('proContact')
    // A contact-tier style override can leave the next cap equal or smaller — never sell that.
    expect(capNoticeMode('starter', 50, 50)).toBe('proContact')
    expect(capNoticeMode('starter', 50, 30)).toBe('proContact')
  })

  it('tells a contact member their cap is custom', () => {
    expect(capNoticeMode('contact', 9999, undefined)).toBe('contactCustom')
    expect(capNoticeMode('contact', 40, 100)).toBe('contactCustom')
  })
})

describe('shouldSendCapNotice', () => {
  const ok = { email: 'a@b.c', subscriptionStatus: 'active', cancelAtPeriodEnd: false }

  it('sends to a trialing or active member with an email on file', () => {
    expect(shouldSendCapNotice(ok)).toBe(true)
    expect(shouldSendCapNotice({ ...ok, subscriptionStatus: 'trialing', cancelAtPeriodEnd: undefined })).toBe(true)
  })

  it.each(['none', 'past_due', 'canceled', undefined])('skips subscription status %s', status => {
    expect(shouldSendCapNotice({ ...ok, subscriptionStatus: status })).toBe(false)
  })

  it('skips a missing email and a scheduled cancel', () => {
    expect(shouldSendCapNotice({ ...ok, email: undefined })).toBe(false)
    expect(shouldSendCapNotice({ ...ok, email: '' })).toBe(false)
    expect(shouldSendCapNotice({ ...ok, cancelAtPeriodEnd: true })).toBe(false)
  })
})

describe('billingIntervalParam', () => {
  it('maps the Stripe interval onto the billing page query param', () => {
    expect(billingIntervalParam('year')).toBe('annual')
    expect(billingIntervalParam('month')).toBe('monthly')
    expect(billingIntervalParam(undefined)).toBe('monthly')
  })
})
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `pnpm --filter ./convex test lib/postCapNotice.test.ts`
Expected: FAIL — `Cannot find module './postCapNotice'`.

- [ ] **Step 4: Write the cap-notice module**

Create `convex/lib/postCapNotice.ts`:

```ts
// convex/lib/postCapNotice.ts
// Pure rules for the "your post reached its cap" email (backlog/R20). No I/O — the action in
// notifications.ts reads the data, these functions decide what (if anything) to say.
import type { Tier } from './planLimits'

/**
 * Which closing line the email carries:
 * - `upgrade`: Starter/Growth with a bigger cap one tier up — one checkout deep link.
 * - `proContact`: Pro (nothing above it) or a next tier whose cap is not bigger — the support line.
 * - `contactCustom`: contact tier — the cap is bespoke; the support line says so.
 */
export type CapNoticeMode = 'upgrade' | 'proContact' | 'contactCustom'

export function capNoticeMode(tier: Tier, cap: number, nextCap: number | undefined): CapNoticeMode {
  if (tier === 'contact') return 'contactCustom'
  if (tier === 'pro' || nextCap === undefined || nextCap <= cap) return 'proContact'
  return 'upgrade'
}

/**
 * Only an author who can act on it gets the email: an address on file and a trial or paid plan
 * that is not already scheduled to end. `none`, `past_due` and `canceled` see the card-gate or
 * expired banners in the app instead; a scheduled cancel would read as a retention push, which
 * R20 forbids.
 */
export function shouldSendCapNotice(c: {
  email?: string
  subscriptionStatus?: string
  cancelAtPeriodEnd?: boolean
}): boolean {
  if (!c.email) return false
  if (c.subscriptionStatus !== 'trialing' && c.subscriptionStatus !== 'active') return false
  return !c.cancelAtPeriodEnd
}

/** Stripe stores `year` / `month`; the billing page reads `?interval=annual|monthly`. */
export function billingIntervalParam(priceInterval: string | undefined): 'annual' | 'monthly' {
  return priceInterval === 'year' ? 'annual' : 'monthly'
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm --filter ./convex test lib/postCapNotice.test.ts`
Expected: PASS (3 describes, 8 tests).

- [ ] **Step 6: Write the failing email-builder tests**

In `convex/lib/billingEmails.test.ts`, change the import block (lines 2-9) to:

```ts
import {
  duplicateSubscriptionCanceledEmail,
  formatPriceLabel,
  planName,
  postCapReachedEmail,
  trialConvertedEmail,
  trialEndingEmail,
  trialNearEndEmail
} from './billingEmails'
```

Inside `describe('billing emails stay transactional')`, the `const all = [` array (line 119) lists four builders per
locale. Add three more entries **inside the array, before its closing `]`** (Read the file first to find the exact
closing line — it is the `]` right after the `trialConvertedEmail(...)` mapping):

```ts
      ...LOCALES.map(l =>
        postCapReachedEmail(l, {
          excerpt: 'x',
          cap: 25,
          planName: 'Starter',
          mode: 'upgrade',
          nextPlanName: 'Growth',
          nextCap: 50,
          upgradeUrl: BILLING_URL,
          myPostsUrl: BILLING_URL,
          supportEmail: 'contact@example.com'
        })
      ),
      ...LOCALES.map(l =>
        postCapReachedEmail(l, {
          excerpt: 'x',
          cap: 100,
          planName: 'Pro',
          mode: 'proContact',
          myPostsUrl: BILLING_URL,
          supportEmail: 'contact@example.com'
        })
      ),
      ...LOCALES.map(l =>
        postCapReachedEmail(l, {
          excerpt: 'x',
          cap: 40,
          planName: 'Enterprise',
          mode: 'contactCustom',
          myPostsUrl: BILLING_URL,
          supportEmail: 'contact@example.com'
        })
      )
```

Append at the end of the file:

```ts
describe('postCapReachedEmail (R20)', () => {
  const base = {
    excerpt: 'Hiring a <senior> engineer & more',
    cap: 25,
    planName: 'Starter',
    myPostsUrl: 'https://app.example/my-posts',
    supportEmail: 'contact@linkintothessi.com'
  }

  it('names the cap in the subject and links My Posts, in every locale', () => {
    for (const l of LOCALES) {
      const m = postCapReachedEmail(l, { ...base, mode: 'proContact' })
      expect(m.subject).toContain('25')
      expect(m.text).toContain(base.myPostsUrl)
      expect(m.html).toContain(`<a href="${base.myPostsUrl}">`)
    }
  })

  it('escapes the excerpt in the HTML body and quotes it verbatim in the text body', () => {
    const m = postCapReachedEmail('en', { ...base, mode: 'proContact' })
    expect(m.html).toContain('Hiring a &lt;senior&gt; engineer &amp; more')
    expect(m.html).not.toContain('<senior>')
    expect(m.text).toContain('“Hiring a <senior> engineer & more”')
  })

  it('upgrade mode carries the next plan, its cap and the checkout link — and no support line', () => {
    const upgradeUrl = 'https://app.example/billing?plan=growth&interval=annual&src=cap_email'
    const m = postCapReachedEmail('en', { ...base, mode: 'upgrade', nextPlanName: 'Growth', nextCap: 50, upgradeUrl })
    expect(m.text).toContain(`On Growth each post keeps collecting up to 50: ${upgradeUrl}`)
    expect(m.html).toContain(`<a href="${upgradeUrl}">`)
    expect(m.text).not.toContain(base.supportEmail)
  })

  it('proContact and contactCustom carry the support address and no checkout link', () => {
    for (const mode of ['proContact', 'contactCustom'] as const) {
      const m = postCapReachedEmail('en', { ...base, mode })
      expect(m.text).toContain(base.supportEmail)
      expect(m.text).not.toContain('/billing')
      expect(m.html).not.toContain('/billing')
    }
    expect(postCapReachedEmail('en', { ...base, mode: 'contactCustom' }).text).toContain('custom cap')
    expect(postCapReachedEmail('en', { ...base, mode: 'proContact' }).text).toContain('higher cap')
  })
})
```

- [ ] **Step 7: Run the test to verify it fails**

Run: `pnpm --filter ./convex test lib/billingEmails.test.ts`
Expected: FAIL — `postCapReachedEmail` is not exported.

- [ ] **Step 8: Add the builder**

In `convex/lib/billingEmails.ts`, after line 8 (`import type { BillingLocale } from './checkoutCopy'`) add:

```ts
import type { CapNoticeMode } from './postCapNotice'
import { escapeHtml } from '../feedback/emails'
```

Append at the end of the file:

```ts
export interface CapReachedArgs {
  /** The post's first characters (lib/recap `excerpt`), quoted so the author knows which post. */
  excerpt: string
  cap: number
  planName: string
  mode: CapNoticeMode
  nextPlanName?: string
  nextCap?: number
  upgradeUrl?: string
  myPostsUrl: string
  supportEmail: string
}

/**
 * Sent once per post when it reaches the plan's interaction cap and leaves the feed (backlog/R20).
 * The event first, then where the post still lives, then the one line the tier can act on. No
 * urgency and no second link — the transactional guard test enforces the words.
 */
export function postCapReachedEmail(locale: BillingLocale, a: CapReachedArgs): EmailContent {
  const copy: Record<
    BillingLocale,
    { subject: string; body: string; stays: string; upgrade: string; proContact: string; contactCustom: string }
  > = {
    en: {
      subject: `Your post reached ${a.cap} interactions and left the feed`,
      body: `It collected ${a.cap} interactions, the ${a.planName} cap, and left the feed so members see the rest.`,
      stays: 'It stays on My Posts:',
      upgrade: `On ${a.nextPlanName} each post keeps collecting up to ${a.nextCap}:`,
      proContact: `Need a higher cap? Write to ${a.supportEmail}.`,
      contactCustom: `Your plan has a custom cap. Write to ${a.supportEmail} to adjust it.`
    },
    pt: {
      subject: `Sua publicação chegou a ${a.cap} interações e saiu do feed`,
      body: `Ela reuniu ${a.cap} interações, o limite do plano ${a.planName}, e saiu do feed para que os membros vejam as demais.`,
      stays: 'Ela continua em Minhas publicações:',
      upgrade: `No ${a.nextPlanName}, cada publicação continua recebendo até ${a.nextCap}:`,
      proContact: `Precisa de um limite maior? Escreva para ${a.supportEmail}.`,
      contactCustom: `Seu plano tem um limite personalizado. Escreva para ${a.supportEmail} para ajustá-lo.`
    },
    es: {
      subject: `Tu publicación llegó a ${a.cap} interacciones y salió del feed`,
      body: `Reunió ${a.cap} interacciones, el límite del plan ${a.planName}, y salió del feed para que los miembros vean las demás.`,
      stays: 'Sigue en Mis publicaciones:',
      upgrade: `En ${a.nextPlanName}, cada publicación sigue recibiendo hasta ${a.nextCap}:`,
      proContact: `¿Necesitas un límite mayor? Escribe a ${a.supportEmail}.`,
      contactCustom: `Tu plan tiene un límite personalizado. Escribe a ${a.supportEmail} para ajustarlo.`
    }
  }
  const c = copy[locale]
  const closing =
    a.mode === 'upgrade' ? `${c.upgrade} ${a.upgradeUrl}` : a.mode === 'proContact' ? c.proContact : c.contactCustom
  const closingHtml =
    a.mode === 'upgrade' ? `${c.upgrade} <a href="${a.upgradeUrl}">${a.upgradeUrl}</a>` : escapeHtml(closing)
  return {
    subject: c.subject,
    text: `“${a.excerpt}”\n\n${c.body}\n\n${c.stays} ${a.myPostsUrl}\n\n${closing}`,
    html: `<p>“${escapeHtml(a.excerpt)}”</p><p>${c.body}</p><p>${c.stays} <a href="${a.myPostsUrl}">${a.myPostsUrl}</a></p><p>${closingHtml}</p>`
  }
}
```

- [ ] **Step 9: Run the tests to verify they pass**

Run: `pnpm --filter ./convex test lib/billingEmails.test.ts lib/postCapNotice.test.ts`
Expected: PASS — the transactional guard now enumerates 7 builders × 3 locales and the four new tests pass. If the guard
fails on a banned phrase, fix the copy above, never the guard.

- [ ] **Step 10: Typecheck, lint, Prettier, do NOT commit**

Run (from the repo root): `pnpm typecheck && pnpm lint && pnpm --filter ./app test lib/support` (the app has no test
that imports `SUPPORT_EMAIL` by that path, so the last command may report "no test files found" — that is fine;
`pnpm typecheck` already compiled the re-export). Then
`pnpm exec prettier --write convex/lib/support.ts app/src/lib/support.ts convex/lib/postCapNotice.ts convex/lib/postCapNotice.test.ts convex/lib/billingEmails.ts convex/lib/billingEmails.test.ts`
Expected: exit 0 everywhere. Do not commit.

---

### Task 4: R20 wiring — one flip helper, the send action, the billing-page event

**Files:**

- Modify: `convex/interactions.ts` (new `flipCapIfReached` helper above `incrementCommentCount` at line ~117; replace
  the two duplicated flip blocks at lines 144-168 and 210-234)
- Modify: `convex/notifications.ts` (imports at lines 17-27; append `sendPostCapReached` after `sendTrialConverted`,
  line 148)
- Modify: `app/src/pages/BillingPage.tsx` (add one effect after the `cancel_completed` effect that ends at line 92)
- Modify: `app/src/pages/BillingPage.test.tsx` (append a describe)

**Interfaces:**

- Consumes (Task 3): `SUPPORT_EMAIL`, `capNoticeMode`, `shouldSendCapNotice`, `billingIntervalParam`,
  `postCapReachedEmail`, `CapReachedArgs`. Existing: `internal.interactions.getPost` (`{ postId }` →
  `Doc<'posts'> | null`, `convex/interactions.ts:66`), `internal.billing.getBillingContext` (`{ userId }` →
  `{ email, language, primaryLocale, tier, subscriptionStatus, trialEndsAt, made, received, subscriptions } | null`,
  `convex/billing.ts:57`), `internal.lib.planLimits.getPlanLimits` (`{ userId, tier }` →
  `{ interactionsPerPost, postsPerWeek, featuredPerMonth }`), `nextTier(tier): 'growth' | 'pro' | null` and `type Tier`
  from `convex/lib/planLimits.ts`, `excerpt(content)` from `convex/lib/recap.ts`, `findLiveSubscription(rows)` from
  `convex/lib/trialMilestone.ts`, `planName(locale, tier)` + `resolveBillingLocale` (already imported in
  `notifications.ts`), `deliver(kind, to, m)` (module-private in `notifications.ts`).
- Produces: `internal.notifications.sendPostCapReached({ postId: Id<'posts'> })` (scheduled, never called directly); the
  `cap_email_billing_opened { plan }` event.

**Testing note:** the flip helper and the action are I/O wiring; this repo unit-tests pure logic only (no `convex-test`,
see `convex/lib/*.test.ts`), exactly as `sendTrialConverted` has no test of its own. Every decision the action makes is
covered by Task 3's tests; the wiring is covered by `pnpm typecheck` and the existing `convex` suite (which must stay
green — `posts.test.ts` and `feed.test.ts` touch the same modules).

- [ ] **Step 1: Extract the flip into one helper that also schedules the email**

In `convex/interactions.ts`, insert the following right before the comment
`// Internal mutation to increment comment count` (line ~117):

```ts
/**
 * Flip `interactionLimitReached` the moment a post reaches its plan cap, recompute the feed fields
 * (the post leaves the feed) and — once per post — tell the author by email (backlog/R20). The
 * email is scheduled only from inside the flip, and both callers bail earlier when the post is
 * already capped, so a second email for the same post cannot happen.
 */
async function flipCapIfReached(
  ctx: MutationCtx,
  post: Doc<'posts'>,
  likeCount: number,
  commentCount: number
): Promise<void> {
  const author = await ctx.db.get(post.authorId)
  if (!author) return
  const limits = await getPlanLimitsHelper(ctx, author._id, author.tier ?? 'starter')
  // The callers already returned when the post was capped, so it's provably not-yet-reached here.
  if (!shouldFlipInteractionLimit(likeCount, commentCount, limits.interactionsPerPost, false)) return
  // Hitting the interaction limit removes the post from the feed — refresh feed fields.
  const feed = computeFeedFields({
    isFeatured: post.isFeatured,
    publishedAt: post.publishedAt,
    authorTierRank: post.authorTierRank,
    hidden: post.hidden,
    interactionLimitReached: true,
    deletedAt: post.deletedAt
  })
  await ctx.db.patch(post._id, { interactionLimitReached: true, ...feed })
  await ctx.scheduler.runAfter(0, internal.notifications.sendPostCapReached, { postId: post._id })
}
```

Then, in `incrementCommentCount`, replace this whole block (it is the last statement of the handler):

```ts
    // Check if combined interactions have reached the author's limit
    const author = await ctx.db.get(post.authorId)
    if (author) {
      const limits = await getPlanLimitsHelper(ctx, author._id, author.tier ?? 'starter')
      if (
        shouldFlipInteractionLimit(
          post.likeCount,
          newCommentCount,
          limits.interactionsPerPost,
          // The guard above already returned when the post was capped, so it's provably not-yet-reached here.
          false
        )
      ) {
        // Hitting the interaction limit removes the post from the feed — refresh feed fields.
        const feed = computeFeedFields({
          isFeatured: post.isFeatured,
          publishedAt: post.publishedAt,
          authorTierRank: post.authorTierRank,
          hidden: post.hidden,
          interactionLimitReached: true,
          deletedAt: post.deletedAt
        })
        await ctx.db.patch(postId, { interactionLimitReached: true, ...feed })
      }
    }
```

with:

```ts
    await flipCapIfReached(ctx, post, post.likeCount, newCommentCount)
```

And in `incrementLikeCount`, replace the identical block whose `shouldFlipInteractionLimit(` call reads
`newLikeCount,` / `post.commentCount,` (it sits right before `return { counted: true }`) with:

```ts
    await flipCapIfReached(ctx, post, newLikeCount, post.commentCount)
```

Both handlers still `return` / `return { counted: true }` exactly as before. The imports `getPlanLimitsHelper`,
`computeFeedFields`, `shouldFlipInteractionLimit`, `MutationCtx`, `Doc`, `internal` are already at the top of the file;
nothing becomes unused.

- [ ] **Step 2: Typecheck + run the convex suite (the helper compiles against the generated `internal` only after Step 3
  exists — do Step 3 first if `tsc` complains about `sendPostCapReached`)**

Run: `pnpm typecheck && pnpm --filter ./convex test`
Expected: exit 0 after Step 3; every existing test green.

- [ ] **Step 3: Add the send action**

In `convex/notifications.ts`, change the `./lib/billingEmails` import (lines 18-26) to:

```ts
import {
  duplicateSubscriptionCanceledEmail,
  formatPriceLabel,
  INTL_TAG,
  planName,
  postCapReachedEmail,
  trialConvertedEmail,
  trialEndingEmail,
  trialNearEndEmail
} from './lib/billingEmails'
```

and add, after the `./lib/trialMilestone` import (line 27):

```ts
import { billingIntervalParam, capNoticeMode, shouldSendCapNotice } from './lib/postCapNotice'
import { nextTier, type Tier } from './lib/planLimits'
import { excerpt } from './lib/recap'
import { SUPPORT_EMAIL } from './lib/support'
```

Append at the end of the file:

```ts
/**
 * backlog/R20 — the author's post reached its interaction cap and left the feed. Scheduled by
 * `interactions.flipCapIfReached`, so it runs at most once per post. Everything that could make
 * the email wrong is re-checked at send time: the post must still be capped and not deleted, the
 * author must have an email and a live plan that is not cancelling, and the caps are read fresh.
 * Pro and contact get the support line; Starter/Growth get one checkout deep link.
 */
export const sendPostCapReached = internalAction({
  args: { postId: v.id('posts') },
  handler: async (ctx, { postId }) => {
    const post = await ctx.runQuery(internal.interactions.getPost, { postId })
    if (!post || !post.interactionLimitReached || post.deletedAt !== undefined) return
    const c = await ctx.runQuery(internal.billing.getBillingContext, { userId: post.authorId })
    if (!c) return
    const live = findLiveSubscription(c.subscriptions)
    const to = c.email
    if (
      !to ||
      !shouldSendCapNotice({
        email: to,
        subscriptionStatus: c.subscriptionStatus,
        cancelAtPeriodEnd: live?.cancelAtPeriodEnd
      })
    ) {
      return
    }

    const tier: Tier = c.tier ?? 'starter'
    const limits = await ctx.runQuery(internal.lib.planLimits.getPlanLimits, { userId: post.authorId, tier })
    const next = nextTier(tier)
    const nextLimits = next
      ? await ctx.runQuery(internal.lib.planLimits.getPlanLimits, { userId: post.authorId, tier: next })
      : null
    const mode = capNoticeMode(tier, limits.interactionsPerPost, nextLimits?.interactionsPerPost)
    const locale = resolveBillingLocale(c.language, c.primaryLocale)
    const appUrl = process.env.APP_URL ?? 'http://localhost:5173'

    const m = postCapReachedEmail(locale, {
      excerpt: excerpt(post.content),
      cap: limits.interactionsPerPost,
      planName: planName(locale, tier),
      mode,
      nextPlanName: next ? planName(locale, next) : undefined,
      nextCap: nextLimits?.interactionsPerPost,
      upgradeUrl: next
        ? `${appUrl}/billing?plan=${next}&interval=${billingIntervalParam(live?.priceInterval)}&src=cap_email`
        : undefined,
      myPostsUrl: `${appUrl}/my-posts`,
      supportEmail: SUPPORT_EMAIL
    })
    await deliver('post_cap_reached', to, m)
  }
})
```

- [ ] **Step 4: Typecheck + run the convex suite**

Run: `pnpm typecheck && pnpm --filter ./convex test`
Expected: exit 0; all green. If `tsc` reports that `c.tier` is not assignable to `Tier`, read `convex/schema.ts`
`users.tier` — it is the same four-literal union — and keep the annotation; do not widen `Tier`.

- [ ] **Step 5: Write the failing billing-page test**

Append to `app/src/pages/BillingPage.test.tsx`:

```ts
describe('cap email landing (R20)', () => {
  it('fires cap_email_billing_opened exactly once under StrictMode, tagged with the plan in the link', () => {
    renderBilling({ search: 'plan=growth&interval=annual&src=cap_email', strict: true })
    expect(captureEvent).toHaveBeenCalledTimes(1)
    expect(captureEvent).toHaveBeenCalledWith('cap_email_billing_opened', { plan: 'growth' })
  })

  it('fires nothing on a plain ?plan= visit', () => {
    renderBilling({ search: 'plan=growth' })
    expect(captureEvent).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 6: Run the test to verify it fails**

Run: `pnpm --filter ./app test pages/BillingPage.test.tsx`
Expected: the first new test FAILS (`captureEvent` called 0 times); everything else green.

- [ ] **Step 7: Add the latched effect**

In `app/src/pages/BillingPage.tsx`, right after the `cancel_completed` effect (the `useEffect` that ends with
`}, [justCanceled, subscriptionInfo?.cancelAtPeriodEnd, me, setSearchParams])`, line 92), add:

```ts
  // R20 — the cap email's one link lands here as /billing?plan=…&interval=…&src=cap_email. Same
  // ref latch as cancel_completed: one event per landing, not one per StrictMode double effect.
  const capEmailTrackedRef = useRef(false)
  useEffect(() => {
    if (searchParams.get('src') !== 'cap_email' || capEmailTrackedRef.current) return
    capEmailTrackedRef.current = true
    captureEvent('cap_email_billing_opened', { plan: resolveTargetPlan(searchParams) })
  }, [searchParams])
```

`useRef`, `useEffect`, `captureEvent` and `resolveTargetPlan` are already imported (lines 1, 18, 21).

- [ ] **Step 8: Run the test to verify it passes**

Run: `pnpm --filter ./app test pages/BillingPage.test.tsx`
Expected: PASS, including Task 2's `checkout_started (R18)` describe and the R09 StrictMode test.

- [ ] **Step 9: Lint, typecheck, Prettier, do NOT commit**

Run (from the repo root): `pnpm lint && pnpm typecheck`, then
`pnpm exec prettier --write convex/interactions.ts convex/notifications.ts app/src/pages/BillingPage.tsx app/src/pages/BillingPage.test.tsx`
Expected: exit 0 everywhere. Do not commit.

---

### Task 5: R21 backend — per-viewer state, 24 h window, hide, caught-up

**Files:**

- Modify: `convex/schema.ts` (the `userPostState` table at the end of the file: two optional fields)
- Create: `convex/lib/feedHygiene.ts`
- Create: `convex/lib/feedHygiene.test.ts`
- Modify: `convex/interactions.ts` (`incrementCommentCount` at line ~118: record `commentedAt`; new public `hidePost`
  mutation appended after `incrementLikeCount`)
- Modify: `convex/feed.ts` (imports; `fetchFeedPage` at lines 187-231; new `getCaughtUp` query appended)
- Modify: `convex/feed.test.ts` (`feedCtx` helper at lines 27-37; new describe)

**Interfaces:**

- Consumes: `userPostState` rows (`{ userId, postId, reactedAt?, commentDraft? }` today); `userInteractions.by_user`
  index (`['userId']`, rows carry `createdAt`); `resolveSession(ctx, sessionToken)` from `convex/lib/auth.ts` (returns
  `Doc<'users'> | null`); `requireAuth(ctx, sessionToken)`; `ConvexError`.
- Produces:
    - Schema: `userPostState.commentedAt?: number`, `userPostState.hiddenAt?: number` (widen-only; no backfill).
    - `convex/lib/feedHygiene.ts`: `INTERACTED_TTL_MS = 86_400_000`;
      `interface ViewerRow { reactedAt?: number; commentedAt?: number; hiddenAt?: number }`;
      `interface FeedViewerState { reacted: boolean; commented: boolean; hidesAt: number }`;
      `lastInteractedAt(row: ViewerRow): number | undefined`;
      `viewerPostStatus(row: ViewerRow | null, now: number): 'fresh' | 'done' | 'gone'`;
      `canHide(row: ViewerRow | null): boolean`; `toFeedViewerState(row: ViewerRow | null): FeedViewerState | null`.
    - `api.interactions.hidePost({ sessionToken, postId })` → `null`; throws `ConvexError('NOT_INTERACTED')` on a post
      the viewer never reacted to or commented on; idempotent otherwise.
    - `api.feed.getCaughtUp({ sessionToken? })` → `{ caughtUp: boolean }`.
    - Every feed page item now carries `viewerState: FeedViewerState | null` (Task 6 reads it), and posts whose status
      is `gone` are dropped from the page.

**DEVIATION from the spec (report it):** the spec wrote `toFeedViewerState(row, now)`. `now` is not needed — `hidesAt`
is `lastInteractedAt + TTL`, a fixed instant; the client computes "leaves in N h" from it. Dropping the parameter keeps
the function pure over the row alone.

- [ ] **Step 1: Widen the schema**

In `convex/schema.ts`, replace

```ts
  userPostState: defineTable({
    userId: v.id('users'),
    postId: v.id('posts'),
    reactedAt: v.optional(v.number()),
    commentDraft: v.optional(v.string())
  })
```

with

```ts
  userPostState: defineTable({
    userId: v.id('users'),
    postId: v.id('posts'),
    reactedAt: v.optional(v.number()),
    // backlog/R21 — set when the viewer records a comment; with reactedAt it starts the 24 h window
    // after which the post leaves THIS viewer's feed. Never read by counts, caps or the author.
    commentedAt: v.optional(v.number()),
    // backlog/R21 — "Hide now": the post leaves this viewer's feed at once. No unhide (history has it).
    hiddenAt: v.optional(v.number()),
    commentDraft: v.optional(v.string())
  })
```

Run: `pnpm --filter ./convex test schema.test.ts`
Expected: PASS (the schema test only checks that the module loads and validators are well-formed).

- [ ] **Step 2: Write the failing pure-module tests**

Create `convex/lib/feedHygiene.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  canHide,
  INTERACTED_TTL_MS,
  lastInteractedAt,
  toFeedViewerState,
  viewerPostStatus
} from './feedHygiene'

const NOW = 10_000_000
const H = 3_600_000

describe('INTERACTED_TTL_MS', () => {
  it('is 24 hours', () => {
    expect(INTERACTED_TTL_MS).toBe(24 * H)
  })
})

describe('lastInteractedAt', () => {
  it('is undefined for a row with only a draft', () => {
    expect(lastInteractedAt({})).toBeUndefined()
  })
  it('is the later of reactedAt and commentedAt', () => {
    expect(lastInteractedAt({ reactedAt: 5 })).toBe(5)
    expect(lastInteractedAt({ commentedAt: 7 })).toBe(7)
    expect(lastInteractedAt({ reactedAt: 5, commentedAt: 7 })).toBe(7)
    expect(lastInteractedAt({ reactedAt: 9, commentedAt: 7 })).toBe(9)
  })
})

describe('viewerPostStatus', () => {
  it('is fresh with no row or a row that only holds a draft', () => {
    expect(viewerPostStatus(null, NOW)).toBe('fresh')
    expect(viewerPostStatus({}, NOW)).toBe('fresh')
  })
  it('is done inside the 24 h window and gone once it elapses', () => {
    expect(viewerPostStatus({ reactedAt: NOW - 23 * H }, NOW)).toBe('done')
    expect(viewerPostStatus({ commentedAt: NOW - INTERACTED_TTL_MS + 1 }, NOW)).toBe('done')
    expect(viewerPostStatus({ reactedAt: NOW - INTERACTED_TTL_MS }, NOW)).toBe('gone')
  })
  it('restarts the window from the later interaction', () => {
    expect(viewerPostStatus({ reactedAt: NOW - 30 * H, commentedAt: NOW - 2 * H }, NOW)).toBe('done')
  })
  it('is gone at once when hidden, whatever the timestamps say', () => {
    expect(viewerPostStatus({ reactedAt: NOW - 1, hiddenAt: NOW }, NOW)).toBe('gone')
  })
})

describe('canHide', () => {
  it('only offers Hide on a post the viewer interacted with', () => {
    expect(canHide(null)).toBe(false)
    expect(canHide({})).toBe(false)
    expect(canHide({ reactedAt: 1 })).toBe(true)
    expect(canHide({ commentedAt: 1 })).toBe(true)
  })
})

describe('toFeedViewerState', () => {
  it('is null for an untouched post', () => {
    expect(toFeedViewerState(null)).toBeNull()
    expect(toFeedViewerState({})).toBeNull()
  })
  it('reports which actions happened and when the post leaves', () => {
    expect(toFeedViewerState({ reactedAt: 100 })).toEqual({ reacted: true, commented: false, hidesAt: 100 + INTERACTED_TTL_MS })
    expect(toFeedViewerState({ reactedAt: 100, commentedAt: 300 })).toEqual({
      reacted: true,
      commented: true,
      hidesAt: 300 + INTERACTED_TTL_MS
    })
  })
})
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `pnpm --filter ./convex test lib/feedHygiene.test.ts`
Expected: FAIL — `Cannot find module './feedHygiene'`.

- [ ] **Step 4: Write the module**

Create `convex/lib/feedHygiene.ts`:

```ts
// convex/lib/feedHygiene.ts
// Pure rules for backlog/R21: a post the viewer already reacted to or commented on stays in THEIR
// feed for 24 h (done state), then leaves; "Hide now" makes it leave at once. Nothing here touches
// counts, caps, `inFeed`, search or the author's My Posts — this is per-viewer presentation only.

/** How long a handled post stays in the viewer's feed. */
export const INTERACTED_TTL_MS = 24 * 60 * 60 * 1000

/** The `userPostState` fields this module reads. */
export interface ViewerRow {
  reactedAt?: number
  commentedAt?: number
  hiddenAt?: number
}

/** What the card renders for a post the viewer already handled — `null` for an untouched post. */
export interface FeedViewerState {
  reacted: boolean
  commented: boolean
  /** When the post leaves this viewer's feed on its own (ms epoch). */
  hidesAt: number
}

export function lastInteractedAt(row: ViewerRow): number | undefined {
  if (row.reactedAt === undefined && row.commentedAt === undefined) return undefined
  return Math.max(row.reactedAt ?? 0, row.commentedAt ?? 0)
}

/**
 * `fresh`: never interacted — the normal card. `done`: interacted, inside the window — the done
 * card. `gone`: hidden by the viewer, or the window elapsed — dropped from the page.
 */
export function viewerPostStatus(row: ViewerRow | null, now: number): 'fresh' | 'done' | 'gone' {
  if (!row) return 'fresh'
  if (row.hiddenAt !== undefined) return 'gone'
  const at = lastInteractedAt(row)
  if (at === undefined) return 'fresh'
  return now - at < INTERACTED_TTL_MS ? 'done' : 'gone'
}

/** Hide exists only on a post the viewer interacted with — never a way to curate untouched posts. */
export function canHide(row: ViewerRow | null): boolean {
  return !!row && lastInteractedAt(row) !== undefined
}

export function toFeedViewerState(row: ViewerRow | null): FeedViewerState | null {
  if (!row) return null
  const at = lastInteractedAt(row)
  if (at === undefined) return null
  return { reacted: row.reactedAt !== undefined, commented: row.commentedAt !== undefined, hidesAt: at + INTERACTED_TTL_MS }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm --filter ./convex test lib/feedHygiene.test.ts`
Expected: PASS (6 describes, 11 tests).

- [ ] **Step 6: Record `commentedAt` and add `hidePost`**

In `convex/interactions.ts`:

(a) Add to the imports at the top:

```ts
import { canHide } from './lib/feedHygiene'
```

and change `import { action, internalMutation, internalQuery, query } from './_generated/server'` to

```ts
import { action, internalMutation, internalQuery, mutation, query } from './_generated/server'
```

(b) In `incrementCommentCount`, replace

```ts
    const newCommentCount = post.commentCount + 1
    await ctx.db.patch(postId, { commentCount: newCommentCount })

    // Same transaction as the counter: the log is the source for recap/history (backlog/R15).
    await ctx.db.insert('userInteractions', {
      userId: actorId,
      postId,
      authorId: post.authorId,
      kind: 'comment',
      comment,
      createdAt: Date.now()
    })
```

with

```ts
    const now = Date.now()
    const newCommentCount = post.commentCount + 1
    await ctx.db.patch(postId, { commentCount: newCommentCount })

    // Same transaction as the counter: the log is the source for recap/history (backlog/R15).
    await ctx.db.insert('userInteractions', {
      userId: actorId,
      postId,
      authorId: post.authorId,
      kind: 'comment',
      comment,
      createdAt: now
    })

    // backlog/R21 — the per-viewer state that starts the 24 h "done" window. Upsert like
    // saveCommentDraft: the row may already hold a draft or a reaction.
    const state = await ctx.db
      .query('userPostState')
      .withIndex('by_user_and_post', q => q.eq('userId', actorId).eq('postId', postId))
      .unique()
    if (state) await ctx.db.patch(state._id, { commentedAt: now })
    else await ctx.db.insert('userPostState', { userId: actorId, postId, commentedAt: now })
```

(c) Append right after the closing `})` of `incrementLikeCount` (before the comment
`// Public action: record an in-app comment engagement + count it.`):

```ts
/**
 * backlog/R21 — "Hide now": the post leaves the viewer's feed at once instead of after 24 h.
 * Only for a post the viewer already reacted to or commented on (there is no hide for untouched
 * posts, and no unhide — /history keeps the record). Idempotent: a second call changes nothing.
 */
export const hidePost = mutation({
  args: { sessionToken: v.string(), postId: v.id('posts') },
  handler: async (ctx, { sessionToken, postId }) => {
    const user = await requireAuth(ctx, sessionToken)
    const state = await ctx.db
      .query('userPostState')
      .withIndex('by_user_and_post', q => q.eq('userId', user._id).eq('postId', postId))
      .unique()
    if (!state || !canHide(state)) throw new ConvexError('NOT_INTERACTED')
    if (state.hiddenAt === undefined) await ctx.db.patch(state._id, { hiddenAt: Date.now() })
    return null
  }
})
```

Run: `pnpm typecheck`
Expected: exit 0.

- [ ] **Step 7: Write the failing feed tests**

In `convex/feed.test.ts`:

(a) Replace the `feedCtx` helper (lines 26-37) with a version that also answers the per-post `userPostState` lookups:

```ts
// Minimal QueryCtx mock: the by_feed_rank page walk returns `page`, get() resolves authors, and the
// per-post userPostState lookup (backlog/R21) answers from `states` keyed by post id.
function feedCtx(page: Doc<'posts'>[], authors: Doc<'users'>[], states: Record<string, unknown> = {}) {
  const byId = new Map(authors.map(a => [a._id, a]))
  return {
    db: {
      query: (table: string) => ({
        withIndex: (_name: string, fn?: (q: any) => any) => {
          if (table === 'userPostState') {
            let postId = ''
            fn?.({ eq: (field: string, value: string) => ({ eq: (f2: string, v2: string) => ((postId = v2), null) }) })
            return { unique: async () => states[postId] ?? null }
          }
          return { order: () => ({ paginate: async () => ({ page, isDone: true, continueCursor: 'END' }) }) }
        }
      }),
      get: async (id: Id<'users'>) => byId.get(id) ?? null
    }
  } as any
}
```

(b) Add the import at the top:

```ts
import { INTERACTED_TTL_MS } from './lib/feedHygiene'
```

(c) Append a describe at the end of the file. It reuses the `post`, `user`, `opts` and `buildFeedFilter` helpers already
in the file:

```ts
describe('fetchFeedPage — per-viewer hygiene (R21)', () => {
  const viewer = user('viewer', { tier: 'starter' })
  const author = user('a1', { subscriptionStatus: 'active' })
  const page = [post('p1', 'a1'), post('p2', 'a1'), post('p3', 'a1'), post('p4', 'a1')]
  const filter = buildFeedFilter({ tier: 'starter' })

  it('attaches viewerState and drops posts that are hidden or past the 24 h window', async () => {
    const ctx = feedCtx(page, [author], {
      p1: { reactedAt: NOW - 1000 },
      p2: { reactedAt: NOW - INTERACTED_TTL_MS - 1 },
      p3: { commentedAt: NOW - 1000, hiddenAt: NOW - 500 }
    })
    const result = await fetchFeedPage(ctx, viewer, opts(filter))
    expect(result.page.map(p => p._id)).toEqual(['p1', 'p4'])
    expect(result.page[0].viewerState).toEqual({ reacted: true, commented: false, hidesAt: NOW - 1000 + INTERACTED_TTL_MS })
    expect(result.page[1].viewerState).toBeNull()
  })

  it('treats a row that only holds a comment draft as untouched', async () => {
    const ctx = feedCtx([post('p1', 'a1')], [author], { p1: { commentDraft: 'hello' } })
    const result = await fetchFeedPage(ctx, viewer, opts(filter))
    expect(result.page).toHaveLength(1)
    expect(result.page[0].viewerState).toBeNull()
  })
})
```

- [ ] **Step 8: Run the test to verify it fails**

Run: `pnpm --filter ./convex test feed.test.ts`
Expected: the two new tests FAIL (`viewerState` undefined, four posts returned); the existing feed tests still pass with
the new mock (they pass no `states`, so every lookup resolves `null`).

- [ ] **Step 9: Read the state in `fetchFeedPage` and add `getCaughtUp`**

In `convex/feed.ts`:

(a) Add the imports:

```ts
import { requireAuth, resolveSession } from './lib/auth'
import { INTERACTED_TTL_MS, toFeedViewerState, viewerPostStatus } from './lib/feedHygiene'
```

(replacing the existing `import { requireAuth } from './lib/auth'`).

(b) In `fetchFeedPage`, replace the block from `// Authors for THIS page only` down to
`return { ...result, page: enriched }` with:

```ts
  // Authors for THIS page only (≤ numItems). Fetched once, reused by the filters + enrichment.
  const uniqueAuthorIds = [...new Set(result.page.map(p => p.authorId))]
  const authors = await Promise.all(uniqueAuthorIds.map(id => ctx.db.get(id)))
  const authorMap = new Map(authors.filter((a): a is Doc<'users'> => a !== null).map(a => [a._id, a]))

  // backlog/R21 — the viewer's own state per post (one indexed point read each, ≤ numItems): a
  // post they handled stays for 24 h as a "done" card, then leaves their feed; "Hide now" makes it
  // leave at once. Per viewer only — nothing global changes, and the author still sees the post.
  const states = await Promise.all(
    result.page.map(p =>
      ctx.db
        .query('userPostState')
        .withIndex('by_user_and_post', q => q.eq('userId', viewer._id).eq('postId', p._id))
        .unique()
    )
  )

  // Viewer-/author-dependent filters that can't live in the global index (plan §3c): the viewer's
  // own posts + visibility allowlists + author eligibility (shared with search via
  // isPostVisibleToViewer), then the viewer's tier-based industry/country filter, then the
  // per-viewer hygiene above. Pages may come back short (even empty) when these drop posts —
  // `usePaginatedQuery` just loads more, and FeedPage auto-loads a few empty pages.
  const enriched = result.page
    .map((post, i) => ({ post, state: states[i] }))
    .filter(({ post, state }) => {
      const author = authorMap.get(post.authorId) ?? null
      if (!isPostVisibleToViewer(post, viewer, author, now)) return false
      if (filter.applyIndustry && filter.industries.length > 0) {
        if (!author?.industry || !filter.industries.includes(author.industry)) return false
      }
      if (filter.applyCountry && filter.countries.length > 0) {
        if (!author?.country || !filter.countries.includes(author.country)) return false
      }
      return viewerPostStatus(state, now) !== 'gone'
    })
    .map(({ post, state }) => {
      const author = authorMap.get(post.authorId)
      const viewerState = toFeedViewerState(state)
      return author ? { ...post, author: toFeedAuthor(author), viewerState } : { ...post, author: null, viewerState }
    })

  // Preserve isDone + continueCursor from the index walk; only `page` is filtered/enriched.
  return { ...result, page: enriched }
```

(c) Append at the end of the file:

```ts
/**
 * backlog/R21 — an empty feed page means one of two things: nothing exists yet (the R05 empty
 * state) or the viewer handled everything and it aged out (the caught-up state). "Interacted with
 * something in the last 24 h" tells them apart: older interactions have already left the feed and
 * prove nothing about today. Read by FeedPage only while the feed is empty.
 */
export const getCaughtUp = query({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, { sessionToken }) => {
    const viewer = await resolveSession(ctx, sessionToken)
    if (!viewer) return { caughtUp: false }
    const latest = await ctx.db
      .query('userInteractions')
      .withIndex('by_user', q => q.eq('userId', viewer._id))
      .order('desc')
      .first()
    return { caughtUp: latest !== null && Date.now() - latest.createdAt < INTERACTED_TTL_MS }
  }
})
```

(`resolveSession` accepts `string | undefined` — see its use in `users.getMe`.)

- [ ] **Step 10: Run the tests to verify they pass**

Run: `pnpm typecheck && pnpm --filter ./convex test`
Expected: exit 0; `feed.test.ts` green including the seeded-parity describe (its `feedCtx` calls still pass two args),
everything else unchanged.

- [ ] **Step 11: Lint, Prettier, do NOT commit**

Run (from the repo root): `pnpm lint`, then
`pnpm exec prettier --write convex/schema.ts convex/lib/feedHygiene.ts convex/lib/feedHygiene.test.ts convex/interactions.ts convex/feed.ts convex/feed.test.ts`
Expected: exit 0. Do not commit.

---

### Task 6: R21 UI — done footer, Hide now, empty-page auto-load, caught-up state

**UI task — load these skills before starting and follow them:** `responsive-design`, `frontend-design:frontend-design`,
`web-design-guidelines`, `ui-ux-pro-max`. The footer must wrap on a 375 px viewport, every control stays a real
`<button>`/`<a>`, and copy is sentence case.

**Files:**

- Modify: `app/src/i18n/locales/en.json`, `app/src/i18n/locales/pt.json`, `app/src/i18n/locales/es.json` (seven `feed.*`
  keys inserted right after the `"emptyFiltered"` line, line 69 in all three — keep the files line-aligned)
- Modify: `app/src/components/PostCard.tsx` (`PostWithAuthor` type; `onHide` prop; footer at lines 135-178)
- Modify: `app/src/components/PostCard.test.tsx` (new describe)
- Modify: `app/src/pages/FeedPage.tsx` (imports; `hidePost` mutation; empty-page auto-load; `getCaughtUp` subscription;
  `onHide` wiring; empty block at lines 146-156)
- Modify: `app/src/pages/FeedPage.test.tsx` (api mock + two tests)
- Modify: `app/src/components/EmptyFeed.tsx` (`caughtUp` prop + branch)
- Modify: `app/src/components/EmptyFeed.test.tsx` (two tests)

**Interfaces:**

- Consumes (Task 5): `FeedViewerState { reacted, commented, hidesAt }` and `INTERACTED_TTL_MS` from
  `convex/lib/feedHygiene.ts`; feed page items carry `viewerState: FeedViewerState | null`;
  `api.interactions.hidePost({ sessionToken, postId })`; `api.feed.getCaughtUp({ sessionToken }) → { caughtUp }`.
  Existing: `captureEvent` from `@/lib/observability/analytics`; `toast(message)` from `../components/ui/toast`;
  `friendlyError(err, fallback)` from `@/lib/errors`.
- Produces: `PostWithAuthor.viewerState?: FeedViewerState | null`; `PostCard` prop `onHide?: () => void`; `EmptyFeed`
  prop `caughtUp?: boolean` (Task 8 adds the invite link to the caught-up branch); PostHog event
  `post_hidden { after: number }` (hours since the interaction); i18n keys `feed.doneReacted`, `feed.doneCommented`,
  `feed.doneBoth`, `feed.leavesIn`, `feed.hideNow`, `feed.caughtUpTitle`, `feed.caughtUpBody`.

- [ ] **Step 1: Add the i18n keys (three locales, same line)**

In each locale file the line `"emptyFiltered": "…",` (line 69) is followed by `"checklist": {`. Insert these seven lines
between them.

`app/src/i18n/locales/en.json`:

```json
    "doneReacted": "Reacted",
    "doneCommented": "Commented",
    "doneBoth": "Reacted · commented",
    "leavesIn": "Leaves your feed in {{hours}} h",
    "hideNow": "Hide now",
    "caughtUpTitle": "You're caught up",
    "caughtUpBody": "Posts you handled leave after 24 hours. New ones appear as members share them.",
```

`app/src/i18n/locales/pt.json`:

```json
    "doneReacted": "Você reagiu",
    "doneCommented": "Você comentou",
    "doneBoth": "Você reagiu · comentou",
    "leavesIn": "Sai do seu feed em {{hours}} h",
    "hideNow": "Ocultar agora",
    "caughtUpTitle": "Você está em dia",
    "caughtUpBody": "As publicações com que você interagiu saem depois de 24 horas. Novas aparecem conforme os membros compartilham.",
```

`app/src/i18n/locales/es.json`:

```json
    "doneReacted": "Reaccionaste",
    "doneCommented": "Comentaste",
    "doneBoth": "Reaccionaste · comentaste",
    "leavesIn": "Sale de tu feed en {{hours}} h",
    "hideNow": "Ocultar ahora",
    "caughtUpTitle": "Estás al día",
    "caughtUpBody": "Las publicaciones con las que interactuaste salen después de 24 horas. Las nuevas aparecen a medida que los miembros las comparten.",
```

Run: `pnpm --filter ./app test i18n.test.ts`
Expected: PASS (valid JSON, existing probes unchanged).

- [ ] **Step 2: Write the failing PostCard tests**

Append to `app/src/components/PostCard.test.tsx`, inside the file but as a new top-level describe after the existing
one:

```tsx
// backlog/R21 — a post the viewer already handled shows what they did, keeps only the action they
// have not taken yet, says when it leaves their feed, and offers Hide now.
describe('PostCard done footer (R21)', () => {
  const inFiveHours = Date.now() + 5 * 3_600_000

  it('names what was done, keeps the remaining action and says when the post leaves', () => {
    render(
      <PostCard
        post={{ ...mockPost, viewerState: { reacted: true, commented: false, hidesAt: inFiveHours } }}
        onComment={() => {}}
        onReact={() => {}}
        onHide={() => {}}
      />
    )
    expect(screen.getByText(/reacted/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /react/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /comment/i })).toBeInTheDocument()
    expect(screen.getByText(/leaves your feed in 5 h/i)).toBeInTheDocument()
  })

  it('drops both actions and names both once the viewer reacted and commented', () => {
    render(
      <PostCard
        post={{ ...mockPost, viewerState: { reacted: true, commented: true, hidesAt: inFiveHours } }}
        onComment={() => {}}
        onReact={() => {}}
        onHide={() => {}}
      />
    )
    expect(screen.getByText(/reacted · commented/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /react/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /comment/i })).not.toBeInTheDocument()
  })

  it('rounds the remaining time up so it never says 0 h', () => {
    render(
      <PostCard
        post={{ ...mockPost, viewerState: { reacted: false, commented: true, hidesAt: Date.now() + 1000 } }}
        onComment={() => {}}
        onReact={() => {}}
        onHide={() => {}}
      />
    )
    expect(screen.getByText(/leaves your feed in 1 h/i)).toBeInTheDocument()
  })

  it('calls onHide from the Hide now button', () => {
    const onHide = vi.fn()
    render(
      <PostCard
        post={{ ...mockPost, viewerState: { reacted: true, commented: false, hidesAt: inFiveHours } }}
        onComment={() => {}}
        onReact={() => {}}
        onHide={onHide}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /hide now/i }))
    expect(onHide).toHaveBeenCalledOnce()
  })

  it('renders the normal footer, with no Hide now, for an untouched post', () => {
    render(
      <PostCard
        post={{ ...mockPost, viewerState: null }}
        onComment={() => {}}
        onReact={() => {}}
        onHide={() => {}}
      />
    )
    expect(screen.getByRole('button', { name: /react/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /comment/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /hide now/i })).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `pnpm --filter ./app test PostCard.test.tsx`
Expected: the five new tests FAIL (TypeScript complains about `viewerState`/`onHide`; the react/comment buttons still
render; no "Leaves your feed" text). The existing PostCard tests still pass.

- [ ] **Step 4: Implement the done footer**

In `app/src/components/PostCard.tsx`:

(a) Imports — add after line 1 (`useTranslation`):

```tsx
import { useState } from 'react'
```

and after the `REACTIONS` import:

```tsx
import type { FeedViewerState } from '../../../convex/lib/feedHygiene'
```

(b) In `PostWithAuthor`, after `suggestedReaction?: Reaction`, add:

```tsx
  /** backlog/R21 — set by feed.getFeed when the viewer already reacted/commented; absent elsewhere. */
  viewerState?: FeedViewerState | null
```

(c) Change the component signature to accept `onHide`:

```tsx
export default function PostCard({
  post,
  onComment,
  onReact,
  gated,
  onGated,
  reacting,
  onHide
}: {
  post: PostWithAuthor
  onComment: (postId: Id<'posts'>) => void
  onReact: (postId: Id<'posts'>, reaction: Reaction) => void
  gated?: boolean
  onGated?: (source: GateSource) => void
  reacting?: boolean
  /** backlog/R21 — "Hide now" on a post the viewer already handled. */
  onHide?: () => void
}) {
  const { t } = useTranslation()
  // backlog/R21 — the done footer. `now` is fixed at mount (react-hooks/purity): the label is
  // "leaves in N h", a live countdown would be noise.
  const [now] = useState(() => Date.now())
  const done = post.viewerState ?? null
  const hoursLeft = done ? Math.max(1, Math.ceil((done.hidesAt - now) / 3_600_000)) : 0
  const doneLabel = done?.reacted && done.commented ? 'feed.doneBoth' : done?.reacted ? 'feed.doneReacted' : 'feed.doneCommented'
```

(d) Replace the footer `<div>` (lines 135-178, from `<div className="border-border bg-card flex h-[52px] …">` to its
closing `</div>` just before `}` of the `footer=` prop) with:

```tsx
          <div className="border-border bg-card flex min-h-[52px] flex-wrap items-center gap-x-4 gap-y-1 border-t px-4 py-1.5">
            {done && <span className="text-muted-foreground text-[13px]">✓ {t(doneLabel)}</span>}
            {!done?.reacted && (
              <ReactionButton
                postId={post._id}
                suggested={post.suggestedReaction ?? 'LIKE'}
                likeCount={post.likeCount}
                onReact={onReact}
                gated={gated}
                onGated={onGated}
                loading={reacting}
              />
            )}
            {!done?.commented && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => (gated ? onGated?.('comment') : onComment(post._id))}
                className="text-muted-foreground flex cursor-pointer items-center gap-1 text-[13px]"
              >
                💬 {post.commentCount} {t('feed.comment')}
              </Button>
            )}

            {!!post.sourceUrl &&
              (gated ? (
                <a
                  href={post.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={e => {
                    e.preventDefault()
                    onGated?.('linkedin')
                  }}
                  className="ml-auto text-gold-text no-underline hover:underline"
                >
                  {t('feed.viewOnLinkedIn')}
                </a>
              ) : (
                <a
                  href={post.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-auto text-gold-text no-underline hover:underline"
                >
                  {t('feed.viewOnLinkedIn')}
                </a>
              ))}

            {done && (
              <span className="ml-auto flex items-center gap-2">
                <span className="text-muted-foreground text-xs">{t('feed.leavesIn', { hours: hoursLeft })}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={onHide}
                  className="text-muted-foreground h-7 cursor-pointer px-2 text-xs"
                >
                  {t('feed.hideNow')}
                </Button>
              </span>
            )}
          </div>
```

(The two `<a>` blocks are unchanged. `h-[52px]` became `min-h-[52px]` + `flex-wrap` so the five-item done row wraps on a
375 px viewport instead of overflowing; an untouched post still renders at 52 px.)

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm --filter ./app test PostCard.test.tsx`
Expected: PASS — all existing tests plus the five new ones.

- [ ] **Step 6: Write the failing FeedPage and EmptyFeed tests**

(a) In `app/src/pages/FeedPage.test.tsx`, replace the api mock with:

```tsx
vi.mock('../convex', () => ({
  api: {
    users: { getMe: 'users.getMe', getTrialProgress: 'users.getTrialProgress' },
    posts: { getMyPosts: 'posts.getMyPosts', submitPost: 'posts.submitPost' },
    feed: { getFeed: 'feed.getFeed', getCaughtUp: 'feed.getCaughtUp' },
    interactions: { reactToPost: 'interactions.reactToPost', hidePost: 'interactions.hidePost' }
  }
}))
```

and append a describe:

```tsx
// backlog/R21 — an empty page is not proof the feed is empty: handled posts are dropped per viewer.
describe('FeedPage feed hygiene (R21)', () => {
  it('keeps loading while empty pages can still load more, instead of showing the empty state', () => {
    mockPaginated = { results: [], status: 'CanLoadMore', loadMore: vi.fn() }
    renderPage()
    expect(mockPaginated.loadMore).toHaveBeenCalledWith(20)
    expect(screen.queryByText(/your feed fills as members post/i)).not.toBeInTheDocument()
  })

  it('shows the caught-up state when the feed is exhausted and the member interacted recently', () => {
    mockQueryReturns['feed.getCaughtUp'] = { caughtUp: true }
    renderPage()
    expect(screen.getByText(/you.re caught up/i)).toBeInTheDocument()
    expect(screen.queryByText(/your feed fills as members post/i)).not.toBeInTheDocument()
  })
})
```

(b) In `app/src/components/EmptyFeed.test.tsx`, append inside the `describe('EmptyFeed', …)` block, after the last test:

```tsx
  // backlog/R21 — everything the member handled aged out: say so, no checklist, no "share first".
  it('renders the caught-up state instead of the checklist', () => {
    render(
      <EmptyFeed
        gated={false}
        hasOwnPost
        made={0}
        trialStatus="trialing"
        caughtUp
      />
    )
    expect(screen.getByText(/you.re caught up/i)).toBeInTheDocument()
    expect(screen.queryByTestId('activation-checklist')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /share your first post/i })).not.toBeInTheDocument()
  })

  it('keeps the card gate ahead of the caught-up state for a gated member', () => {
    render(
      <EmptyFeed
        gated
        hasOwnPost
        made={0}
        caughtUp
      />
    )
    expect(screen.getByText(/saved and hidden/i)).toBeInTheDocument()
    expect(screen.queryByText(/you.re caught up/i)).not.toBeInTheDocument()
  })
```

- [ ] **Step 7: Run the tests to verify they fail**

Run: `pnpm --filter ./app test FeedPage.test.tsx EmptyFeed.test.tsx`
Expected: the four new tests FAIL (`loadMore` not called; no caught-up copy; TypeScript rejects `caughtUp`).

- [ ] **Step 8: Implement EmptyFeed's caught-up branch and FeedPage's wiring**

(a) `app/src/components/EmptyFeed.tsx` — add the prop and the branch:

```tsx
export default function EmptyFeed({
  gated,
  hasOwnPost,
  made,
  trialStatus,
  caughtUp
}: {
  gated: boolean
  hasOwnPost: boolean
  made: number
  trialStatus?: string
  /** backlog/R21 — the member interacted in the last 24 h and every handled post aged out. */
  caughtUp?: boolean
}) {
  const { t } = useTranslation()
  // backlog/R21 — nothing to activate here: they used the feed and cleared it. A gated member keeps
  // the gate (they cannot have interacted recently anyway, so this rarely competes).
  if (caughtUp && !gated) {
    return (
      <div
        className="py-8 text-center"
        data-testid="caught-up"
      >
        <h2 className="text-foreground mt-0 mb-2 text-lg font-semibold">{t('feed.caughtUpTitle')}</h2>
        <p className="text-muted-foreground mb-0 text-sm">{t('feed.caughtUpBody')}</p>
      </div>
    )
  }
  const done = { signedIn: true, firstPost: hasOwnPost, reactTwice: made >= 2 }
```

(the rest of the component is unchanged).

(b) `app/src/pages/FeedPage.tsx`:

Imports — change line 2 to `import { useAction, useMutation, usePaginatedQuery, useQuery } from 'convex/react'` and add
after line 21:

```tsx
import { INTERACTED_TTL_MS } from '../../../convex/lib/feedHygiene'
import { captureEvent } from '@/lib/observability/analytics'
```

Constants — after `const FEED_PAGE_SIZE = 20`:

```tsx
// backlog/R21 — how many empty pages to auto-load before trusting that the feed is empty.
// ponytail: 5 auto-loads (100 posts) then the manual Load more button takes over.
const MAX_EMPTY_LOADS = 5
```

After `const react = useAction(api.interactions.reactToPost)` add:

```tsx
  const hidePost = useMutation(api.interactions.hidePost)
```

After the existing auto-load effect (the one ending `}, [virtualItems, posts.length, status])`) add:

```tsx
  // ─── backlog/R21: keep loading while pages come back empty ──────────────────
  // fetchFeedPage drops posts the viewer already handled (24 h window / Hide now), so a page can
  // come back empty while more exist. Load a few more before showing any empty state.
  const [emptyLoads, setEmptyLoads] = useState(0)
  const autoLoading = posts.length === 0 && status === 'CanLoadMore' && emptyLoads < MAX_EMPTY_LOADS
  useEffect(() => {
    if (!autoLoading) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: bound the auto-load loop
    setEmptyLoads(n => n + 1)
    loadMoreRef.current(FEED_PAGE_SIZE)
  }, [autoLoading])
  // While a page is in flight the bottom LoadingMore spinner is the only thing on screen.
  const settling = posts.length === 0 && (autoLoading || status === 'LoadingMore')
  // Only read while the feed is really empty — tells the R05 empty state and the R21 caught-up
  // state apart.
  const caughtUp = useQuery(api.feed.getCaughtUp, sessionToken && posts.length === 0 && !settling ? { sessionToken } : 'skip')
```

Replace the empty block (lines 146-156) with:

```tsx
      {posts.length === 0 &&
        !settling &&
        (filterActive ? (
          <p className="text-muted-foreground py-8 text-center">{t('feed.emptyFiltered')}</p>
        ) : (
          <EmptyFeed
            gated={gated}
            hasOwnPost={hasAnyPost}
            made={progress?.made ?? 0}
            trialStatus={progress?.status}
            caughtUp={caughtUp?.caughtUp ?? false}
          />
        ))}
```

In the `<PostCard … />` element add, after `reacting={reactingPostId === post._id}`:

```tsx
                    onHide={async () => {
                      const state = post.viewerState
                      if (!state) return
                      try {
                        await hidePost({ sessionToken: sessionToken ?? '', postId: post._id })
                        // How long after the interaction they hid it — the only number R21 wants.
                        captureEvent('post_hidden', {
                          after: Math.round((INTERACTED_TTL_MS - (state.hidesAt - Date.now())) / 3_600_000)
                        })
                      } catch (err: unknown) {
                        toast(friendlyError(err, String(err)))
                      }
                    }}
```

- [ ] **Step 9: Run the tests to verify they pass**

Run: `pnpm --filter ./app test`
Expected: PASS across the app package (PostCard, FeedPage, EmptyFeed new tests included).

- [ ] **Step 10: Lint, typecheck, Prettier, do NOT commit**

Run (from the repo root): `pnpm lint && pnpm typecheck`, then
`pnpm exec prettier --write app/src/components/PostCard.tsx app/src/components/PostCard.test.tsx app/src/pages/FeedPage.tsx app/src/pages/FeedPage.test.tsx app/src/components/EmptyFeed.tsx app/src/components/EmptyFeed.test.tsx`
(locale JSON files are not run through Prettier — keep their manual line alignment). Expected: exit 0. Do not commit.

---

### Task 7: R19 backend — invite codes, `?ref=` through OAuth, 14-day invited trial

**Files:**

- Modify: `convex/schema.ts` (users: two fields after `firstPostPromptedAt` at line 101, two indexes after
  `by_deletion_and_last_login` at line 117; `oauthStates`: one field at line 251)
- Create: `convex/lib/invite.ts`, `convex/lib/invite.test.ts`
- Modify: `convex/lib/trialMilestone.ts` (append) + `convex/lib/trialMilestone.test.ts` (append)
- Modify: `convex/lib/checkoutCopy.ts` (lines 28-43) + `convex/lib/checkoutCopy.test.ts`
- Modify: `convex/billingNode.ts` (lines 9-10, 21-23, 46, 62, 69)
- Modify: `convex/users.ts` (imports lines 1-10; `toSafeMe` line 74-82; `getMe` line 171-178; two new functions appended
  after `getTrialProgress`) + `convex/users.test.ts` (append)
- Modify: `convex/sessions.ts` (lines 109-145)
- Modify: `convex/http.ts` (lines 7-9 imports, 29-32, 87-96)
- Modify: `convex/linkedin/auth.ts` (lines 19-28, 56-71, 75-87) + `convex/linkedin/auth.test.ts` (`createMockDb` + three
  tests)

**Interfaces:**

- Consumes: `requireAuth` / `resolveSession` (`convex/lib/auth.ts`); `requireAuthAction` in `billingNode.ts` returns the
  full `Doc<'users'>` (it already reads `user.language`, `user.primaryLocale`).
- Produces:
    - Schema: `users.inviteCode?: string`, `users.referredByCode?: string`, indexes `by_invite_code` (`['inviteCode']`)
      and `by_referred_by_code` (`['referredByCode']`); `oauthStates.ref?: string`.
    - `convex/lib/invite.ts`: `INVITE_CODE_RE = /^[a-z0-9]{8}$/`; `isInviteCode(value: unknown): value is string`;
      `generateInviteCode(random?: () => number): string`; `firstName(name: string): string`.
    - `convex/lib/trialMilestone.ts`: `TRIAL_PERIOD_DAYS = 7`, `INVITED_TRIAL_PERIOD_DAYS = 14`,
      `trialDaysFor(user: { referredByCode?: string }): number`.
    - `checkoutSubmitMessage(locale, { trial: boolean; days: number })` (signature change — `days` required).
    - `toSafeMe(user)` now includes `trialDays: number`; `api.users.getMe` additionally returns `inviterName?: string`
      (first name) when the member was referred.
    - `api.users.getOrCreateInviteCode({ sessionToken })` → `string` (throws `ConvexError('INVITE_CODE_RETRY')` after
      two collisions); `api.users.getInviteSummary({ sessionToken? })` →
      `{ inviteCode: string | null; joined: number } | null` (`joined` caps at 101, the UI renders "100+").
    - `/auth/linkedin?ref=<code>` carries a shape-valid code through `oauthStates.ref` into
      `upsertUser({ …, referredByCode })`; attribution is insert-only and only when the code belongs to an existing
      member.

**DEVIATION from the spec (report it):** the spec put the Stripe `trial_period_days` constant in `billingNode.ts`; it
moves next to `TRIAL_INTERACTION_THRESHOLD` in `lib/trialMilestone.ts` so `toSafeMe`, checkout and the UI read one
value.

- [ ] **Step 1: Widen the schema**

In `convex/schema.ts`:

(a) Replace

```ts
    firstPostPromptedAt: v.optional(v.number()),
    createdAt: v.number()
  })
    .index('by_linkedin_id', ['linkedinId'])
```

with

```ts
    firstPostPromptedAt: v.optional(v.number()),
    // backlog/R19 — the member's own invite code (minted on first visit to Settings › Invite, never
    // reissued: shared links must keep working) and the code they joined through (stamped at insert
    // only, after verifying it belongs to a member — see linkedin/auth.upsertUserHandler).
    inviteCode: v.optional(v.string()),
    referredByCode: v.optional(v.string()),
    createdAt: v.number()
  })
    .index('by_linkedin_id', ['linkedinId'])
```

(b) Replace

```ts
    .index('by_deletion_and_last_login', ['deletionScheduledAt', 'lastLoginAt'])
```

with

```ts
    .index('by_deletion_and_last_login', ['deletionScheduledAt', 'lastLoginAt'])
    // backlog/R19 — inviter lookup (getMe's gift line, upsert verification) + the "N joined" count.
    .index('by_invite_code', ['inviteCode'])
    .index('by_referred_by_code', ['referredByCode'])
```

(c) In `oauthStates`, replace

```ts
    plan: v.optional(v.string()),
    interval: v.optional(v.string())
  })
    .index('by_state', ['state'])
```

with

```ts
    plan: v.optional(v.string()),
    interval: v.optional(v.string()),
    // backlog/R19 — the inviter's code from the landing's ?ref=, carried through the OAuth round-trip.
    ref: v.optional(v.string())
  })
    .index('by_state', ['state'])
```

Run: `pnpm --filter ./convex test schema.test.ts`
Expected: PASS.

- [ ] **Step 2: Write the failing pure-module tests**

Create `convex/lib/invite.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { firstName, generateInviteCode, INVITE_CODE_RE, isInviteCode } from './invite'

describe('isInviteCode', () => {
  it('accepts exactly eight lowercase alphanumerics', () => {
    expect(isInviteCode('abc12345')).toBe(true)
    expect(isInviteCode('ABC12345')).toBe(false)
    expect(isInviteCode('abc1234')).toBe(false)
    expect(isInviteCode('abc123456')).toBe(false)
    expect(isInviteCode('abc-1234')).toBe(false)
    expect(isInviteCode(undefined)).toBe(false)
    expect(isInviteCode(null)).toBe(false)
    expect(isInviteCode(12345678)).toBe(false)
  })
})

describe('generateInviteCode', () => {
  it('produces a code the validator accepts', () => {
    for (let i = 0; i < 50; i++) expect(generateInviteCode()).toMatch(INVITE_CODE_RE)
  })
  it('maps the random source onto the alphabet deterministically', () => {
    expect(generateInviteCode(() => 0)).toBe('aaaaaaaa')
    expect(generateInviteCode(() => 0.999999)).toBe('99999999')
  })
})

describe('firstName', () => {
  it('takes the first whitespace-separated token', () => {
    expect(firstName('Ana Souza')).toBe('Ana')
    expect(firstName('  Jordan   Maxwell ')).toBe('Jordan')
    expect(firstName('Cher')).toBe('Cher')
    expect(firstName('')).toBe('')
  })
})
```

Append to `convex/lib/trialMilestone.test.ts` — add `INVITED_TRIAL_PERIOD_DAYS, TRIAL_PERIOD_DAYS, trialDaysFor` to the
import list (keep it alphabetical: `trialDaysFor` after `trialEligible`; the two constants after
`TRIAL_INTERACTION_THRESHOLD`/`TRIAL_WARNING_THRESHOLD` respectively — Prettier does not sort imports, so any order
compiles), then at the end of the file:

```ts
// backlog/R19 — the invited peer's gift is a longer trial; the interaction threshold is unchanged.
describe('trialDaysFor', () => {
  it('is 7 for a plain signup and 14 for a member who joined through an invite', () => {
    expect(TRIAL_PERIOD_DAYS).toBe(7)
    expect(INVITED_TRIAL_PERIOD_DAYS).toBe(14)
    expect(trialDaysFor({})).toBe(7)
    expect(trialDaysFor({ referredByCode: undefined })).toBe(7)
    expect(trialDaysFor({ referredByCode: 'abc12345' })).toBe(14)
  })
})
```

In `convex/lib/checkoutCopy.test.ts`, every `checkoutSubmitMessage` call gains `days`: `{ trial: true }` →
`{ trial: true, days: 7 }`, `{ trial: false }` → `{ trial: false, days: 7 }`, the two loops `{ trial }` →
`{ trial, days: 7 }` (five call sites). Then add inside `describe('checkoutSubmitMessage', …)`:

```ts
  // backlog/R19 — an invited member's checkout states the 14-day trial they actually get.
  it('states the invited 14-day trial when asked', () => {
    for (const l of LOCALES) {
      const msg = checkoutSubmitMessage(l, { trial: true, days: 14 })
      expect(msg).toContain('14')
      expect(msg).toContain('50')
      expect(msg).not.toMatch(/\b7\b/)
    }
  })
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `pnpm --filter ./convex test lib/invite.test.ts lib/trialMilestone.test.ts lib/checkoutCopy.test.ts`
Expected: FAIL — `./invite` not found; `trialDaysFor` not exported; `days` unknown / 14-day message still says 7.

- [ ] **Step 4: Write the pure modules**

Create `convex/lib/invite.ts`:

```ts
// convex/lib/invite.ts
// Pure helpers for backlog/R19 (invite a peer). Only the code travels: the landing puts ?ref=<code>
// on its sign-in links, http.ts carries it through the OAuth state, and upsertUserHandler stamps
// `referredByCode` on the NEW user only. No invites table, no counters — the users table is the log.
export const INVITE_CODE_RE = /^[a-z0-9]{8}$/
const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789'

export function isInviteCode(value: unknown): value is string {
  return typeof value === 'string' && INVITE_CODE_RE.test(value)
}

/** Eight of [a-z0-9]: 36^8 ≈ 2.8e12 codes. The minting mutation retries a collision once. */
export function generateInviteCode(random: () => number = Math.random): string {
  let code = ''
  for (let i = 0; i < 8; i++) code += ALPHABET[Math.floor(random() * ALPHABET.length)]
  return code
}

/** "Ana Souza" → "Ana": the gift line names the inviter the way a friend would. */
export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? ''
}
```

Append to `convex/lib/trialMilestone.ts`:

```ts

/** Stripe trial_period_days for a plain signup — the 7-day side of "50 OR 7 days". */
export const TRIAL_PERIOD_DAYS = 7
/** backlog/R19 — a member who joined through another member's invite link starts with two weeks. */
export const INVITED_TRIAL_PERIOD_DAYS = 14

export function trialDaysFor(user: { referredByCode?: string }): number {
  return user.referredByCode ? INVITED_TRIAL_PERIOD_DAYS : TRIAL_PERIOD_DAYS
}
```

In `convex/lib/checkoutCopy.ts`, replace lines 28-32 (`const TRIAL_MESSAGE …`) and lines 40-43 (`checkoutSubmitMessage`)
with:

```ts
// `days` is the Stripe trial length actually granted (7, or 14 for an invited member — backlog/R19).
const trialMessage = (days: number): Record<BillingLocale, string> => ({
  en: `Your free trial ends as soon as you reach 50 interactions (made plus received), or after ${days} days — whichever comes first. Billing starts then. Cancel before that from Subscription and you pay nothing.`,
  pt: `Seu teste grátis termina assim que você atingir 50 interações (feitas e recebidas) ou depois de ${days} dias — o que vier primeiro. A cobrança começa nesse momento. Cancele antes disso em Assinatura e você não paga nada.`,
  es: `Tu prueba gratuita termina en cuanto alcances 50 interacciones (hechas y recibidas) o a los ${days} días, lo que ocurra primero. La facturación comienza en ese momento. Cancela antes desde Suscripción y no pagas nada.`
})
```

and

```ts
/** The line under Stripe's pay button. Stripe caps custom_text.submit.message at 1200 chars. */
export function checkoutSubmitMessage(locale: BillingLocale, opts: { trial: boolean; days: number }): string {
  return opts.trial ? trialMessage(opts.days)[locale] : NO_TRIAL_MESSAGE[locale]
}
```

(`NO_TRIAL_MESSAGE` is unchanged.)

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm --filter ./convex test lib/invite.test.ts lib/trialMilestone.test.ts lib/checkoutCopy.test.ts`
Expected: PASS.

- [ ] **Step 6: Checkout uses the member's trial length**

In `convex/billingNode.ts`:

(a) Line 9 becomes `import { findLiveSubscription, trialDaysFor, trialEligible } from './lib/trialMilestone'`.

(b) Delete line 21 (`const TRIAL_PERIOD_DAYS = 7`) and its following blank line; change the comment
`// Card-required 7-day trial checkout.` to
`// Card-required trial checkout (7 days, 14 for an invited member — lib/trialMilestone.trialDaysFor).`

(c) After `const trial = trialEligible(subscriptions.length)` add:

```ts
    const trialDays = trialDaysFor(user)
```

(d) `trial_period_days: TRIAL_PERIOD_DAYS` → `trial_period_days: trialDays`;
`checkoutSubmitMessage(billingLocale, { trial })` → `checkoutSubmitMessage(billingLocale, { trial, days: trialDays })`.

Run: `pnpm typecheck`
Expected: exit 0 (the only other `checkoutSubmitMessage` caller is the test, already updated).

- [ ] **Step 7: Write the failing users / auth tests**

(a) Append to `convex/users.test.ts`:

```ts
// backlog/R19 — the client renders "{{days}}-day trial" from this, so it must follow referredByCode.
describe('toSafeMe trial days (R19)', () => {
  it('is 7 for a plain signup and 14 for an invited member', () => {
    expect((toSafeMe(makeUser()) as Record<string, unknown>).trialDays).toBe(7)
    expect((toSafeMe(makeUser({ referredByCode: 'abc12345' })) as Record<string, unknown>).trialDays).toBe(14)
  })
})
```

(b) In `convex/linkedin/auth.test.ts`, replace `createMockDb` (lines 6-28) with a version whose index lookups dispatch
on the index name:

```ts
// Minimal in-memory mock for Convex db context. `by_linkedin_id` answers with the existing user,
// `by_invite_code` (backlog/R19) with the inviter — both optional.
function createMockDb(existingUser?: any, inviter?: any) {
  const records: any[] = existingUser ? [existingUser] : []
  const patches: any[] = []
  const inserts: any[] = []

  return {
    query: (_table: string) => ({
      withIndex: (name: string, _fn: any) => ({
        first: async () => (name === 'by_invite_code' ? (inviter ?? null) : (records[0] ?? null))
      })
    }),
    get: async (_id: string) => records.find(r => r._id === _id) ?? null,
    patch: async (id: string, data: any) => {
      patches.push({ id, data })
    },
    insert: async (_table: string, data: any) => {
      inserts.push(data)
      return 'new-user-id'
    },
    _patches: patches,
    _inserts: inserts
  }
}
```

and add inside `describe('upsertUserHandler', …)` after the last test:

```ts
  // backlog/R19 — attribution is insert-only and only for a code that belongs to a member.
  it('stamps referredByCode on a new user when the code belongs to a member', async () => {
    const db = createMockDb(undefined, { _id: 'inviter-id', inviteCode: 'abc12345' })
    await upsertUserHandler(db, { ...BASE_ARGS, referredByCode: 'abc12345' })
    expect(db._inserts[0].referredByCode).toBe('abc12345')
  })

  it('drops a code that matches no member', async () => {
    const db = createMockDb()
    await upsertUserHandler(db, { ...BASE_ARGS, referredByCode: 'abc12345' })
    expect(db._inserts[0].referredByCode).toBeUndefined()
  })

  it('never attributes an existing member on a later login', async () => {
    const existing = { _id: 'existing-id', linkedinId: 'li-123' }
    const db = createMockDb(existing, { _id: 'inviter-id', inviteCode: 'abc12345' })
    await upsertUserHandler(db, { ...BASE_ARGS, referredByCode: 'abc12345' })
    expect(db._inserts).toHaveLength(0)
    expect(db._patches[0].data).not.toHaveProperty('referredByCode')
  })
```

- [ ] **Step 8: Run the tests to verify they fail**

Run: `pnpm --filter ./convex test users.test.ts linkedin/auth.test.ts`
Expected: FAIL — `trialDays` undefined; `referredByCode` not stamped (and TypeScript rejects it on `UpsertUserArgs`).

- [ ] **Step 9: Attribution, safe payload, invite code functions, OAuth plumbing**

(a) `convex/linkedin/auth.ts`:

In `UpsertUserArgs`, after `email?: string` add:

```ts
  /** backlog/R19 — the inviter's code from ?ref=; honoured on insert only, after verification. */
  referredByCode?: string
```

Replace the insert (from `return await db.insert('users', {` to its closing `})`) with:

```ts
  // backlog/R19 — attribution is insert-only: an existing member who opens a friend's link is not
  // "invited", and a code that matches no member (typo, deleted inviter) is dropped, never stored.
  let referredByCode: string | undefined
  if (args.referredByCode) {
    const inviter = await db
      .query('users')
      .withIndex('by_invite_code', q => q.eq('inviteCode', args.referredByCode))
      .first()
    if (inviter) referredByCode = args.referredByCode
  }

  return await db.insert('users', {
    // SECURITY: isAdmin is intentionally excluded — only settable via direct DB edit
    linkedinId: args.linkedinId,
    name: args.name,
    headline: args.headline,
    profilePictureUrl: args.profilePictureUrl,
    tier: 'starter' as const,
    subscriptionStatus: 'none' as const,
    linkedinAccessToken: args.accessToken,
    linkedinRefreshToken: args.refreshToken,
    tokenExpiresAt: args.tokenExpiresAt,
    email: args.email,
    referredByCode,
    lastLoginAt: Date.now(),
    acknowledgedPolicyVersion: POLICY_VERSION,
    createdAt: Date.now()
  })
```

In the `upsertUser` validators, after `email: v.optional(v.string())` add `referredByCode: v.optional(v.string())` (with
the comma on the `email` line).

(b) `convex/users.ts`:

Imports — line 10 becomes
`import { isNearThreshold, TRIAL_INTERACTION_THRESHOLD, trialDaysFor } from './lib/trialMilestone'` and add after it:

```ts
import { firstName, generateInviteCode } from './lib/invite'
```

`toSafeMe` — replace its last line `return isAdmin ? { ...safeUser, isAdmin: true as const } : safeUser` with:

```ts
  // backlog/R19 — the trial the member would get at checkout (7, or 14 when invited); the gate
  // screens and Billing render "{{days}}-day trial" from it instead of a hard-coded 7.
  const trialDays = trialDaysFor(user)
  return isAdmin ? { ...safeUser, trialDays, isAdmin: true as const } : { ...safeUser, trialDays }
```

`getMe` — replace its handler body with:

```ts
  handler: async (ctx, { sessionToken }) => {
    const user = await resolveSession(ctx, sessionToken)
    if (!user) return null
    // backlog/R19 — Billing's gift line names who invited them. One indexed point read, only for a
    // referred member; only the inviter's first name crosses to the client. Always the same shape,
    // so `me?.inviterName` types cleanly on the client.
    const code = user.referredByCode
    const inviter = code
      ? await ctx.db
          .query('users')
          .withIndex('by_invite_code', q => q.eq('inviteCode', code))
          .first()
      : null
    return { ...toSafeMe(user), inviterName: inviter ? firstName(inviter.name) : undefined }
  }
```

Append after `getTrialProgress` (before the `// Public: returns subscription info for billing page display.` comment):

```ts
// backlog/R19 — mints the member's invite code on their first visit to Settings › Invite. Codes are
// never reissued: links people already shared must keep working. Idempotent after the first call.
export const getOrCreateInviteCode = mutation({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    const user = await requireAuth(ctx, sessionToken)
    if (user.inviteCode) return user.inviteCode
    // 36^8 codes — a collision is a one-in-billions event. One retry, then surface it.
    for (let attempt = 0; attempt < 2; attempt++) {
      const code = generateInviteCode()
      const taken = await ctx.db
        .query('users')
        .withIndex('by_invite_code', q => q.eq('inviteCode', code))
        .first()
      if (taken) continue
      await ctx.db.patch(user._id, { inviteCode: code })
      return code
    }
    throw new ConvexError('INVITE_CODE_RETRY')
  }
})

// backlog/R19 — Settings › Invite: the code (null until minted) and how many members joined through
// it. Bounded: the count stops at 101 and the UI shows "100+".
export const getInviteSummary = query({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, { sessionToken }) => {
    const user = await resolveSession(ctx, sessionToken)
    if (!user) return null
    const code = user.inviteCode
    if (!code) return { inviteCode: null, joined: 0 }
    const rows = await ctx.db
      .query('users')
      .withIndex('by_referred_by_code', q => q.eq('referredByCode', code))
      .take(101)
    return { inviteCode: code, joined: rows.length }
  }
})
```

(c) `convex/sessions.ts` — `createOAuthState` becomes:

```ts
export const createOAuthState = internalMutation({
  args: {
    state: v.string(),
    plan: v.optional(v.string()),
    interval: v.optional(v.string()),
    ref: v.optional(v.string())
  },
  handler: async (ctx, { state, plan, interval, ref }) => {
    await ctx.db.insert('oauthStates', {
      state,
      expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
      plan,
      interval,
      ref
    })
  }
})
```

and in `validateAndConsumeOAuthState`, replace

```ts
    const plan = record.plan
    const interval = record.interval
    await ctx.db.delete(record._id)

    if (record.expiresAt < Date.now()) return { valid: false }
    return { valid: true, plan, interval }
```

with

```ts
    const plan = record.plan
    const interval = record.interval
    const ref = record.ref
    await ctx.db.delete(record._id)

    if (record.expiresAt < Date.now()) return { valid: false }
    return { valid: true, plan, interval, ref }
```

(update its doc comment to `Returns { valid: true, plan?, interval?, ref? } on success…`).

(d) `convex/http.ts`:

Add after line 9 (`scrubError` import):

```ts
import { isInviteCode } from './lib/invite'
```

After `const interval = …` (line 29) add:

```ts
    // backlog/R19 — the inviter's code from the landing's ?ref=. Shape-checked here; whether it
    // belongs to a member is checked at upsert, where an unknown code is dropped.
    const rawRef = reqUrl.searchParams.get('ref')
    const ref = isInviteCode(rawRef) ? rawRef : undefined
```

Line 32 becomes `await ctx.runMutation(internal.sessions.createOAuthState, { state, plan, interval, ref })`.

In the `upsertUser` call, after `email: userInfo.email` add `referredByCode: oauthState.ref` (comma on the `email`
line).

- [ ] **Step 10: Run the tests to verify they pass**

Run: `pnpm typecheck && pnpm --filter ./convex test`
Expected: exit 0, everything green (schema, invite, trialMilestone, checkoutCopy, users, linkedin/auth, and the
untouched suites).

- [ ] **Step 11: Lint, Prettier, do NOT commit**

Run (from the repo root): `pnpm lint`, then
`pnpm exec prettier --write convex/schema.ts convex/lib/invite.ts convex/lib/invite.test.ts convex/lib/trialMilestone.ts convex/lib/trialMilestone.test.ts convex/lib/checkoutCopy.ts convex/lib/checkoutCopy.test.ts convex/billingNode.ts convex/users.ts convex/users.test.ts convex/sessions.ts convex/http.ts convex/linkedin/auth.ts convex/linkedin/auth.test.ts`
Expected: exit 0. Do not commit.

### Task 8: R19 UI — invite section, gift line, `{{days}}` trial copy, invite links

> **UI skills:** before touching any `.tsx` in this task, load `responsive-design`, `frontend-design:frontend-design`,
> `web-design-guidelines`, and `ui-ux-pro-max` via the Skill tool and apply them (touch targets ≥ 44 px on mobile, no
> layout shift, tokens only — `text-foreground` / `text-muted-foreground` / `border-border` / `bg-card` /
> `text-primary`,
> never raw palette classes; sentence case; dark mode via tokens). Match the section pattern already in
> `SettingsPage.tsx`.

**Files:**

- Modify: `app/src/i18n/locales/en.json`, `app/src/i18n/locales/pt.json`, `app/src/i18n/locales/es.json` (line-aligned —
  every insertion happens at the same key in all three)
- Modify: `app/src/pages/SettingsPage.tsx` (imports lines 1-14; hooks after line 83; tail after the
  `{isPro && (…feedFilter…)}` section)
- Modify: `app/src/pages/BillingPage.tsx` (import line 7; after line 60; trial banner ~393-418; `!hasCard` block ~
  428-437; plan button ~526-534)
- Modify: `app/src/components/CardGateDialog.tsx`, `app/src/components/CardGateBanner.tsx`,
  `app/src/components/UpgradeAtLimit.tsx`
- Modify: `app/src/pages/RecapPage.tsx` (imports; footer ~241-262)
- Modify: `app/src/components/EmptyFeed.tsx` (caught-up branch from Task 6)
- Test: `app/src/pages/SettingsPage.test.tsx`, `app/src/pages/BillingPage.test.tsx`,
  `app/src/components/CardGateDialog.test.tsx`, `app/src/pages/RecapPage.test.tsx`,
  `app/src/components/EmptyFeed.test.tsx`

**Interfaces:**

- Consumes (Task 7): `api.users.getMe` now returns `{ …safeUser, trialDays: number, inviterName?: string }`;
  `api.users.getInviteSummary({ sessionToken })` → `{ inviteCode: string | null, joined: number }`;
  `api.users.getOrCreateInviteCode({ sessionToken })` → `string`; `TRIAL_PERIOD_DAYS = 7` and
  `INVITED_TRIAL_PERIOD_DAYS = 14` from `convex/lib/trialMilestone.ts`.
- Consumes (Task 6): the `caughtUp` branch of `EmptyFeed` (`data-testid="caught-up"`); `feed.caughtUpBody` is the last
  of the seven R21 keys.
- Consumes (existing): `useCardGate()` → `{ gated, isTrialing, status, isAdmin, me }`; `LANDING_URL` from
  `app/src/lib/session.ts`; `toast(message)` from `@/components/ui/toast`; `captureEvent(name, props?)`;
  `friendlyError(err, fallback)`.
- Produces: PostHog event `invite_copied` (no props); the `#invite` anchor on `/settings` that Task 9's docs and the
  recap/caught-up links point at; the `?ref=<code>` URL shape `${LANDING_URL}/${lang}?ref=${code}` that Task 9's
  `RefCarrier` consumes.

**Why the copy changes:** an invited member's trial is 14 days, so every string that hard-codes "7 days" would lie to
them. The six trial strings become `{{days}}` interpolations fed from `me.trialDays` (fallback `TRIAL_PERIOD_DAYS` while
`me` loads). Strings that say "7 days" for other reasons (`feed.weeklyUsageHint`, `privacy.exportNote`, `recap.7d`) stay
untouched.

- [ ] **Step 1: Replace the six hard-coded trial strings with `{{days}}` (all three locales)**

Edit by key, not by line (Task 6 shifted the line numbers). Each replacement keeps its position in the file.

`en.json`:

| key                         | new value                                                                                                                          |
|-----------------------------|------------------------------------------------------------------------------------------------------------------------------------|
| `feed.cardGateCta`          | `"Start {{days}}-day trial"`                                                                                                       |
| `feed.cardGateCost`         | `"Free for {{days}} days or {{threshold}} interactions, then your plan starts. Cancel anytime."`                                   |
| `billing.trialBannerNoDate` | `"You're on a free {{plan}} trial. Your plan starts at {{threshold}} interactions or after {{days}} days, whichever comes first."` |
| `billing.newUserTrialNote`  | `"Every plan starts with a free {{days}}-day trial · cancel anytime."`                                                             |
| `billing.startTrialCta`     | `"Start {{days}}-day {{plan}} trial"`                                                                                              |
| `billing.chosenPlanLead`    | `"You picked {{plan}} on the site. Its {{days}}-day trial starts below."`                                                          |

`pt.json`:

| key                         | new value                                                                                                                                           |
|-----------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------|
| `feed.cardGateCta`          | `"Iniciar teste de {{days}} dias"`                                                                                                                  |
| `feed.cardGateCost`         | `"Grátis por {{days}} dias ou {{threshold}} interações, depois seu plano começa. Cancele quando quiser."`                                           |
| `billing.trialBannerNoDate` | `"Você está em um teste grátis do {{plan}}. Seu plano começa ao atingir {{threshold}} interações ou depois de {{days}} dias, o que vier primeiro."` |
| `billing.newUserTrialNote`  | `"Todos os planos começam com um teste gratuito de {{days}} dias · cancele quando quiser."`                                                         |
| `billing.startTrialCta`     | `"Iniciar teste de {{days}} dias do {{plan}}"`                                                                                                      |
| `billing.chosenPlanLead`    | `"Você escolheu o {{plan}} no site. O teste de {{days}} dias começa abaixo."`                                                                       |

`es.json`:

| key                         | new value                                                                                                                                                |
|-----------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------|
| `feed.cardGateCta`          | `"Iniciar prueba de {{days}} días"`                                                                                                                      |
| `feed.cardGateCost`         | `"Gratis por {{days}} días o {{threshold}} interacciones, después empieza tu plan. Cancela cuando quieras."`                                             |
| `billing.trialBannerNoDate` | `"Estás en una prueba gratuita de {{plan}}. Tu plan empieza al llegar a {{threshold}} interacciones o después de {{days}} días, lo que ocurra primero."` |
| `billing.newUserTrialNote`  | `"Todos los planes incluyen una prueba gratuita de {{days}} días · cancela cuando quieras."`                                                             |
| `billing.startTrialCta`     | `"Iniciar prueba de {{days}} días de {{plan}}"`                                                                                                          |
| `billing.chosenPlanLead`    | `"Elegiste {{plan}} en el sitio. Su prueba de {{days}} días empieza abajo."`                                                                             |

- [ ] **Step 2: Add the twelve new keys (all three locales, same positions)**

(a) `feed.inviteLink` — insert directly after `"caughtUpBody": …,` (the last R21 key), before `"checklist": {`:

```json
    "inviteLink": "Invite a peer",
```

pt: `"inviteLink": "Convidar um colega",` · es: `"inviteLink": "Invitar a un colega",`

(b) `settings.*` — `"commentLanguage"` is currently the LAST key of `settings` (no trailing comma). Add a comma to that
line, then insert nine keys after it (en):

```json
    "commentLanguage": "Default comment language",
    "inviteTitle": "Invite a peer",
    "inviteBody": "Anyone who joins through your link starts with a {{days}}-day free trial instead of {{base}}. Share it with someone who needs the right people to find them.",
    "inviteLinkLabel": "Your invite link",
    "inviteCopy": "Copy link",
    "inviteCopied": "Link copied",
    "inviteJoined_one": "{{count}} member joined through your link",
    "inviteJoined_other": "{{count}} members joined through your link",
    "inviteJoinedMany": "100+ members joined through your link",
    "inviteNone": "No one has joined through it yet."
```

pt:

```json
    "commentLanguage": "Idioma padrão do comentário",
    "inviteTitle": "Convidar um colega",
    "inviteBody": "Quem entrar pelo seu link começa com um teste grátis de {{days}} dias em vez de {{base}}. Compartilhe com alguém que precisa que as pessoas certas o encontrem.",
    "inviteLinkLabel": "Seu link de convite",
    "inviteCopy": "Copiar link",
    "inviteCopied": "Link copiado",
    "inviteJoined_one": "{{count}} membro entrou pelo seu link",
    "inviteJoined_other": "{{count}} membros entraram pelo seu link",
    "inviteJoinedMany": "Mais de 100 membros entraram pelo seu link",
    "inviteNone": "Ninguém entrou por ele ainda."
```

es:

```json
    "commentLanguage": "Idioma predeterminado del comentario",
    "inviteTitle": "Invitar a un colega",
    "inviteBody": "Quien se una con tu enlace empieza con una prueba gratuita de {{days}} días en lugar de {{base}}. Compártelo con alguien que necesite que las personas correctas lo encuentren.",
    "inviteLinkLabel": "Tu enlace de invitación",
    "inviteCopy": "Copiar enlace",
    "inviteCopied": "Enlace copiado",
    "inviteJoined_one": "{{count}} miembro se unió con tu enlace",
    "inviteJoined_other": "{{count}} miembros se unieron con tu enlace",
    "inviteJoinedMany": "Más de 100 miembros se unieron con tu enlace",
    "inviteNone": "Nadie se ha unido con él todavía."
```

(c) `billing.giftFrom` — insert directly after the `"chosenPlanLead"` line:

```json
    "giftFrom": "{{name}} invited you, so your trial runs {{days}} days instead of {{base}}.",
```

pt: `"giftFrom": "{{name}} convidou você, então seu teste dura {{days}} dias em vez de {{base}}.",` · es:
`"giftFrom": "{{name}} te invitó, así que tu prueba dura {{days}} días en lugar de {{base}}.",`

(d) `recap.inviteLine` — `"seeAll"` is the LAST key of `recap` (no trailing comma). Add a comma to it and insert after:

```json
    "inviteLine": "People are finding you. Invite a peer who needs that too: they start with a {{days}}-day trial."
```

pt:
`"inviteLine": "As pessoas estão encontrando você. Convide um colega que também precisa disso: ele começa com um teste de {{days}} dias."` ·
es:
`"inviteLine": "La gente te está encontrando. Invita a un colega que también lo necesite: empieza con una prueba de {{days}} días."`

Check parity right away:

Run: `pnpm --filter ./app test i18n.test.ts`
Expected: PASS (all three files still parse and load).

- [ ] **Step 3: Write the failing tests**

`app/src/components/CardGateDialog.test.tsx` — widen `mockMe` and add one test at the end of the existing describe:

```tsx
let mockMe: { subscriptionStatus: string; trialDays?: number }
```

```tsx
  // backlog/R19 — an invited member's gate names the trial they actually get (14 days), not the default.
  it('names the invited 14-day trial when the member joined through an invite', () => {
    mockMe = { subscriptionStatus: 'none', trialDays: 14 }
    renderDialog('?plan=pro')
    expect(screen.getByRole('link', { name: /start 14-day trial/i })).toBeInTheDocument()
    expect(
      screen.getByText(new RegExp(`free for 14 days or ${TRIAL_INTERACTION_THRESHOLD} interactions`, 'i')),
    ).toBeInTheDocument()
  })
```

(The existing test that asserts `/start 7-day trial/i` keeps passing: `mockMe` has no `trialDays`, so the component
falls back to `TRIAL_PERIOD_DAYS`.)

`app/src/pages/BillingPage.test.tsx` — the `t` mock echoes options as JSON (`key:{"a":1}`), so assert on that shape. Add
a new describe at the end of the file:

```tsx
describe('BillingPage invited member (R19)', () => {
  it('renders the gift line and 14-day copy for a member who joined through an invite', () => {
    setUser({ trialDays: 14, inviterName: 'Ana' })
    renderPage()
    expect(screen.getByText(/billing\.giftFrom:.*"name":"Ana".*"days":14/)).toBeInTheDocument()
    expect(screen.getByText(/billing\.newUserTrialNote:\{"days":14\}/)).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /billing\.startTrialCta:.*"days":14/ }).length).toBeGreaterThan(0)
  })

  it('says 7 days and shows no gift line for a plain signup', () => {
    renderPage()
    expect(screen.queryByText(/billing\.giftFrom/)).not.toBeInTheDocument()
    expect(screen.getByText(/billing\.newUserTrialNote:\{"days":7\}/)).toBeInTheDocument()
  })
})
```

`app/src/pages/SettingsPage.test.tsx` — add the query dispatch, mock the clipboard + analytics, and add a describe. In
the `useQuery` mock's dispatch add, before the `return undefined` fallback:

```ts
      if (name === 'users:getInviteSummary') return { inviteCode: 'abc12345', joined: 2 }
```

Add next to the other `vi.mock` calls:

```ts
vi.mock('@/lib/observability/analytics', () => ({ captureEvent: vi.fn() }))
```

and the imports `import { captureEvent } from '@/lib/observability/analytics'` and
`import { LANDING_URL } from '../lib/session'`. Then:

```tsx
describe('SettingsPage invite (R19)', () => {
  it('shows the invite link built from the landing URL and the joined count', () => {
    renderPage()
    expect(screen.getByLabelText('settings.inviteLinkLabel')).toHaveValue(`${LANDING_URL}/en?ref=abc12345`)
    expect(screen.getByText('settings.inviteJoined')).toBeInTheDocument()
  })

  it('copies the link and records the event', async () => {
    const writeText = vi.fn(async () => {})
    Object.assign(navigator, { clipboard: { writeText } })
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'settings.inviteCopy' }))
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(`${LANDING_URL}/en?ref=abc12345`))
    expect(captureEvent).toHaveBeenCalledWith('invite_copied')
  })
})
```

(Import `fireEvent` and `waitFor` from `@testing-library/react` if the file does not already.)

`app/src/pages/RecapPage.test.tsx` — real i18n, real router. Add:

```tsx
describe('RecapPage invite line (R19)', () => {
  it('links to Settings › Invite when the member received interactions', () => {
    renderPage()
    expect(screen.getByRole('link', { name: /invite a peer/i })).toHaveAttribute('href', '/settings#invite')
  })

  it('stays quiet when nobody interacted with them yet', () => {
    mockQueryReturns['interactions.getRecap'] = EMPTY
    renderPage()
    expect(screen.queryByRole('link', { name: /invite a peer/i })).not.toBeInTheDocument()
  })
})
```

`app/src/components/EmptyFeed.test.tsx` — extend the two relevant tests from Task 6. In the caught-up test add:

```tsx
    expect(screen.getByRole('link', { name: /invite a peer/i })).toHaveAttribute('href', '/settings#invite')
```

and in the existing R05 empty-state test ("offers one action that focuses the composer" or equivalent) add:

```tsx
    expect(screen.queryByRole('link', { name: /invite a peer/i })).not.toBeInTheDocument()
```

- [ ] **Step 4: Run the tests to verify they fail**

Run: `pnpm --filter ./app test CardGateDialog BillingPage SettingsPage RecapPage EmptyFeed`
Expected: FAIL — `start 14-day trial` not found; `billing.giftFrom` not found; `settings.inviteLinkLabel` label not
found; `invite a peer` link not found.

- [ ] **Step 5: Feed `days` into the card-gate surfaces**

`app/src/components/CardGateDialog.tsx`:

```tsx
import { TRIAL_INTERACTION_THRESHOLD, TRIAL_PERIOD_DAYS } from '../../../convex/lib/trialMilestone'
```

(same module the existing `TRIAL_INTERACTION_THRESHOLD` import comes from — extend that line rather than adding a second
import.)

```tsx
  const { status, me } = useCardGate()
  // backlog/R19 — an invited member has a 14-day trial; say so. Fallback while `me` loads.
  const days = me?.trialDays ?? TRIAL_PERIOD_DAYS
```

CTA text: `{pastDue ? t('feed.cardGatePastDueCta') : t('feed.cardGateCta', { days })}`
Cost line: `{t('feed.cardGateCost', { threshold: TRIAL_INTERACTION_THRESHOLD, days })}`

`app/src/components/CardGateBanner.tsx`: same three changes (`const { status, me } = useCardGate()`, `days`, CTA
`t('feed.cardGateCta', { days })`); import `TRIAL_PERIOD_DAYS` from `'../../../convex/lib/trialMilestone'`.

`app/src/components/UpgradeAtLimit.tsx`: it already has its own `me` (line 33, non-null inside the gated branch). Import
`TRIAL_PERIOD_DAYS` from `'../../../convex/lib/trialMilestone'` and change the gated CTA (line 57) to:

```tsx
{pastDue ? t('feed.cardGatePastDueCta') : t('feed.cardGateCta', { days: me.trialDays ?? TRIAL_PERIOD_DAYS })}
```

(`UpgradeAtLimit.test.tsx:95` asserts `/start 7-day trial/i` with a `me` fixture that has no `trialDays` — the fallback
keeps it green.)

- [ ] **Step 6: BillingPage — `trialDays` everywhere, gift line**

Import (line 7): `import { TRIAL_INTERACTION_THRESHOLD, TRIAL_PERIOD_DAYS } from '../../../convex/lib/trialMilestone'`.

After `const progress = …` (line 60):

```tsx
  // backlog/R19 — invited members get 14 days; every "7-day" string reads this instead.
  const trialDays = me?.trialDays ?? TRIAL_PERIOD_DAYS
```

Trial banner (the `t(trialEndsAt ? 'billing.trialBanner' : 'billing.trialBannerNoDate', {...})` call): add
`days: trialDays` to the options object (harmless for `trialBanner`, required for `trialBannerNoDate`).

`!hasCard` block becomes:

```tsx
            {!hasCard && (
              <div className="mb-4">
                <p className="text-foreground text-base font-semibold">
                  {chosenPlan
                    ? t('billing.chosenPlanLead', {
                        plan: t(`billing.plans.${targetPlan}.name`),
                        days: trialDays,
                      })
                    : t('billing.newUserLead')}
                </p>
                <p className="text-muted-foreground mt-1 text-[13px]">
                  {t('billing.newUserTrialNote', { days: trialDays })}
                </p>
                {me?.inviterName && (
                  <p className="text-muted-foreground mt-1 text-[13px]">
                    {t('billing.giftFrom', { name: me.inviterName, days: trialDays, base: TRIAL_PERIOD_DAYS })}
                  </p>
                )}
              </div>
            )}
```

Plan button label: `t('billing.startTrialCta', { plan: t(`billing.plans.${planId}.name`), days: trialDays })`.

- [ ] **Step 7: SettingsPage — the invite section**

Imports (extend the existing lines; add only what is missing):

```tsx
import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { toast } from '@/components/ui/toast'
import { captureEvent } from '@/lib/observability/analytics'
import { LANDING_URL } from '../lib/session'
import { INVITED_TRIAL_PERIOD_DAYS, TRIAL_PERIOD_DAYS } from '../../../convex/lib/trialMilestone'
```

After the existing mutations (line ~83):

```tsx
  // backlog/R19 — one invite link per member. The code is minted lazily on the first visit here;
  // the ref makes StrictMode's double effect (and a slow query round-trip) a single mint.
  const inviteSummary = useQuery(api.users.getInviteSummary, sessionToken ? { sessionToken } : 'skip')
  const getOrCreateInviteCode = useMutation(api.users.getOrCreateInviteCode)
  const mintedRef = useRef(false)
  useEffect(() => {
    if (!sessionToken || !inviteSummary || inviteSummary.inviteCode || mintedRef.current) return
    mintedRef.current = true
    void (async () => {
      try {
        await getOrCreateInviteCode({ sessionToken })
      } catch {
        mintedRef.current = false
      }
    })()
  }, [sessionToken, inviteSummary, getOrCreateInviteCode])

  const { hash } = useLocation()
  useEffect(() => {
    if (hash === '#invite') document.getElementById('invite')?.scrollIntoView({ block: 'start' })
  }, [hash, me])

  const inviteCode = inviteSummary?.inviteCode ?? null
  const inviteLink = inviteCode ? `${LANDING_URL}/${i18n.language.slice(0, 2)}?ref=${inviteCode}` : null
  const joined = inviteSummary?.joined ?? 0
  const joinedLine =
    joined === 0
      ? t('settings.inviteNone')
      : joined > 100
        ? t('settings.inviteJoinedMany')
        : t('settings.inviteJoined', { count: joined })

  async function copyInvite() {
    if (!inviteLink) return
    try {
      await navigator.clipboard.writeText(inviteLink)
      toast(t('settings.inviteCopied'))
      captureEvent('invite_copied')
    } catch (err) {
      toast(friendlyError(err, String(err)))
    }
  }
```

(`me` in the scroll effect's deps is deliberate: the section only exists once the page has rendered past its loading
spinner, so the effect re-runs when `me` arrives. If lint flags `me` as unnecessary, keep `[hash, inviteSummary]`
instead — same effect.)

Section JSX — append after the `{isPro && (…feedFilter…)}` block, inside the same wrapper `<div>`:

```tsx
      {/* backlog/R19 — invite a peer: one link, one gift (a 14-day trial for them). Deep-linked as
          /settings#invite from the recap page and the caught-up feed state. */}
      <section id="invite" className="border-border bg-card rounded-xl border p-5">
        <h2 className="text-foreground mt-0 mb-2 text-base font-semibold">{t('settings.inviteTitle')}</h2>
        <p className="text-muted-foreground mb-3 text-sm">
          {t('settings.inviteBody', { days: INVITED_TRIAL_PERIOD_DAYS, base: TRIAL_PERIOD_DAYS })}
        </p>
        {inviteLink && (
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              readOnly
              value={inviteLink}
              aria-label={t('settings.inviteLinkLabel')}
              onFocus={e => e.currentTarget.select()}
              className="font-mono text-xs"
            />
            <Button type="button" onClick={() => void copyInvite()} className="min-h-11 sm:min-h-0">
              {t('settings.inviteCopy')}
            </Button>
          </div>
        )}
        <p className="text-muted-foreground mt-3 mb-0 text-xs">{joinedLine}</p>
      </section>
```

- [ ] **Step 8: RecapPage — invite line in the footer**

Import: `import { INVITED_TRIAL_PERIOD_DAYS } from '../../../convex/lib/trialMilestone'`. `Link` is already imported
(line 4).

Inside the `<footer …>` (after the `recap.seeAll` paragraph; `recap` is already narrowed non-null in this branch):

```tsx
          {/* backlog/R19 — only when people are finding them: an ask made from strength, not need. */}
          {recap.received.current.total > 0 && (
            <p className="m-0">
              {t('recap.inviteLine', { days: INVITED_TRIAL_PERIOD_DAYS })}{' '}
              <Link to="/settings#invite" className="text-primary hover:underline">
                {t('feed.inviteLink')}
              </Link>
            </p>
          )}
```

- [ ] **Step 9: EmptyFeed — invite link in the caught-up branch only**

Import `Link` from `'react-router-dom'` (the R05 branch keeps its single composer action — no invite link there). In the
`caughtUp && !gated` branch after the body `<p>`:

```tsx
        <p className="text-muted-foreground mt-3 mb-0 text-sm">
          <Link to="/settings#invite" className="text-primary hover:underline">
            {t('feed.inviteLink')}
          </Link>
        </p>
```

- [ ] **Step 10: Run the tests to verify they pass**

Run: `pnpm --filter ./app test`
Expected: PASS — all app tests, including the seven new ones and the untouched `UpgradeAtLimit` 7-day assertion.

- [ ] **Step 11: Typecheck + lint + Prettier on touched files**

Run: `pnpm typecheck && pnpm lint`
Expected: exit 0. If `react-hooks/exhaustive-deps` complains about the scroll effect, switch its deps to
`[hash, inviteSummary]`.

Run:
`pnpm exec prettier --write app/src/pages/SettingsPage.tsx app/src/pages/BillingPage.tsx app/src/components/CardGateDialog.tsx app/src/components/CardGateBanner.tsx app/src/components/UpgradeAtLimit.tsx app/src/pages/RecapPage.tsx app/src/components/EmptyFeed.tsx app/src/pages/SettingsPage.test.tsx app/src/pages/BillingPage.test.tsx app/src/components/CardGateDialog.test.tsx app/src/pages/RecapPage.test.tsx app/src/components/EmptyFeed.test.tsx app/src/i18n/locales/en.json app/src/i18n/locales/pt.json app/src/i18n/locales/es.json`

Then `pnpm format:check` → exit 0. **Never** `pnpm format`.

- [ ] **Step 12: Do NOT commit**

Leave everything as uncommitted working-tree changes. Henriko commits.

---

### Task 9: R19 landing — `RefCarrier` and the Terms 14-day clause

**Files:**

- Create: `landing/components/RefCarrier.tsx`
- Modify: `landing/app/[lang]/layout.tsx` (import after line 6; mount after `<CookieNotice … />`, line 74-77)
- Modify: `landing/app/[lang]/terms/content/en.tsx` (the "Free trial." paragraph, lines 87-95)
- Modify: `landing/app/[lang]/terms/content/pt.tsx` (the "Teste grátis." paragraph, lines 89-98)
- Modify: `landing/app/[lang]/terms/content/es.tsx` (the "Prueba gratuita." paragraph, lines 87-96)

**Interfaces:**

- Consumes: the `?ref=<code>` link shape from Task 8 (`${LANDING_URL}/${lang}?ref=${code}`); the `ref` query parameter
  that `convex/http.ts` reads on `/auth/linkedin` (Task 7, validated there with `isInviteCode`); `SIGN_IN_URL`
  (`landing/lib/links.ts`) = `${NEXT_PUBLIC_CONVEX_SITE}/auth/linkedin` — the only hrefs on the site that contain
  `/auth/linkedin`.
- Produces: nothing importable. A no-render client component and three legal paragraphs.

**Facts the implementer needs (verified 2026-09-07):**

- `landing/middleware.ts` clones `request.nextUrl` and only rewrites `pathname` on the locale redirect, so
  `/?ref=abc12345` → `/en?ref=abc12345` keeps the query. No middleware change.
- The landing is a static export; `useSearchParams` would force a Suspense boundary, so `RefCarrier` reads
  `window.location.search` directly. `usePathname` (already used by `LanguageSelector.tsx`) is safe and re-runs the
  effect after client-side navigation, when the new page's anchors are in the DOM.
- The landing has no test runner. Verification is `next lint` + `next build` (the build typechecks).
- `next lint` enforces `react/no-unescaped-entities` — write `member&apos;s`, never a bare `'` in JSX text.
- The code regex is duplicated from `convex/lib/invite.ts` on purpose: the landing bundle must not import from
  `convex/`.

- [ ] **Step 1: Create `landing/components/RefCarrier.tsx`**

```tsx
'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

// backlog/R19 — carries a member's invite code from the landing URL (`?ref=<code>`) into the LinkedIn
// OAuth start, so the app can attribute the new account (convex/http.ts reads `ref`, convex/linkedin/auth.ts
// stamps `referredByCode` on insert only). Renders nothing.
//
// Same shape rule as convex/lib/invite.ts INVITE_CODE_RE, duplicated on purpose: the landing bundle must not
// import from convex/. Keep the two in sync.
const INVITE_CODE_RE = /^[a-z0-9]{8}$/
const KEY = 'ref'

function readRef(): string | null {
  try {
    const fromUrl = new URLSearchParams(window.location.search).get(KEY)
    if (fromUrl && INVITE_CODE_RE.test(fromUrl)) {
      sessionStorage.setItem(KEY, fromUrl)
      return fromUrl
    }
    // A language switch or an in-site link drops the query; the stored code survives the tab.
    const stored = sessionStorage.getItem(KEY)
    return stored && INVITE_CODE_RE.test(stored) ? stored : null
  } catch {
    return null
  }
}

export default function RefCarrier() {
  const pathname = usePathname()
  useEffect(() => {
    const ref = readRef()
    if (!ref) return
    // Every CTA that starts OAuth (lib/links.ts SIGN_IN_URL). `plan`/`interval` on the plan buttons are kept;
    // when NEXT_PUBLIC_CONVEX_SITE is unset the CTAs point at the app root and this matches nothing.
    document.querySelectorAll<HTMLAnchorElement>('a[href*="/auth/linkedin"]').forEach(a => {
      try {
        const url = new URL(a.href)
        url.searchParams.set(KEY, ref)
        a.href = url.toString()
      } catch {
        /* a malformed href stays as it was */
      }
    })
  }, [pathname])
  return null
}
```

- [ ] **Step 2: Mount it in the locale layout**

`landing/app/[lang]/layout.tsx` — add after line 6:

```tsx
import RefCarrier from '@/components/RefCarrier'
```

and change the body to:

```tsx
      <body className="bg-ink font-body text-cream antialiased">
        {children}
        <CookieNotice
          dict={dict.cookieNotice}
          lang={lang}
        />
        <RefCarrier />
      </body>
```

- [ ] **Step 3: Terms — the trial clause names the invited length**

`en.tsx` lines 87-95 become:

```tsx
        <p>
          <strong className="text-cream">Free trial.</strong> New accounts start with a{' '}
          <strong className="text-cream">7-day free trial</strong> (14 days when you join through a member&apos;s
          invite link) and a payment method is required to begin it. The trial ends — and billing starts — as soon as
          you reach <strong className="text-cream">50 interactions</strong> (made plus received) or when the trial
          period ends, whichever comes first. We notify you by email before the first charge. You may cancel at any
          time before the trial ends from the Subscription page in your account, and you will not be charged. One free
          trial is available per account; if you subscribe again after cancelling, billing starts immediately and this
          is stated at checkout.
        </p>
```

`pt.tsx` lines 89-98 become:

```tsx
        <p>
          <strong className="text-cream">Teste grátis.</strong> Novas contas começam com um{' '}
          <strong className="text-cream">teste grátis de 7 dias</strong> (14 dias quando você entra pelo link de
          convite de um membro) e é necessário informar um método de pagamento para iniciá-lo. O teste termina — e a
          cobrança começa — assim que você atingir <strong className="text-cream">50 interações</strong> (feitas e
          recebidas) ou quando o período de teste terminar, o que vier primeiro. Avisamos você por e-mail antes da
          primeira cobrança. Você pode cancelar a qualquer momento antes do fim do teste, na página Assinatura da sua
          conta, e nada será cobrado. Há um teste grátis por conta; se você assinar novamente após cancelar, a cobrança
          começa imediatamente e isso é informado no checkout.
        </p>
```

`es.tsx` lines 87-96 become:

```tsx
        <p>
          <strong className="text-cream">Prueba gratuita.</strong> Las cuentas nuevas comienzan con una{' '}
          <strong className="text-cream">prueba gratuita de 7 días</strong> (14 días cuando se une mediante el enlace
          de invitación de un miembro) y se requiere un método de pago para iniciarla. La prueba termina —y la
          facturación comienza— en cuanto alcanza <strong className="text-cream">50 interacciones</strong> (hechas y
          recibidas) o cuando termina el período de prueba, lo que ocurra primero. Le avisamos por correo antes del
          primer cobro. Puede cancelar en cualquier momento antes de que termine la prueba desde la página Suscripción
          de su cuenta, y no se le cobrará. Hay una prueba gratuita por cuenta; si se suscribe de nuevo tras cancelar,
          el cobro comienza de inmediato y se indica en el checkout.
        </p>
```

The landing dictionaries (`landing/i18n/*`) do **not** change — the CTAs keep "7-day" by decision (spec §5).

- [ ] **Step 4: Lint, build, Prettier**

Run: `pnpm --filter ./landing lint`
Expected: exit 0, no warnings.

Run: `pnpm --filter ./landing build`
Expected: exit 0; the static export still lists the 12 SSG pages (3 locales × 4 routes).

Run:
`pnpm exec prettier --write landing/components/RefCarrier.tsx "landing/app/[lang]/layout.tsx" "landing/app/[lang]/terms/content/en.tsx" "landing/app/[lang]/terms/content/pt.tsx" "landing/app/[lang]/terms/content/es.tsx"`
then `pnpm format:check` → exit 0.

- [ ] **Step 5: Manual smoke (browser pane, read-only)**

Open the landing dev server via `preview_start` (`.claude/launch.json` entry for the landing, or the `landing` `dev`
script on port 3000) at `/en?ref=abc12345`, then run in the page:
`[...document.querySelectorAll('a[href*="/auth/linkedin"]')].map(a => a.href)` — every href ends with `ref=abc12345` and
the plan buttons still carry `plan=`/`interval=`. Navigate to `/pt` (no query) and repeat — the stored code is still
applied. Try `/en?ref=NOPE` — no href gains a `ref`. (If `NEXT_PUBLIC_CONVEX_SITE` is unset locally, the selector
matches nothing; say so in the report rather than faking the check.)

- [ ] **Step 6: Do NOT commit**

---

### Task 10: Documentation — `docs/PLATFORM.md` + `backlog/revenue`

**Files:**

- Modify: `docs/PLATFORM.md` (§5, §7, §8, §9, §11, §12, §13B, §14, §15, §17, §21 — anchors below)
- Modify: `backlog/revenue/README.md` (rows at lines 139, 140, 144, 145, 161)
- Modify: `backlog/revenue/R18-survival-panel.md`, `R19-invite-a-peer.md`, `R20-email-at-the-post-interaction-cap.md`,
  `R21-feed-hygiene-24h-and-hide-now.md`, `R17-buy-featured-posts.md` (status line 3 + acceptance boxes)

**Interfaces:** consumes the names produced by Tasks 1-9 (listed in each task's Interfaces block). Produces nothing —
but this task is part of "done": CLAUDE.md says a feature is not complete until `docs/PLATFORM.md` reflects it.

**Rules for this task:** describe what the code does now (read the files; do not copy claims from the R-docs). Prose is
human-owned — do **not** run Prettier on `.md` files. Keep the existing voice, the `**bold**` lead-ins, and the
`[§N](#anchor)` cross-link style. `backlog/` is gitignored, so those edits are local-only; still do them. No TOC change:
the TOC lists numbered and lettered sections only, and no new one is added.

- [ ] **Step 1: §5 Data Model (line 278; table reference from 343)**

In the `users` table rows add, following the row format used for `firstPostPromptedAt` (Grep it):

- `inviteCode` — optional string, 8 chars `[a-z0-9]`, minted lazily by `users.getOrCreateInviteCode` on the first
  Settings visit; unique by construction (`by_invite_code` collision retry, `ConvexError('INVITE_CODE_RETRY')` after two
  attempts).
- `referredByCode` — optional string, stamped **insert-only** in `linkedin/auth.upsertUser` after verifying the code
  exists via `by_invite_code`; never changed on later logins.
- indexes `by_invite_code (['inviteCode'])`, `by_referred_by_code (['referredByCode'])`.

`oauthStates`: `ref` — optional string, the validated invite code carried through the OAuth round-trip (see §7).

`userPostState`: `commentedAt` — set by `incrementCommentCount` (the moment the viewer tapped Comment); `hiddenAt` — set
by `interactions.hidePost`. Both optional, widen-only, no backfill: rows written before 2026-09-07 have neither, so a
pre-existing reaction shows the done footer only because `reactedAt` was already there, and old comments do not.

ER diagram: no new table, so no diagram change — add one sentence under it: `users.referredByCode → users.inviteCode` is
a self-reference resolved by index, not a foreign key.

- [ ] **Step 2: §7 Authentication & Identity (line 786)**

"OAuth login flow" (line 822): add a step to the sequence and the Mermaid flow: the landing's `RefCarrier` (§15) appends
`?ref=<code>` to every `/auth/linkedin` href; `http.ts` keeps it only when `isInviteCode(ref)` (`/^[a-z0-9]{8}$/`),
stores it on the `oauthStates` row via `sessions.createOAuthState({ ref })`, and the callback passes
`referredByCode: oauthState.ref` to `upsertUser`, which stamps it on **insert only** after a `by_invite_code` lookup
proves the code belongs to a real member. An invalid or unknown code is dropped silently at each hop; an existing member
logging in with a `ref` is unchanged.

"Identity / user functions" table (line 869): add rows for `users.getOrCreateInviteCode` (mutation, public — returns the
code, minting on first call), `users.getInviteSummary` (query, public — `{ inviteCode | null, joined }`, `joined`
counted via `by_referred_by_code` `.take(101)` so the UI can say "100+"), and amend `users.getMe`: now returns
`trialDays` (`trialDaysFor(user)` = 14 with `referredByCode`, else 7) and `inviterName` (first name of the inviter,
resolved by one indexed read; `undefined` when not referred).

- [ ] **Step 3: §8 Subscriptions & Billing (line 927)**

"Checkout (subscribe) flow" (line 962): `trial_period_days` is `trialDaysFor(user)` from `lib/trialMilestone.ts`
(`TRIAL_PERIOD_DAYS = 7`, `INVITED_TRIAL_PERIOD_DAYS = 14`; the constant left `billingNode.ts`). The R01 repeat-trial
rule still wins: a member who already had a trial gets none regardless of referral.
`checkoutSubmitMessage(locale, { trial, days })` prints the actual day count under Stripe's pay button. Add the
`checkout_started { plan, interval }` event fired by `BillingPage.handlePlanClick` just before `createCheckoutSession`
(R18 funnel).

After "Trial notifications" (line 1085) add a subsection **`### Post-cap email (R20)`** with a Mermaid flow and this
content: both `incrementLikeCount` and `incrementCommentCount` call one helper, `flipCapIfReached`, which flips `inFeed`
and schedules `internal.notifications.sendPostCapReached({ postId })` at 0 ms — the flip happens once per post, so the
email is at most once per post. The action re-reads the post (`internal.interactions.getPost`), the author's billing
context (`internal.billing.getBillingContext`) and the effective limits (`internal.lib.planLimits.getPlanLimits`), then
`shouldSendCapNotice` decides: nothing for `none`, `past_due`, `canceled`, a scheduled cancel, a soft-deleted post or a
missing email. `capNoticeMode(tier, cap, nextCap)` picks the body: `upgrade` (Starter/Growth, link
`/billing?plan=<next>&interval=<annual|monthly>&src=cap_email`, interval from the live subscription via
`billingIntervalParam`), `proContact` (Pro → mailto `SUPPORT_EMAIL`), `contactCustom` (contact tier → the same mailto),
and falls back to the support line whenever the next tier's cap is not actually higher.
`postCapReachedEmail(locale, args)` in `lib/billingEmails.ts` builds subject (names the cap number) and body in en/pt/es
and is enumerated in the transactional guard test. `SUPPORT_EMAIL` now lives in `convex/lib/support.ts`;
`app/src/lib/support.ts` re-exports it. Delivery goes through the same `deliver()` seam as the trial emails (loud
`console.error` when the mailer is unconfigured).

Add `cap_email_billing_opened { plan }` to the events fired from `/billing` (fires once when `src=cap_email` is
present).

- [ ] **Step 4: §9 Plan Limits (line 1375) — "Upgrade at the limit (R08)" (line 1461)**

One sentence: the post-cap email (§8) deep-links to the same `/billing?plan=<next>` surface, tagged `src=cap_email`, so
the in-app `UpgradeAtLimit` and the email are two doors to one checkout.

- [ ] **Step 5: §11 Feed & Engagement (line 1761)**

"Feed resolution" (line 1763): `fetchFeedPage` now does one `userPostState` `.unique()` read per page item
(`by_user_and_post`) — N extra indexed reads per page — and (a) drops posts whose `viewerPostStatus(state, now)` is
`'gone'` (hidden, or interacted more than `INTERACTED_TTL_MS` = 24 h ago), (b) attaches
`viewerState: { reacted, commented, hidesAt } | null` to every remaining item. Sort, `inFeed`, counts, caps, search, the
refresh cron and My Posts are untouched. Because `now` is the query's `Date.now()` (the existing `getFeed` convention),
a tab left open past the 24 h mark keeps the card until the next query re-run.

Rewrite the paragraph at line 1894-1900 ("Author-facing post-cap state"): in-app stays exactly as described (badge +
`UpgradeAtLimit` in My Posts, no toast, no feed notice) **and** the author gets one email at the flip — link to the new
§8 subsection.

After "Interactions (comment / react)" (line 1866) add **`### 24-hour feed hygiene (R21)`** with a Mermaid flow: tap →
`reactedAt` / `commentedAt` on `userPostState` (the comment stamp is written in `incrementCommentCount`, the same
transaction as the log row) → the card renders the done footer (`✓ Reacted` / `Commented` / `Reacted · commented`, the
remaining action, View on LinkedIn, "Leaves your feed in N h", **Hide now**) → after 24 h `viewerPostStatus` returns
`'gone'` and the next feed query drops it → or **Hide now** calls `interactions.hidePost`
(`ConvexError('NOT_INTERACTED')` unless `canHide(state)`, i.e. the viewer reacted or commented; idempotent) which stamps
`hiddenAt`, and Convex reactivity removes the card without a reload. No unhide. `feed.getCaughtUp` (`{ caughtUp }`) is
true when the viewer's newest `userInteractions` row is younger than 24 h; `FeedPage` subscribes to it only when the
page is empty and settled, after auto-loading up to `MAX_EMPTY_LOADS` (5) further pages while the first ones come back
empty. Empty because everything was handled → caught-up state; empty because nothing exists → the R05 `EmptyFeed` state.

Add `hidePost` to the interactions function table and `getCaughtUp` to the feed function list. Mention
`post_hidden { after }` (hours since the interaction).

- [ ] **Step 6: §12 Admin & Moderation (line 2173) and the §14 admin paragraph (line 3021)**

§12 "Admin functions" table (line 2179): add `admin.survivalMetrics({ sessionToken, days: 7 | 28 })` →
`{ days, since, generatedAt, cohort, payingByTier }`. Read budget: `users` `.order('desc').take(1000)` window filtered
by `createdAt >= since`, then per member two indexed reads — the oldest `userInteractions` row (`by_user`, `.first()`)
and the `subscriptions` rows (`by_user`). No new table, no snapshot cron. State the cohort definitions as implemented in
`lib/survival.ts` (`summarizeCohort`): `signups`; `startedTrial` (any subscription row); `activated` (first interaction
within 24 h of `createdAt`); `medianMinutesToFirstInteraction` (`null` when nobody activated); `returnedDay1` /
`returnedDays2to7` (from `lastLoginAt`); `trialsEnded` = started a trial and status is `active`, `canceled` or
`past_due`; `converted` = started a trial and `active`; `canceled` = `canceled` or cancel-pending. Say **why** it is
keyed on the subscription row: `stripe.ts` erases `users.trialEndsAt` once a subscription is active, so a date-based
definition could never count a conversion. `payingByTier` counts `active` members per tier across the whole window.

§14 line 3021: add the **Survival** tab (`SurvivalTab`, `/admin?tab=survival`: 7/28-day toggle, one table of count +
share via the exported `share(part, base)`, spinner as the only non-data state — `useQuery` has no error return) to the
tab list and fix the count word ("Four tabs:") to the actual number of tabs listed after your edit.

- [ ] **Step 7: §13B Privacy & Compliance (line 2459)**

Personal data inventory: `users.inviteCode` and `users.referredByCode` (an opaque code, not an identifier of another
person; the inviter's first name is resolved at render time and never stored on the invitee),
`userPostState.commentedAt` / `hiddenAt`. All four ride the existing row-level DSR export and erasure — no new code
path; the existing privacy tests stay green. The landing stores the code in `sessionStorage['ref']` for the life of the
tab — functional, not tracking, no consent banner change. The Terms trial clause now says "7-day free trial (14 days
when you join through a member's invite link) … or when the trial period ends" in en/pt/es — **draft pending legal
review**, like the rest of the legal pages.

- [ ] **Step 8: §14 Frontend — Authenticated App (line 2730)**

"Pages" (line 2806): Feed — done footer, Hide now, empty-page auto-load, caught-up state (with the invite link);
Settings — `#invite` section (read-only link `${LANDING_URL}/${lang}?ref=<code>`, Copy → clipboard + toast +
`invite_copied`, joined count with `_one/_other` and the "100+" ceiling, deep-linked from Recap and the caught-up state,
lazily mints the code); Billing — `trialDays` from `getMe` feeds every trial string (`{{days}}`), the gift line
`billing.giftFrom` for an invited member without a card, `checkout_started`, `cap_email_billing_opened`; Recap — footer
invite line only when `received.current.total > 0`; Admin — Survival tab.

"Reusable components" (line 3041): `SurvivalTab`; `PostCard` gained `viewerState` (on `PostWithAuthor`) and `onHide`;
`EmptyFeed` gained `caughtUp` (the R05 branch keeps its single composer action — no invite link there).

"Trial UI" (line 3163): the six trial strings (`feed.cardGateCta`, `feed.cardGateCost`, `billing.trialBannerNoDate`,
`billing.newUserTrialNote`, `billing.startTrialCta`, `billing.chosenPlanLead`) interpolate `{{days}}`; `CardGateDialog`,
`CardGateBanner`, `UpgradeAtLimit` and `BillingPage` read `me.trialDays` with `TRIAL_PERIOD_DAYS` as the fallback while
`me` loads.

"i18n" (line 3289): update the key count. Compute it, do not guess — write this read-only script to the scratchpad with
the Write tool and run it with `node`:

```js
// count-keys.mjs — arrays count as one leaf (the convention used in every earlier count)
import { readFileSync } from 'node:fs'
const dir = 'app/src/i18n/locales/'
const leaves = (o, p = '') =>
  Object.entries(o).flatMap(([k, v]) =>
    v && typeof v === 'object' && !Array.isArray(v) ? leaves(v, `${p}${k}.`) : [`${p}${k}`],
  )
for (const l of ['en', 'pt', 'es']) {
  const n = leaves(JSON.parse(readFileSync(`${dir}${l}.json`, 'utf8'))).length
  console.log(l, n)
}
```

Expected: the same number for all three (295 + 7 R21 keys + 12 R19 keys = **314** if nothing else moved). Write that
number and the method ("arrays counted as one leaf") wherever §14 states the count.

- [ ] **Step 9: §15 Frontend — Landing (line 3420)**

"Free-trial clause (Terms §5)" (line 3630): the paragraph now reads "7-day free trial (14 days when you join through a
member's invite link)" and "or when the trial period ends, whichever comes first"; the checkout `custom_text` prints the
actual day count (`checkoutSubmitMessage(locale, { trial, days })`), so the three surfaces still agree.

"CTAs → app" (line 3668): add a paragraph on `RefCarrier` (`landing/components/RefCarrier.tsx`, `'use client'`, renders
nothing, mounted once in `app/[lang]/layout.tsx` beside `CookieNotice`): reads `?ref` from `window.location.search` (not
`useSearchParams` — static export), keeps it only when it matches `/^[a-z0-9]{8}$/` (a deliberate copy of
`INVITE_CODE_RE`; the landing must not import from `convex/`), stores it in `sessionStorage`, falls back to the stored
value when the URL has none (a language switch drops the query), and sets `ref` on every `a[href*="/auth/linkedin"]` via
`URL.searchParams.set`, preserving `plan`/`interval`; re-runs on `usePathname()` change; no-op when
`NEXT_PUBLIC_CONVEX_SITE` is unset. `middleware.ts` already preserves the query on the locale redirect. The dictionaries
keep "7-day" on the CTAs by decision.

- [ ] **Step 10: §17 Security Posture — the events list (line 3947-3963)**

Change "As of 2026‑09‑07 there are eight" to "As of 2026‑09‑07 there are twelve" and append four bullets in the same
style:

- `checkout_started` — `BillingPage.handlePlanClick`, just before `createCheckoutSession` (R18). Props: `plan`,
  `interval`.
- `cap_email_billing_opened` — `BillingPage`, once per mount when `src=cap_email` is in the URL (R20). Props: `plan`.
- `post_hidden` — `FeedPage`'s Hide now handler (R21). Props: `after` (whole hours since the interaction).
- `invite_copied` — `SettingsPage` Copy link (R19). No props.

Keep the sentence about `HistoryPage` firing nothing. The Survival panel reads the database, not PostHog — say so in one
clause so nobody looks for a survival event.

- [ ] **Step 11: §21 Maintaining This Document (line 4176)**

Add four mapping rows in the table (keep column alignment):

- Survival panel (`convex/lib/survival.ts`, `admin.survivalMetrics`, `app/src/components/SurvivalTab.tsx`) → §12, §14
- Post-cap email (`convex/lib/postCapNotice.ts`, `convex/lib/support.ts`, `interactions.flipCapIfReached`,
  `notifications.sendPostCapReached`, `lib/billingEmails.ts`) → §8, §9, §11
- Feed hygiene (`convex/lib/feedHygiene.ts`, `interactions.hidePost`, `feed.getCaughtUp`, `PostCard` done footer,
  `EmptyFeed`) → §11, §14
- Invite / referral (`convex/lib/invite.ts`, `users.getOrCreateInviteCode` / `getInviteSummary`, `http.ts` `ref`,
  `linkedin/auth.ts` attribution, `landing/components/RefCarrier.tsx`, Settings `#invite`, Terms clause) → §5, §7, §8,
  §13B, §14, §15

Then insert a new
`_Last updated: 2026‑09‑07. **Survival panel, the post-cap email, 24-hour feed hygiene and invite-a-peer (R18 / R20 / R21 / R19).** …_`
paragraph **above** the existing `_Last updated: 2026‑09‑07. **Recap, History, …_` paragraph (line 4209), in the same
voice and length as that one: one theme sentence, then per feature what changed and where, the deviations
(subscription-status rule for R18; `capNoticeMode(tier, cap, nextCap)` collapsing two spec functions;
`toFeedViewerState(row)` without `now`; `TRIAL_PERIOD_DAYS` moved to `lib/trialMilestone.ts`; no `Flash` in
`SurvivalTab`; no invite link in the R05 state; `RefCarrier` duplicates the regex), the test counts from the final run
(fill in from Task 11 — leave `N/N` placeholders **only** until Task 11 reports, then replace them; the plan's final
gate checks no placeholder remains), and the locale key count with its method. State that §16 has no change (no new env
variable) and that R17 is held until R13.

- [ ] **Step 12: backlog — README rows and the five R-docs**

`backlog/revenue/README.md`:

- line 139 R20: `TODO` → `DONE 2026-09-07`
- line 140 R17: `TODO` → `TODO (held until R13, 2026-09-07)`
- line 144 R21: `TODO` → `DONE 2026-09-07`
- line 145 R19: `TODO` → `DONE 2026-09-07`
- line 161 R18: `TODO` → `DONE 2026-09-07`

Keep each table's column alignment (pad with spaces as the file does).

Each R-doc's line 3 status: `> **Status:** DONE 2026-09-07 · …` (R18, R19, R20, R21); R17:
`> **Status:** TODO · held until R13 (2026-09-07) · …`. Tick every acceptance box `- [x]` that the code satisfies and
append ` — shipped as: …` where the implementation differs:

- R18 line 79: add `startedTrial` to the metric list (Henriko's addition); line 81 (`track()` + four events): shipped as
  **no `track()` and no survival events** — the panel reads the database; the one new event on the checkout path is
  `checkout_started`. Line 82: read budget is the `take(1000)` window plus two indexed reads per member (as written).
  Add a "Shipped as" note under the list: trials ended / converted / canceled are keyed on the subscription row's status
  because `stripe.ts` erases `trialEndsAt` on activation; no nightly snapshot; no `Flash` on error (`useQuery` has no
  error value).
- R19 line 86-93: all `[x]`. Shipped-as notes: the six trial strings interpolate `{{days}}` and the fallback is
  `TRIAL_PERIOD_DAYS` while `me` loads; `RefCarrier` reads `window.location.search` and duplicates the regex; the R05
  empty state deliberately gets no invite link (only the caught-up state and the recap footer); joined count caps at
  "100+".
- R20 line 182-188: all `[x]`. Shipped-as: `capNoticeMode(tier, cap, nextCap)` is one function (the "upgrade" sentence
  is dropped when the next cap is not higher); `SUPPORT_EMAIL` moved to `convex/lib/support.ts` with an app re-export;
  no unit test for the action or the flip helper (I/O wiring; every decision is in the pure modules' tests).
- R21 line 157-164: all `[x]`. Shipped-as: `toFeedViewerState(row)` takes no `now`; the caught-up rule is "newest
  interaction younger than 24 h" via `feed.getCaughtUp`, checked only when the page is empty after up to 5 auto-loads;
  hours-left is computed once at render (no timer).
- R17: leave the boxes; add one line under the status: "Held 2026-09-07 until R13 settles the ladder math (⚖️)."

Also in each of the four DONE docs, update any "Docs to update" list to say which PLATFORM.md sections were actually
touched (the ones in Steps 1-11).

- [ ] **Step 13: Consistency read-back**

Grep `docs/PLATFORM.md` for `there are eight`, `Four tabs`, `TRIAL_PERIOD_DAYS` (must point at `lib/trialMilestone.ts`,
not `billingNode.ts`), `recordInteraction` (must still say deleted), and `N/N` (must be gone after Task 11). Expected:
only the intended hits.

- [ ] **Step 14: Do NOT commit**

---

### Task 11: Final gate — `pnpm verify`, i18n parity, landing build, report numbers

**Files:** none modified except `docs/PLATFORM.md` (to replace the `N/N` test-count placeholders from Task 10 Step 11)
and, if a check fails, the file that caused it.

**Interfaces:** consumes everything. Produces the numbers for the final report.

- [ ] **Step 1: The repo gate**

Run from the repo root: `pnpm verify`
Expected: exit 0 — `format:check`, `lint` (`--max-warnings 0`), `typecheck` (convex + app + landing), and every
package's `vitest run`. Record the convex and app test totals from the output (e.g. `Tests  4xx passed`).

If `format:check` fails on a file this batch touched, run `pnpm exec prettier --write <that file>` and re-run. If it
fails on a file this batch did **not** touch, stop and report it — never `pnpm format`, never reformat prose.

- [ ] **Step 2: i18n parity — key sets and placeholder sets**

There is no parity test in the repo. Write this read-only script to the scratchpad with the Write tool and run it with
`node`:

```js
// i18n-parity.mjs — key-set diff + per-key {{placeholder}} set diff across en/pt/es
import { readFileSync } from 'node:fs'
const dir = 'app/src/i18n/locales/'
const flat = (o, p = '') =>
  Object.entries(o).flatMap(([k, v]) =>
    v && typeof v === 'object' && !Array.isArray(v) ? flat(v, `${p}${k}.`) : [[`${p}${k}`, v]],
  )
const ph = v => new Set(String(Array.isArray(v) ? v.join(' ') : v).match(/\{\{\w+\}\}/g) ?? [])
const maps = Object.fromEntries(
  ['en', 'pt', 'es'].map(l => [l, new Map(flat(JSON.parse(readFileSync(`${dir}${l}.json`, 'utf8'))))]),
)
let bad = 0
for (const l of ['pt', 'es']) {
  for (const k of maps.en.keys()) if (!maps[l].has(k)) (bad++, console.log(`${l} missing ${k}`))
  for (const k of maps[l].keys()) if (!maps.en.has(k)) (bad++, console.log(`${l} extra ${k}`))
  for (const [k, v] of maps.en) {
    if (!maps[l].has(k)) continue
    const a = [...ph(v)].sort().join(), b = [...ph(maps[l].get(k))].sort().join()
    if (a !== b) (bad++, console.log(`${l} placeholders differ at ${k}: en=${a || '-'} ${l}=${b || '-'}`))
  }
}
console.log(`keys en=${maps.en.size} pt=${maps.pt.size} es=${maps.es.size}; problems=${bad}`)
process.exit(bad ? 1 : 0)
```

Expected: `problems=0` and three equal counts (**314** if nothing else moved: 295 + 7 + 12). This is the "arrays counted
as one leaf" method — always state it with the number. Spot-check by eye that `settings.inviteJoined_one` / `_other`
exist in all three files (plural suffixes are keys like any other here).

- [ ] **Step 3: Landing**

Run: `pnpm --filter ./landing lint && pnpm --filter ./landing build`
Expected: both exit 0.

- [ ] **Step 4: Replace the doc placeholders**

Open `docs/PLATFORM.md`, find the `_Last updated: 2026‑09‑07. **Survival panel…_` paragraph from Task 10 and replace
every `N/N` with the real counts from Step 1 and the key count from Step 2. Then: `Grep 'N/N' docs/PLATFORM.md` → no
hits.

- [ ] **Step 5: Working-tree sanity (read-only git)**

Run: `git status --porcelain` and `git diff --stat`
Expected: only files this plan names (plus the spec and this plan). Confirm **no** `git commit`, `git stash`,
`git checkout`, `git reset` or `git push` was run by any task — `git log -1` still shows `53eac01` as HEAD and
`git stash list` is empty.

- [ ] **Step 6: Report**

Hand back, in this order: the verify result; the convex / app test totals; the locale key count with method; the landing
lint/build result; the list of deviations from the spec (R18 subscription-status rule;
`capNoticeMode(tier, cap, nextCap)`; `toFeedViewerState(row)` without `now`; `TRIAL_PERIOD_DAYS` in
`lib/trialMilestone.ts`; no `Flash` in `SurvivalTab`; no invite link in the R05 state; `RefCarrier` regex duplicate +
`window.location.search`; no unit tests for `flipCapIfReached` / `sendPostCapReached` / the `FeedPage` `onHide` glue);
the human steps still open (Stripe Customer Portal rows from R09 in PLATFORM §8; lawyer review of the Terms clause); and
that nothing was committed.

---

## Self-review (done at plan-writing time)

- **Spec coverage:** §3.1 schema → Tasks 5, 7. §3.2 R18 → Tasks 1, 2. §3.3 R20 → Tasks 3, 4. §3.4 R21 → Tasks 5, 6. §3.5
  R19 → Tasks 7, 8. §4.1-4.5 app → Tasks 2, 4, 6, 8. §4.6 analytics (four events) → Tasks 2, 4, 6, 8. §4.7 i18n → Tasks
  6, 8 (parity gate in Task 11). §5 landing → Task 9. §6 error handling → inline in Tasks 4, 5, 6, 8. §7
  a11y/responsive → the UI-skills preambles in Tasks 2, 6, 8. §8 testing → each task's test steps + Task 11. §9
  docs/backlog → Task 10. §10 out-of-scope → nothing here builds them.
- **Placeholder scan:** the only intentional placeholder is `N/N` in Task 10 Step 11, replaced in Task 11 Step 4 and
  checked by Grep.
- **Type consistency:** `FeedViewerState { reacted, commented, hidesAt }` (Task 5) is what Task 6 renders and Task 8
  leaves alone; `trialDays` / `inviterName` on `getMe` (Task 7, uniform shape) are what Task 8 reads;
  `getInviteSummary → { inviteCode: string | null, joined }` (Task 7) is what Task 8's Settings section and test
  consume; `TRIAL_PERIOD_DAYS` / `INVITED_TRIAL_PERIOD_DAYS` / `trialDaysFor` live in `lib/trialMilestone.ts` in Tasks
  7, 8, 10; `capNoticeMode(tier, cap, nextCap)` (Task 3) is what Task 4 calls and Task 10 documents;
  `MAX_EMPTY_LOADS = 5` (Task 6) is the "5" in Tasks 10 and 11; the `?ref=` shape `${LANDING_URL}/${lang}?ref=${code}`
  (Task 8) is what `RefCarrier` (Task 9) reads back.

<!-- PLAN-END -->
