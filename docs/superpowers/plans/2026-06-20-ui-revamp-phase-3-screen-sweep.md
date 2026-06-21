# UI Revamp — Phase 3 (Screen Sweep) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:
> executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Restyle the five daily screens — **Feed, My Posts, Settings, Privacy & Data, Billing** — and their content
components to the warm-premium design system: wrap each in `PageHeader`, replace every hardcoded
`slate/blue/amber/red/...` class with semantic tokens, adopt the `Button`/`Badge`/`Avatar`/`Input` primitives, apply the
forms + CLS QC, and virtualize the feed.

**Architecture:** Presentation-only. The tokens, theme, and primitives already exist (Phases 1–2). Each task restyles
one screen/component by applying the shared **Transformation Guide** below; behavior, props, data flow, and i18n keys
are unchanged. Only `PostComposer.test.tsx` asserts a color class and needs updating.

**Tech Stack:** React 19, Tailwind v4, shadcn primitives, `@tanstack/react-virtual` (already a dep), vitest.

**Spec:** `docs/superpowers/specs/2026-06-20-ui-revamp-design.md` §7 (screens), §8B (forms), §8C (CLS), §8F (
typography/truncation).

## Global Constraints

- **Commits:** agent never `git commit`/`git push`; each task ends with a **Checkpoint (Henriko commits)**.
- **pnpm** only; app commands `pnpm --filter app …`. Run `pnpm --filter app exec tsc --noEmit` + the screen's test after
  each task.
- **Behavior unchanged:** do not alter logic, props, Convex calls, or i18n keys — restyle only. Keep all `data-*`,
  `aria-*`, and existing accessible labels.
- **Casing:** Title Case for buttons; keep page `<h1>` text as-is (via `PageHeader`).
- **No hardcoded palette colors** may remain in a restyled file (no `slate-*`/`blue-*`/`amber-*`/`red-*`/`green-*`/
  `yellow-*` numeric classes). Verify with grep at the end of each task.

---

## Transformation Guide (the shared reference every task applies)

### Color → token mapping

| Hardcoded                                                                                           | Replace with                                                                                                            |
|-----------------------------------------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------|
| `text-slate-900`, `text-slate-800`                                                                  | `text-foreground`                                                                                                       |
| `text-slate-700`, `text-slate-600`                                                                  | `text-foreground` (body) or `text-muted-foreground` (secondary) — pick by role                                          |
| `text-slate-500`, `text-slate-400`                                                                  | `text-muted-foreground`                                                                                                 |
| `bg-white` (a card/surface)                                                                         | `bg-card`                                                                                                               |
| `bg-white` (the page)                                                                               | `bg-background`                                                                                                         |
| `bg-slate-50`, `hover:bg-slate-50/100`                                                              | `bg-muted`, `hover:bg-muted`                                                                                            |
| `border-slate-200`, `border-slate-300`                                                              | `border-border`                                                                                                         |
| `text-blue-500/600` (a link)                                                                        | `text-gold-text` (add `hover:underline` if it's a link)                                                                 |
| `bg-blue-500/600` (a primary CTA button)                                                            | use `<Button>` (default variant = `bg-primary`)                                                                         |
| `border-blue-500 text-blue-600` (outline CTA)                                                       | `<Button variant="outline">` or `border-primary text-gold-text`                                                         |
| `border-blue-500 ring-blue-300` (selected state)                                                    | `border-primary ring-2 ring-ring`                                                                                       |
| `bg-blue-100 text-blue-700`, `bg-slate-700` (avatar)                                                | use `<Avatar name=… src=… />`                                                                                           |
| `bg-blue-50 text-blue-700` (info pill)                                                              | `<Badge>` (default)                                                                                                     |
| `border-blue-200 bg-blue-50` (info card)                                                            | `border-border bg-accent`                                                                                               |
| `text-amber-600/700/800`                                                                            | `text-gold-text`                                                                                                        |
| `bg-amber-50 text-amber-700`, `border-yellow-200 bg-yellow-50 text-amber-800` (warning pill/banner) | `<Badge variant="warning">` / `bg-accent border-border text-accent-foreground`                                          |
| `bg-green-500` (transient "Saved ✓")                                                                | `bg-success text-success-foreground`                                                                                    |
| `text-red-400/500/600/700`                                                                          | `text-destructive`                                                                                                      |
| `bg-red-50 text-red-700` (error banner)                                                             | `bg-destructive/10 text-destructive`                                                                                    |
| `border-red-200/300 … hover:bg-red-50` (danger outline)                                             | `<Button variant="destructive">` (soft)                                                                                 |
| `bg-red-600` (modal confirm-delete)                                                                 | `<Button variant="destructive" className="bg-destructive text-destructive-foreground hover:bg-destructive/90">` (solid) |

### Primitive usage

- **Buttons:** every `<button>` → `<Button>` from `@/components/ui/button`. Map: primary CTA → default;
  secondary/outline → `outline`; link-style → `link`; subtle/icon → `ghost`; destructive → `destructive`. Preserve
  `type`, `disabled`, `onClick`, and any `aria-*`.
- **Inputs/Textareas:** `<input>`/`<textarea>` → `Input`/`Textarea` from `@/components/ui/input`/`textarea`. Keep
  labels.
- **Avatars:** any avatar image or initials block → `<Avatar name={…} src={…} size="sm|md|lg" />` (handles CLS dims +
  initials).
- **Badges:** status/featured/usage/plan labels → `<Badge variant="default|success|warning|destructive|outline">`.
- **Page header:** the screen's `<h1>` → `<PageHeader title={…} lead={…}>` (optional actions in children). Keep the
  existing i18n title key.

### Forms QC (§8B)

- URL inputs get `type="url"` + `inputMode="url"`. Never add an `onPaste` that blocks paste.
- Placeholders that are sentences should end with `…` (use the existing i18n value; if it lacks `…`, that's an i18n
  change — leave the key, just note it).

### CLS (§8C)

- Replacing avatar `<img>` with `<Avatar>` adds `width`/`height` automatically. `LinkedInEmbed` already sets explicit
  heights — leave it.

### Layout

- Cards: `rounded-xl border border-border bg-card`. Page content keeps its existing max-width/padding wrapper (the shell
  provides the frame).

---

### Task 1: `PostComposer` — remove the bespoke mini-theme, apply tokens + forms QC

**Files:** `app/src/components/PostComposer.tsx`; **Test:** `app/src/components/PostComposer.test.tsx` (must update the
color assertion).

**Notes (from survey):** it has a bespoke `theme: 'light'|'dark'` prop with an `s` style object (the only ad-hoc dark
surface in the app). DELETE that system — the real theme handles dark now. The card becomes `bg-card border-border`;
label/hint `text-muted-foreground`; the URL `<input>` → `Input` with `type="url"` + `inputMode="url"`; the limit text
`text-gold-text`; the error `text-destructive`; the submit `<button>` → `<Button>` (default).

- [ ] **Step 1: Update the failing test assertion.** In `app/src/components/PostComposer.test.tsx` line ~54, replace
  `expect(container.querySelector('form')?.className).toContain('bg-white')` with
  `expect(container.querySelector('form')?.className).toContain('bg-card')`. Run
  `pnpm --filter app exec vitest run src/components/PostComposer.test.tsx` — expect FAIL (still `bg-white` in source).
- [ ] **Step 2: Restyle `PostComposer.tsx`** per the guide: remove the `theme` prop + `s` object, apply tokens, swap to
  `Input` + `Button`, add `inputMode="url"` to the URL input. If a caller passes `theme=` (e.g. `MyPostsPage`/
  `FeedPage`), drop that prop at the call site in THIS task only if trivial — otherwise leave the prop
  accepted-but-ignored and remove it in the consuming screen's task. (Check callers: `grep -rn "PostComposer" app/src`.)
- [ ] **Step 3:** Run `pnpm --filter app exec vitest run src/components/PostComposer.test.tsx` — expect PASS.
- [ ] **Step 4:** `grep -nE "(slate|blue|amber|red|green|yellow)-[0-9]" app/src/components/PostComposer.tsx` → no
  matches. Run `pnpm --filter app exec tsc --noEmit`.
- [ ] **Step 5: Checkpoint (Henriko commits).**

---

### Task 2: `PostCard` + `LoadingSpinner` — tokens, Avatar, Featured Badge, gold link

**Files:** `app/src/components/PostCard.tsx`, `app/src/components/LoadingSpinner.tsx`. **Test:** `PostCard.test.tsx` (
behavior-only — should stay green without edits).

**Notes:** card → `border-border bg-card`; author name `text-foreground`, headline `text-muted-foreground`; the
initials/`<img>` avatar → `<Avatar name={post.author.name} src={post.author.profilePictureUrl} size="md" />`; the
`text-amber-600` FEATURED → `<Badge variant="warning">{t('feed.featured')}</Badge>`; reaction buttons →
`<Button variant="ghost" size="icon-sm">`; selected reaction `border-blue-500 ring-blue-300` →
`border-primary ring-2 ring-ring`; "View on LinkedIn" `text-blue-500` → `text-gold-text hover:underline`; action bar
`border-border bg-card`. `LoadingSpinner`: `border-slate-200` → `border-border`, `border-t-blue-500` →
`border-t-primary`.

- [ ] **Step 1:** Run `pnpm --filter app exec vitest run src/components/PostCard.test.tsx` — confirm it currently
  passes (baseline).
- [ ] **Step 2:** Restyle `PostCard.tsx` per the guide + notes (keep `ReactionOptions`/`ReactionPicker` behavior and all
  `aria-*`/`title`/`sr-only` intact; the reaction emoji stay).
- [ ] **Step 3:** Restyle `LoadingSpinner.tsx` (two class swaps).
- [ ] **Step 4:** Run `pnpm --filter app exec vitest run src/components/PostCard.test.tsx` — expect PASS (unchanged
  behavior).
  `grep -nE "(slate|blue|amber|red|green|yellow)-[0-9]" app/src/components/PostCard.tsx app/src/components/LoadingSpinner.tsx` →
  no matches. `tsc --noEmit`.
- [ ] **Step 5: Checkpoint (Henriko commits).**

---

### Task 3: `CommentBox` — Button/Textarea + tokens

**Files:** `app/src/components/CommentBox.tsx`. (No test file.)

**Notes:** Generate/Regenerate `<button>` → `<Button variant="outline">`; `<textarea>` → `Textarea`; Cancel →
`<Button variant="ghost">`; Submit → `<Button>` (default; `bg-blue-300/600` disabled/active both become default +
`disabled:opacity-50`); error `text-red-500` → `text-destructive`; textarea border → `border-border`.

- [ ] **Step 1:** Restyle `CommentBox.tsx` per the guide + notes (keep the `VirtualizedCombobox` language picker and all
  behavior/handlers).
- [ ] **Step 2:** `grep -nE "(slate|blue|amber|red|green|yellow)-[0-9]" app/src/components/CommentBox.tsx` → none.
  `tsc --noEmit`. Run `pnpm --filter app test` (full suite — confirm nothing broke; no CommentBox test exists, so this
  guards regressions).
- [ ] **Step 3: Checkpoint (Henriko commits).**

---

### Task 4: `FeedPage` — PageHeader, tokens, and virtualize the feed

**Files:** `app/src/pages/FeedPage.tsx`. (No test file.)

**Notes:** wrap the `<h1>{t('feed.title')}</h1>` in `<PageHeader title={t('feed.title')} />`; empty-state
`text-slate-500` → `text-muted-foreground`; "Load more" `<button>` → `<Button variant="outline">`. **Virtualize** the
accumulating results list with `@tanstack/react-virtual` (`useVirtualizer`) — see
`app/src/components/VirtualizedCombobox.tsx` for the existing usage pattern in this repo. Keep `usePaginatedQuery` +
`loadMore` (trigger `loadMore` when the last virtual row nears the end) and the `CommentBox` toggle behavior. Preserve
the centered reading-column wrapper.

- [ ] **Step 1:** Restyle `FeedPage.tsx`: `PageHeader` + token swaps + `Button` for Load-more.
- [ ] **Step 2:** Add virtualization over `results` using `useVirtualizer` (variable size; estimate row height; render
  the `PostCard` + inline `CommentBox` per virtual item). Wire `loadMore(FEED_PAGE_SIZE)` to fire when the last item
  becomes visible (replace or augment the manual Load-more button — keep the button as a fallback).
- [ ] **Step 3:** Run `pnpm --filter app dev`, open `/feed`, confirm the feed renders, scrolls smoothly, loads more on
  scroll, and comment toggles still work.
  `grep -nE "(slate|blue|amber|red|green|yellow)-[0-9]" app/src/pages/FeedPage.tsx` → none. `tsc --noEmit` +
  `pnpm --filter app test`.
- [ ] **Step 4: Checkpoint (Henriko commits).**

> If virtualization proves fiddly with the existing pagination, ship the token/PageHeader restyle first (still a
> complete improvement) and split virtualization into its own follow-up — note it in the checkpoint rather than blocking
> the phase.

---

### Task 5: `MyPostsPage` — PageHeader, Avatar, Badge pills, Buttons, fix the `color-[]` bug

**Files:** `app/src/pages/MyPostsPage.tsx`. **Test:** `MyPostsPage.test.tsx` (behavior-only).

**Notes:** title `"My Posts"` → `<PageHeader title={t('nav.myPosts')} />` (use the existing i18n key). Profile initials
avatar → `<Avatar>`; **fix the invalid `color-[#94a3b8]` class** (→ `text-muted-foreground`). Usage pill
`bg-blue-50 text-blue-700` → `<Badge>`; at-limit / "Hidden from feed" `bg-amber-50 text-amber-700` →
`<Badge variant="warning">`. Hide/Unhide `<button>` → `<Button variant="outline" size="sm">`; Delete →
`<Button variant="destructive" size="sm">`. Action error banner `bg-red-50 text-red-700` →
`bg-destructive/10 text-destructive`. "View on LinkedIn" → `text-gold-text`. Cards → `border-border bg-card`. If
`PostComposer` is still passed a `theme` prop here, remove it.

- [ ] **Step 1:** Run `MyPostsPage.test.tsx` (baseline pass).
- [ ] **Step 2:** Restyle per guide + notes; fix the `color-[#94a3b8]` bug.
- [ ] **Step 3:** Run `MyPostsPage.test.tsx` (PASS).
  `grep -nE "(slate|blue|amber|red|green|yellow)-[0-9]|color-\[" app/src/pages/MyPostsPage.tsx` → none. `tsc --noEmit`.
- [ ] **Step 4: Checkpoint (Henriko commits).**

---

### Task 6: `SettingsPage` + `ConsentToggles` — PageHeader, Card sections, Button, URL input

**Files:** `app/src/pages/SettingsPage.tsx`, `app/src/components/ConsentToggles.tsx`. **Tests:** both behavior-only.

> Heads-up: `SettingsPage.tsx` also carries an unrelated pre-existing import-only change in the working tree (a separate
> effort). Restyle on top of the current file; do not revert those imports.

**Notes:** title → `<PageHeader title={t('settings.title')} />`. The four
`<section className="rounded-xl border bg-white p-5">` → `border-border bg-card`. h2 headings/labels →
`text-foreground`; helper text → `text-muted-foreground`. Save buttons → `<Button>`; the transient "Saved ✓"
`bg-green-500` → `bg-success text-success-foreground`. Refresh button → `<Button variant="outline">`. **LinkedIn profile
URL `<input type="text">` → `Input` with `type="url"` + `inputMode="url"`.** Errors `text-red-500` → `text-destructive`.
Verified-identity/"coming soon" `text-blue-500` → `text-gold-text`. Upgrade prompt
`border-blue-200 bg-blue-50 text-blue-700` → `border-border bg-accent text-accent-foreground`. `ConsentToggles`: card →
`border-border bg-card`, h2 `text-foreground`, note `text-muted-foreground`, label `text-foreground`.

- [ ] **Step 1:** Run `SettingsPage.test.tsx` + `ConsentToggles.test.tsx` (baseline pass).
- [ ] **Step 2:** Restyle both per guide + notes (keep the three `VirtualizedCombobox`es and all save/refresh handlers +
  labels).
- [ ] **Step 3:** Re-run both tests (PASS).
  `grep -nE "(slate|blue|amber|red|green|yellow)-[0-9]" app/src/pages/SettingsPage.tsx app/src/components/ConsentToggles.tsx` →
  none. `tsc --noEmit`.
- [ ] **Step 4: Checkpoint (Henriko commits).**

---

### Task 7: `PrivacyDataPage` — PageHeader, Buttons, danger zone, tokens

**Files:** `app/src/pages/PrivacyDataPage.tsx`. **Test:** behavior-only.

**Notes:** title → `<PageHeader title={t('privacy.title')} />`. Export section card → `border-border bg-card`; Export
`<button>` → `<Button>`; download link `text-blue-500` → `text-gold-text`; pending/expired text →
`text-muted-foreground`. Deletion-scheduled card `border-amber-200 bg-amber-50` → `border-border bg-accent` with
`text-accent-foreground`. **Danger zone:** delete card `border-red-200` → `border-destructive/40 bg-card`, h2
`text-destructive`; "Request deletion" `<button>` → `<Button variant="destructive">`. Modal: h2 `text-foreground`, body
`text-muted-foreground`, input → `Input` (border-border), Cancel → `<Button variant="ghost">`, **Confirm
delete `bg-red-600` →
`<Button variant="destructive" className="bg-destructive text-destructive-foreground hover:bg-destructive/90">`** (
solid). (Keep the typed-"DELETE" confirmation UX and its placeholder as-is.)

- [ ] **Step 1:** Run `PrivacyDataPage.test.tsx` (baseline pass).
- [ ] **Step 2:** Restyle per guide + notes.
- [ ] **Step 3:** Re-run the test (PASS).
  `grep -nE "(slate|blue|amber|red|green|yellow)-[0-9]" app/src/pages/PrivacyDataPage.tsx` → none. `tsc --noEmit`.
- [ ] **Step 4: Checkpoint (Henriko commits).**

---

### Task 8: `BillingPage` — PageHeader, plan cards, current-plan Badge, tokens

**Files:** `app/src/pages/BillingPage.tsx`. (No test file.)

**Notes:** title → `<PageHeader title={t('billing.title')} lead={…current-plan subtitle…} />`. Subscription-info card
`border-slate-200 bg-slate-50` → `border-border bg-muted`; "cancels…" `text-red-500` → `text-destructive`. Trial banner
`border-yellow-200 bg-yellow-50 text-amber-800` → `bg-accent border-border text-accent-foreground`; expired banner
`border-red-200 bg-red-50 text-red-800` → `bg-destructive/10 border-destructive/30 text-destructive`. **Plan cards:**
non-current `border-border bg-card`; **current** `border-2 border-primary bg-accent` with a
`<Badge variant="warning">{t('billing.currentPlanLabel')}</Badge>`; price/name `text-foreground`, description
`text-muted-foreground`. Subscribe/Upgrade `bg-blue-600` `<button>` → `<Button>` (default). "Manage subscription" +
Enterprise CTA → `<Button variant="outline">`. Enterprise footer `text-slate-400` → `text-muted-foreground`.

- [ ] **Step 1:** Restyle `BillingPage.tsx` per guide + notes (keep `getSubscriptionInfo`/plan logic + `PLAN_IDS.map`).
- [ ] **Step 2:** `grep -nE "(slate|blue|amber|red|green|yellow)-[0-9]" app/src/pages/BillingPage.tsx` → none.
  `tsc --noEmit` + `pnpm --filter app test`.
- [ ] **Step 3: Checkpoint (Henriko commits).**

---

## Phase 3 Done Criteria

- [ ] All five screens + their content components render in the warm-premium theme (light + dark); no hardcoded palette
  classes remain in any restyled file (repo grep over the Task files is clean).
- [ ] Feed list is virtualized (or virtualization explicitly split out with a noted reason).
- [ ] Forms QC applied (URL inputs `type="url"`+`inputMode`); `PostComposer` bespoke mini-theme removed.
- [ ] `pnpm verify`-equivalent for the app passes: `tsc --noEmit` clean + full vitest suite green (only
  `PostComposer.test.tsx` needed a color-assertion update).
- [ ] `docs/PLATFORM.md` frontend section reflects the restyled screens if it described their old look (check + update
  if needed).

## Self-Review (completed by plan author)

- **Spec coverage:** §7 per-screen restyle → Tasks 1–8; §8B forms (URL inputs, no-block-paste) → Tasks 1 (composer) &
  6 (settings URL); §8C CLS (avatar dims via `Avatar`) → Tasks 2, 5; feed virtualization (§8C) → Task 4.
- **Placeholder scan:** none — the Transformation Guide carries the concrete mapping; per-task notes name the exact
  classes/primitives from the codebase survey.
- **Type/test consistency:** only `PostComposer.test.tsx` asserts a color (`bg-white`→`bg-card`, Task 1); every other
  listed test is behavior-only (verified in the survey) and must stay green unchanged.
- **Known coupling:** `PostComposer`'s `theme` prop is consumed by `FeedPage`/`MyPostsPage` — Task 1 removes the prop
  and notes the call-site cleanup, finished in Tasks 4/5.
