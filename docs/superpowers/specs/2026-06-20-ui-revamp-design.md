# UI Revamp — Design Spec

- **Date:** 2026-06-20
- **Status:** Approved (design) — ready for implementation planning
- **Scope owner:** Henriko
- **Topic:** Revamp the authenticated app UI (`app/`) into a professional, accessible, brand-cohesive interface.

> **Commit policy:** Per `CLAUDE.md`, the agent never runs `git commit`/`git push`. This spec is written to disk only; *
*Henriko commits it.**

---

## 1. Summary

Revamp the `app/` UI so it looks professional, is comfortable for daily data-dense work, is accessible, works on mobile,
and reads as the **same product** as the premium landing site — **desktop-first, mobile-capable**.

Two pillars:

1. **A real design system** — replace the stock-shadcn neutral (grayscale) tokens and the ad-hoc hardcoded `slate-*`/
   `blue-*` colors with a **"warm premium"** branded token system (gold / cream / ink, serif display + sans body), in
   light (default) and dark.
2. **A real app shell** — replace the thin top-bar [`AppNav`](../../../app/src/components/AppNav.tsx) with a **sidebar +
   top bar** shell (responsive to a mobile drawer), a consistent page-header pattern, and a command-palette placeholder.

This is **presentation + shell only**. No backend capability changes. Two capability additions surfaced during design (
LinkedIn headline, functional search) are **carved out as separate deferred plans** (§12).

---

## 2. Context & problem

Current state of `app/` (React 19 + Vite + Tailwind 4 + shadcn/ui + Radix + i18next + lucide):

- [`index.css`](../../../app/src/index.css) is the **default shadcn neutral theme** — pure grayscale, zero brand color.
- Components **bypass the tokens** and hardcode palette colors (`slate-900`, `blue-500`, `amber-600`) — e.g. [
  `AppNav.tsx`](../../../app/src/components/AppNav.tsx), [`PostCard.tsx`](../../../app/src/components/PostCard.tsx). Two
  competing color systems.
- The shell is a thin dark top bar with **hardcoded English** labels (i18n not wired into nav) that would overflow on
  mobile.
- The result is a **brand disconnect**: the marketing site ([
  `landing/app/globals.css`](../../../landing/app/globals.css)) is a distinctive premium identity (ink `#060B18`, cream
  `#F5F0E8`, gold `#C9963E`, Cormorant Garamond + DM Sans), while the app looks like an unstyled prototype.

---

## 3. Locked decisions

| #   | Decision           | Choice                                                                                                                                               |
|-----|--------------------|------------------------------------------------------------------------------------------------------------------------------------------------------|
| D1  | Brand relationship | **Branded "working" theme** — carry the gold/ink/cream identity + serif display, expressed as a calm, legible working surface with a real dark mode. |
| D2  | Scope              | **Reskin + new app shell** (design system + shell; existing screens reframed & restyled, content unchanged).                                         |
| D3  | Shell layout       | **Sidebar + top bar** (feed keeps a centered reading column inside the main area; data screens go full-width).                                       |
| D4  | Visual direction   | **Warm premium** — cream canvas, white cards, gold present but disciplined, medium density.                                                          |
| D5  | Letter casing      | **Title Case** for interactive labels (buttons, nav, tabs); **sentence-case** serif page H1s as a deliberate editorial choice.                       |
| D6  | Typography         | **DM Sans** (body/UI) + **Cormorant Garamond** (display), **self-hosted** (not Google Fonts CDN — privacy).                                          |
| D7  | Admin access       | **URL-only** — `/admin` route stays, but **no** sidebar link and **no** command-palette entry.                                                       |
| D8  | Top-bar search     | **Placeholder only** in this revamp; functional search is a deferred plan (§12).                                                                     |
| D9  | Member headline    | **Deferred plan** (§12). Until shipped, author/user secondary line falls back to the **industry** already in the app (`headline ?? industry`).       |
| D10 | Reaction emoji     | **Keep** the LinkedIn-style reaction emoji (they are content, not chrome). Swap only chrome emoji (🔗, 💬, ↗) for lucide.                            |

---

## 4. Design system / foundations

### 4.1 Color tokens

Authored in [`app/src/index.css`](../../../app/src/index.css) as the shadcn semantic variables (values below are the *
*starting point**; every foreground/background pair **must be contrast-verified** at build — see §8A). Values may be
authored as hex or equivalent oklch (Tailwind v4 accepts both).

**Light (default)**

| shadcn var                                  | Role                            | Value                                  |
|---------------------------------------------|---------------------------------|----------------------------------------|
| `--background`                              | canvas                          | `#F2EEE6`                              |
| `--foreground`                              | primary text (ink)              | `#1C1813`                              |
| `--card`, `--popover`                       | card / popover surface          | `#FFFFFF`                              |
| `--card-foreground`, `--popover-foreground` | text on card                    | `#1C1813`                              |
| `--secondary`                               | warm surface (sidebar, top bar) | `#FAF7F0`                              |
| `--secondary-foreground`                    | text on secondary               | `#2A251D`                              |
| `--muted`                                   | muted surface                   | `#EFEAE0`                              |
| `--muted-foreground`                        | muted text                      | `#6E6757`                              |
| `--accent`                                  | active/hover tint (gold)        | `#F6EAD0`                              |
| `--accent-foreground`                       | text on accent                  | `#8A6418`                              |
| `--primary`                                 | **gold** (fills, CTAs)          | `#C9963E`                              |
| `--primary-foreground`                      | text on gold                    | `#1C1813`                              |
| `--border`, `--input`                       | hairline                        | `#E4DCCD`                              |
| `--ring`                                    | focus ring                      | `#C9963E`                              |
| `--destructive`                             | danger                          | `#B4231F`                              |
| `--destructive-foreground`                  | text on danger                  | `#FFFFFF`                              |
| `--gold-text` *(new)*                       | accent **text/links/icons**     | `#8A6418`                              |
| `--success`, `--success-foreground` *(new)* | success badge                   | `#E6F1DD` / `#3B6D2E`                  |
| `--font-display` *(new)*                    | serif                           | `'Cormorant Garamond', Georgia, serif` |

Sidebar group: `--sidebar #FAF7F0`, `--sidebar-foreground #2A251D`, `--sidebar-primary #C9963E`,
`--sidebar-accent #F6EAD0`, `--sidebar-accent-foreground #8A6418`, `--sidebar-border #E4DCCD`, `--sidebar-ring #C9963E`.

Primary button states (light): default `#C9963E` → hover `#B8862F` → active `#A6781F`.

**Dark**

| shadcn var                                  | Role                     | Value                 |
|---------------------------------------------|--------------------------|-----------------------|
| `--background`                              | canvas (ink-navy)        | `#0E1320`             |
| `--foreground`                              | primary text (cream)     | `#F5F0E8`             |
| `--card`, `--popover`                       | card surface             | `#161C2B`             |
| `--card-foreground`                         | text on card             | `#F5F0E8`             |
| `--secondary`                               | sidebar/top-bar surface  | `#131A28`             |
| `--secondary-foreground`                    | text on secondary        | `#E7E1D6`             |
| `--muted`                                   | muted surface            | `#1C2433`             |
| `--muted-foreground`                        | muted text               | `#9A9384`             |
| `--accent`                                  | active/hover tint (gold) | `#2A2418`             |
| `--accent-foreground`                       | text on accent           | `#E8C474`             |
| `--primary`                                 | **gold**                 | `#D8A94E`             |
| `--primary-foreground`                      | text on gold             | `#0E1320`             |
| `--border`, `--input`                       | hairline                 | `#2A3142`             |
| `--ring`                                    | focus ring               | `#D8A94E`             |
| `--destructive`                             | danger                   | `#E06A5E`             |
| `--destructive-foreground`                  | text on danger           | `#0E1320`             |
| `--gold-text` *(new)*                       | accent text/links/icons  | `#E8C474`             |
| `--success`, `--success-foreground` *(new)* | success badge            | `#1E2A1C` / `#8FCB8A` |

Sidebar group (dark): `--sidebar #131A28`, `--sidebar-foreground #E7E1D6`, `--sidebar-primary #D8A94E`,
`--sidebar-accent #2A2418`, `--sidebar-accent-foreground #E8C474`, `--sidebar-border #2A3142`, `--sidebar-ring #D8A94E`.

Primary button states (dark): default `#D8A94E` → hover `#E3B85E` → active `#C9963E`.

### 4.2 The two-gold rule (accessibility keystone)

Bright gold (`--primary` `#C9963E`) is mid-luminance (~2.8:1 on white) and **fails WCAG for text**. The system splits
it:

- **`--primary` (bright gold)** → fills, borders, focus rings, the page-title underline, active backgrounds.
- **`--gold-text` (deep gold)** → anything that is **text, a link, or a small icon** on light/card surfaces.

> Contrast caveat to verify in §8A: `--gold-text #8A6418` passes AA on white (~4.6:1) but is borderline on the cream
> canvas (~4.0:1). For small body-weight gold text on cream, darken toward `#7A5816`, or reserve gold-text for ≥medium
> weight / on white cards.

### 4.3 Typography

- **Body / UI:** DM Sans. **Display / headings:** Cormorant Garamond. Both **self-hosted** via `@fontsource` (add
  `@fontsource-variable/dm-sans` + a Cormorant Garamond source, and remove the existing `@fontsource-variable/geist`
  import — Geist is replaced). Set `--font-sans` and `--font-display`.
- **Serif is reserved** for page titles (the H1 + gold underline) and signature moments — **never** for table data or
  dense functional text.
- `font-display: swap`; preload the 1–2 critical weights.
- Numeric data (counts, billing figures, admin columns) uses `font-variant-numeric: tabular-nums`.
- Type scale (rem): 12 / 13.5 / 14 (base) / 16 / 20 / 24 / 30. Weights: 400 body, 500 labels/medium, 600 headings.

### 4.4 Shape, elevation, motion

- **Radius:** `--radius` → `0.75rem` (12px) on cards; `sm`/`md`/`lg` derive.
- **Elevation:** restrained — hairline borders for separation; a single soft shadow only on popovers/dialogs. No ambient
  shadows on cards.
- **Motion:** 150–200ms, `ease-out` enter / `ease-in` exit; animate `transform`/`opacity` only (never
  `transition: all`); honor `prefers-reduced-motion`.

### 4.5 Icons

- **lucide-react** for all chrome. One stroke width (lucide default 2px), outline-only (no filled variants at the same
  hierarchy). Size tokens: `icon-sm` 16, `icon-md` 20, `icon-lg` 24.
- **Exception:** LinkedIn reaction emoji stay (content). Each keeps its `sr-only` text label (already done in [
  `PostCard.tsx`](../../../app/src/components/PostCard.tsx)).

### 4.6 Dark mode

- Default **light**; toggle in the user menu; preference persisted to `localStorage` (`theme`), seeded from
  `prefers-color-scheme` on first visit. The `.dark` class is already wired in [
  `index.css`](../../../app/src/index.css).
- Set **`color-scheme: light dark`** on `<html>` (and toggle), and a `<meta name="theme-color">` that matches the active
  canvas — fixes native scrollbars/controls.

---

## 5. App shell & navigation

### 5.1 Component decomposition

Replace the single [`AppNav`](../../../app/src/components/AppNav.tsx) with a focused set, each independently testable:

- **`AppShell`** — layout: sidebar + top bar + main; owns responsive state (drawer open/closed) and theme.
- **`Sidebar`** — grouped nav + user chip.
- **`TopBar`** — command-palette trigger, language switcher, theme toggle.
- **`UserMenu`** — profile, theme toggle, sign-out (the current sign-out logic in [
  `AppNav.tsx`](../../../app/src/components/AppNav.tsx) / [`session.ts`](../../../app/src/lib/session.ts) moves here
  unchanged).
- **`CommandPalette`** — `cmdk`-based, **placeholder** wiring in this revamp (§12).
- **`PageHeader`** — serif H1 + gold underline + optional lead + actions slot. Used by every page.

[`App.tsx`](../../../app/src/App.tsx) `RequireAuth` wraps the authenticated `{children}` in `<AppShell>` instead of
`<AppNav>`. **Pre-app gate screens render without the shell** (see §7).

### 5.2 Sidebar

- Brand mark (gold) + wordmark "Link Into The SSI" (`translate="no"`).
- Groups: **Main** (Feed, My Posts) · **Manage** (Billing, Settings, Privacy & Data). **No Admin group** (D7).
- Each item: lucide icon + Title-Case label. Active = `--accent` background + `--accent-foreground` text +
  `aria-current="page"`.
- Bottom: **user chip** → `UserMenu`.

### 5.3 Top bar

- Command-palette trigger pill (`⌘ K`, non-breaking space, placeholder).
- Language switcher (EN/PT/ES) — **not** a bare native `<select>` (replace with a styled dropdown, or if kept native set
  explicit `background-color`/`color` for Windows dark mode).
- Theme toggle.

### 5.4 Responsive

- Breakpoints: persistent sidebar ≥`lg` (1024px); **off-canvas drawer** below `lg`, opened by a hamburger in the top
  bar.
- Drawer: dimmed scrim (40–60% black), **focus trap**, `Esc` to close, focus returned to the trigger,
  `overscroll-behavior: contain`.
- Feed content holds a centered **~640px** reading column; data screens (admin, billing) use full width. Touch targets
  ≥44px. No horizontal page scroll.

### 5.5 MOTD + Feedback

- [`Motd`](../../../app/src/components/Motd.tsx) → dismissible banner under the top bar.
- [`FeedbackButton`](../../../app/src/components/FeedbackButton.tsx) → floating action button, restyled gold.

### 5.6 i18n

- Every shell/chrome string via `i18next` (en/pt/es), preserving [`seedLanguage`](../../../app/src/i18n/seedLanguage.ts)
  and the existing browser-language detector (`navigator.languages`, not IP).
- `translate="no"` on brand/identifier tokens ("Link Into The SSI", "LinkedIn", "SSI").

---

## 6. Component system

Build on the existing primitives in [`app/src/components/ui/`](../../../app/src/components/ui/); add what's missing.

**Extend:** `Button` (variants `primary`/`secondary`/`ghost`/`destructive`/`link` + sizes), `Input`/`Textarea`/
`InputGroup` (gold focus ring, error states), `Popover`/`HoverCard`/`Command`.

**Consolidate:** standardize on shadcn [`dialog.tsx`](../../../app/src/components/ui/dialog.tsx); migrate the bespoke [
`Modal.tsx`](../../../app/src/components/Modal.tsx) and its consumers (BanUserDialog, ChangeTier, ChangeStatus,
ContactLimits, Feedback, RespondFeedback) onto it. One modal primitive.

**Add:** `Badge` (status/plan), `Avatar` (extract the inline initials-fallback from [
`PostCard.tsx`](../../../app/src/components/PostCard.tsx); reuse in sidebar chip + admin rows), `Table`, `Tabs` (
replaces admin ad-hoc tab state), `DropdownMenu` ([`RowActionsMenu`](../../../app/src/components/RowActionsMenu.tsx) →
it), `Toast` (wire [`useFlash`](../../../app/src/components/useFlash.tsx) into an `aria-live` region), `Skeleton`,
`EmptyState`, `PageHeader`.

---

## 7. Screen-by-screen (logic untouched — presentation only)

- **Feed** — centered ~640px column; `PageHeader`; composer card with gold Add-post button; warm-premium `PostCard` (
  Featured pill, `Avatar`, gold reaction picker, comment, "View on LinkedIn" as a gold-text `<a>` with lucide external
  icon); restyled `CommentBox`; secondary Load-more; empty/loading/skeleton states. **Virtualize** the accumulating
  list (§8C).
- **My Posts** — `PageHeader` + the member's submitted posts with status badges + actions.
- **Settings** — sectioned form (Account · Language · [
  `ConsentToggles`](../../../app/src/components/ConsentToggles.tsx)); save → success toast; unsaved-changes guard.
- **Privacy & Data** — export/download, consent management, deletion with deliberate **danger** styling + confirmation.
- **Billing** — `PageHeader`; current-plan card + tier-comparison cards (gold highlight on current/recommended) + gold
  upgrade CTA.
- **Admin** (`/admin`, URL-only) — tabbed (Users · Feedback · MOTD · Plan Limits) with the **tab in the URL** (§8D);
  data `Table` with avatars, plan pills, semantic status badges, row-action `DropdownMenu`; modals on the consolidated
  dialog; PlanLimitsTab as a clean form.
- **Gate flows (no shell)** — [`BannedScreen`](../../../app/src/components/BannedScreen.tsx), `ConsentPromptScreen`,
  `PolicyUpdateScreen`, `PublicIdentifierPromptScreen`, `CancelDeletionScreen`, [
  `AuthSuccessPage`](../../../app/src/pages/AuthSuccessPage.tsx) → centered, branded cards on the cream canvas with
  logo, serif heading, one clear primary action.

---

## 8. Cross-cutting requirements (QC findings from ui-ux-pro-max + Web Interface Guidelines)

### 8A · Accessibility & semantics

- WCAG 2.1 **AA** target. **Verify every foreground/background pair** with a contrast tool at build (esp. gold-text on
  cream, muted on cream, dark-mode pairs); adjust values if any fail.
- `focus-visible` gold ring on every interactive element; never `outline: none` without a replacement.
- Status conveyed by **text + color**, never color alone.
- Icon-only buttons → `aria-label`; decorative icons → `aria-hidden`. `<button>` for actions, `<a>`/`<Link>` for
  navigation (no `<div onClick>`). Semantic HTML before ARIA.
- Toasts → `aria-live="polite"`, must not steal focus; form errors → `role="alert"`/`aria-live`.
- Hierarchical headings (`PageHeader` = the page `<h1>`); skip-to-content link; `scroll-margin-top` on any anchored
  headings (privacy/legal).

### 8B · Forms (incl. the paste-heavy composer)

- Post composer: **never block paste**; `type="url"` + `inputmode="url"`; placeholder with example ending in `…` (e.g.
  `https://linkedin.com/posts/…`).
- All inputs: visible label, `autocomplete` + meaningful `name`, helper text; inline validation **on blur** (not
  per-keystroke); focus the first invalid field on submit.
- Submit button stays enabled until the request starts, then spinner + disabled.
- Settings: warn before navigating away with unsaved changes; `spellCheck={false}` on identifier-type fields.
- Disabled states: ~0.4 opacity + `disabled` attribute + cursor change.

### 8C · Performance & layout shift (CLS)

- Avatars and the [`LinkedInEmbed`](../../../app/src/components/LinkedInEmbed.tsx) iframe need explicit `width`/`height`
  or `aspect-ratio` to reserve space; `loading="lazy"` on below-fold avatars.
- **Virtualize the feed** with `@tanstack/react-virtual` (already a dependency — see [
  `VirtualizedCombobox`](../../../app/src/components/VirtualizedCombobox.tsx)). Admin tables stay paginated.
- `font-display: swap` + preload critical weights; `preconnect` to LinkedIn media/CDN domains.

### 8D · Navigation = URL state

- **Admin tab** and **feed pagination** live in the URL (query param or nested route via React Router) so they are
  deep-linkable and Back works. (Today they are component state.)
- Links use `<a>`/`<Link>` (Cmd/Ctrl+click, middle-click). Destructive actions keep confirmation (existing dialogs)
  and/or an undo window.

### 8E · Dark mode / theming (web specifics)

- `color-scheme` on `<html>`; `<meta name="theme-color">` per theme; native `<select>` (if any remain) gets explicit
  `background-color`/`color`.
- Define interaction states (hover/active/focus/disabled) for **both** themes; verify dividers/borders are visible in
  both.

### 8F · Typography & copy

- Real `…`, curly quotes, non-breaking spaces (`⌘ K`, brand names); loading states end in `…` ("Saving…").
- `text-wrap: balance` on serif titles; `min-w-0` on flex children that truncate (author names, table cells);
  `line-clamp`/`break-words` on user-generated content (post body, comments, names — anticipate short/avg/very-long).
- Copy: Title Case for buttons/nav/tabs (D5), active voice, second person, numerals for counts, specific button labels.

### 8G · Touch / interaction / motion

- Global `touch-action: manipulation`; `-webkit-tap-highlight-color` set intentionally; `overscroll-behavior: contain`
  on drawer + dialogs; modal/drawer scrim 40–60% black.
- `autoFocus` only on desktop, single primary input (e.g. command palette) — not on the mobile drawer.

A condensed **Design QC checklist** (§15) collects these for implementation-time verification.

---

## 9. Implementation sequence (5 shippable phases)

1. **Foundation** — tokens (light+dark) in `index.css`; add DM Sans + Cormorant (`@fontsource`), remove Geist; theme
   toggle + persistence + `color-scheme`/`theme-color`; base primitives (Button, Input, Badge, Avatar, PageHeader). *The
   app re-themes at the token level before any screen is hand-touched.*
2. **App shell** — `AppShell`/`Sidebar`/`TopBar`/`UserMenu` + responsive drawer + command-palette **placeholder**; i18n
   labels; swap `AppNav` in `RequireAuth`; MOTD banner + restyled feedback FAB.
3. **Screen sweep** — Feed (+ virtualization), My Posts, Settings, Privacy, Billing: replace every hardcoded `slate-*`/
   `blue-*` with tokens/primitives; apply §8B forms + §8C CLS.
4. **Admin & tables** — `Tabs` (+ URL state §8D), `Table`, `DropdownMenu`, modal consolidation.
5. **Gate flows & polish** — no-shell branded screens; toasts via `useFlash` (`aria-live`); empty/loading/skeletons;
   final a11y + contrast verification + docs.

Each phase is independently shippable; the revamp lands incrementally, not as one mega-PR.

---

## 10. Testing

- Keep existing vitest suites green (unit/logic with mocked `convex/server`, per the project convention — no
  `convex-test`). Update only tests that assert a specific class/color.
- Add focused tests for new shell behavior: active nav (`aria-current`), drawer open/close + focus return, theme toggle
  persistence, `PageHeader` rendering, URL-tab sync.
- Verify by **running the app** (light + dark, desktop + ~360px), not just tests. Run `pnpm verify` (format + lint +
  typecheck + tests) before declaring a phase done.

---

## 11. Documentation

Per `CLAUDE.md`, [`docs/PLATFORM.md`](../../PLATFORM.md) is canonical and kept in sync **in the same change**:

- Add a **Design System** section (tokens, theming, fonts, components, the two-gold rule).
- Add/Update the **App shell & navigation** section + a Mermaid flow for the shell (sidebar/topbar/drawer, gate-screen
  bypass) and ToC entries.
- Note the new `theme` localStorage key and self-hosted fonts.

---

## 12. Out of scope & deferred plans

**Deferred plan A — LinkedIn headline** (own spec/plan): fetch + store + display the member's LinkedIn **headline** (the
app has *industry*, not headline). Surface in the sidebar user chip + post-author rows. **Build on the existing** [
`profile-enrichment`](2026-06-14-profile-enrichment-design.md) pipeline. **Compliance gate:** pulling additional
LinkedIn profile data must clear the privacy/compliance process (disclosed sub-processor, data minimization) before
implementation. Until shipped, UI uses `headline ?? industry` (D9).

**Deferred plan B — Top-bar search / command palette** (own spec/plan): implement real search over posts/people +
command-palette actions (navigate, add post, switch language, toggle theme, sign out). Define the data source (Convex
search index?) and scope. In this revamp the trigger is a styled, non-functional placeholder (D8).

**Not changing:** routing/IA beyond the shell; the reaction-emoji model (D10); env vars; admin stays URL-only (D7).

---

## 13. Risks & mitigations

| Risk                                                    | Mitigation                                                                                                           |
|---------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------|
| Large diff touching many files                          | Token-first sequencing (§9) — Phase 1 re-themes most of the app via tokens; later phases are isolated and shippable. |
| Tests asserting classes/colors break                    | Expected, bounded; update alongside each component. Logic tests unaffected (presentation-only).                      |
| Gold contrast failures (esp. on cream)                  | The two-gold rule + a mandatory build-time contrast verification pass (§8A); darken `--gold-text` if needed.         |
| Font swap (Geist→DM Sans) regressions                   | Self-host via `@fontsource`; `font-display: swap`; verify numeric alignment with `tabular-nums`.                     |
| Feed/iframe CLS                                         | Reserve space (aspect-ratio/dimensions) + virtualization (§8C).                                                      |
| Headline mock data implies a feature that doesn't exist | D9 fallback (`headline ?? industry`) + Deferred plan A.                                                              |

---

## 14. Success criteria

- App visually matches the **warm-premium** brand and reads as the same product as the landing site, in **light and dark
  **.
- **No** hardcoded `slate-*`/`blue-*` remain in `app/`; all color flows from tokens.
- WCAG **AA** contrast verified for all pairs; full keyboard operation; visible focus everywhere.
- Responsive to ~360px; sidebar→drawer works (focus trap, Esc, restore).
- Admin tab + feed pagination are URL-driven.
- Existing vitest suites green + new shell tests; `pnpm verify` passes.
- [`docs/PLATFORM.md`](../../PLATFORM.md) updated.

---

## 15. Appendix — Design QC checklist (verify per phase)

**Accessibility:** contrast AA (all pairs, both themes) · focus-visible everywhere · aria-label on icon buttons ·
aria-hidden on decorative icons · `<button>`/`<a>` semantics · toasts aria-live · form errors role=alert · heading
hierarchy · skip link · color-not-only.
**Forms:** labels + autocomplete + name · correct type/inputmode · paste not blocked · placeholders end `…` with
example · validate on blur · focus first error · submit spinner · unsaved-changes guard · disabled 0.4 + attribute.
**Performance/CLS:** img/iframe dimensions or aspect-ratio · lazy below-fold · feed virtualized · font-display swap +
preload · preconnect.
**Navigation/state:** admin tab + pagination in URL · `<Link>` for nav · destructive confirm/undo.
**Theming:** color-scheme on html · theme-color meta · native select colors · states defined both themes · borders
visible both themes · scrim 40–60%.
**Typography/copy:** `…`/curly quotes/nbsp · loading ends `…` · text-wrap balance on titles · min-w-0 + line-clamp on
UGC · tabular-nums on data · Title-Case labels / sentence-case H1.
**Motion/touch:** 150–200ms transform/opacity only · no `transition: all` · prefers-reduced-motion · touch-action
manipulation · overscroll-contain · targets ≥44px.
**Style:** lucide outline-only, one stroke + size tokens · no chrome emoji (reaction emoji kept as content) · restrained
elevation · radius 12.

---

## 16. Assumptions log

- The existing admin authorization check still governs the `/admin` route; removing the nav link does not change access
  control (URL-only by design).
- `getMe` exposes (or can cheaply expose) the member's **industry** for the author/user fallback line; **headline** does
  not exist yet (Deferred plan A).
- `@fontsource` packages exist for DM Sans (variable) and Cormorant Garamond; if a variable Cormorant is unavailable,
  pin the needed static weights (500/600).
- No new environment variables are introduced by this work.
