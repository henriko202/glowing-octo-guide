# Ban / Unban Users — Design Spec

- **Date:** 2026-06-12
- **Status:** Approved (brainstorm) — ready for implementation planning
- **Branch:** `feat/initial-setup`
- **Backend:** Convex · **Frontend:** React 19 + React Router 7 + raw Tailwind

## Problem & Goal

Admins need to **ban** and **unban** users. A ban is a **hard lockout**: a banned user is
immediately blocked from the entire authenticated app — not merely prevented from logging in
fresh. Only admins may ban or unban.

## Existing architecture (context)

- **Auth:** custom LinkedIn OAuth + opaque session tokens. Every protected query/mutation takes
  a `sessionToken` arg and resolves it server-side via `requireAuth(ctx, sessionToken)` in
  [`convex/lib/auth.ts`](../../../convex/lib/auth.ts), which returns the full `Doc<'users'>`.
- **Admin model:** `isAdmin: v.optional(v.boolean())` on the `users` table, set **only directly in
  the database** (never via app code). `assertAdmin(user)` in
  [`convex/admin.ts`](../../../convex/admin.ts) throws if `!user.isAdmin`. Established pattern:
  `requireAuth` → `assertAdmin` → act (see `setUserTier`).
- **Client auth gate:** `RequireAuth` in [`app/src/App.tsx`](../../../app/src/App.tsx) calls
  `api.users.getMe`. `undefined` → spinner; `null` → redirect to LinkedIn OAuth; user object →
  render `<AppNav/>` + page.
- **Admin UI:** [`app/src/components/UsersTab.tsx`](../../../app/src/components/UsersTab.tsx) — a
  table `Name | Tier | Status | Action` with one inline "→ Contact" button per row.

## Decisions

| #   | Topic         | Decision                                                                           |
| --- | ------------- | ---------------------------------------------------------------------------------- |
| 1   | Ban effect    | **Hard lockout** — enforced centrally in `requireAuth`, covering every endpoint    |
| 2   | Recorded data | **Reason + who + when** stored on the user doc                                     |
| 3   | Guardrails    | **Block self-ban only** — banning other admins is allowed; reason stays optional   |
| 4   | Admin control | **`···` kebab row-actions menu** (folds in "Set to Contact" + Ban/Unban)           |
| 5   | Confirmation  | **Modal** for ban (with optional reason); **quick one-tap confirm** for unban      |
| 6   | Banned screen | **Administrative** style; reason shown to the user when present; `mailto:` contact |

## 1. Data model — `convex/schema.ts`

Add four optional fields to the `users` table (parallels how `tier` already lives there):

```ts
isBanned: v.optional(v.boolean()),
bannedAt: v.optional(v.number()),
bannedBy: v.optional(v.id('users')),   // FK to the acting admin — not a string
bannedReason: v.optional(v.string()),  // user-visible
```

- **No new index.** Reading `isBanned` per row needs none. A `by_banned` index is only justified
  if a "Banned" filter pill is added later (deferred).
- **No `sessions` table changes** (see "Why no session invalidation").

## 2. Enforcement — `convex/lib/auth.ts` + `convex/users.ts`

The single chokepoint. Refactor the session→user resolution so it can be shared without the
banned-throw, then branch:

- **`requireAuth`** — after loading the user, add:

  ```ts
  if (user.isBanned) throw new ConvexError({ code: 'BANNED' })
  ```

  This blocks **every** current and future protected query/mutation automatically.

- **`getMe`** ([`convex/users.ts`](../../../convex/users.ts)) — must **not** throw on banned (a thrown
  query would surface as a client error, not a clean state). Instead it resolves the session
  directly (not via the throwing `requireAuth`) and returns either:
  - `null` when unauthenticated (unchanged → client redirects to LinkedIn), or
  - the existing safe user object (tokens stripped) **plus** `isBanned` and `bannedReason`.

  Returning a distinct banned signal (rather than `null`) is what avoids the **redirect loop**: a
  banned user returned `null` would re-auth on LinkedIn → fresh session → `null` again → loop.

Suggested shared helper shape:

```ts
// resolves token → user (or null); performs NO banned check
async function resolveSession(ctx, token): Promise<Doc<'users'> | null>

// requireAuth = resolveSession + unauthorized-throw + banned-throw
// getMe       = resolveSession + return { ...safeUser, isBanned, bannedReason } | null
```

## 3. Admin mutations — `convex/admin.ts`

Two new mutations following the exact `setUserTier` shape (`requireAuth` → `assertAdmin` → act):

```ts
banUser({ sessionToken, userId, reason? })
  admin = requireAuth(ctx, sessionToken); assertAdmin(admin)
  if (userId === admin._id) throw new Error("You can't ban yourself")
  target = await ctx.db.get(userId); if (!target) throw new Error('User not found')
  // banning other admins is intentionally allowed
  await ctx.db.patch(userId, {
    isBanned: true,
    bannedAt: Date.now(),
    bannedBy: admin._id,
    ...(reason ? { bannedReason: reason } : {}),   // only set when provided
  })

unbanUser({ sessionToken, userId })
  admin = requireAuth(ctx, sessionToken); assertAdmin(admin)
  target = await ctx.db.get(userId); if (!target) throw new Error('User not found')
  await ctx.db.patch(userId, {
    isBanned: false, bannedAt: undefined, bannedBy: undefined, bannedReason: undefined,
  })
```

- `Date.now()` is valid inside Convex mutations.
- `listUsers` already returns user docs, so the new fields flow to the admin UI automatically.

## 4. Admin UI — `app/src/components/UsersTab.tsx`

- **`RowActionsMenu`** — new `···` kebab replacing the inline action button. Items: `Set to Contact`
  (existing), then `Ban user…` (red) **or** `Unban` (green) depending on `user.isBanned`.
  Requires click-outside-to-close (`useRef` + document listener) — new behavior the button-only
  UI doesn't have yet.
- **Banned badge** — a red "Banned" pill beside the name of banned users (no row tint; matches the
  chosen mock).
- **`BanUserDialog`** — modal triggered by `Ban user…`: title `Ban {name}?`, warning copy
  ("They'll be signed out immediately and blocked until an admin unbans them."), an **optional**
  reason `textarea` labeled **"Reason (optional — shown to the user)"**, and `Cancel` / **Ban user**
  (red) → calls `banUser`.
- **Unban** — lightweight confirm (`Unban {name}?`) → calls `unbanUser`. No reason needed.

## 5. Banned screen — new `BannedScreen.tsx` + `app/src/App.tsx`

- **`BannedScreen`** — administrative card: "Account suspended" heading, message, a **conditional**
  reason block (`{reason && <ReasonBlock reason={reason}/>}` — never an empty box), and two actions:
  **Contact support** (`mailto:contact@email.com` — placeholder) and **Sign out**
  (clear `sessionStorage` `sessionToken`, return to login).
- **`RequireAuth`** gains one branch, checked before rendering children:
  - `me === undefined` → spinner (unchanged)
  - `me === null` → redirect to LinkedIn (unchanged)
  - `me.isBanned` → render `<BannedScreen reason={me.bannedReason} />` (no `AppNav`, no children)
  - otherwise → render app (unchanged)

## Why no session invalidation (Convex reactivity)

`getMe` is a **live subscription** on the banned user's own user doc. The moment `banUser` patches
`isBanned: true`, Convex re-runs `getMe` for that user's open client → `RequireAuth` re-renders →
the Banned screen replaces the app **instantly, with no refresh and no logout call**. In-flight and
future mutations are independently rejected by the `requireAuth` throw. Deleting `sessions` rows
would add nothing, and keeping the session means **unban restores access seamlessly** on the same
token. Hence: no `sessions` schema/index/logic changes.

## Testing (`convex-test` + `vitest`)

- `banUser` sets the four fields with `bannedBy = admin._id`.
- `banUser` rejects self-ban.
- `banUser` / `unbanUser` reject a non-admin caller.
- `requireAuth` throws (`BANNED`) for a banned user → a representative protected function is blocked.
- `getMe` returns `isBanned: true` (+ `bannedReason`) for a banned user, and `null` when unauthenticated.
- `unbanUser` clears all four fields and restores access.

## Out of scope (deferred — YAGNI)

- Audit-history table for repeat-offender tracking (decided against; single user-doc record is enough).
- Timed / temporary bans.
- "Banned" filter pill + `by_banned` index.
- Separate internal-note vs. public-message reason fields.
- Any appeal workflow beyond the `mailto:` link.

## Files touched

| File                                  | Change                                                         |
| ------------------------------------- | -------------------------------------------------------------- |
| `convex/schema.ts`                    | +4 fields on `users`                                           |
| `convex/lib/auth.ts`                  | `resolveSession` helper + banned-throw in `requireAuth`        |
| `convex/users.ts`                     | `getMe` returns `isBanned` + `bannedReason` (or `null`)        |
| `convex/admin.ts`                     | new `banUser`, `unbanUser` mutations                           |
| `app/src/components/UsersTab.tsx`     | `RowActionsMenu`, banned badge, `BanUserDialog`, unban confirm |
| `app/src/components/BannedScreen.tsx` | new                                                            |
| `app/src/App.tsx`                     | banned branch in `RequireAuth`                                 |
| `convex/*.test.ts`                    | new tests                                                      |

## Open items

- **Support contact:** `mailto:contact@email.com` is an intentional placeholder — swap for the real
  address when known.
