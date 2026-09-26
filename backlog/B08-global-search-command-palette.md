# B08 — Global search / ⌘K command palette (dead button)

> **Status:** ✅ DONE (2026-08-21) · **Priority:** P2 · **Effort:** M · **Category:** Frontend / Feature
> **Depends on:** — · **Blocks:** —

## Summary

The top bar shows a search field with a "⌘ K" hint, but the button has no `onClick` and only a
"Search is coming soon" tooltip — it does nothing. The `cmdk` command-palette wrapper is fully
built in `ui/command.tsx` but its `CommandDialog` is never imported, there is no search index in the
Convex schema, and a complete implementation plan for this exists but was explicitly **deferred**.
So this is a visible dead control with a written-but-unexecuted plan behind it.

## Evidence

- `app/src/components/shell/TopBar.tsx:23-35` — the search `<button>` has **no `onClick`**; it
  carries `aria-label={t('shell.search')}`, `title={t('shell.searchComingSoon')}` (line 26), and a
  `<kbd>⌘ K</kbd>` hint (line 34). Nothing opens a palette.
- `app/src/i18n/locales/en.json:16` — `"searchComingSoon": "Search is coming soon."`.
- `app/src/components/ui/command.tsx:24` — `CommandDialog` is defined (and exported at line 147) but
  **never imported** anywhere. Only `Command`, `CommandEmpty`, `CommandGroup`, `CommandInput`,
  `CommandItem`, `CommandList` are consumed — and only by
  `app/src/components/VirtualizedCombobox.tsx:6` (a form combobox, not a global palette).
- `convex/schema.ts` — the `posts` table has no `.searchIndex(...)`; the users table has none
  either. No full-text search backend exists yet.
- `docs/superpowers/plans/2026-06-20-topbar-search-command-palette.md:1,6` — a full 6-task plan
  titled "…(DEFERRED)"; line 6 marks it **DEFERRED**, depending on the App-Shell phase (already in
  place).

## Root cause

Phase 2 (App Shell) shipped the search **placeholder**; the palette that replaces it was written up
as a separate plan and deferred. The `cmdk` UI primitives and the `TopBar` slot exist, but the
Convex search indexes, the `search` query, the `CommandPalette` component, and the ⌘K wiring were
never built.

## What we need to do

> **READ the deferred plan first** (`docs/superpowers/plans/2026-06-20-topbar-search-command-palette.md`).
> It is detailed and mostly pre-coded. Its intended scope (from the plan):

- **Two Convex `searchIndex`es** — `posts.search_content` (searchField `content`, filterField
  `inFeed`) and `users.search_name` (searchField `name`) — added to `convex/schema.ts` (Task 1).
- **`convex/search.ts`** — a `search` query returning `{ posts, people }`, reusing `toFeedAuthor` +
  `isAuthorFeedEligible` and applying the **same** feed visibility + author-eligibility rules as
  `getFeed` (so hidden/visibility-restricted/ineligible-author posts never leak); people are
  projected via a new pure `toSearchPerson` that exposes only safe display fields — never
  tokens/PII (Task 2).
- **`app/src/components/shell/CommandPalette.tsx`** — reuses the existing `CommandDialog` from
  `ui/command.tsx`, debounces input (~180ms), queries reactively via `useQuery(..., 'skip')`, and
  offers Quick-actions (navigate / toggle theme / sign out) + People + Posts groups (Task 4).
- **Wiring** — `AppShell` owns the open state + a global ⌘K/Ctrl-K keydown listener; the `TopBar`
  search button opens it via a new `onOpenSearch` prop, and the `title={t('shell.searchComingSoon')}`
  hint is removed (Task 5).
- **i18n** — new `shell.*` palette strings in en/pt/es (Task 3).

Concrete steps:

1. Decide scope: **content search (posts + people)** per the plan vs. a lighter **command/nav
   palette only**. The plan does both; the searchable entities are **posts** (by `content`) and
   **people** (users, by `name`), plus quick nav actions.
2. Execute the deferred plan Tasks 1–6 (schema index → `convex/search.ts` → i18n → `CommandPalette`
   → wire ⌘K + button → docs). Apply the schema change with `npx convex dev` from the **repo root**.
3. Enforce auth + feed-parity visibility in the `search` query (the plan's Global Constraints call
   this out — it is a leakage risk if skipped).
4. Add the ⌘K keydown listener with `e.preventDefault()` so it doesn't collide with browser search.

## Acceptance criteria

- [ ] ⌘K/Ctrl-K **and** the top-bar search button open a working palette; `Esc` closes it.
- [ ] Typing ≥2 chars searches posts + people; results honor feed visibility + author eligibility;
      people results expose only safe fields (no tokens/PII).
- [ ] The `searchComingSoon` tooltip is removed; all palette strings localized (en/pt/es).
- [ ] `pnpm verify` is green (typecheck + lint + tests)
- [ ] `docs/PLATFORM.md` updated (see **Docs to update**)

## Risks / edge cases / open questions

- **Data leakage** is the headline risk: the `search` query must reuse the feed's visibility +
  author-eligibility filters (`convex/feed.ts`) and the safe people projection — otherwise it
  becomes a bypass around the feed's access rules.
- **Search index scope**: `filterFields: ['inFeed']` keeps post results to feed-eligible rows;
  confirm that matches the intended UX (should hidden own-posts be findable by the author?).
- **⌘K collisions** with browser/OS shortcuts — always `preventDefault` and only when the palette
  should own the key.
- Search indexes cannot be unit-tested under the project's no-`convex-test` convention; the query
  needs a manual runtime smoke test (the plan notes this explicitly).

## Docs to update

- `docs/PLATFORM.md` — add a "Search & command palette" subsection (the two search indexes, the
  `search` query's auth + feed-parity rules, the ⌘K palette) and update the Maintaining-This-Document
  mapping (per the plan's Task 6).

## References

- Related: [[B16]] (i18n for the new strings)
- Prior art / plan: `docs/superpowers/plans/2026-06-20-topbar-search-command-palette.md` (DEFERRED,
  near-complete); spec `docs/superpowers/specs/2026-06-20-ui-revamp-design.md` §12 (Deferred plan B),
  §8D

## Update — 2026-08-21 — IMPLEMENTED

The deferred plan was executed end-to-end. The dead top-bar button is now a working ⌘K palette.

**What shipped:**

- **Schema** (`convex/schema.ts`): `posts.searchIndex('search_content', { searchField: 'content', filterFields: ['inFeed'] })`
  and `users.searchIndex('search_name', { searchField: 'name' })`.
- **`convex/search.ts`** — `search` query returning `{ posts, people }`, session-gated, reusing `toFeedAuthor` +
  `isAuthorFeedEligible` and applying the **same** visibility filter as `feed.getFeed` (inFeed pin + per-viewer
  industry/country allow-lists + author eligibility). New pure `toSearchPerson` allow-list projection; unit-tested in
  `convex/search.test.ts`.
- **`app/src/components/shell/CommandPalette.tsx`** — cmdk `CommandDialog`, 180ms debounce, `useQuery(..., 'skip')` at
  ≥2 chars, idle Quick-actions (nav + toggle theme + sign out) vs. searching People/Posts, localized "No results".
- **Wiring**: `AppShell` owns palette state + global ⌘K/Ctrl-K listener; `TopBar` gained `onOpenSearch` and the
  `searchComingSoon` tooltip (and its i18n key) was removed. i18n `shell.*` palette strings added to en/pt/es.
- **Docs**: `docs/PLATFORM.md` §11B "Search & Command Palette" added (+ TOC + Maintaining mapping row).

**Deviations from the plan (plan was slightly wrong / incomplete — corrected):**

1. The plan's `CommandPalette` snippet omitted the cmdk **`<Command>` root** — this project's `CommandDialog` does not
   wrap children in it (unlike canonical shadcn; the only other consumer, `VirtualizedCombobox`, supplies its own
   `<Command>`). Added `<Command shouldFilter={false}>` so results aren't double-filtered client-side.
2. **Idle vs. searching split** added so the `noResults` string is meaningful and quick actions don't get filtered by
   the typed query.
3. **Test infra**: `convex-mocks/_test/__mocks__/convex_server.ts` needed a `.searchIndex()` stub (the schema mock only
   had `.index()`); `app/src/test/setup.ts` needed `ResizeObserver` + `Element.prototype.scrollIntoView` stubs (jsdom
   gaps cmdk/radix hit on mount).

**Verified:** `pnpm typecheck` green; `pnpm lint` green; convex tests 252/252; app tests 178 pass (the only 3 app
failures — `cookies.test.ts` ×2, `theme.test.ts` ×1 — are **pre-existing**, unrelated to this work). `pnpm exec convex
codegen` was run from the repo root to regenerate `convex/_generated/api.d.ts` (adds the `search` module) and it pushed
the schema to the **dev** deployment, so the search indexes build there.

**Remaining (human):**

- **Manual runtime smoke** (search indexes can't be unit-tested under the no-`convex-test` convention): open the app,
  press ⌘K and click the search button → palette opens; type ≥2 chars → People/Posts appear; quick actions navigate;
  `Esc` closes.
- Before **prod**, run `npx convex deploy` (or `npx convex dev` against prod) so the two search indexes build in the
  production deployment.
- `pnpm verify`'s global `format:check` is a **pre-existing** repo-wide red (docs + vendored `ui/*` etc.); only this
  task's own files were Prettier-formatted, not the 41 unrelated ones.
