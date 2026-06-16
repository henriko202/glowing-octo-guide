# Admin Page Touch-ups — Design

**Date:** 2026-06-16
**Context:** Two admin-panel refinements. (1) The Users tab can currently only "Set to Contact" and ban/unban —
admins need to change a user to **any** tier and to override a user's **subscription status** (notably to take a
user out of `trialing`, which today hides their posts from the shared feed). (2) The per-user "contact override"
plan-limit editing currently lives in the **Plan Limits** tab; it should move to be editable **only** from the
Users tab, leaving the Plan Limits tab as a **read-only** view that also lists every contact-tier user.

Backend CRUD already exists in `convex/admin.ts` (`setUserTier`, `setContactUserLimit`, `removeContactUserLimit`,
`listPlanLimits`, `updateTierDefault`). This spec adds two functions, removes one, and restructures two frontend
tabs.

---

## Decisions

| Question                                                 | Answer                                                                               |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| How does an admin change a user's tier?                  | "Change tier…" row action → small modal with a tier picker → `setUserTier`           |
| How does an admin "remove the trialing status"?          | "Change status…" row action → modal with a **full status dropdown** (all 5 statuses) |
| Tier + status: combined or separate?                     | **Separate** menu items / modals (one action ↔ one mutation, matches existing code)  |
| Where can contact per-user limits be edited?             | **Only** in the Users tab ("Edit limits…", shown only for contact-tier users)        |
| What does the Plan Limits tab become?                    | **Read-only**: keep the 4 tier-default rows + a read-only list of all contact users  |
| Is the Plan Limits tab renamed?                          | **No** — stays "Plan Limits"                                                         |
| What happens to the old contact-override search box?     | Removed; `searchContactUsers` query deleted (no remaining consumer)                  |
| Cleanup of override rows when a contact user is demoted? | **None** — orphan rows are inert (see Correctness note); out of scope                |

---

## Correctness note — demoting a contact user is safe

`getPlanLimitsHelper` (`convex/lib/planLimits.ts`) only consults a user's per-user override row **when
`tier === 'contact'`**. So changing a contact user to `pro`/`growth`/`starter` makes their override row dormant —
they correctly receive the new tier's default. No cleanup is required. (Re-promoting to contact would revive the
old custom limits, which is acceptable.)

"Effective limits" for a contact user = their override row if one exists, otherwise the contact tier default.

---

## Backend changes (`convex/admin.ts`)

### New: `setUserSubscriptionStatus` (mutation)

```typescript
args: {
  sessionToken: v.string(),
  userId: v.id('users'),
  status: v.union(
    v.literal('trialing'),
    v.literal('active'),
    v.literal('canceled'),
    v.literal('past_due'),
    v.literal('none')
  )
}
```

Admin-guarded (`requireAuth` + `assertAdmin`). Verifies the target user exists, then
`ctx.db.patch(userId, { subscriptionStatus: status })`. Touches **only** `subscriptionStatus` — tier and Stripe
records are untouched. A code comment documents that this is a manual override a later Stripe webhook may overwrite.

### New: `listContactUsersWithLimits` (query)

Admin-guarded. Scans contact-tier users via the `by_tier` index (`take(500)` — bounded, same ceiling as
`searchContactUsers` used), looks up each user's override row, and returns effective limits:

```typescript
{
  _id: Id<'users'>
  name: string
  interactionsPerPost: number // effective (override ?? contact default)
  postsPerWeek: number // effective
  hasOverride: boolean
}
;[]
```

Implementation: read the contact override rows + the contact default row once, build a `Map<userId, row>`, then
map over the contact users computing `override ?? default`. Sorted by `name`.

### Reused unchanged

`setUserTier` (already supports all 4 tiers and auto-seeds a contact override on promotion),
`setContactUserLimit`, `removeContactUserLimit`, `listPlanLimits` (now consumed by the extracted modal for
prefill), `banUser`, `unbanUser`.

### Removed: `searchContactUsers` (query)

Its only consumer was the Plan Limits "Add contact override" search box, which is removed. Delete the query and
its test/docs references.

---

## Frontend — Users tab (`app/src/components/UsersTab.tsx`)

The row `···` menu (`RowActionsMenu`) per user becomes:

1. **Change tier…** — opens `ChangeTierModal`. Tier picker (segmented buttons or `<select>`) for
   starter/growth/pro/contact, defaulting to the user's current tier; **Save** calls `setUserTier`. Replaces the
   current single "Set to Contact" item.
2. **Change status…** — opens `ChangeStatusModal`. `<select>` of all 5 statuses, defaulting to the user's current
   `subscriptionStatus`; **Save** calls `setUserSubscriptionStatus`. (This is the "remove trialing" path.)
3. **Edit limits…** — **only rendered when `user.tier === 'contact'`** — opens the shared `ContactLimitsModal`
   (see below).
4. **Ban user… / Unban** — unchanged.

Pending state per row is tracked as it is today (`pendingId`).

### New modal components

- **`ChangeTierModal.tsx`** — props `{ user, sessionToken, onClose }`; local selected-tier state; Save / Cancel.
- **`ChangeStatusModal.tsx`** — props `{ user, sessionToken, onClose }`; local selected-status state; Save / Cancel.

Both follow the existing `Modal` + button styling already used for the Unban confirm dialog.

### Extracted: `ContactLimitsModal.tsx`

The existing `EditModal` inside `PlanLimitsTab.tsx` is moved to its own file `ContactLimitsModal.tsx` and made
self-contained: given a contact user (`{ _id, name }`), it queries `listPlanLimits` to find the user's existing
override (if any) and the contact default, prefills the two number inputs, and exposes **Save**
(`setContactUserLimit`) and **Reset to default** (`removeContactUserLimit`, only when an override exists).
This is the same prefill logic `PlanLimitsTab.handleSelectUser` used. Both validation rules (`>= 1`, integer) carry
over.

---

## Frontend — Plan Limits tab (`app/src/components/PlanLimitsTab.tsx`) → read-only

- **Keep** the 4 tier-default rows (read-only), exactly as today.
- **Remove** the editable "Contact overrides" section, the "Add contact override" search box, the
  `searchContactUsers` query, `handleSelectUser`, `handleReset`, and the inline `EditModal` (now extracted).
- **Add** a read-only **"Contact users"** section sourced from `listContactUsersWithLimits`: one row per contact
  user showing name, effective Int/Post and Posts/Wk, and a subtle "override" badge when `hasOverride` is true.
  Empty state: "No contact-tier users."
- The tab no longer imports `setContactUserLimit` / `removeContactUserLimit`.

`AdminPage.tsx` is unchanged (same three tabs, same labels).

---

## Testing

- **`UsersTab.test.tsx`** — the current mock maps `useMutation` calls by **position** (`setUserTier, banUser,
unbanUser`), which breaks once more mutations are added. Rework it to resolve mocks by the **function reference**
  argument passed to `useMutation`. Add tests: "Change tier…" calls `setUserTier` with the chosen tier; "Change
  status…" calls `setUserSubscriptionStatus`; "Edit limits…" is shown only for contact users.
- **`PlanLimitsTab.test.tsx`** — rewrite for the read-only view: tier defaults render, contact users render with
  effective limits + override badge, and **no** edit/search controls exist.
- **`ContactLimitsModal`** — tests for prefill (override vs default), Save, and Reset.
- New backend functions covered by Convex tests where the existing `admin`/`users` test style applies
  (`setUserSubscriptionStatus` patches status; `listContactUsersWithLimits` returns effective limits).

---

## Documentation

Update `docs/PLATFORM.md` admin section to reflect: the Users-tab tier/status/limits actions, the new
`setUserSubscriptionStatus` and `listContactUsersWithLimits` functions, the removal of `searchContactUsers`, and
the Plan Limits tab now being read-only. (Per CLAUDE.md, this is part of "done".)

---

## Out of scope

- Editing tier **default** limits from the UI (`updateTierDefault` remains backend-only, as today).
- Cleaning up orphaned override rows on demotion (inert — see Correctness note).
- Bulk actions / pagination on the Users table (still a bounded `take(1000)`).
