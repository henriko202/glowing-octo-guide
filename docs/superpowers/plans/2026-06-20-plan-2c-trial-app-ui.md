# Plan 2C — Trial App UI (Card-Gate, X/50 Progress, SSI Link-out, Always-Growth)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Checkbox tracking. **Depends on
Plans 2A + 2B** (billing + trial backend, both implemented). Lands **on top of the app/ UI revamp** (Phases 1–4 already
> in).

**Goal:** Build the in-product trial UI on the now-revamped `app/`: a soft **card-gate** (disabled engagement + an "add
a card" message + a **pulsing Billing nav**), an **X/50 interaction-progress** display, a **"View your SSI on LinkedIn"
** link-out, an **always-Growth** trial-start, and a **"what you'll miss"** prompt when a trialing user picks a lower
plan.

**Architecture:** A new `getTrialProgress` Convex query exposes the `trialInteractionsMade/Received` counters (from 2B).
A shared `useCardGate()` hook derives the gate from `getMe` (mirrors the backend `canEngage`: gated = signed-in, not
admin, status ∉ {trialing, active}). The feed threads a `gated` boolean into `PostCard` to disable
react/comment/view-on-LinkedIn; the sidebar pulses Billing + adds the SSI link; BillingPage gains the X/50 meter, the
SSI link, the always-Growth CTA, and the downgrade prompt. The backend already enforces the gate (`assertCanEngage`) —
this is the UX layer.

**Tech Stack:** React 19 + Vite, Tailwind v4 (tokens via `@theme inline` in `app/src/index.css`; `tw-animate-css`
available), react-i18next (en/pt/es), Convex. pnpm.

**Source maps:** written from full reads of `app/src/components/shell/{navItems,Sidebar,AppShell}.tsx`,
`app/src/components/{PostCard,CommentBox}.tsx`, `app/src/pages/{FeedPage,BillingPage}.tsx`, `app/src/i18n/*`.

## Global Constraints

- **NEVER run ANY git state-changing command** — no `commit`/`push`/`add`/`stash`/`checkout`/`reset`/`restore`/`rm`/
  `clean`. File edits only. (A prior run lost work to a stray `git stash`.)
- **Gate logic = mirror `canEngage`:** `gated` ⇔ `me` loaded AND `!me.isAdmin` AND
  `subscriptionStatus ∉ {trialing, active}`. Admins are never gated.
- **Always-Growth trial:** any trial-start CTA checks out the **Growth** price (`PLAN_PRICE_IDS[interval].growth`),
  respecting the monthly/annual toggle.
- **Honesty:** SSI is link-out only (`https://linkedin.com/sales/ssi`, new tab) — never a displayed score. No fabricated
  numbers.
- **i18n:** every new string goes in all three of `en.json`, `pt.json`, `es.json` under `billing`/`feed`/`nav`. Plurals
  use the `_one`/`_other` suffix pattern.
- **Tokens only** (Tailwind v4 vars): gold = `text-primary`/`bg-primary`; `text-gold-text`; sidebar tokens. No new hex.
- **Pure logic gets a unit test** (Vitest, mock `convex/server`).

### Verification

```bash
pnpm --filter convex exec tsc --noEmit -p tsconfig.json
pnpm --filter app exec tsc --noEmit
pnpm -r test
# scoped lint on changed files (repo-wide lint has pre-existing app WIP noise)
```

---

## File Structure

| Action | Path                                   | Responsibility                                                                             |
|--------|----------------------------------------|--------------------------------------------------------------------------------------------|
| Modify | `convex/users.ts`                      | New `getTrialProgress` query (made/received/combined/threshold/reached/status/trialEndsAt) |
| Create | `app/src/hooks/useCardGate.ts`         | Shared gate hook from `getMe`                                                              |
| Modify | `app/src/components/shell/Sidebar.tsx` | Pulse the Billing nav item when gated; add the SSI link-out                                |
| Modify | `app/src/components/PostCard.tsx`      | `gated` prop → disable react/comment/view-on-LinkedIn + gate hint                          |
| Modify | `app/src/components/CommentBox.tsx`    | Detect `PAYMENT_REQUIRED`; disable submit/generate when gated                              |
| Modify | `app/src/pages/FeedPage.tsx`           | Use `useCardGate`; wrap `react()` in try/catch; pass `gated` to PostCard                   |
| Modify | `app/src/pages/BillingPage.tsx`        | X/50 meter + SSI link; always-Growth CTA; "what you'll miss"; fix stale calendar copy      |
| Modify | `app/src/i18n/locales/{en,pt,es}.json` | New strings                                                                                |
| Modify | `docs/PLATFORM.md`                     | §14 (app) trial-UI notes                                                                   |

---

## Task 1: Backend `getTrialProgress` query

**Files:** Modify `convex/users.ts`

**Interfaces — Produces:**
`api.users.getTrialProgress({ sessionToken }) → { made, received, combined, threshold, reached, status, trialEndsAt }`

- [ ] **Step 1:** In `convex/users.ts`, add a `getTrialProgress` query. **Mirror the exact session/auth pattern of the
  existing `getMe` query** in the same file (same `sessionToken` arg + session resolution; return an empty/neutral shape
  if unauthenticated, matching how `getMe` handles it). Import `TRIAL_INTERACTION_THRESHOLD` from
  `./lib/trialMilestone`.

```ts
// add near getMe; copy getMe's auth/session resolution exactly.
export const getTrialProgress = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    const user = /* resolve via the same helper getMe uses */ null as Doc<'users'> | null
    if (!user) return null
    const made = user.trialInteractionsMade ?? 0
    const received = user.trialInteractionsReceived ?? 0
    const combined = made + received
    return {
      made,
      received,
      combined,
      threshold: TRIAL_INTERACTION_THRESHOLD,
      reached: combined >= TRIAL_INTERACTION_THRESHOLD,
      status: user.subscriptionStatus,
      trialEndsAt: user.trialEndsAt
    }
  }
})
```

- [ ] **Step 2: Verify** — `pnpm --filter convex exec tsc --noEmit -p tsconfig.json` (0 errors). Then run
  `npx convex codegen` from the repo root (regenerates `api` so the app can call `api.users.getTrialProgress`).

- [ ] **Step 3: Checkpoint** — (`feat(trial): getTrialProgress query`).

---

## Task 2: `useCardGate` hook

**Files:** Create `app/src/hooks/useCardGate.ts`

**Interfaces — Produces:**
`useCardGate(): { gated: boolean; isTrialing: boolean; status?: string; isAdmin: boolean; me: ... }`

- [ ] **Step 1: Create the hook**

```ts
import { useQuery } from 'convex/react'
import { api } from '../convex' // match how pages import api

// Soft card-gate: mirrors the backend canEngage(). gated ⇔ signed-in, not admin,
// and status is NOT card-backed (none/canceled/past_due). Admins are never gated.
export function useCardGate() {
  const sessionToken = sessionStorage.getItem('sessionToken') ?? undefined
  const me = useQuery(api.users.getMe, sessionToken ? { sessionToken } : 'skip')
  const status = me?.subscriptionStatus
  const isAdmin = me?.isAdmin === true
  const gated = !!me && !isAdmin && status !== 'trialing' && status !== 'active'
  return { gated, isTrialing: status === 'trialing', status, isAdmin, me }
}
```

- [ ] **Step 2: Verify** — `pnpm --filter app exec tsc --noEmit` (0 errors).
- [ ] **Step 3: Checkpoint** — (`feat(trial): useCardGate hook`).

---

## Task 3: Sidebar — pulse Billing + SSI link-out

**Files:** Modify `app/src/components/shell/Sidebar.tsx`

- [ ] **Step 1:** Add `import { useCardGate } from '../../hooks/useCardGate'` and call `const { gated } = useCardGate()`
  in `Sidebar`.

- [ ] **Step 2: Pulse the Billing item.** In the nav `<Link>` map (where `item.path` is used for styling), when
  `item.path === '/billing' && gated`, add `animate-pulse text-primary` to the link's className (so the Billing item
  pulses gold). Use the existing `cn()` helper.

- [ ] **Step 3: SSI link-out.** In the sidebar footer (the `border-t` block above `<UserMenu />`), insert an anchor:

```tsx
<a
  href="https://linkedin.com/sales/ssi"
  target="_blank"
  rel="noopener noreferrer"
  className="text-gold-text mb-2 flex items-center gap-2 px-3 py-1.5 text-[13px] hover:underline"
>
  {t('nav.viewSsi')} ↗
</a>
```

(Add the `nav.viewSsi` i18n key in Task 7.)

- [ ] **Step 4: Verify** — `pnpm --filter app exec tsc --noEmit`. Visual: a no-card user sees the Billing item pulsing +
  the SSI link.
- [ ] **Step 5: Checkpoint** — (`feat(trial): pulsing billing nav + SSI link-out`).

---

## Task 4: Feed card-gate

**Files:** Modify `app/src/components/PostCard.tsx`, `app/src/components/CommentBox.tsx`, `app/src/pages/FeedPage.tsx`

- [ ] **Step 1: PostCard — accept `gated`.** Add `gated?: boolean` to PostCard's props. On the reaction `<Button>` and
  the comment `<Button>`, add `disabled={gated}` and, when gated, swap the click handler to a no-op + add
  `title={t('feed.cardGate')}` (a tooltip). Thread `gated` into the `ReactionPicker`/hover-card variant too. For the **"
  View on LinkedIn"** `<a>`: when `gated`, render a disabled
  `<button type="button" disabled title={t('feed.cardGate')}>` with the same label instead of the anchor (anchors can't
  be disabled).

- [ ] **Step 2: CommentBox — gate + detect PAYMENT_REQUIRED.** Add a `gated?: boolean` prop (passed from
  PostCard/FeedPage). Disable the submit + generate buttons when `gated`. The existing error display already shows the
  raw message; when `error?.startsWith('PAYMENT_REQUIRED')`, render the friendly `t('feed.cardGate')` + a
  `<Link to="/billing">` instead of the raw text.

- [ ] **Step 3: FeedPage — wire the gate + fix silent reaction failure.** Add `const { gated } = useCardGate()`. Pass
  `gated` to each `<PostCard>`. Wrap the `react({...})` call (currently un-try/caught) in try/catch; on a
  `PAYMENT_REQUIRED` error, surface the gate hint (a toast or an inline message) rather than failing silently.

- [ ] **Step 4: Verify** — `pnpm --filter app exec tsc --noEmit`; visual: a no-card user sees
  react/comment/view-on-LinkedIn disabled with the "add a card" hint; an active/trialing user is unaffected.
- [ ] **Step 5: Checkpoint** — (`feat(trial): card-gate the feed engagement actions`).

---

## Task 5: BillingPage — progress, SSI, always-Growth, downgrade prompt

**Files:** Modify `app/src/pages/BillingPage.tsx`

- [ ] **Step 1: X/50 progress + SSI link.** Add
  `const progress = useQuery(api.users.getTrialProgress, sessionToken ? { sessionToken } : 'skip')`. Inside the
  trial-banner block (shown when `isTrialing`), render an **X / 50 interactions** meter (`progress.combined` /
  `progress.threshold`, with a simple bar) and the SSI link-out (`https://linkedin.com/sales/ssi`, new tab). Use
  `t('billing.trialProgress', { combined, threshold })` and `t('billing.ssiLink')`.

- [ ] **Step 2: Fix stale calendar copy.** Update `planLabel` (the `PageHeader` lead) and the trial banner so they
  reflect the **50-or-7-day** model — show the X/50 dimension alongside (or instead of) "days remaining". Update the
  `billing.trialBanner` string (Task 7) to mention the 50-interaction milestone. Keep `trialEndsAt`/days as the
  secondary "or 7 days" detail.

- [ ] **Step 3: Always-Growth trial start.** For a **no-card** user (`subscriptionStatus ∈ {none, canceled}`), the
  trial-start CTA must check out the **Growth** price: `handleUpgrade(PLAN_PRICE_IDS[interval].growth!)`. Make the *
  *Growth** card the primary "Start your free trial" CTA; the Starter/Pro card CTAs in the no-card state either also
  start the Growth trial or are shown as "after your trial" (see Open Decisions). Guard against an undefined Growth
  price id.

- [ ] **Step 4: "What you'll miss" on downgrade.** When `isTrialing` (user is on the Growth trial) and they act on the *
  *Starter** card, show an inline loss-framing block (a `<div>` in the Starter card before its CTA) listing what Growth
  gives that Starter doesn't (industry+country feed filter, 50 vs 25 interactions/post, 2 vs 1 posts/week) via
  `t('billing.whatYouLlMiss')`. No modal (keeps it stateless).

- [ ] **Step 5: Verify** — `pnpm --filter app exec tsc --noEmit` + `pnpm --filter app build`; visual: trialing user sees
  X/50 + SSI link + accurate trial label; no-card user's CTA starts a Growth trial; selecting Starter while trialing
  shows the comparison.
- [ ] **Step 6: Checkpoint** — (`feat(trial): billing X/50 progress, SSI link, always-Growth CTA, downgrade prompt`).

---

## Task 6: i18n strings

**Files:** Modify `app/src/i18n/locales/{en,pt,es}.json`

- [ ] **Step 1:** Add to each locale (EN shown; translate for pt/es). `nav.viewSsi`; `feed.cardGate`;
  `billing.trialProgress`, `billing.ssiLink`, `billing.whatYouLlMiss`, and an updated `billing.trialBanner`.

```jsonc
// en.json
"nav":  { "viewSsi": "View your SSI on LinkedIn" },
"feed": { "cardGate": "Add a payment method on the Billing page to start engaging." },
"billing": {
  "trialProgress": "{{combined}} / {{threshold}} interactions",
  "ssiLink": "View your SSI on LinkedIn",
  "whatYouLlMiss": "On Starter you lose your industry-filtered feed, drop from 50 to 25 interactions per post, and from 2 to 1 posts per week.",
  "trialBanner": "You're on a free Growth trial. You'll be billed once you reach 50 interactions or after 7 days, whichever comes first."
}
```

- [ ] **Step 2: Verify** — `pnpm --filter app exec tsc --noEmit`; confirm all three locale files have every new key (no
  missing-key fallbacks).
- [ ] **Step 3: Checkpoint** — (`feat(trial): i18n strings for the trial UI`).

---

## Task 7: Docs + full verification

**Files:** Modify `docs/PLATFORM.md`

- [ ] **Step 1:** Update §14 (Frontend — Authenticated App) to document the trial UI: the `useCardGate` hook, the
  card-gate on the feed, the pulsing Billing nav, the X/50 progress + SSI link-out on Billing, the always-Growth
  trial-start, and the downgrade "what you'll miss" prompt. Note `getTrialProgress` in the relevant backend section.

- [ ] **Step 2: Full verify** — `pnpm --filter convex exec tsc --noEmit -p tsconfig.json` ·
  `pnpm --filter app exec tsc --noEmit` · `pnpm -r test` · scoped `eslint` on every changed file (`convex/users.ts` +
  the app files). All green (ignore unrelated pre-existing `FeedPage.tsx`/`FeedbackTab.tsx` WIP if still present — but
  note: this plan edits `FeedPage.tsx`, so confirm IT is clean).

- [ ] **Step 3: Checkpoint** — ready for Henriko to commit.

---

## Self-Review (plan author)

**Spec coverage:** card-gate visuals (disabled actions + message) ✓ T4 · pulsing billing nav ✓ T3 · X/50 progress ✓
T1/T5 · SSI link-out ✓ T3/T5 · always-Growth CTA ✓ T5 · "what you'll miss" downgrade ✓ T5 · admins bypass ✓ (gate
mirrors `canEngage`, T2).

**Type/interface consistency:** `getTrialProgress` shape consumed in T5; `useCardGate().gated` consumed in T3/T4;
`gated` prop threaded PostCard→CommentBox/ReactionPicker.

**Risks:** (1) `getTrialProgress` must copy `getMe`'s exact auth/session resolution — implementer reads `getMe` first. (

2) `react()` in FeedPage is currently silent — T4 adds error handling (don't regress the happy path). (3) The "View on
   LinkedIn" anchor→button swap when gated must keep the un-gated anchor behavior identical. (4) `FeedPage.tsx` had
   pre-existing WIP lint errors earlier in the session — confirm the file is currently clean before editing; if not,
   flag (
   don't fix unrelated issues).

---

## Open decisions (defaulted — tell me to change)

1. **No-card plan cards — DECIDED (single CTA):** pre-card (`none`/`canceled`/`past_due`), show ONE prominent "Start
   your free 7-day Growth trial" CTA (Growth checkout; monthly/annual via the toggle) and HIDE the 3-tier cards. The
   3-tier comparison + the "what you'll miss" downgrade prompt render only once `trialing`/`active`. (Task 5 Step 3
   implements this branch.)
2. **Gating "View on LinkedIn":** defaulted to **gated** (disabled when no card), per "even the show on LinkedIn
   button." (It's a harmless view link, so this is a deliberate pressure choice — easy to exclude if you prefer.)
3. **Trial label:** defaulted to showing **X/50 interactions** as the primary trial indicator, with "or 7 days" as
   secondary. (Could lead with days instead.)
