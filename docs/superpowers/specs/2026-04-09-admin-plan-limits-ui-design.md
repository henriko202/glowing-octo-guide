# Admin Panel — Plan Limits UI Design

**Date:** 2026-04-09
**Context:** The `planLimits` CRUD backend API was added to `convex/admin.ts` as part of the security fixes work
(`listPlanLimits`, `setContactUserLimit`, `removeContactUserLimit`, `updateTierDefault`). This spec covers the
frontend that exposes those endpoints in the admin panel.

---

## Decisions

| Question | Answer |
|----------|--------|
| Where does Plan Limits fit? | Tab navigation inside `AdminPage` (Settings + Plan Limits tabs) |
| How are contact users identified? | All contact-tier users appear automatically; no separate "add" form |
| Edit UX | Modal dialog |
| Table structure | Single unified table (tier defaults first, contact rows below a divider) |

---

## Tab Structure

`AdminPage.tsx` gains a tab bar at the top of the page. Two tabs:

- **Settings** — the existing Apify Post Sync card, unchanged
- **Plan Limits** — new tab (see below)

Tab state is local React state (`useState<'settings' | 'planLimits'>`), defaulting to `'settings'`. No URL change,
no router involvement.

The `max-w-[640px]` container and page heading remain. The tab bar sits between the heading and the card content.

---

## Plan Limits Tab

### Data

```typescript
useQuery(api.admin.listPlanLimits, { sessionToken })
```

Returns an array of rows typed as:

```typescript
{
  _id: Id<'planLimits'>
  tier: 'starter' | 'growth' | 'pro' | 'contact'
  userId?: Id<'users'>
  userName?: string
  interactionsPerPost: number
  postsPerWeek: number
}
```

Rows with no `userId` are tier defaults (4 rows). Rows with a `userId` are contact-tier per-user overrides.

The query is a live subscription — the table reflects mutations automatically without any manual refetch.

### Table Layout

Single table. Columns:

| Column | Notes |
|--------|-------|
| Tier / User | Tier badge pill for default rows; plain user name for contact rows |
| Interactions per post | Numeric value |
| Posts per week | Numeric value |
| Actions | Edit button; Reset button (contact override rows only) |

**Row ordering (client-side sort):**

1. Tier default rows, fixed order: starter → growth → pro → contact
2. A thin `<hr>` divider
3. Contact per-user rows, sorted alphabetically by `userName`

**Row variants:**

- **Tier default row** (no `userId`): tier name displayed as a coloured pill badge. Both limit values shown
  as plain numbers. "Edit" button only.

- **Contact override row** (`userId` set): user name as plain text. Both limit values shown as numbers in
  normal weight. "Edit" + "Reset" buttons.

- **Contact user without a custom override:** These users do not appear in `listPlanLimits` results — the
  query only returns rows that exist in the `planLimits` table. Contact users who have no override row simply
  inherit the contact-tier default and are not listed. The table therefore shows only: 4 tier defaults +
  however many contact-tier users have a custom override row.

  > **Note:** This is the correct behaviour given how the backend works. The "show all contact users"
  > concept discussed in brainstorming was refined here: we don't have a query that lists all contact-tier
  > users, only `listPlanLimits` which returns existing rows. The table shows what exists.

### Empty State

If there are no contact override rows, the divider and the contact section are omitted. Only the 4 tier
default rows are shown.

### Loading State

While the query is loading (`undefined`), show a loading spinner in place of the table body (same
`LoadingSpinner` component used elsewhere).

---

## Edit Modal

A centered modal overlay. Clicking outside does **not** dismiss it (accidental dismissal on an admin form is
bad UX). The modal has an explicit "Cancel" button.

### Title

- Tier default row: `"Edit [tier] defaults"` (e.g. "Edit growth defaults")
- Contact override row: `"Edit [userName] limits"` (e.g. "Edit Bob Smith limits")

### Fields

Two `<input type="number" min="1">` fields:

- **Interactions per post** — pre-filled with `row.interactionsPerPost`
- **Posts per week** — pre-filled with `row.postsPerWeek`

### Buttons

- **Save** — disabled while mutation is in-flight; calls the appropriate mutation on click
- **Cancel** — closes modal, discards changes
- **Reset to default** (contact override rows only) — a secondary text link below the inputs; calls
  `removeContactUserLimit` and closes the modal on success

### Mutations

| Row type | Save calls | Reset calls |
|----------|------------|-------------|
| Tier default | `api.admin.updateTierDefault` | N/A |
| Contact override | `api.admin.setContactUserLimit` | `api.admin.removeContactUserLimit` |

All mutations receive `sessionToken` from `sessionStorage.getItem('sessionToken')`.

### Validation

- Both values must be integers ≥ 1.
- Client-side validation gates the Save button (disabled if invalid).
- Backend also validates — surface any thrown error as a text message inside the modal (below the inputs).

### Success

On successful save or reset: modal closes. Convex reactivity automatically updates the table.

---

## Files Changed

| File | Change |
|------|--------|
| `app/src/pages/AdminPage.tsx` | Add tab bar; wrap existing card in Settings tab; add Plan Limits tab rendering `PlanLimitsTab` |
| `app/src/components/PlanLimitsTab.tsx` | New component — table + edit modal logic |

No new Convex functions needed. All backend work was completed in the security fixes implementation.

---

## Verification

- Admin visits `/admin` → defaults to Settings tab; existing Apify card visible and functional
- Clicking "Plan Limits" tab → table loads with 4 tier default rows
- After adding a contact override (via `setContactUserLimit` in Convex dashboard), table shows 5 rows
- "Edit" on starter row → modal opens pre-filled with starter's values; Save calls `updateTierDefault`;
  table reflects new values immediately
- "Edit" on a contact override row → modal opens; Save calls `setContactUserLimit`; "Reset to default"
  link calls `removeContactUserLimit`, row disappears from table
- Validation: entering 0 or a non-number disables the Save button
- Non-admin session token → `listPlanLimits` throws; page redirected by existing `checkIsAdmin` guard
