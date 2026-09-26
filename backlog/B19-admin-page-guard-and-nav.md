# B19 — AdminPage render-time redirect + missing nav entry

> **Status:** TODO · **Priority:** P3 · **Effort:** S · **Category:** Frontend / Access

> **Depends on:** — · **Blocks:** —

## Summary

`AdminPage` redirects non-admins by calling `navigate('/')` **inline in the render body** — a React
anti-pattern (side effect during render; the component still finishes rendering, and React may warn about
updating another component while rendering). Separately, there is no navigation entry for `/admin`; the page
is reachable only by typing the URL. Fix the redirect to run in an effect / route guard, and decide whether
admins get a conditional nav link or the URL-only access stays.

## Evidence

- `app/src/pages/AdminPage.tsx:41-43` — redirect performed during render:
  ```tsx
  if (!isAdmin) {
    navigate('/')
  }
  ```
  (`isAdmin` comes from `useQuery(api.admin.checkIsAdmin, …)` at `:23`; the `undefined` loading case is
  handled at `:37-39`, but the `false` case calls `navigate` mid-render and then keeps rendering the admin JSX.)
- `app/src/App.tsx:118-125` — the route is `RequireAuth`-wrapped but has **no admin-specific guard**; access
  control lives entirely inside the component:
  ```tsx
  <Route path="/admin" element={<RequireAuth><AdminPage /></RequireAuth>} />
  ```
- `app/src/components/shell/navItems.ts:6-22` — `NAV_GROUPS` lists feed, my-posts, billing, settings,
  privacy-data — **no `/admin` entry**. So the page is URL-only.

## Root cause

The admin gate was bolted onto the page as a quick inline check rather than a proper guard, and admin was
never surfaced in the sidebar (intentionally or not). Server functions re-check admin on every call
(`api.admin.*` all validate), so this is a UX/correctness-of-pattern issue, not a security hole.

## What we need to do

1. **Move the redirect out of render.** Options (pick the lazy one that fits the existing pattern):
   - a `useEffect(() => { if (isAdmin === false) navigate('/') }, [isAdmin, navigate])`, returning `null`
     (or the spinner) while `isAdmin !== true`; **or**
   - render `<Navigate to="/" replace />` from JSX when `isAdmin === false` (react-router's declarative
     redirect — no effect needed). Keep the `isAdmin === undefined` loading branch (`:37-39`).
   Prefer whichever matches how `RequireAuth` already redirects elsewhere, for consistency.
2. **Nav decision:** either add an `isAdmin`-conditional entry to the sidebar (a new `NavItem` rendered only
   when `checkIsAdmin` is true — note `navItems.ts` is a static array today, so this needs the shell to
   filter by an admin flag), **or** keep `/admin` URL-only and document that choice. Recommend keeping it
   URL-only unless admins ask for a link (YAGNI) — but do record the decision.
3. Server-side authorization is already enforced by `api.admin.*`; this item does **not** change that.

## Acceptance criteria

- [ ] No `navigate(...)` (or other side effect) is called during `AdminPage`'s render; the redirect runs via
      effect or declarative `<Navigate>`.
- [ ] A non-admin hitting `/admin` is cleanly redirected without rendering admin JSX or console warnings.
- [ ] The nav decision (conditional link vs URL-only) is implemented and documented.
- [ ] `pnpm verify` is green (typecheck + lint + tests).
- [ ] `docs/PLATFORM.md` updated (see **Docs to update**).

## Risks / edge cases / open questions

- `checkIsAdmin` is async: while it is `undefined`, keep showing the spinner (`:37-39`) — don't redirect on a
  not-yet-loaded value, or a real admin would be bounced on first paint.
- If a conditional nav entry is added, it must gate on the reactive `checkIsAdmin` result, not a stale/derived
  flag, and must never be the *only* access-control layer (server checks remain the source of truth).

## Docs to update

- `docs/PLATFORM.md §12` (Admin & Moderation) and/or `§14` (Frontend — Routing) — note the admin route guard
  pattern and whether admin is linked in the sidebar or URL-only.

## References

- Related: [[B17]] (admin locale decision)
- Prior art / plan: `app/src/App.tsx:118-125`, `app/src/components/shell/navItems.ts:6-22`
