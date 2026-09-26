# B18 — Replace native `confirm()`/`alert()` with app Modal/toast

> **Status:** TODO · **Priority:** P3 · **Effort:** S · **Category:** UX
> **Depends on:** — · **Blocks:** —

## Summary

Two flows use the browser's native `window.confirm()` / `alert()` instead of the app's own dialog and toast
primitives. Native modals are unstyled, un-themable, un-localizable, and jarring against the rest of the UI.
The app already ships a shadcn `Dialog` and a `toast()` helper used elsewhere — route these two call sites
through them. Localize the surfaced text as part of the swap ([[B16]]).

## Evidence

- `app/src/pages/MyPostsPage.tsx:76` — `const ok = window.confirm('Delete this post? …')` guarding
  `deletePost` (the string continues to `:77-78`).
- `app/src/pages/BillingPage.tsx:78` — `alert(`Checkout failed: ${…}`)` in `handleUpgrade`'s catch.
- `app/src/pages/BillingPage.tsx:89` — `alert(`Failed to open portal: ${…}`)` in `handleManageSubscription`'s catch.

Existing primitives to reuse (do not add a dependency):
- `app/src/components/ui/dialog.tsx` — shadcn `Dialog`, consumed via the `app/src/components/Modal.tsx`
  wrapper (`Modal.tsx:2` imports `Dialog`/`DialogContent`/`DialogTitle`). `ChangeStatusModal.tsx`,
  `ChangeTierModal.tsx`, and `ContactLimitsModal.tsx` all render through `Modal` — reuse `Modal` for the
  delete confirm rather than raw `dialog.tsx`.
- `app/src/components/ui/toast.tsx:13` — module-level `export function toast(message: string)` (sonner-style),
  already imported and used in `app/src/pages/FeedPage.tsx:9,147` and `CommentBox.tsx:10,99`. `Toaster` is
  mounted in `App.tsx`.

## Root cause

Quick-and-dirty error/confirmation handling written before (or without reaching for) the app's dialog/toast
system. No shared confirm-modal helper exists yet, so the native `confirm` was the path of least resistance.

## What we need to do

1. **Delete confirmation (MyPostsPage):** replace `window.confirm` at `:76` with a `Dialog`-based confirm.
   Since no generic confirm modal exists, either (a) drive a small local `Dialog` with state
   (`confirmingDelete: MyPost | null`) and Confirm/Cancel buttons, or (b) add one tiny reusable
   `ConfirmDialog` under `app/src/components/` and use it here (only if a second caller appears — YAGNI
   otherwise). Keep `handleDelete`'s existing logic; just move the "are you sure" behind the styled dialog.
2. **Billing errors:** replace both `alert(...)` calls (`:78`, `:89`) with `toast(...)` from
   `components/ui/toast`.
3. **Localize** the confirm body and the two error messages via `t()` — coordinate keys with [[B16]] (the
   delete-confirm string at `:77` is already listed there).

## Acceptance criteria

- [ ] No `window.confirm` / `alert(` remains in `MyPostsPage.tsx` or `BillingPage.tsx`.
- [ ] Delete uses a themed `Dialog`; billing errors use `toast()`.
- [ ] Surfaced text goes through `t()` (en/pt/es parity, per [[B16]]).
- [ ] No new dependency added (reuse `dialog.tsx` / `toast.tsx`).
- [ ] `pnpm verify` is green (typecheck + lint + tests).
- [ ] `docs/PLATFORM.md` updated (see **Docs to update**).

## Risks / edge cases / open questions

- `Dialog` confirm is async/stateful, unlike synchronous `window.confirm` — restructure `handleDelete` so the
  actual `deletePost` runs from the dialog's Confirm handler, not inline after a boolean.
- Don't over-build a confirm abstraction for a single caller; a local `Dialog` is enough (ponytail).

## Docs to update

- `docs/PLATFORM.md §14` (Frontend — Pages / Reusable components) — note that My Posts delete uses the app
  `Dialog` and billing errors use `toast()`, consistent with the rest of the UI.

## References

- Related: [[B16]] (localize the confirm/toast strings)
- Prior art / plan: `app/src/pages/FeedPage.tsx:147` (existing `toast()` usage)

## Update — 2026-08-20

Re-verified after `5fe86b8` (added `toast.tsx`, rewrote `MyPostsPage.tsx`/`CommentBox.tsx`) and `8417b51`.
**Status unchanged: still TODO.** Neither native call site was converted in the rewrite:
- `app/src/pages/MyPostsPage.tsx:76` — `window.confirm('Delete this post? …')` still present (string at `:77`).
- `app/src/pages/BillingPage.tsx:78` — `alert(\`Checkout failed: …\`)` still present.
- `app/src/pages/BillingPage.tsx:89` — `alert(\`Failed to open portal: …\`)` still present.

(A repo-wide grep confirms these three are the only `window.confirm`/`alert(` sites in `app/src`.)

Primitives confirmed present and in use, so the swap has everything it needs:
- `toast.tsx:13` `export function toast(message: string)` exists; used by `FeedPage.tsx:9,147` and
  `CommentBox.tsx:10,99` (the `5fe86b8` comment flow is a working reference for the toast pattern).
- The dialog primitive is reachable via `Modal.tsx` (wraps `dialog.tsx`) — corrected the evidence above,
  since the three sibling modals now go through `Modal` rather than importing `dialog.tsx` directly.
