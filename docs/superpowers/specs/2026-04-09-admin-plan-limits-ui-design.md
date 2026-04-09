# Admin Panel — Plan Limits UI Design

**Date:** 2026-04-09
**Context:** The `planLimits` CRUD backend API was added to `convex/admin.ts` as part of the security fixes work
(`listPlanLimits`, `setContactUserLimit`, `removeContactUserLimit`, `updateTierDefault`). This spec covers the
frontend that exposes those endpoints in the admin panel.

---

## Decisions

| Question                                                    | Answer                                                                   |
|-------------------------------------------------------------|--------------------------------------------------------------------------|
| Where does Plan Limits fit?                                 | Tab navigation inside `AdminPage` (Settings + Plan Limits tabs)          |
| How are contact users identified for new overrides?         | Live name search dropdown                                                |
| Edit UX                                                     | Modal dialog                                                             |
| Table structure                                             | Single unified table (tier defaults first, contact rows below a divider) |
| Can admins edit tier defaults (starter/growth/pro/contact)? | **No — tier default rows are read-only**                                 |
| What can admins do?                                         | Create/edit/delete per-user contact overrides only                       |

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
useQuery(
  api.admin.listPlanLimits,
  sessionToken && isAdmin ? { sessionToken } : 'skip'
)
```

`isAdmin` and `sessionToken` are already resolved in `AdminPage` before the tab renders. The `'skip'`
pattern follows the same convention used for `getSettings` in the existing page — prevents the query from
firing for unauthenticated or non-admin visitors while the `checkIsAdmin` guard is still resolving.

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

| Column                | Notes                                                                                       |
|-----------------------|---------------------------------------------------------------------------------------------|
| Tier / User           | Tier badge pill for default rows; plain user name for contact rows                          |
| Interactions per post | Numeric value                                                                               |
| Posts per week        | Numeric value                                                                               |
| Actions               | **Empty for tier default rows (read-only)**; Edit + Reset buttons for contact override rows |

**Row ordering (client-side sort):**

1. Tier default rows, fixed order: starter → growth → pro → contact
2. A section header ("Contact overrides") above contact per-user rows
3. Contact per-user rows, sorted alphabetically by `userName`

**Row variants:**

- **Tier default row** (no `userId`): tier name displayed as a coloured pill badge. Both limit values shown
  as plain numbers. **No action buttons — these rows are read-only.** A small "Default" label or muted
  "read-only" indicator may be shown in the Actions column for clarity, but no interactive controls.

- **Contact override row** (`userId` set): user name as plain text. Both limit values shown as numbers.
  "Edit" + "Reset" buttons. The "Reset" button in the table calls `removeContactUserLimit` directly
  (no modal) for quick access. The edit modal for this same row also has a "Reset to default" link
  that does the same thing — both affordances are intentional.

### Empty State

If there are no contact override rows, the section header and the contact section are omitted. Only the 4 tier
default rows are shown.

### Loading State

While the query is loading (`undefined`), show a loading spinner in place of the table body (same
`LoadingSpinner` component used elsewhere).

---

## Add Contact Override — Live Search Form

Below the table, a search section lets admins create a new per-user override for any contact-tier user.

### Layout

```
[ Search contact users...          ]  ← text input
  ┌─────────────────────────────────┐
  │ Alice Johnson                   │  ← search result
  │ Bob Whitmore                    │
  └─────────────────────────────────┘
```

### Behaviour

1. Admin types in the search input (any non-empty text triggers the query).
2. `useQuery(api.admin.searchContactUsers, { sessionToken, nameQuery })` fires — results update live as they
   type. When `nameQuery` is empty, the query is skipped (no results shown).
3. Up to 10 matching contact-tier users are listed in a dropdown-style results list below the input.
4. Clicking a user from the list opens the **EditModal** pre-filled with the contact tier's current default
   values (looked up from the `listPlanLimits` rows). The modal title is `"Add override for [userName]"`.
5. On Save, `setContactUserLimit` is called (same mutation as editing an existing override). The mutation
   handles upsert — if the user already has an override, it is updated.
6. After Save, the search input is cleared and the modal closes. The new row appears in the table immediately
   (Convex reactivity).

### Backend: `searchContactUsers` query

New query in `convex/admin.ts`:

```typescript
export const searchContactUsers = query({
  args: {
    sessionToken: v.string(),
    nameQuery: v.string(),
  },
  handler: async (ctx, { sessionToken, nameQuery }) => {
    const admin = await requireAuth(ctx, sessionToken)
    assertAdmin(admin)

    // No by_tier index on users — bounded scan is acceptable for an admin tool.
    const allUsers = await ctx.db.query('users').take(1000)
    const q = nameQuery.toLowerCase()

    return allUsers
      .filter(u => u.tier === 'contact' && (u.name ?? '').toLowerCase().includes(q))
      .slice(0, 10)
      .map(u => ({ _id: u._id, name: u.name ?? '' }))
  },
})
```

---

## Edit Modal

A centered modal overlay. Clicking outside does **not** dismiss it (accidental dismissal on an admin form is
bad UX). The modal has an explicit "Cancel" button.

### When it opens

- From a **contact override row** in the table: "Edit" button clicked — pre-filled with that row's current values.
- From a **search result** (new override): user selected — pre-filled with the contact tier default values.

### Title

- From contact override row: `"Edit [userName] limits"` (e.g. "Edit Bob Smith limits")
- From search result (new override): `"Add override for [userName]"` (e.g. "Add override for Alice Johnson")

> Note: Tier default rows no longer have an "Edit" button. The modal is only opened for contact overrides
> (existing or new). `updateTierDefault` is no longer called from the frontend.

### Fields

Two `<input type="number" min="1">` fields:

- **Interactions per post** — pre-filled with current row values or contact tier defaults
- **Posts per week** — pre-filled with current row values or contact tier defaults

### Buttons

- **Save** — disabled while mutation is in-flight; calls `setContactUserLimit`
- **Cancel** — closes modal, discards changes
- **Reset to default** (existing contact override rows only) — a secondary text link below the inputs; calls
  `removeContactUserLimit` and closes the modal on success. Not shown when creating a new override.

### Mutations

| Trigger                      | Save calls                      | Reset calls                        |
|------------------------------|---------------------------------|------------------------------------|
| Contact override (edit)      | `api.admin.setContactUserLimit` | `api.admin.removeContactUserLimit` |
| Search result (new override) | `api.admin.setContactUserLimit` | N/A                                |

All mutations receive `sessionToken` from `sessionStorage.getItem('sessionToken')`.

> `updateTierDefault` is no longer called from the frontend in this scope. Tier defaults are read-only.

### Validation

- Both values must be integers ≥ 1.
- Client-side validation gates the Save button (disabled if invalid).
- Backend also validates — surface any thrown error as a text message inside the modal (below the inputs).

### Success

On successful save or reset: modal closes, search input clears (if opened from search). Convex reactivity
automatically updates the table.

---

## Files Changed

| File                                        | Change                                                                                                            |
|---------------------------------------------|-------------------------------------------------------------------------------------------------------------------|
| `convex/admin.ts`                           | Add `searchContactUsers` query                                                                                    |
| `app/src/pages/AdminPage.tsx`               | Add tab bar; wrap existing card in Settings tab; add Plan Limits tab rendering `PlanLimitsTab` (**already done**) |
| `app/src/components/PlanLimitsTab.tsx`      | Update: remove Edit from tier rows; add search form; update modal for new-override flow                           |
| `app/src/components/PlanLimitsTab.test.tsx` | Update tests to match new behaviour                                                                               |

---

## Verification

- Admin visits `/admin` → defaults to Settings tab; existing Apify card visible and functional
- Clicking "Plan Limits" tab → table loads with 4 tier default rows (no Edit buttons on them)
- Tier default rows show values as plain text; no interactive controls in the Actions column
- Search input below table: typing a contact user's name shows matching results
- Clicking a search result opens modal titled "Add override for [name]", pre-filled with contact tier defaults
- Save creates a new row in the table (or updates existing if override already existed)
- "Edit" on a contact override row → modal opens titled "Edit [name] limits"; Save calls `setContactUserLimit`
- "Reset" button (table) and "Reset to default" link (modal) both remove the override
- Validation: entering 0 or a non-number disables the Save button
- Non-admin session token → `listPlanLimits` throws; page redirected by existing `checkIsAdmin` guard
