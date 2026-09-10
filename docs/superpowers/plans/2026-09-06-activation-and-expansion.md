# Activation and Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this
> plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the card ask after the first micro-win, put an upgrade path at every plan limit, surface trial
progress where the work happens, celebrate the checkout, and give the empty feed one action.

**Architecture:** Five backlog items (R04, R08, R06, R07, R05) built in that order over four new shared
components, one new public Convex query, one pure tier helper and one analytics helper. The server-side card
gate in `convex/lib/access.ts` is not touched — only the order and shape of the client-side ask change.

**Tech Stack:** React 19 + TypeScript + Vite (`app/`), Convex (`convex/`), Tailwind v4, shadcn `Dialog`,
react-i18next (en / pt-BR / neutral es), Vitest + Testing Library, PostHog (inert without prod keys).

**Spec:** [
`docs/superpowers/specs/2026-09-06-activation-and-expansion-design.md`](../specs/2026-09-06-activation-and-expansion-design.md)

## Global Constraints

- **NEVER run a git state-changing command.** No `commit`, `push`, `stash`, `checkout`, `reset`, `restore`,
  `clean`, `rebase`, `merge`. Henriko makes every commit. A past agent's `git stash` stranded finished work.
  Read-only git (`status`, `diff`, `log`) is fine. This plan therefore has **no commit steps**; each task ends
  with a verification step instead.
- **NEVER run `pnpm format`.** Prettier owns code and config, humans own prose. Fix formatting by hand in the
  files you touched. `pnpm format:check` must still pass.
- **Run from the repo root** (`D:\ERP\LinkIntoTheSSI\LinkIntoTheSSI`). Use `pnpm`, never `npm`. Never run the
  Convex CLI from inside `convex/` — it wipes the deployment.
- **No new dependency** for a dialog, a bar, a toast, confetti or a tour. Use the existing shadcn `Dialog`
  (`app/src/components/ui/dialog.tsx`) and the existing `toast` (`app/src/components/ui/toast.tsx`).
- **No hardcoded plan numbers in user-facing copy.** `posts.getTierLimits` is the source; admins edit those
  rows. `isUnlimitedFeatured` (`convex/lib/postLimit.ts`) guards the 9999 sentinel — never print it.
- **No interrupting upsell.** No modal on page load, no upgrade email, no toast the next day. Inline only.
- **No fabricated proof.** No invented counts, ratings, urgency or scarcity.
- **No claim that the app reads or shows the member's SSI.** Never tell a free member to check their SSI. The
  SSI page went behind Sales Navigator in late August 2026.
- **i18n parity is manual.** There is no automated parity test. Every new key lands in all three of
  `app/src/i18n/locales/{en,pt,es}.json`. `pt` is pt-BR (never European), `es` is neutral Latin American,
  sentence case for labels. Verify with a recursive key diff before calling a task done.
- **Docs are part of done.** `docs/PLATFORM.md` is updated in the same change as the code (project CLAUDE.md).
- **Verification gate per task:** `pnpm verify` (format:check → lint → typecheck → all workspace tests) exits 0.
- **Design skills:** build UI under `frontend-design`, `responsive-design` and `ui-ux-pro-max`; review against
  `web-design-guidelines`; code style follows `andrej-karpathy-skills:karpathy-guidelines`.

## File Structure

**Created**

| File                                             | Responsibility                                                                              |
|--------------------------------------------------|---------------------------------------------------------------------------------------------|
| `app/src/components/CardGateDialog.tsx`          | The one dialog a gated member meets on any engagement tap.                                  |
| `app/src/components/CardGateBanner.tsx`          | The "your first post is saved and hidden" banner, reused by `EmptyFeed`.                    |
| `app/src/components/UpgradeAtLimit.tsx`          | One sentence of loss plus one link, for all four cap moments.                               |
| `app/src/components/TrialMeter.tsx`              | The bar, count and days-left, shared by BillingPage and the shell.                          |
| `app/src/components/shell/TrialProgressCard.tsx` | The sidebar wrapper: meter, goal copy, made/received.                                       |
| `app/src/components/CheckoutSuccessDialog.tsx`   | The post-checkout peak.                                                                     |
| `app/src/components/EmptyFeed.tsx`               | Headline, one CTA, and the three-step activation checklist.                                 |
| `app/src/lib/targetPlan.ts`                      | Shared `?plan=` / sessionStorage resolution, so BillingPage and the gate CTAs cannot drift. |

**Modified**

| File                                             | Change                                                                     |
|--------------------------------------------------|----------------------------------------------------------------------------|
| `convex/lib/planLimits.ts`                       | `+ Tier` type, `+ nextTier()`.                                             |
| `convex/posts.ts`                                | `+ getTierLimits` query; two `ConvexError` messages become prefixed codes. |
| `app/src/lib/observability/analytics.ts`         | `+ captureEvent()`.                                                        |
| `app/src/lib/errors.ts`                          | `+ mapLimitError()`.                                                       |
| `app/src/components/FirstPostPromptScreen.tsx`   | Drop the `/billing` branch.                                                |
| `app/src/components/PostCard.tsx`                | Gated buttons become enabled, calling `onGated`.                           |
| `app/src/components/PostComposer.tsx`            | `limitHint` widens `string → ReactNode`; textarea gets a stable id.        |
| `app/src/pages/FeedPage.tsx`                     | Banner, gate dialog, `EmptyFeed`.                                          |
| `app/src/pages/MyPostsPage.tsx`                  | Three `UpgradeAtLimit` placements plus the capped-post badge.              |
| `app/src/pages/SettingsPage.tsx`                 | `settings.upgradePrompt` → `UpgradeAtLimit`.                               |
| `app/src/pages/BillingPage.tsx`                  | Meter extracted; success and activating states.                            |
| `app/src/components/shell/Sidebar.tsx`           | Trial card; SSI qualifier; Recap entry.                                    |
| `app/src/components/shell/TopBar.tsx`            | Mobile trial pill.                                                         |
| `app/src/i18n/locales/{en,pt,es}.json`           | ~34 keys added, `feed.empty` removed.                                      |
| `docs/PLATFORM.md`                               | §8, §9, §11, §14, §21.                                                     |
| `backlog/revenue/R15-interactions-recap-page.md` | Records the two deferrals.                                                 |
| `backlog/revenue/R0{4,5,6,7,8}-*.md`             | Status → DONE.                                                             |

---

### Task 1: R04 — Value before the card

**Files:**

- Create: `app/src/lib/targetPlan.ts`, `app/src/components/CardGateDialog.tsx`,
  `app/src/components/CardGateBanner.tsx`
- Modify: `app/src/lib/observability/analytics.ts`, `app/src/components/FirstPostPromptScreen.tsx:13-28`,
  `app/src/components/PostCard.tsx:40-62,80-160`, `app/src/pages/FeedPage.tsx:110-135`
- Test: `app/src/components/FirstPostPromptScreen.test.tsx` (existing — one case inverts),
  `app/src/components/PostCard.test.tsx` (existing — append), `app/src/lib/targetPlan.test.ts` (new)
- Docs: `docs/PLATFORM.md` §14, §11

**Interfaces:**

- Consumes: nothing from earlier tasks.
- Produces, relied on by Tasks 2–5:
    - `resolveTargetPlan(searchParams: URLSearchParams | null): 'starter' | 'growth' | 'pro' | 'contact'` from
      `app/src/lib/targetPlan.ts`
    - `captureEvent(name: string, props?: Record<string, string | number | boolean>): void` from
      `app/src/lib/observability/analytics.ts`
    - `CardGateBanner` — default export, props `{ className?: string }`
    - `PostCard` prop `onGated?: () => void`
    - `useHasHiddenOwnPost(): boolean` — exported from `app/src/components/CardGateBanner.tsx`, used again by
      Task 4's success dialog and Task 5's checklist

- [ ] **Step 1: Read the spec sections that govern this task**

Read §2.3, §2.4 and §3 of the spec, and `backlog/revenue/R04-value-before-the-card.md`'s **Do / Don't**
section in full. Option A only: `convex/lib/access.ts` and `convex/ai/comments.ts` must end this task byte
for byte unchanged.

- [ ] **Step 2: Write the failing test for the plan resolver**

Create `app/src/lib/targetPlan.test.ts`:

```ts
import { describe, expect, it, beforeEach } from 'vitest'
import { resolveTargetPlan } from './targetPlan'

describe('resolveTargetPlan', () => {
  beforeEach(() => sessionStorage.clear())

  it('prefers a valid ?plan= param', () => {
    expect(resolveTargetPlan(new URLSearchParams('plan=pro'))).toBe('pro')
  })

  it('falls back to the stashed chosenPlan', () => {
    sessionStorage.setItem('chosenPlan', 'starter')
    expect(resolveTargetPlan(new URLSearchParams(''))).toBe('starter')
  })

  it('defaults to growth when both are absent or invalid', () => {
    expect(resolveTargetPlan(new URLSearchParams('plan=bogus'))).toBe('growth')
    expect(resolveTargetPlan(null)).toBe('growth')
  })
})
```

- [ ] **Step 3: Run it and confirm it fails**

```bash
pnpm --filter app exec vitest run src/lib/targetPlan.test.ts
```

Expected: FAIL — cannot resolve `./targetPlan`.

- [ ] **Step 4: Implement the resolver**

Create `app/src/lib/targetPlan.ts`. Lift the logic verbatim from `app/src/pages/BillingPage.tsx:65-68` —
including its `isPlanId` guard — so there is one implementation, then change BillingPage to import it. Keep
BillingPage's explanatory comment about the landing choice with the moved code.

```ts
import { isPlanId, type PlanId } from '@/lib/plans' // wherever isPlanId currently lives; move it if it is local to BillingPage

/**
 * The plan a card-gate CTA should land on. The visitor already chose a plan on the landing page; it
 * arrives either as ?plan= or in the sessionStorage stash written by AuthSuccessPage. Growth is the
 * cold-arrival fallback and the recommended plan.
 */
export function resolveTargetPlan(searchParams: URLSearchParams | null): PlanId {
  const param = searchParams?.get('plan') ?? null
  const stashed = sessionStorage.getItem('chosenPlan')
  return isPlanId(param) ? param : isPlanId(stashed) ? stashed : 'growth'
}
```

- [ ] **Step 5: Run it and confirm it passes**

```bash
pnpm --filter app exec vitest run src/lib/targetPlan.test.ts
```

Expected: PASS, 3 tests.

- [ ] **Step 6: Add the analytics capture helper**

In `app/src/lib/observability/analytics.ts`, below `syncAnalyticsConsent`:

```ts
/**
 * Fire a named product event. No-op until initPostHog has run (dev, or prod without a key).
 * Consent is inherited, not re-checked: syncAnalyticsConsent opts PostHog in and out, and
 * posthog.capture does nothing while opted out. Props carry no PII — ids and enum-ish strings only.
 */
export function captureEvent(name: string, props?: Record<string, string | number | boolean>): void {
  if (!initialized) return
  posthog.capture(name, props)
}
```

- [ ] **Step 7: Invert the FirstPostPromptScreen test**

`app/src/components/FirstPostPromptScreen.test.tsx` currently has a case named *"funnels a card-gated member to billing
after submitting"*. Rewrite it to assert the opposite — a gated
member reloads into the feed and `window.location.href` is never set:

```ts
it('reloads into the feed after submitting, even for a card-gated member', async () => {
  render(<FirstPostPromptScreen />)
  fireEvent.change(screen.getByPlaceholderText(/linkedin\.com\/posts/i), {
    target: { value: 'https://www.linkedin.com/posts/jane_x-activity-123-abc' }
  })
  fireEvent.click(screen.getByRole('button', { name: /share/i }))
  await waitFor(() => expect(window.location.reload).toHaveBeenCalledOnce())
  expect(window.location.href).toBe('')
})
```

Match the existing file's submit-button query; read it before editing rather than guessing the label.

- [ ] **Step 8: Run it and confirm it fails**

```bash
pnpm --filter app exec vitest run src/components/FirstPostPromptScreen.test.tsx
```

Expected: FAIL — `reload` not called, `href` is `/billing`.

- [ ] **Step 9: Make the routing feed-first**

In `app/src/components/FirstPostPromptScreen.tsx`, `handleSubmit` becomes:

```ts
    await submitPost({ sessionToken, postUrl })
    // submitPost set firstPostPromptedAt server-side. Everyone lands on the feed: a not-yet-subscribed
    // member's post is created hidden and the feed's CardGateBanner names it, so the card ask arrives
    // after they have seen the product rather than instead of it (R04).
    window.location.reload()
```

Delete the `if (gated)` branch, the `const { gated } = useCardGate()` line and the now-unused `useCardGate`
import. Leave the mock in the test file — `useQuery` is still called by nothing here, but removing the mock
would break the other cases only if they need it; check and clean up if it is genuinely dead.

- [ ] **Step 10: Run it and confirm it passes**

```bash
pnpm --filter app exec vitest run src/components/FirstPostPromptScreen.test.tsx
```

Expected: PASS, all cases.

- [ ] **Step 11: Write the failing PostCard gate tests**

Append to `app/src/components/PostCard.test.tsx`:

```tsx
  it('calls onGated instead of onReact when the member is card-gated', () => {
    const onReact = vi.fn()
    const onGated = vi.fn()
    render(
      <PostCard
        post={mockPost}
        gated
        onGated={onGated}
        onComment={() => {}}
        onReact={onReact}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /like/i }))
    expect(onGated).toHaveBeenCalledOnce()
    expect(onReact).not.toHaveBeenCalled()
  })

  it('leaves the engagement buttons enabled while gated so the tap is never dead', () => {
    render(
      <PostCard
        post={mockPost}
        gated
        onGated={() => {}}
        onComment={() => {}}
        onReact={() => {}}
      />
    )
    expect(screen.getByRole('button', { name: /like/i })).toBeEnabled()
    expect(screen.getByRole('button', { name: /comment/i })).toBeEnabled()
  })

  it('calls the real handler when not gated', () => {
    const onReact = vi.fn()
    const onGated = vi.fn()
    render(
      <PostCard
        post={mockPost}
        onGated={onGated}
        onComment={() => {}}
        onReact={onReact}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /like/i }))
    expect(onReact).toHaveBeenCalledOnce()
    expect(onGated).not.toHaveBeenCalled()
  })
```

Read the component first and match the real accessible names — the reaction button's label comes from
`t(current.labelKey)` and the gated `title` is being removed, so the accessible name changes with this task.
Adjust the queries to whatever the post-change markup actually exposes; do not weaken them to `getAllByRole`
index lookups.

- [ ] **Step 12: Run them and confirm they fail**

```bash
pnpm --filter app exec vitest run src/components/PostCard.test.tsx
```

Expected: FAIL — `onGated` is not a prop; buttons are disabled.

- [ ] **Step 13: Let the gate bind at the tap**

In `app/src/components/PostCard.tsx`, add `onGated?: () => void` to both prop interfaces (`:49` and `:88`)
and thread it to the reaction control at `:136`.

- Reaction button `:60-62`:
  `onClick={loading ? undefined : () => (gated ? onGated?.() : onReact(postId, current.value))}`,
  `disabled={loading}` (drop `gated`), and `title={t(current.labelKey)}` (drop the gated branch).
- Comment button `:142-144`: `onClick={() => (gated ? onGated?.() : onComment(post._id))}`, drop `disabled`
  and the gated `title`.
- View-on-LinkedIn `:151-155`: the gated branch currently renders a disabled element. Render the same
  button shape as the ungated one, with `onClick={() => onGated?.()}`.
- Do the same for the AI-draft control. **No gated tap may reach `generateComment`** — every draft is a paid
  DeepInfra call.
- The `feed.cardGate` key stays: `FeedPage.tsx:181` still maps the server `PAYMENT_REQUIRED` fallback.

- [ ] **Step 14: Run them and confirm they pass**

```bash
pnpm --filter app exec vitest run src/components/PostCard.test.tsx
```

Expected: PASS, all cases including the pre-existing ones.

- [ ] **Step 15: Build the dialog and the banner**

`app/src/components/CardGateDialog.tsx` — shadcn `Dialog`, props
`{ open: boolean; onOpenChange: (o: boolean) => void; source: 'react' | 'comment' | 'linkedin' | 'aiDraft' }`.

- Title `feed.cardGateTitle`, body `feed.cardGateBody` — lead with the result, never with billing mechanics.
- Primary: an anchor to `/billing?plan=${resolveTargetPlan(searchParams)}` labelled `feed.cardGateCta`
  ("Start 7-day trial", never "Add a payment method"), firing
  `captureEvent('card_gate_cta_clicked', { plan })` on click.
- Secondary: `feed.cardGateLater` ("Not now") closing the dialog.
- Fire `captureEvent('card_gate_opened', { source })` on open, once per open, not once per render.

`app/src/components/CardGateBanner.tsx` — the banner plus the shared detection hook:

```tsx
/**
 * True when a card-gated member has a post of their own sitting hidden (created hidden by
 * postCreatedHidden in convex/lib/access.ts). Subscribed only while gated; a member in this state
 * has at most one post, so reusing getMyPosts costs less than a new query.
 */
export function useHasHiddenOwnPost(gated: boolean): boolean {
  const sessionToken = sessionStorage.getItem('sessionToken') ?? undefined
  const posts = useQuery(api.posts.getMyPosts, gated && sessionToken ? { sessionToken } : 'skip') as
    | { hidden?: boolean }[]
    | undefined
  return !!posts?.some(p => p.hidden === true)
}
```

The banner renders `feed.hiddenPostBanner` plus the same single CTA as the dialog.

- [ ] **Step 16: Wire the feed**

In `app/src/pages/FeedPage.tsx`:

- `const { gated } = useCardGate()`, `const hasHiddenPost = useHasHiddenOwnPost(gated)`.
- Render `<CardGateBanner />` above `<PostComposer />` (`:119`) **only when** `gated && hasHiddenPost &&
  posts.length > 0`. On an empty feed, Task 5's `EmptyFeed` carries the copy — the banner and the empty state
  never appear together, and neither stacks with the pulsing Billing nav item plus a dialog. One attention
  point per screen.
- Hold `const [gateSource, setGateSource] = useState<GateSource | null>(null)`; pass
  `onGated={() => setGateSource('react')}` etc. into each `PostCard`; render one `CardGateDialog` driven by
  that state.

- [ ] **Step 17: Add the five i18n keys to all three locales**

`feed.cardGateTitle`, `feed.cardGateBody`, `feed.cardGateCta`, `feed.cardGateLater`, `feed.hiddenPostBanner`
in `app/src/i18n/locales/{en,pt,es}.json`. English leads with the result:

- `cardGateTitle`: "Your post goes live and every reaction counts"
- `hiddenPostBanner`: "Your first post is saved and hidden until you start your trial."
- `cardGateCta`: "Start 7-day trial"

pt is pt-BR, es is neutral Latin American, sentence case. Verify parity:

```bash
node -e "const k=(o,p='')=>Object.entries(o).flatMap(([a,b])=>typeof b==='object'?k(b,p+a+'.'):[p+a]);const L=n=>new Set(k(require('./app/src/i18n/locales/'+n+'.json')));const [e,p,s]=['en','pt','es'].map(L);console.log('missing pt',[...e].filter(x=>!p.has(x)),'missing es',[...e].filter(x=>!s.has(x)),'extra',[...p].filter(x=>!e.has(x)).concat([...s].filter(x=>!e.has(x))))"
```

Expected: three empty arrays.

- [ ] **Step 18: Update the docs**

`docs/PLATFORM.md` §14 — the onboarding chain now lands on the feed, and the card gate is a banner plus a
tap-bound dialog rather than disabled controls. §11 — the client-side gate behaviour. Do not touch §17: the
server-side control is unchanged.

- [ ] **Step 19: Verify the whole repo**

```bash
pnpm verify
```

Expected: exit 0. If `format:check` flags a file **you touched**, fix it by hand — never run `pnpm format`.

- [ ] **Step 20: Confirm the server gate is untouched**

```bash
git diff --stat -- convex/lib/access.ts convex/ai/comments.ts
```

Expected: no output. If either file appears, revert your edit to it by hand (not with `git checkout`).

---

### Task 2: R08 — Upgrade at the moment of the limit

**Files:**

- Create: `app/src/components/UpgradeAtLimit.tsx`, `app/src/components/UpgradeAtLimit.test.tsx`
- Modify: `convex/lib/planLimits.ts`, `convex/posts.ts:232-236,521-523`, `app/src/lib/errors.ts`,
  `app/src/components/PostComposer.tsx:13`, `app/src/pages/MyPostsPage.tsx:167-177,188`,
  `app/src/pages/SettingsPage.tsx:440-444`
- Test: `convex/lib/planLimits.test.ts` (append), `app/src/lib/errors.test.ts` (append),
  `app/src/pages/MyPostsPage.test.tsx` (append)
- Docs: `docs/PLATFORM.md` §9, §11, §14, §8

**Interfaces:**

- Consumes: `captureEvent` and `resolveTargetPlan` from Task 1.
- Produces, relied on by Task 3 and Task 5: nothing structural. Task 4 uses none of it.
    - `nextTier(tier: Tier): 'growth' | 'pro' | null` from `convex/lib/planLimits.ts`
    - `api.posts.getTierLimits` →
      `Record<Tier, { interactionsPerPost: number; postsPerWeek: number; featuredPerMonth: number }>`
    - `mapLimitError(msg: string, t: TFunction): string` from `app/src/lib/errors.ts`

- [ ] **Step 1: Read the spec sections that govern this task**

Read §2.1, §2.2 and §4 of the spec, and `backlog/revenue/R08-upgrade-at-the-moment-of-the-limit.md`'s **Do / Don't**.
Note the two hard rules: never send a Pro or contact member to a checkout, and never write
"Upgrade to unlock more features".

- [ ] **Step 2: Write the failing test for `nextTier`**

Append to `convex/lib/planLimits.test.ts` (create it if absent, following the sibling convex test
convention — pure logic only, no `convex-test`):

```ts
import { describe, expect, it } from 'vitest'
import { nextTier } from './planLimits'

describe('nextTier', () => {
  it('climbs the ladder', () => {
    expect(nextTier('starter')).toBe('growth')
    expect(nextTier('growth')).toBe('pro')
  })

  it('returns null at the top so callers render a contact line, never a checkout link', () => {
    expect(nextTier('pro')).toBeNull()
    expect(nextTier('contact')).toBeNull()
  })
})
```

- [ ] **Step 3: Run it and confirm it fails**

```bash
pnpm --filter convex exec vitest run lib/planLimits.test.ts
```

Expected: FAIL — `nextTier` is not exported.

- [ ] **Step 4: Implement `nextTier`**

In `convex/lib/planLimits.ts`, beside `DEFAULTS`:

```ts
export type Tier = 'starter' | 'growth' | 'pro' | 'contact'

/**
 * The next tier up the ladder, or null at the top. null means the caller renders a contact line
 * rather than a checkout link — Pro gets the Enterprise contact line, contact gets the custom-limit
 * line (decided 2026-09-05). Callers branch on the tier itself to pick between those two.
 */
export function nextTier(tier: Tier): 'growth' | 'pro' | null {
  return tier === 'starter' ? 'growth' : tier === 'growth' ? 'pro' : null
}
```

Reuse this `Tier` alias for the existing `Record<'starter' | 'growth' | 'pro' | 'contact', PlanLimits>`
annotations in the file so the union is written once.

- [ ] **Step 5: Run it and confirm it passes**

```bash
pnpm --filter convex exec vitest run lib/planLimits.test.ts
```

Expected: PASS.

- [ ] **Step 6: Add the public `getTierLimits` query**

In `convex/posts.ts`, directly after `getFeaturedUsage` (`:150-171`):

```ts
/**
 * Public: the plan-limit numbers for every tier, so a component can name the NEXT tier's numbers
 * ("Growth gives you 2") — something getWeeklyUsage/getFeaturedUsage cannot do, since they answer
 * only for the caller's own tier. No auth: these are the same public pricing limits the landing
 * page states. Per-user contact-tier overrides are deliberately NOT resolved here — the contact
 * tier renders a custom-limit line, never a number.
 */
export const getTierLimits = query({
  args: {},
  handler: async ctx => {
    const rows = await ctx.db.query('planLimits').collect()
    const byTier = (tier: Tier) => {
      const row = rows.find(r => r.tier === tier && r.userId === undefined)
      return {
        interactionsPerPost: row?.interactionsPerPost ?? DEFAULTS[tier].interactionsPerPost,
        postsPerWeek: row?.postsPerWeek ?? DEFAULTS[tier].postsPerWeek,
        featuredPerMonth: row?.featuredPerMonth ?? DEFAULTS[tier].featuredPerMonth
      }
    }
    return { starter: byTier('starter'), growth: byTier('growth'), pro: byTier('pro'), contact: byTier('contact') }
  }
})
```

Check how tier-default rows are distinguished from per-user override rows in `getPlanLimitsHelper` and
match that predicate exactly — the schema comment on `planLimits.userId` is authoritative. If the table
has a `by_tier` index, use it instead of `.collect()`.

- [ ] **Step 7: Write the failing error-mapping test**

Append to `app/src/lib/errors.test.ts`:

```ts
import { mapLimitError } from './errors'

describe('mapLimitError', () => {
  const t = ((key: string, opts?: { limit?: number }) => `${key}:${opts?.limit}`) as never

  it('maps the weekly-cap code to a localized string with the number', () => {
    expect(mapLimitError('WEEKLY_LIMIT:2', t)).toBe('errors.weeklyLimit:2')
  })

  it('maps the featured-cap code', () => {
    expect(mapLimitError('FEATURED_LIMIT:1', t)).toBe('errors.featuredLimit:1')
  })

  it('passes anything else through untouched', () => {
    expect(mapLimitError('Something else broke', t)).toBe('Something else broke')
  })
})
```

- [ ] **Step 8: Run it and confirm it fails**

```bash
pnpm --filter app exec vitest run src/lib/errors.test.ts
```

Expected: FAIL — `mapLimitError` is not exported.

- [ ] **Step 9: Implement the codes on both sides**

`convex/posts.ts:232-236`:

```ts
      if (recentPostCount >= planLimits.postsPerWeek) {
        // Prefixed code, not prose: ConvexError.data survives production redaction and the client
        // localizes it (same pattern as PAYMENT_REQUIRED:). See app/src/lib/errors.ts.
        throw new ConvexError(`WEEKLY_LIMIT:${planLimits.postsPerWeek}`)
      }
```

`convex/posts.ts:521-523`: the same shape with `` `FEATURED_LIMIT:${limits.featuredPerMonth}` ``.

`app/src/lib/errors.ts`, beside `friendlyError`:

```ts
/** Turn a prefixed backend limit code into localized copy; anything else passes through. */
export function mapLimitError(msg: string, t: TFunction): string {
  const m = msg.match(/^(WEEKLY_LIMIT|FEATURED_LIMIT):(\d+)$/)
  if (!m) return msg
  const key = m[1] === 'WEEKLY_LIMIT' ? 'errors.weeklyLimit' : 'errors.featuredLimit'
  return t(key, { limit: Number(m[2]) })
}
```

Then wire it at both call sites that surface those submits — `MyPostsPage.handleSubmit` and the feed
composer — as `mapLimitError(friendlyError(err, String(err)), t)`.

- [ ] **Step 10: Run it, then find and fix the convex tests asserting the old strings**

```bash
pnpm --filter app exec vitest run src/lib/errors.test.ts
grep -rn "Weekly post limit reached\|Monthly featured-post limit reached" convex app
pnpm --filter convex test
```

Expected: the app test passes; the grep finds any convex test still asserting the English prose; update
those to assert the code. `pnpm --filter convex test` ends green.

- [ ] **Step 11: Write the failing `UpgradeAtLimit` tests**

Create `app/src/components/UpgradeAtLimit.test.tsx`. Mock `convex/react`'s `useQuery` to return `getMe`,
`getTierLimits` and `getSubscriptionInfo` by the mocked api key, following the `ContactLimitsModal.test.tsx`
multi-query pattern. Cover:

```tsx
  it('links a starter member to the growth checkout carrying their interval', () => {
    // tier 'starter', priceInterval 'year'
    render(<UpgradeAtLimit limit="weeklyPosts" />)
    expect(screen.getByRole('link')).toHaveAttribute('href', '/billing?plan=growth&interval=annual')
  })

  it('names the next tier numbers from the query, never a hardcoded value', () => {
    // getTierLimits mocked with growth.postsPerWeek = 7
    render(<UpgradeAtLimit limit="weeklyPosts" />)
    expect(screen.getByText(/7/)).toBeInTheDocument()
  })

  it('gives a pro member the enterprise contact line, never a checkout link', () => {
    render(<UpgradeAtLimit limit="featured" />)
    expect(screen.getByRole('link')).toHaveAttribute('href', 'mailto:contact@linkintothessi.com')
  })

  it('gives a contact-tier member the custom-limit line and never prints the 9999 sentinel', () => {
    render(<UpgradeAtLimit limit="featured" />)
    expect(screen.queryByText(/9999/)).not.toBeInTheDocument()
  })
```

- [ ] **Step 12: Run them and confirm they fail**

```bash
pnpm --filter app exec vitest run src/components/UpgradeAtLimit.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 13: Build `UpgradeAtLimit`**

```tsx
type LimitKind = 'weeklyPosts' | 'featured' | 'interactionCap' | 'visibility'
export default function UpgradeAtLimit({ limit, className }: { limit: LimitKind; className?: string })
```

- Reads `api.users.getMe` (tier), `api.posts.getTierLimits` (numbers), `api.users.getSubscriptionInfo`
  (interval — map `priceInterval` `'year' → 'annual'`, `'month' → 'monthly'`, exactly as
  `BillingPage.tsx` already does).
- Renders **one sentence and one link**. Nothing else: no icon row, no secondary link, no badge stack.
- `starter` / `growth` → `/billing?plan=${nextTier(tier)}&interval=${chargedInterval}`, label `upgrade.cta`.
  A member who already has a card must reach the portal switch path — mirror
  `BillingPage.handlePlanClick`'s `hasCard` decision rather than re-deriving it.
- `pro` → `upgrade.proContact` + `mailto:${SUPPORT_EMAIL}`; `contact` → `upgrade.contactCustom` + the same
  mailto. Follow the `BillingPage.tsx:424-435` markup.
- Copy per kind, numbers interpolated, loss-framed — e.g. `upgrade.weeklyPosts`: "You've used your
  {{used}} post this week. {{nextPlan}} gives you {{next}}, each collecting up to {{interactions}}
  interactions." Never "Upgrade to unlock more features".
- Guard the featured number with `isUnlimitedFeatured` from `convex/lib/postLimit`.
- On click: `captureEvent('upgrade_at_limit_clicked', { limit, plan })`.
- Render nothing while any query is `undefined`.

- [ ] **Step 14: Run them and confirm they pass**

```bash
pnpm --filter app exec vitest run src/components/UpgradeAtLimit.test.tsx
```

Expected: PASS, 4 tests.

- [ ] **Step 15: Place it at all four moments**

1. `app/src/components/PostComposer.tsx:13` — widen `limitHint?: string` to `limitHint?: ReactNode`
   (`import type { ReactNode } from 'react'`); the render at `:57-58` needs no change.
2. `app/src/pages/MyPostsPage.tsx:188` — pass `limitHint={<UpgradeAtLimit limit="weeklyPosts" />}`.
3. `app/src/pages/MyPostsPage.tsx:167-177` — when `featuredAtCap`, render
   `<UpgradeAtLimit limit="featured" />` under the pill row.
4. In the My Posts list, a post with `interactionLimitReached` gets a `Badge variant="warning"` reading
   `myPosts.interactionCapBadge` ("Reached {{limit}} interactions and left the feed") plus
   `<UpgradeAtLimit limit="interactionCap" />`. The flag is already on the returned post shape
   (`convex/posts.ts:439,473,533,567`) — add it to the local `MyPost` interface at
   `MyPostsPage.tsx:20-30`. **No toast, no notice on the next feed visit.**
5. `app/src/pages/SettingsPage.tsx:440-444` — replace the `settings.upgradePrompt` paragraph with
   `<UpgradeAtLimit limit="visibility" />`. Remove `settings.upgradePrompt` from all three locales if
   nothing else uses it (grep first).

- [ ] **Step 16: Add the i18n keys to all three locales**

`upgrade.weeklyPosts`, `upgrade.featured`, `upgrade.interactionCap`, `upgrade.visibility`, `upgrade.cta`,
`upgrade.proContact`, `upgrade.contactCustom`, `myPosts.interactionCapBadge`, `errors.weeklyLimit`,
`errors.featuredLimit`. Run the parity command from Task 1 Step 17; expect three empty arrays.

- [ ] **Step 17: Update the docs**

`docs/PLATFORM.md` §9 (the upgrade path at each cap; the two new error codes), §11 (the author-facing
post-cap state), §14 (the component and its four placements), §8 (deep-link and switch-plan routing).

- [ ] **Step 18: Verify**

```bash
pnpm verify
```

Expected: exit 0.

---

### Task 3: R06 — Trial progress where the work happens

**Files:**

- Create: `app/src/components/TrialMeter.tsx`, `app/src/components/shell/TrialProgressCard.tsx`
- Modify: `app/src/pages/BillingPage.tsx:157-175`, `app/src/components/shell/Sidebar.tsx`,
  `app/src/components/shell/TopBar.tsx`
- Test: `app/src/components/shell/Sidebar.test.tsx`, `app/src/components/shell/TopBar.test.tsx`
- Docs: `docs/PLATFORM.md` §14

**Interfaces:**

- Consumes: nothing from Tasks 1–2 structurally.
- Produces, relied on by Task 4: `TrialMeter` — default export, props
  `{ progress: { made: number; received: number; combined: number; threshold: number; nearThreshold: boolean; trialEndsAt?: number } }`.
  Task 4 edits the same `BillingPage.tsx`, so this extraction must land first.

- [ ] **Step 1: Read the spec sections that govern this task**

Read §5 of the spec and `backlog/revenue/R06-trial-progress-where-the-work-happens.md`'s **Do / Don't**. Two
decisions are already closed: the made/received line is **plain text with no link** (D3), and the sidebar
keeps the SSI link with a Sales Navigator qualifier plus a new Recap entry pointing at `/feed` (D4).

- [ ] **Step 2: Extract the meter with no visual change**

Move the bar, count and days-left markup out of `app/src/pages/BillingPage.tsx:157-175` into
`app/src/components/TrialMeter.tsx`, taking the `getTrialProgress` result as a prop. BillingPage renders
`<TrialMeter progress={progress} />`. Its rendered output must be identical — this step is a pure move.

- [ ] **Step 3: Confirm nothing changed on the billing page**

```bash
pnpm --filter app exec vitest run src/pages/BillingPage.test.tsx
```

Expected: PASS with no test edits. If a test fails, the move was not pure — fix the component, not the test.

- [ ] **Step 4: Write the failing Sidebar tests**

Create or extend `app/src/components/shell/Sidebar.test.tsx`. Mock `convex/react`'s `useQuery` to drive
`getMe` and `getTrialProgress`; wrap in a `MemoryRouter` (the component uses `Link` and `useLocation`).

```tsx
  it('shows the trial card while trialing', () => {
    // getMe → { subscriptionStatus: 'trialing', tier: 'growth' }, progress → combined 12 of 50
    renderSidebar()
    expect(screen.getByText(/12/)).toBeInTheDocument()
    expect(screen.getByText(/50/)).toBeInTheDocument()
  })

  it.each(['none', 'active', 'canceled'])('hides the trial card for %s', status => {
    renderSidebar({ subscriptionStatus: status })
    expect(screen.queryByTestId('trial-progress-card')).not.toBeInTheDocument()
  })

  it('switches to the amber near-threshold state', () => {
    renderSidebar({ subscriptionStatus: 'trialing' }, { combined: 40, nearThreshold: true })
    expect(screen.getByTestId('trial-progress-card')).toHaveAttribute('data-near', 'true')
  })

  it('keeps the SSI link with its Sales Navigator note and adds the recap entry', () => {
    renderSidebar()
    expect(screen.getByRole('link', { name: /ssi/i })).toHaveAttribute('href', 'https://linkedin.com/sales/ssi')
    expect(screen.getByRole('link', { name: /recap/i })).toHaveAttribute('href', '/feed')
  })
```

- [ ] **Step 5: Run them and confirm they fail**

```bash
pnpm --filter app exec vitest run src/components/shell/Sidebar.test.tsx
```

Expected: FAIL.

- [ ] **Step 6: Build `TrialProgressCard` and mount it**

`app/src/components/shell/TrialProgressCard.tsx` renders, inside a `data-testid="trial-progress-card"`
wrapper with `data-near={String(progress.nearThreshold)}`:

- `<TrialMeter progress={progress} />`
- `shell.trialGoal` — "Interactions build your SSI habit. Your {{plan}} plan starts at 50 or on {{date}}."
  The plan name comes from `billing.plans.<tier>.name`; the date from `progress.trialEndsAt`, formatted with
  the same locale helper BillingPage uses. **Name the plan start every time the number appears** — the meter
  must read as a goal, never as "38 left before billing".
- `shell.trialMadeReceived` — "made {{made}} · received {{received}}" as **plain text, no link**.
- At `nearThreshold`: the amber state, `shell.trialNearEnd`, and a link to `/billing`.

In `Sidebar.tsx`, read `isTrialing` from the existing `useCardGate()` call at `:12`, subscribe
`api.users.getTrialProgress` with `'skip'` unless `isTrialing`, and render the card above the `<nav>`.

In the footer (`:62-70`): keep the SSI anchor and add `nav.viewSsiNote` beneath it as muted text — the page
is behind Sales Navigator, so the qualifier stops the link reading as a broken promise. Add a Recap `Link`
to `/feed` beside it, labelled `nav.recap`.

- [ ] **Step 7: Run them and confirm they pass**

```bash
pnpm --filter app exec vitest run src/components/shell/Sidebar.test.tsx
```

Expected: PASS.

- [ ] **Step 8: Write the failing TopBar test**

```tsx
  it('shows a trial pill linking to billing, hidden on large screens', () => {
    renderTopBar({ subscriptionStatus: 'trialing' }, { combined: 12, threshold: 50 })
    const pill = screen.getByRole('link', { name: /12\s*\/\s*50/ })
    expect(pill).toHaveAttribute('href', '/billing')
    expect(pill.className).toContain('lg:hidden')
  })

  it('renders no pill when the member is not trialing', () => {
    renderTopBar({ subscriptionStatus: 'active' })
    expect(screen.queryByRole('link', { name: /\d+\s*\/\s*\d+/ })).not.toBeInTheDocument()
  })
```

- [ ] **Step 9: Run it, implement the pill, run it again**

```bash
pnpm --filter app exec vitest run src/components/shell/TopBar.test.tsx
```

Expected FAIL, then PASS after adding the pill to `TopBar.tsx` before `LanguageMenu`. The sidebar is a closed
drawer below `lg`, so the meter must not live only there.

- [ ] **Step 10: Add the i18n keys to all three locales**

`shell.trialGoal`, `shell.trialStartsAt`, `shell.trialNearEnd`, `shell.trialMadeReceived`, `shell.trialPill`,
`nav.viewSsiNote`, `nav.recap`. Run the parity command; expect three empty arrays.

- [ ] **Step 11: Check the sidebar still fits**

Open the app and confirm the trial card does not push the footer below the fold at 1280×768 with the card in
its amber state (the tallest variant). If it does, tighten the card, never the footer.

- [ ] **Step 12: Update the docs and verify**

`docs/PLATFORM.md` §14 — the shell trial card, the mobile pill, the shared `TrialMeter`, and the note that
the meter now renders in the shell as well as on the billing page.

```bash
pnpm verify
```

Expected: exit 0.

---

### Task 4: R07 — Celebrate activation

**Files:**

- Create: `app/src/components/CheckoutSuccessDialog.tsx`
- Modify: `app/src/pages/BillingPage.tsx`
- Test: `app/src/pages/BillingPage.test.tsx` (append)
- Docs: `docs/PLATFORM.md` §14, §8

**Interfaces:**

- Consumes: `captureEvent` and `useHasHiddenOwnPost` from Task 1; `TrialMeter` already extracted by Task 3.
- Produces: nothing later tasks depend on.

- [ ] **Step 1: Read the spec sections that govern this task**

Read §6 of the spec and `backlog/revenue/R07-celebrate-activation-and-reinforce-checkout.md`'s **Do / Don't**.
Henriko's draft sentence in that doc is explicitly **not** to ship as written — three exclamation marks, a
hedge and a pull-quote ending.

- [ ] **Step 2: Write the failing tests**

Append to `app/src/pages/BillingPage.test.tsx`:

```tsx
  it('opens the celebration once when returning from checkout with the status already flipped', () => {
    renderBilling({ search: '?success=true', me: { subscriptionStatus: 'trialing', tier: 'growth' } })
    expect(screen.getByRole('dialog')).toHaveTextContent(/you're in/i)
    expect(mockSetSearchParams).toHaveBeenCalledWith({}, { replace: true })
  })

  it('shows the activating state while the webhook has not landed', () => {
    renderBilling({ search: '?success=true', me: { subscriptionStatus: 'none' } })
    expect(screen.getByText(/activating your trial/i)).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('changes nothing on a plain visit', () => {
    renderBilling({ search: '', me: { subscriptionStatus: 'active' } })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
```

Follow the existing file's render helper and `useSearchParams` mock — `AdminPage.test.tsx:59` shows the
`mockSetSearchParams` pattern already used in this repo.

- [ ] **Step 3: Run them and confirm they fail**

```bash
pnpm --filter app exec vitest run src/pages/BillingPage.test.tsx
```

Expected: FAIL on the first two cases.

- [ ] **Step 4: Read and strip the parameter**

In `BillingPage.tsx`, change `const [searchParams] = useSearchParams()` to also take the setter. On mount,
when `searchParams.get('success') === 'true'`, set `justSubscribed` and call
`setSearchParams({}, { replace: true })` in an effect, so a refresh never repeats the celebration.

- [ ] **Step 5: Build the waiting state**

While `justSubscribed && me?.subscriptionStatus === 'none'`, render an inline `billing.activating` block —
"Activating your trial…". `getMe` is reactive, so the webhook flip updates it with no polling. Start a 20s
timer; on expiry swap to `billing.activatingTimeout` — "Your payment went through; your plan will show here
shortly" — with the Manage button visible, and report the case to Sentry via the existing `scrubError` path
so a genuinely lost webhook is visible. The copy never blames the member and never says "webhook".

- [ ] **Step 6: Build the celebration**

`app/src/components/CheckoutSuccessDialog.tsx`, on the shadcn `Dialog`:

- Title `billing.successTitle` — "You're in."
- Body `billing.successBody` — "Your {{plan}} trial is live." — plus `billing.successPostLive` — "Your first
  post is now in the feed." — rendered only when `useHasHiddenOwnPost` was true before the flip. Capture that
  value into state before the status changes; once the webhook reveals the post it is no longer hidden.
- One reinforcing line from `billing.plans.<id>.description`. No upsell, no discount, no unverifiable number.
- Primary `billing.successCta` → `/feed`; secondary `billing.successStay` closes the dialog.
- Fire `captureEvent('checkout_success_viewed', { plan })` when it opens.

Copy rule: keep the outcome Henriko wants — a real LinkedIn presence that gets the right people to find you; never
"the next role" or "a client", the R11 one-ICP rule says what arrives is never named (amended 2026-09-06) — one idea
per sentence, plain verbs, no exclamation marks, no confetti library, no tour.

- [ ] **Step 7: Run them and confirm they pass**

```bash
pnpm --filter app exec vitest run src/pages/BillingPage.test.tsx
```

Expected: PASS, all cases.

- [ ] **Step 8: Add the i18n keys to all three locales**

`billing.successTitle`, `billing.successBody`, `billing.successPostLive`, `billing.successCta`,
`billing.successStay`, `billing.activating`, `billing.activatingTimeout`. Run the parity command; expect
three empty arrays.

- [ ] **Step 9: Update the docs and verify**

`docs/PLATFORM.md` §14 (the BillingPage success and activating states) and §8 (the checkout return leg now
has a client-side state).

```bash
pnpm verify
```

Expected: exit 0.

---

### Task 5: R05 — Never ship a blank feed

**Files:**

- Create: `app/src/components/EmptyFeed.tsx`, `app/src/components/EmptyFeed.test.tsx`
- Modify: `app/src/pages/FeedPage.tsx:129-133`, `app/src/components/PostComposer.tsx`,
  `app/src/i18n/locales/{en,pt,es}.json`
- Test: `app/src/pages/FeedPage.test.tsx` (append)
- Docs: `docs/PLATFORM.md` §14, §21

**Interfaces:**

- Consumes: `useHasHiddenOwnPost` and `CardGateBanner` from Task 1.
- Produces: nothing.

- [ ] **Step 1: Read the spec sections that govern this task**

Read §7 of the spec and `backlog/revenue/R05-never-ship-a-blank-feed.md`'s **Do / Don't**. Two absolutes: no
placeholder posts or invented counts, and the checklist never claims a gated member's post is live.

- [ ] **Step 2: Write the failing tests**

Create `app/src/components/EmptyFeed.test.tsx`:

```tsx
  it('offers one action that focuses the composer', () => {
    render(<EmptyFeed gated={false} hasOwnPost={false} made={0} />)
    fireEvent.click(screen.getByRole('button', { name: /share your first post/i }))
    expect(document.activeElement).toBe(document.getElementById('post-url-input'))
  })

  it('opens the checklist at 1 of 3', () => {
    render(<EmptyFeed gated={false} hasOwnPost={false} made={0} />)
    expect(screen.getByText(/1 \/ 3|1 of 3/i)).toBeInTheDocument()
  })

  it('hides the checklist once every step is done', () => {
    render(<EmptyFeed gated={false} hasOwnPost made={2} />)
    expect(screen.queryByTestId('activation-checklist')).not.toBeInTheDocument()
  })

  it('shows the card-gate banner instead of the checklist for a gated member with a hidden post', () => {
    render(<EmptyFeed gated hasOwnPost made={0} />)
    expect(screen.getByText(/saved and hidden/i)).toBeInTheDocument()
    expect(screen.queryByTestId('activation-checklist')).not.toBeInTheDocument()
  })
```

Append to `app/src/pages/FeedPage.test.tsx`: an empty unfiltered feed renders `EmptyFeed`; an empty **filtered** feed
still renders `feed.emptyFiltered` with its existing recovery copy.

- [ ] **Step 3: Run them and confirm they fail**

```bash
pnpm --filter app exec vitest run src/components/EmptyFeed.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 4: Give the composer a focusable id**

In `app/src/components/PostComposer.tsx`, give the URL input a stable `id="post-url-input"`. No ref plumbing.

- [ ] **Step 5: Build `EmptyFeed`**

Props `{ gated: boolean; hasOwnPost: boolean; made: number }`.

- Headline `feed.emptyTitle` — "Your feed fills as members post"; one line `feed.emptyBody`; one primary
  button `feed.emptyCta` — "Share your first post" — that scrolls to and focuses `#post-url-input`. One
  action, never a menu.
- When `gated && hasOwnPost`: render `<CardGateBanner />` **instead of** the checklist. One progress element
  per state.
- Otherwise a `data-testid="activation-checklist"` block, hidden once all three are done:
    1. signed in with LinkedIn — always done, so the bar opens at 1 of 3
    2. shared a first post — done when `hasOwnPost`; for a gated member the label says the post is **saved and
       waiting for the trial**, never that it is live
    3. reacted to two posts — done when `made >= 2`
- No placeholder posts, no invented counts, no sample data.

In `FeedPage.tsx:129-133`, replace the paragraph: when `filterActive`, keep `feed.emptyFiltered`; otherwise
render `<EmptyFeed gated={gated} hasOwnPost={hasHiddenPost || hasAnyOwnPost} made={progress?.made ?? 0} />`.
Subscribe `getTrialProgress` here with `'skip'` when there is no session.

- [ ] **Step 6: Run them and confirm they pass**

```bash
pnpm --filter app exec vitest run src/components/EmptyFeed.test.tsx src/pages/FeedPage.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Delete the invite line and add the new keys**

Remove `feed.empty` from `en.json`, `pt.json` and `es.json` — it advertises an invite feature that does not
exist, and a CTA to a missing feature is a dead click. Confirm nothing still references it:

```bash
grep -rn "feed\.empty'" app/src ; grep -rn '"feed.empty"' app/src
```

Expected: only `feed.emptyFiltered`, `feed.emptyTitle`, `feed.emptyBody`, `feed.emptyCta`.

Add `feed.emptyTitle`, `feed.emptyBody`, `feed.emptyCta`, `feed.checklist.title`, `feed.checklist.signedIn`,
`feed.checklist.firstPost`, `feed.checklist.reactTwice` to all three locales. Run the parity command.

- [ ] **Step 8: Check the one-result state**

Render the feed with exactly one post and confirm it does not look broken in a layout built for twenty.

- [ ] **Step 9: Update the docs**

`docs/PLATFORM.md` §14 (the feed empty state, the checklist and its data sources) and §21 (a launch-checklist
line naming the minimum live posts, submitted by real members through the normal composer, before sign-ups
open — the dev seed never goes to production).

- [ ] **Step 10: Close out the backlog**

Flip R04, R05, R06, R07 and R08 to `**Status:** DONE` in `backlog/revenue/`. Edit
`backlog/revenue/R15-interactions-recap-page.md` to record the two deferrals: the `nearCap` prop for the 80%
moment, and re-pointing both the sidebar Recap entry (currently `/feed`) and R06's made/received line at
`/recap` when R15 ships.

- [ ] **Step 11: Final verification**

```bash
pnpm verify
```

Expected: exit 0. Report the actual output; do not claim green without it.

---

## Self-Review

**Spec coverage.** §2.1 → Task 2 Steps 2-5. §2.2 → Task 2 Step 6. §2.3 → Task 1 Step 6. §2.4 → all five tasks.
§3.1 → Task 1 Steps 7-10. §3.2 → Task 1 Steps 15-16. §3.3 → Task 1 Steps 11-14. §3.4 → Task 1 Step 20.
§3.5 → Task 1 Steps 6, 15. §4.1 → Task 2 Steps 11-14. §4.2 → Task 2 Step 15. §4.3 → Task 2 Steps 7-10.
§5 → Task 3. §6 → Task 4. §7 → Task 5. §8 → the i18n step in each task. §9 → the test steps throughout.
§10 → the docs step in each task plus Task 5 Step 10. §11 → Global Constraints. No gaps.

**Deliberate deviation from the writing-plans template:** every task ends in a verification step rather than
a commit step, because the project's CLAUDE.md forbids commits outright.

**Type consistency.** `nextTier`, `resolveTargetPlan`, `captureEvent`, `mapLimitError`, `useHasHiddenOwnPost`
and `LimitKind` are each defined once and referenced with the same signature everywhere they reappear.
