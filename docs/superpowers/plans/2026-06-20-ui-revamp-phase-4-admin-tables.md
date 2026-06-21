# UI Revamp — Phase 4 (Admin & Tables) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:
> executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Restyle the Admin console — `AdminPage` + the 4 tabs (Users, Feedback, MOTD, Plan Limits) + `RowActionsMenu` +
the admin modals + `useFlash` — to the warm-premium design system: tokens everywhere, `PageHeader`, a `Tabs` primitive
with **URL-driven tab selection** (§8D), `Badge` for tier/status, the existing `DropdownMenu` for row actions, and
token-styled modals.

**Architecture:** Presentation + two structural changes: (1) admin tab state moves from `useState` to the URL (
`useSearchParams`, key `tab`), and (2) `RowActionsMenu` is reimplemented on the `DropdownMenu` primitive. The "tables"
stay CSS-grid (restyled + given ARIA table roles). The bespoke `Modal` is **restyled to tokens but kept** (see Scope
calls). No admin test asserts a color, so zero test edits for restyles.

**Tech Stack:** React 19, React Router 7 (`useSearchParams`), Tailwind v4, radix-ui (Tabs, DropdownMenu), shadcn
primitives, vitest.

**Spec:** `docs/superpowers/specs/2026-06-20-ui-revamp-design.md` §7 (admin), §8D (URL state), §8A (a11y), §8E (native
select). **Reuse the Transformation Guide** (color→token map + primitive rules) from
`docs/superpowers/plans/2026-06-20-ui-revamp-phase-3-screen-sweep.md` — every task applies it, plus the Phase-4
additions below.

## Scope calls (planner decisions — flagged deviations from the spec letter, same visual outcome)

1. **Modal consolidation deferred.** The spec said migrate the bespoke `Modal.tsx` onto the shadcn `Dialog`. `Modal` is
   used by 6 components with custom props (`dismissOnBackdrop/Escape`, `panelClassName`); a full migration is a
   behavior-touching refactor that adds risk to an already-large phase. This plan **restyles `Modal.tsx` + all modal
   contents to tokens** (identical visual result) and leaves the `Dialog` consolidation as a separate quality refactor.
   Flag at the Phase-4 handoff.
2. **No new `<table>` primitive.** The data "tables" are CSS grids for column alignment. This plan restyles them to
   tokens and adds ARIA table semantics (`role="table"/"row"/"columnheader"/"cell"`) rather than restructuring to
   `<table>`. A semantic Table primitive is an optional future enhancement.

## Global Constraints

- **Commits:** agent never `git commit`/`git push`; each task → **Checkpoint (Henriko commits)**.
- **pnpm**; `pnpm --filter app exec tsc --noEmit` + the relevant test after each task. Admin is URL-only (no nav link —
  unchanged).
- **Behavior unchanged** except the two structural changes above. Keep all Convex calls, props, i18n keys, `data-testid`
  s, and `aria-*`.
- **No hardcoded palette colors** may remain in a restyled file (grep at the end of each task).

## Phase-4 additions to the Transformation Guide

- **Tabs:** active tab → `text-foreground border-primary` (gold underline); inactive →
  `text-muted-foreground hover:text-foreground`. Use the new `Tabs` primitive (Task 1), controlled by the URL.
- **Badge variant mapping:**
    - **Tier:** `starter`→`<Badge variant="outline">`, `growth`→`<Badge>` (default), `pro`→`<Badge variant="success">`,
      `contact`→`<Badge variant="warning">` (gold = premium).
    - **Subscription status:** `active`→`success`, `trialing`→`default`, `canceled`/`none`→`outline`, `past_due`→
      `destructive`. **Banned**→`destructive`.
    - **Feedback status:** `new`→`default`, `responded`→`success`, `archived`→`outline`. **Category**→`outline`.
    - **MOTD:** enabled→`success`, disabled→`outline`, important→`warning`.
- **Grid "tables":** card `border-border bg-card`; header row `bg-muted text-muted-foreground`; row dividers
  `border-border`. Add `role="table"` to the grid container, `role="row"` to each row, `role="columnheader"` to header
  cells, `role="cell"` to data cells.
- **Native `<select>`:** keep the element but style with `bg-card text-foreground border-border` (explicit colors
  satisfy §8E Windows dark mode).
- **Modal scrim:** `bg-slate-900/50` → `bg-black/50`; panel `bg-white` → `bg-card`.
- **Filter pills:** active → `bg-primary text-primary-foreground`; inactive →
  `bg-muted text-muted-foreground hover:bg-muted/70` (or `<Button variant="ghost"/"outline" size="sm">`).

---

### Task 1: `Tabs` primitive (radix-ui)

**Files:** create `app/src/components/ui/tabs.tsx` (+ `tabs.test.tsx`).
**Interfaces:** `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` (radix `Tabs` namespace from `radix-ui`), styled per
the guide (gold active underline). Supports controlled `value`/`onValueChange` (AdminPage drives it from the URL).

- [ ] **Step 1:** failing test `tabs.test.tsx` — render `<Tabs defaultValue="a">` with two triggers + contents, assert
  the active content shows. Run it (fail).
- [ ] **Step 2:** implement `tabs.tsx` (radix `Tabs.Root/List/Trigger/Content`; `TabsTrigger` active state
  `data-[state=active]:text-foreground data-[state=active]:border-primary border-b-2 border-transparent text-muted-foreground`;
  `TabsList` `border-b border-border`). Run the test (pass).
- [ ] **Step 3:** `tsc --noEmit`. **Checkpoint.**

---

### Task 2: `AdminPage` — PageHeader + Tabs + URL tab state + Apify section

**Files:** `app/src/pages/AdminPage.tsx`. Test: `AdminPage.test.tsx` (behavior-only).
**Notes (survey):** `useState<'settings'|'planLimits'|'users'|'feedback'|'motd'>` (`tab`/`setTab`, default
`'settings'`). Replace with `useSearchParams`: read `searchParams.get('tab') ?? 'settings'`; on change
`setSearchParams({ tab })` (use `replace`). Render the tab bar with the `Tabs` primitive (controlled
`value={tab} onValueChange={…}`), the 5 panels as `TabsContent`. Title → `<PageHeader>`. Apify Settings cards →
`border-border bg-card`; enable/disable toggles → `<Button variant="destructive">` (when enabled, to disable) /
`<Button>` (to enable); "Sync all now" → `<Button variant="outline">`; sync error `text-red-500` → `text-destructive`.

- [ ] **Step 1:** run `AdminPage.test.tsx` (baseline). Confirm whether it relies on tab clicks — if it does, the URL
  change must keep the same accessible tab names so the test still passes.
- [ ] **Step 2:** restyle + move tab state to `useSearchParams` + `Tabs` primitive + PageHeader + Apify section per
  notes.
- [ ] **Step 3:** run `AdminPage.test.tsx` (pass; if a tab-click assertion breaks because of the URL move, update that
  test to the new tab interaction — this is a deliberate §8D change, not a restyle).
  `grep -nE "(slate|blue|amber|red|green|yellow|purple)-[0-9]" app/src/pages/AdminPage.tsx` → none. `tsc`. **Checkpoint.
  **

> Verify `/admin?tab=users` deep-links to the Users tab and browser Back restores the previous tab.

---

### Task 3: `RowActionsMenu` → `DropdownMenu`

**Files:** `app/src/components/RowActionsMenu.tsx`. Test: `RowActionsMenu.test.tsx` (behavior-only — must stay green; if
it asserted outside-click/Escape on the old impl, radix provides the same behavior but the test may need light
adjustment).
**Notes:** replace the custom `useState(open)` + `mousedown`/`Escape` `useEffect` + absolute `<div>` with
`DropdownMenu`/`DropdownMenuTrigger`/`DropdownMenuContent`/`DropdownMenuItem` from `@/components/ui/dropdown-menu`.
Kebab trigger → a `<Button variant="ghost" size="icon-sm">` as the trigger (keep `aria-label={label}`). Each
`RowAction` → `DropdownMenuItem` (`danger` → `className="text-destructive focus:text-destructive"`; `disabled` maps 1:1;
keep `title`/`onClick`). Keep the `RowAction`/props shape identical so callers (`UsersTab`) need no change.

- [ ] **Step 1:** run `RowActionsMenu.test.tsx` (baseline).
- [ ] **Step 2:** reimplement on `DropdownMenu`.
- [ ] **Step 3:** run the test. If a test drove the old open/close internals and now fails because radix manages a
  portal, adjust that test to assert via the trigger/items (behavior preserved) — note it. `grep` palette → none. `tsc`.
  **Checkpoint.**

---

### Task 4: `UsersTab` — grid table + Badges + filter pills + search + unban modal

**Files:** `app/src/components/UsersTab.tsx`. Test: `UsersTab.test.tsx` (behavior-only).
**Notes:** table card/header/rows per the grid-table guide + ARIA roles. `TIER_COLOURS` map → `<Badge>` per the tier
mapping; `STATUS_COLOURS` → status mapping (Badge or `text-*` token); banned → `<Badge variant="destructive">`. Filter
pills → the pill rule. Name search `<input>` → `Input` (`focus:border-blue-400` drops to the primitive's gold ring). The
inline unban `<Modal>` → keep `Modal` (now token-styled) with `<Button variant="outline">` cancel + `<Button>` confirm (
`bg-green-600` → default/primary). `RowActionsMenu` already converted (Task 3) — no change needed here.

- [ ] **Step 1:** run `UsersTab.test.tsx` (baseline).
- [ ] **Step 2:** restyle per notes (keep `listUsers` query, client filters, mutation calls).
- [ ] **Step 3:** run the test (pass).
  `grep -nE "(slate|blue|amber|red|green|yellow|purple)-[0-9]" app/src/components/UsersTab.tsx` → none. `tsc`. *
  *Checkpoint.**

---

### Task 5: `PlanLimitsTab` — grid table + Badges

**Files:** `app/src/components/PlanLimitsTab.tsx`. Test: `PlanLimitsTab.test.tsx` (asserts `data-testid` values — keep
them).
**Notes:** read-only grid table per the grid-table guide + ARIA roles; tier `TIER_COLOURS` → Badge mapping; override tag
`bg-purple-100 text-purple-700` → `<Badge variant="warning">` (or outline); note/empty text → `text-muted-foreground`.
Preserve every `data-testid`.

- [ ] **Step 1:** run `PlanLimitsTab.test.tsx` (baseline). **Step 2:** restyle. **Step 3:** test pass + `grep` clean +
  `tsc`. **Checkpoint.**

---

### Task 6: `FeedbackTab`

**Files:** `app/src/components/FeedbackTab.tsx`. Test: `FeedbackTab.test.tsx` (behavior-only).
**Notes:** filter pills (pill rule); `STATUS_COLOURS` → feedback-status Badge mapping; category →
`<Badge variant="outline">`; reply stripe `border-green-300 text-green-600` → `border-primary text-gold-text`;
card/dividers/text → tokens.

- [ ] **Step 1:** baseline test. **Step 2:** restyle. **Step 3:** test pass + `grep` clean + `tsc`. **Checkpoint.**

---

### Task 7: `MotdTab`

**Files:** `app/src/components/MotdTab.tsx`. Test: `MotdTab.test.tsx` (behavior-only).
**Notes:** MOTD cards + badges (enabled/disabled/important per MOTD mapping); inline editor: "New MOTD"/Save →
`<Button>`, Edit/Toggle/Delete links → `<Button variant="ghost" size="sm">` (Delete → add `text-destructive`); 3× body
`<textarea>` → `Textarea`; `<input type="datetime-local">` + checkboxes → style with `border-border` tokens;
locale-preview `<select>` → native-select token styling; preview pane `bg-slate-50 [&_a]:text-blue-600` →
`bg-muted [&_a]:text-gold-text`; error → `text-destructive`.

- [ ] **Step 1:** baseline test. **Step 2:** restyle (keep all MOTD CRUD handlers + locale logic). **Step 3:** test
  pass + `grep` clean + `tsc`. **Checkpoint.**

---

### Task 8: `Modal` (token restyle) + user modals (BanUser, ChangeTier, ChangeStatus, ContactLimits)

**Files:** `app/src/components/Modal.tsx`, `BanUserDialog.tsx`, `ChangeTierModal.tsx`, `ChangeStatusModal.tsx`,
`ContactLimitsModal.tsx`. Tests: `Modal.test.tsx`, `BanUserDialog.test.tsx`, `ContactLimitsModal.test.tsx` (
behavior-only; ChangeTier/ChangeStatus have no test).
**Notes:**

- `Modal.tsx`: scrim `bg-slate-900/50` → `bg-black/50`; panel `bg-white` → `bg-card`. Keep the API + behavior (don't
  migrate to shadcn Dialog — Scope call 1).
- `BanUserDialog`: heading/para/label → tokens; `<textarea>` → `Textarea`; Cancel → `<Button variant="outline">`;
  confirm (`bg-red-600`) →
  `<Button variant="destructive" className="bg-destructive text-destructive-foreground hover:bg-destructive/90">`.
- `ChangeTierModal`: tier selector buttons active `border-blue-500 bg-blue-50 text-blue-700` →
  `border-primary bg-accent text-accent-foreground`, inactive → `border-border hover:bg-muted`; Cancel → outline, Save →
  `<Button>`; error → `text-destructive`.
- `ChangeStatusModal`: `<select>` → native-select token styling; Cancel/Save → `Button`; error → token.
- `ContactLimitsModal`: number `<input>`s → `Input`; Save → `<Button>`, Cancel → `<Button variant="outline">`, "Reset to
  default" → `<Button variant="ghost">` (`hover:text-red-500` → `hover:text-destructive`); error → token.
- [ ] **Step 1:** run `Modal.test.tsx` + `BanUserDialog.test.tsx` + `ContactLimitsModal.test.tsx` (baseline).
- [ ] **Step 2:** restyle all five files per notes.
- [ ] **Step 3:** re-run those tests (pass).
  `grep -nE "(slate|blue|amber|red|green|yellow|purple)-[0-9]" app/src/components/Modal.tsx app/src/components/BanUserDialog.tsx app/src/components/ChangeTierModal.tsx app/src/components/ChangeStatusModal.tsx app/src/components/ContactLimitsModal.tsx` →
  none. `tsc`. **Checkpoint.**

---

### Task 9: `RespondFeedbackModal` + `useFlash`

**Files:** `app/src/components/RespondFeedbackModal.tsx`, `app/src/components/useFlash.tsx`. Test:
`RespondFeedbackModal.test.tsx` (behavior-only); `useFlash` has no test.
**Notes:**

- `RespondFeedbackModal`: quoted message + reply-history blocks `bg-slate-50` → `bg-muted`; no-email warning
  `text-amber-600` → `text-gold-text`; `<textarea>` → `Textarea`; char count/labels → tokens; checkbox
  `border-slate-300` → `border-border`; Cancel → outline, Send → `<Button>`; error → token.
- `useFlash` (`Flash` component): error `border-red-200 bg-red-50 text-red-700` →
  `border-destructive/30 bg-destructive/10 text-destructive`; success `border-green-200 bg-green-50 text-green-700` →
  keep green via `bg-success text-success-foreground border-success-foreground/30`; dismiss buttons → token `text-*`/
  `hover:` with `aria-label` kept. Keep `role`/`aria-live`.
- [ ] **Step 1:** run `RespondFeedbackModal.test.tsx` (baseline). **Step 2:** restyle both. **Step 3:** test pass +
  `grep` clean + `tsc` + `pnpm --filter app test` (full suite green). **Checkpoint.**

---

## Phase 4 Done Criteria

- [ ] Admin console renders warm-premium (light + dark); no hardcoded palette classes remain in any restyled admin
  file (grep over the Task files clean).
- [ ] Admin tabs are URL-driven (`/admin?tab=users` deep-links; Back works); the `Tabs` primitive provides `tablist`/
  `tab`/`tabpanel` semantics.
- [ ] `RowActionsMenu` uses the `DropdownMenu` primitive; tier/status/state use `Badge`; grids have ARIA table roles.
- [ ] `pnpm --filter app exec tsc --noEmit` clean + full vitest suite green (test edits only where the URL/DropdownMenu
  structural changes required them — not for restyles).
- [ ] `docs/PLATFORM.md` admin section updated if it described the old look.

## Self-Review (completed by plan author)

- **Spec coverage:** §7 admin restyle → Tasks 2,4,5,6,7,8,9; §8D URL tab state → Task 2; `Tabs` → Task 1; `DropdownMenu`
  row actions → Task 3; `Badge` tier/status → Tasks 4,5,6,7; modal restyle → Tasks 8,9. **Deviations flagged:**
  Modal-on-Dialog consolidation deferred (Scope 1); no `<table>` primitive (Scope 2) — both preserve the visual outcome.
- **Placeholder scan:** none — the reused Phase-3 guide + the Phase-4 additions + per-task survey notes give concrete
  classes/primitives.
- **Test consistency:** survey confirmed NO admin test asserts a color → restyles need zero test edits; the only
  possible test touches are the structural changes (Task 2 URL tab, Task 3 DropdownMenu portal), flagged in-task.
