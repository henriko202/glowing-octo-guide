# Message of the Day (MOTD) — Design

**Date:** 2026-06-17
**Status:** Approved (pending spec review)
**Author:** Henriko (with Claude)

## 1. Summary

Admin-authored **Message of the Day** shown to authenticated users at the very top of
the app. Default presentation is a **dismissible top banner**; an admin can flag a MOTD
as **important** to escalate it to a **blocking modal** that can only be closed with an
explicit OK button. Bodies are **markdown** (rendered safely), **per-locale** (English
required, others optional and extensible), and optionally **scheduled** with a start
and/or expiry date. Dismissal is **session-scoped**: closing a MOTD hides it for the
current session, but it re-appears on the next login.

## 2. Requirements

- Message displayed on top of everything in the app.
- Optional limited date (start and/or expiry).
- Always re-shows when the user logs in again, even after dismissing it.
- Markdown compatible.
- User can close it; it re-opens on next login.

Derived/clarified decisions:

- **Presentation:** banner by default; admin `important` flag escalates to a blocking modal.
- **Lifecycle:** a managed list of MOTDs with optional scheduling; exactly one is active at a time.
- **Markdown:** `react-markdown` + `remark-gfm`, rendered to React elements (no raw HTML).
- **Localization:** per-locale bodies; `en` required as the fallback; `pt`/`es` optional;
  data model accommodates additional locales later **without a schema migration**.
- **Important modals** are NOT dismissible by backdrop-click or Escape — only an OK button.
- **No audit log** for MOTD create/update/delete — this is ordinary admin content, not a
  personal-data action.

## 3. The "re-show on re-login" mechanic

Dismissal is stored in `sessionStorage` under a single key `motdDismissed`, holding
`{ token, motdId }` (JSON):

- The active MOTD is hidden **only if**
  `stored.token === currentSessionToken && stored.motdId === activeMotd._id`.
- **Page reload** keeps the same `sessionToken` → stays dismissed (correct — not a re-login).
- **Re-login** (even same-tab, after the cross-origin OAuth round-trip) writes a _fresh_
  token via `AuthSuccessPage` (`app/src/pages/AuthSuccessPage.tsx`) → stored token no
  longer matches → **re-shows**.
- **A newly published MOTD** mid-session has a different `_id` → re-shows even if the
  previous one was dismissed.

Rationale: keying on the _token value_ (not merely "is something dismissed") is what makes
same-tab re-login work — `sessionStorage` survives a same-tab navigation out to LinkedIn
and back, so a bare boolean would wrongly persist. The session token rotates on every
login, so it is the natural per-login fingerprint.

The MOTD component is rendered inside `RequireAuth`'s fully-onboarded branch, so it never
competes with the ban/policy/consent/public-identifier blocking screens.

## 4. Data model — new `motds` table

Added to `convex/schema.ts`:

```ts
motds: defineTable({
  // Locale code -> markdown body. `en` is required (enforced in validation, not schema)
  // and is the fallback for any locale without its own body. A record (not a fixed
  // object) so new locales can be added with no schema migration.
  bodies: v.record(v.string(), v.string()),
  important: v.boolean(), // false -> banner, true -> blocking modal
  enabled: v.boolean(), // admin on/off switch
  startAt: v.optional(v.number()), // optional scheduled start (ms epoch)
  expiresAt: v.optional(v.number()), // optional "limited date" (ms epoch)
  createdBy: v.id('users'),
  createdAt: v.number(),
  updatedAt: v.number()
}).index('by_enabled_and_created', ['enabled', 'createdAt'])
```

This is a **pre-launch additive schema change** (no prod data): add the table and ship.

### Active-selection rule (pure function)

`selectActiveMotd(rows, now)` — exported and unit-tested:

1. Filter to `enabled === true`.
2. Keep rows where `(startAt == null || startAt <= now)` **and**
   `(expiresAt == null || expiresAt > now)`.
3. Return the **newest by `createdAt`**, or `null` if none qualify.

So multiple MOTDs may be stored/scheduled, but exactly one is ever shown.

## 5. Backend — `convex/motd/motd.ts`

Mirrors the `feedback` feature conventions (`requireAuth` + `assertAdmin`, exported pure
validators). Folder: `convex/motd/`.

- `getActiveMotd({ sessionToken })` — **viewer query**. Uses `resolveSession`; returns
  `null` if unauthenticated. Otherwise returns the active MOTD as
  `{ _id, bodies, important }` or `null`. Non-throwing (avoids UI error states on a
  transient/expired token).
- `listMotds({ sessionToken })` — **admin query**. `requireAuth` + `assertAdmin`.
  Newest-first, bounded `.take(200)`. Returns full rows for the admin table.
- `createMotd({ sessionToken, bodies, important, enabled, startAt?, expiresAt? })` —
  **admin mutation**. Validates, sets `createdBy`, `createdAt`, `updatedAt`.
- `updateMotd({ sessionToken, motdId, bodies, important, enabled, startAt?, expiresAt? })`
  — **admin mutation**. Validates, patches, bumps `updatedAt`.
- `deleteMotd({ sessionToken, motdId })` — **admin mutation**. Hard delete (admin content,
  no retention requirement).
- `toggleMotdEnabled({ sessionToken, motdId, enabled })` — **admin mutation**. Quick
  on/off without opening the editor.

### Pure validation — `validateMotdInput(...)` (exported, unit-tested)

- Trim every locale body; drop entries that are empty after trimming.
- Require a non-empty `en` body after trimming → else throw.
- Cap each body at 5000 characters → else throw.
- If both `startAt` and `expiresAt` are set, require `expiresAt > startAt` → else throw.
- Returns the cleaned `bodies` map.

## 6. Frontend

### 6.1 `app/src/components/MarkdownView.tsx` (new, shared)

Wraps `react-markdown` + `remark-gfm` with safe defaults:

- No raw HTML (do not add `rehype-raw`); react-markdown ignores embedded HTML by default.
- Links rendered via a `components.a` override forcing
  `target="_blank" rel="noopener noreferrer"`.
- Dangerous URL protocols (`javascript:`, etc.) stripped by react-markdown's default
  `urlTransform`.
- Accepts `className` so banner vs modal vs admin-preview can style the prose container.

Used by the live MOTD **and** the admin editor preview (single rendering path).

### 6.2 `app/src/components/Modal.tsx` (extend)

Add two optional props, both defaulting to `true` so existing callers
(`FeedbackModal`, etc.) are unaffected:

```ts
type Props = {
  onClose: () => void
  children: ReactNode
  panelClassName?: string
  dismissOnBackdrop?: boolean // default true
  dismissOnEscape?: boolean // default true
}
```

- When `dismissOnBackdrop === false`, backdrop click does not call `onClose`.
- When `dismissOnEscape === false`, the Escape handler is not attached.

### 6.3 `app/src/components/Motd.tsx` (new)

- Reads `sessionToken` from `sessionStorage`; subscribes to
  `api.motd.motd.getActiveMotd`.
- Resolves the body for the active UI language:
  `bodies[i18n.language.split('-')[0]] ?? bodies.en`.
- Reads/writes the `motdDismissed` sessionStorage key (`{ token, motdId }`); recomputes
  hidden state when `motd._id` or the token changes.
- Renders nothing while loading (`undefined`) or when there is no active MOTD (`null`).
- **Banner** (`important === false`): full-width bar pinned at the top with the rendered
  markdown and a `×` dismiss button (aria-label from i18n `motd.dismiss`).
- **Modal** (`important === true`): the extended `Modal` with
  `dismissOnBackdrop={false}` and `dismissOnEscape={false}`, plus an explicit **OK**
  button (i18n `motd.ok`) that performs the dismissal. No `×`.
- Both dismissal paths write the same `{ token, motdId }` to sessionStorage.

### 6.4 `app/src/App.tsx` (wire-in)

Inside `RequireAuth`'s final `return`, render `<Motd />` **above** `<AppNav />`:

```tsx
return (
  <>
    <Motd />
    <AppNav />
    {children}
    <FeedbackButton />
  </>
)
```

The banner renders in normal flow at the very top; the important modal uses fixed
positioning, so tree placement does not affect it.

### 6.5 Admin — `app/src/components/MotdTab.tsx` (new) + `AdminPage.tsx` (extend)

- Add `'motd'` to the `AdminPage` tab union and a "MOTD" tab button.
- `MotdTab` receives `{ sessionToken, isAdmin }` (same shape as `FeedbackTab`).
- **List:** existing MOTDs newest-first, showing enabled/important badges, the date
  window, and edit/delete + enable/disable controls.
- **Editor (create/edit):** one markdown textarea per supported language (iterating the
  app's supported locales — `en`, `pt`, `es` — with `en` marked required), `important`
  and `enabled` checkboxes, optional `datetime-local` inputs for start/expiry, and a live
  `MarkdownView` preview of the body being edited.

### 6.6 Dependencies & i18n

- Add to the `app/` workspace via **pnpm**: `pnpm --filter app add react-markdown remark-gfm`.
- Add keys to `app/src/i18n/locales/{en,pt,es}.json` under a `motd` namespace
  (`motd.dismiss`, `motd.ok`, plus admin-tab labels). The MOTD _body_ itself is admin
  content, not an i18n key.

## 7. Testing

### 7.1 Convex unit (`convex/motd/motd.test.ts`)

- `selectActiveMotd`: picks newest enabled; excludes disabled; respects `startAt`
  (future start → excluded) and `expiresAt` (past expiry → excluded); returns `null` when
  none qualify.
- `validateMotdInput`: rejects empty `en`; rejects over-length; rejects
  `expiresAt <= startAt`; drops empty optional-locale entries; accepts a valid input.

### 7.2 Frontend (Testing Library, jsdom — existing setup)

- `Motd`: banner shows when active; hidden after dismiss; **re-shows when the session
  token changes**; re-shows when `motdId` changes; renders the modal (not banner) when
  `important`; locale fallback to `en` when the active language has no body.
- `MarkdownView`: renders gfm markdown; ignores raw HTML; neutralizes `javascript:` links.
- `Modal`: with `dismissOnBackdrop={false}` a backdrop click does not close; with
  `dismissOnEscape={false}` Escape does not close (regression guard for existing callers
  defaulting to `true`).

## 8. Documentation

Update `docs/PLATFORM.md` in the same change (per its "Maintaining This Document" map):

- New numbered section "Message of the Day (MOTD)" with the data model, active-selection
  rule, session-scoped dismissal semantics, and admin authoring.
- TOC entry.
- A Mermaid flow chart for active-selection + the dismissal/re-login lifecycle.
- Schema reference updated to include the `motds` table.

## 9. Non-goals (YAGNI)

- No per-tier / per-segment targeting (shown to all authenticated users).
- No read receipts or view analytics.
- No audit-log entries for MOTD CRUD.
- No email/push delivery.
- No rich media beyond markdown.
- No more than one MOTD shown at a time (storage/scheduling supports many; display picks one).

## 10. Acceptance criteria

1. An admin can create, edit, enable/disable, schedule, and delete MOTDs from the Admin
   panel's MOTD tab.
2. A non-important enabled MOTD within its date window shows as a top banner to logged-in
   users, rendered from markdown.
3. Flagging a MOTD important shows it as a modal that can only be closed via OK (not
   backdrop/Escape).
4. Closing a MOTD hides it for the session; reloading the page keeps it hidden; logging in
   again shows it.
5. A MOTD outside its start/expiry window is not shown.
6. Body resolves to the user's language when present, else falls back to English.
7. Raw HTML / dangerous links in a body are not rendered as active markup.
