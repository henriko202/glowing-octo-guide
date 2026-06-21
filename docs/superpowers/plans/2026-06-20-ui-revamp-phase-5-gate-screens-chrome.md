# UI Revamp — Phase 5 (Gate Screens & Chrome) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:
> executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** The finale — restyle the full-screen **gate screens** (Banned, Cancel-deletion, Consent-prompt, Policy-update,
Public-identifier) into centered, **branded** cards (logo + serif heading + one gold action) on the cream canvas, and
tokenize the remaining **chrome** (the `Motd` banner/modal, the `FeedbackButton` FAB, the `FeedbackModal`). Extract a
shared `BrandMark` so the gate screens and the sidebar reuse one logo element.

**Architecture:** Presentation-only. The gate screens stay full-screen (rendered before the app shell in `RequireAuth`);
they switch to `bg-background` (cream) page + `bg-card` centered card + a `BrandMark` + a serif `font-display` heading +
the gold primary `Button`. No structural/auth-flow changes — every gate test is behavior-only and must stay green
unchanged.

**Tech Stack:** React 19, Tailwind v4, shadcn primitives, lucide-react, vitest.

**Spec:** `docs/superpowers/specs/2026-06-20-ui-revamp-design.md` §7 (gate flows), §4.5 (icons), §8A. **Reuse the
Transformation Guide** (color→token map + primitive rules) from
`docs/superpowers/plans/2026-06-20-ui-revamp-phase-3-screen-sweep.md`, plus the Phase-5 additions below.

## Global Constraints

- **Git:** the agent NEVER runs `git commit`/`push`/`add`/**`stash`**/`checkout`/`reset`/`restore`/`clean` or ANY
  state-changing git — only `git status`/`diff`/`log`. For a "clean baseline" just run `tsc`/tests on the tree as-is. (A
  prior subagent corrupted the tree with `git stash` — do not repeat.) Each task ends with a **Checkpoint (Henriko
  commits)**.
- **pnpm**; `pnpm --filter app exec tsc --noEmit` + the relevant test after each task.
- **Behavior unchanged:** keep all Convex calls, props, i18n keys, side-effects (sign-out, save), and `aria-*`/`role`.
  These are auth-critical screens — restyle only.
- **No hardcoded palette colors** may remain in a restyled file (grep at the end of each task).

## Phase-5 additions to the Transformation Guide

- **`BrandMark`** (new shared component): the gold icon square + serif wordmark currently inline in `Sidebar.tsx` (
  lines ~14–27):
  `<span className="bg-primary text-primary-foreground flex size-7 items-center justify-center rounded-md"><LinkIcon className="size-4" aria-hidden/></span>` +
  `<span className="font-display text-base font-semibold" translate="no">Link Into The SSI</span>`. Extract to
  `app/src/components/BrandMark.tsx` with an optional `size`/layout prop; `Sidebar` imports it.
- **Gate-screen layout:** page wrapper `min-h-dvh bg-background flex items-center justify-center p-4`; card
  `w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-sm`. Inside the card, top-center: `<BrandMark />`,
  then the heading as `font-display text-2xl font-semibold text-foreground` (serif, replacing
  `text-lg font-bold text-slate-900`), then body `text-muted-foreground`, then actions.
- **Gate primary action:** the `bg-slate-900 ... text-white` buttons (and the `mailto:` `<a>`) → the gold `<Button>` (
  default variant; for the `<a>` use `<Button asChild><a …>…</a></Button>`). Secondary/sign-out/skip →
  `<Button variant="ghost">`. Full-width where they were (`className="w-full"`).
- **Gate status labels:** Banned's "Account suspended" → `<Badge variant="destructive">`; Cancel-deletion's "deletion
  pending" → `<Badge variant="warning">`. Reason callout (`border-red-500 bg-red-50`) →
  `border-destructive bg-destructive/10 text-destructive`.
- **Motd banner:** `bg-blue-600 text-white` → `bg-accent text-accent-foreground border-b border-border`; dismiss X →
  `<Button variant="ghost" size="icon-sm">`. Modal path: OK → `<Button>`; `[&_a]:text-blue-600` →
  `[&_a]:text-gold-text`; body `text-slate-700` → `text-foreground`.
- **FeedbackButton FAB:** `bg-blue-600 text-white` → `bg-primary text-primary-foreground`; replace the `💬` emoji with a
  lucide icon (`MessageCircle`), `aria-hidden` on the icon; keep it a fixed rounded pill.
- **FeedbackModal:** category pills selected `bg-blue-600 text-white` → `bg-primary text-primary-foreground`, unselected
  `bg-slate-100 …` → `bg-muted text-muted-foreground hover:bg-muted/70`; `<textarea>` → `Textarea`; Cancel →
  `<Button variant="outline">`, Submit/Close → `<Button>`; error → `text-destructive`; labels/counter →
  `text-muted-foreground`.

---

### Task 1: `BrandMark` component + Sidebar refactor

**Files:** create `app/src/components/BrandMark.tsx` (+ `BrandMark.test.tsx`); modify
`app/src/components/shell/Sidebar.tsx`.
**Interfaces:** `<BrandMark className?={string} />` rendering the gold icon square (`LinkIcon`) + the `font-display` "
Link Into The SSI" wordmark (`translate="no"`).

- [ ] **Step 1:** write `BrandMark.test.tsx` — renders the wordmark text "Link Into The SSI". Run (fail).
- [ ] **Step 2:** implement `BrandMark.tsx` (lift the exact markup from `Sidebar.tsx`). Run test (pass).
- [ ] **Step 3:** refactor `Sidebar.tsx` to render `<BrandMark />` in place of the inline brand block (keep the
  surrounding `px-4 py-4` wrapper). Run
  `pnpm --filter app exec vitest run src/components/shell/Sidebar.test.tsx src/components/BrandMark.test.tsx` (pass) +
  `tsc`. **Checkpoint.**

---

### Task 2: `BannedScreen` + `CancelDeletionScreen`

**Files:** `app/src/components/BannedScreen.tsx`, `app/src/components/CancelDeletionScreen.tsx`. Tests: both
behavior-only (keep green unchanged).
**Notes:** apply the gate-screen layout + `BrandMark` + serif heading. Page `bg-slate-100` → `bg-background`; card →
`border-border bg-card`. **BannedScreen:** "Account suspended" `<span>` (`text-red-700`) →
`<Badge variant="destructive">`; reason callout `border-red-500 bg-red-50 text-slate-700` →
`border-destructive bg-destructive/10 text-destructive`, reason label `text-slate-400` → `text-muted-foreground`; the
`mailto:` primary `<a>` → `<Button asChild><a href="mailto:…">…</a></Button>`; Sign-out → `<Button variant="ghost">`. *
*CancelDeletionScreen:** "deletion pending" label → `<Badge variant="warning">`; "Keep my account" → `<Button>` (keep
`disabled`); Sign out → `<Button variant="ghost">`; body `text-slate-500` → `text-muted-foreground`.

- [ ] **Step 1:** run both tests (baseline). **Step 2:** restyle both. **Step 3:** both tests pass +
  `grep -nE "(slate|blue|amber|red|green|yellow|purple)-[0-9]"` on the two files → none + `tsc`. **Checkpoint.**

---

### Task 3: `PolicyUpdateScreen` + `ConsentPromptScreen`

**Files:** `app/src/components/PolicyUpdateScreen.tsx`, `app/src/components/ConsentPromptScreen.tsx`. Tests:
behavior-only.
**Notes:** gate layout + `BrandMark` + serif heading + tokens. **PolicyUpdateScreen:** "Read Policy" `<a>`
`text-blue-600 hover:underline` → `text-gold-text hover:underline`; Acknowledge `<button>` →
`<Button className="w-full">` (keep `disabled`). **ConsentPromptScreen:** the two `<input type="checkbox">` keep
behavior, label `text-slate-700` → `text-foreground`; Save → `<Button className="w-full">`; footnote `text-slate-400` →
`text-muted-foreground`. Body copy → `text-muted-foreground`.

- [ ] **Step 1:** baseline tests. **Step 2:** restyle both. **Step 3:** tests pass + grep clean + `tsc`. **Checkpoint.**

---

### Task 4: `PublicIdentifierPromptScreen`

**Files:** `app/src/components/PublicIdentifierPromptScreen.tsx`. Test: behavior-only.
**Notes:** gate layout + `BrandMark` + serif heading + tokens. The LinkedIn URL `<input type="text">` (
`border-slate-300`) → `Input` from `@/components/ui/input` (it accepts a profile URL — set `type="url"` +
`inputMode="url"`); invalid hint `text-red-500` → `text-destructive`; "will save as" hint `text-slate-500` →
`text-muted-foreground`; Save → `<Button className="w-full">`; "Skip for now" → `<Button variant="ghost">`. Remove the
redundant `font-sans` on the wrapper.

- [ ] **Step 1:** baseline test. **Step 2:** restyle. **Step 3:** test pass + grep clean + `tsc`. **Checkpoint.**

---

### Task 5: `Motd` (banner + modal)

**Files:** `app/src/components/Motd.tsx`. Test: `Motd.test.tsx` (behavior-only).
**Notes:** banner `bg-blue-600 text-white` → `bg-accent text-accent-foreground border-b border-border`; dismiss X
`<button>` (`text-white/80 hover:text-white`) → `<Button variant="ghost" size="icon-sm">` (keep its `aria-label`). Modal
path (uses the shared `Modal`, already token-styled): OK `<button>` (`bg-slate-900 …`) → `<Button>`; body
`text-slate-700` → `text-foreground`; `[&_a]:text-blue-600` → `[&_a]:text-gold-text`. Keep `MarkdownView`, the
`important` modal's `dismissOnBackdrop={false}`/`dismissOnEscape={false}`, and the language-fallback logic.

- [ ] **Step 1:** baseline `Motd.test.tsx`. **Step 2:** restyle. **Step 3:** test pass + grep clean + `tsc`. *
  *Checkpoint.**

---

### Task 6: `FeedbackButton` + `FeedbackModal`

**Files:** `app/src/components/FeedbackButton.tsx`, `app/src/components/FeedbackModal.tsx`. Test:
`FeedbackModal.test.tsx` (behavior-only).
**Notes:** **FeedbackButton:** FAB `bg-blue-600 hover:bg-blue-700 text-white` →
`bg-primary text-primary-foreground hover:bg-[color-mix(in_oklch,var(--primary),black_12%)]`; replace the `💬` emoji with
`<MessageCircle className="size-4" aria-hidden="true" />` from `lucide-react`; keep `fixed bottom-5 right-5 z-40` + the
rounded pill + the i18n label. **FeedbackModal:** category pill toggles selected `bg-blue-600 text-white` →
`bg-primary text-primary-foreground`, unselected `bg-slate-100 text-slate-600 hover:bg-slate-200` →
`bg-muted text-muted-foreground hover:bg-muted/70`; `<textarea>` → `Textarea` (`@/components/ui/textarea`); char
counter/labels `text-slate-400/500` → `text-muted-foreground`; error `text-red-500` → `text-destructive`; Cancel →
`<Button variant="outline">`; Submit + success Close → `<Button>`; success heading `text-slate-900` →
`text-foreground`. (Uses the shared `Modal`.)

- [ ] **Step 1:** baseline `FeedbackModal.test.tsx`. **Step 2:** restyle both. **Step 3:** test pass + `grep` clean on
  both files + `tsc` + `pnpm --filter app test` (full suite green). **Checkpoint.**

---

## Phase 5 Done Criteria

- [ ] All gate screens are centered branded cards (BrandMark + serif heading + gold action) on the cream canvas, light +
  dark; chrome (Motd, Feedback) tokenized; no hardcoded palette classes remain in any restyled file.
- [ ] `BrandMark` is shared by the sidebar + gate screens.
- [ ] `pnpm --filter app exec tsc --noEmit` clean + full vitest suite green (no test edits needed — all gate/chrome
  tests are behavior-only).
- [ ] **The UI revamp is visually complete** — a repo-wide `grep` for `(slate|blue|amber|red|green|yellow|purple)-[0-9]`
  across `app/src` returns only any intentionally-excluded spots (none expected). Update `docs/PLATFORM.md` if any
  screen description is now stale.

## Self-Review (completed by plan author)

- **Spec coverage:** §7 gate flows (branded cards, logo, serif heading, one action) → Tasks 1–4; chrome restyle (Motd,
  Feedback FAB/modal) → Tasks 5–6; §4.5 icon (💬→lucide) → Task 6. `AuthSuccessPage` needs no work (renders only
  `LoadingSpinner`, restyled in Phase 3).
- **Placeholder scan:** none — the reused guide + Phase-5 additions + survey notes give exact classes/primitives.
- **Test consistency:** survey confirmed every gate/chrome test is behavior-only → zero test edits for restyles; only
  `BrandMark` adds a new (passing) test.
