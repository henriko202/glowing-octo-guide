# B17 — Dead `admin.*` locale namespace vs hardcoded admin UI

> **Status:** TODO · **Priority:** P3 · **Effort:** S · **Category:** i18n
> **Depends on:** — · **Blocks:** —

## Summary

The locale files define an `admin` namespace (title, forbidden, apifySync, enable, disable, lastSync, …),
but **nothing renders it** — every admin screen hardcodes English. So the app has both a set of dead
translation keys *and* an un-localized admin UI. This is a **decision** item: either the admin console is
intentionally English-only internal tooling (delete the dead keys), or it should be localized (wire the UI
to `t()` using those keys). Recommend deletion unless admins are non-English speakers.

## Evidence

- `app/src/i18n/locales/en.json:150-158` — the `admin` namespace:
  ```json
  "admin": {
    "title": "Admin Panel",
    "forbidden": "You do not have admin access.",
    "apifySync": "Apify Post Sync",
    "apifySyncDescription": "Scrapes LinkedIn posts for all active users every hour via Apify.",
    "enable": "Enable",
    "disable": "Disable",
    "lastSync": "Last sync"
  }
  ```
  (mirrored in `pt.json` / `es.json` at the corresponding location).
- **No `t('admin.…')` call exists.** A repo-wide grep for `admin\.` across `app/src/**/*.tsx` matches only
  `api.admin.*` Convex calls — never `t('admin.…')`. The keys are unreferenced.
- The admin UI hardcodes the same English the keys duplicate:
  - `app/src/pages/AdminPage.tsx:113` — `<PageHeader title="Admin Panel" />` (vs `admin.title`)
  - `app/src/pages/AdminPage.tsx:136` — `Apify Post Sync` (vs `admin.apifySync`)
  - `app/src/pages/AdminPage.tsx:138` — `Scrapes LinkedIn posts for all active users every hour via Apify.` (vs `admin.apifySyncDescription`)
  - `app/src/pages/AdminPage.tsx:148,157,165,195,203,224,233,241` — `Enable` / `Disable` / `Starting…` / `Sync all now` (vs `admin.enable` / `admin.disable`)
  - Tab labels `:120-124` and the other admin tabs (`UsersTab`, `PlanLimitsTab`, `FeedbackTab`, `MotdTab`) are likewise hardcoded English.

## Root cause

The `admin.*` keys were added ahead of localizing the admin console, but the console was then built with
inline English and the keys were never wired up. The two drifted; neither side is the source of truth.

## What we need to do

**Pick one and document the decision** (in `docs/PLATFORM.md §14` i18n notes):

- **(a) — recommended — admin is English-only internal tooling.** Delete the `admin` namespace from
  `en.json`, `pt.json`, and `es.json` (keep the three structurally identical after removal). No UI change.
  This matches reality: admin is a small internal surface, and localizing it is unlikely to pay off. The dead
  keys are the only debt; remove them.
- **(b) — localize the admin UI.** Wire `AdminPage.tsx` (and the tab components) to `t('admin.*')`, and add
  the *many* additional keys the current UI needs beyond the seven that exist (master kill-switch copy,
  profile-scrape copy, tab labels, flash messages, "Sync all now", "Starting…", per-tab strings). Add all new
  keys to all three locale files with pt/es translations. This is materially more work than (a).

Do **not** leave it half-wired (some keys used, most hardcoded).

## Acceptance criteria

- [ ] A decision is recorded (a or b) in `docs/PLATFORM.md §14`.
- [ ] **If (a):** the `admin` namespace is gone from all three locale files; grep for `"admin":` returns
      nothing; the three files remain structurally identical.
- [ ] **If (b):** `AdminPage.tsx` + admin tabs render via `t()`; all needed keys exist in en/pt/es with
      translations; no hardcoded English remains in the admin surface.
- [ ] `pnpm verify` is green (typecheck + lint + tests).
- [ ] `docs/PLATFORM.md` updated (see **Docs to update**).

## Risks / edge cases / open questions

- Open question for Henriko: are there (or will there be) non-English admins? If no, choose (a).
- If (a), make sure no *future* item assumes those keys exist — this deletion should land before any admin
  i18n work is scheduled.
- User-facing i18n gaps are a separate, higher-priority item — [[B16]]. Keep the two scopes distinct.

## Docs to update

- `docs/PLATFORM.md §14` (Frontend — i18n) and/or `§12` (Admin & Moderation) — record that the admin console
  is intentionally English-only (option a) or now localized (option b).

## References

- Related: [[B16]] (user-facing hardcoded English)
- Prior art / plan: `app/src/i18n/locales/en.json:150-158`

## Update — 2026-08-20

Re-verified after `8417b51` (edited all three locale files) and `5fe86b8`. **Status unchanged: still TODO.**
The `admin` namespace is intact — same 7 keys, still no `t('admin.…')` call anywhere in `app/src` (repo-wide
grep confirms; only `api.admin.*` Convex calls match). The dead-keys-vs-hardcoded-UI drift is unchanged.

Line numbers corrected: the `admin` namespace moved `en.json:154-162` → **`:150-158`** (the onboarding
commit shortened the `onboarding` namespace above it). Mirrored at `pt.json:150` / `es.json:150`. AdminPage
evidence is **unchanged** (neither commit touched `AdminPage.tsx`) — re-verified `:113` (`Admin Panel`), `:136`
(`Apify Post Sync`), `:138` (description), `:148` (`Sync all now`/`Starting…`).
