# B06 — Post-visibility controls UI (backend enforced, no UI/setter)

> **Status:** ✅ DONE (2026-08-29, uncommitted) · **Priority:** P1 · **Effort:** M · **Category:** Frontend / Feature
> **Depends on:** — · **Blocks:** Pro/Contact "who can see your posts" tier promise (docs/PLATFORM.md §1)

## Summary

The feed already enforces per-post visibility allowlists (`visibilityIndustries`,
`visibilityCountries`), and the schema stores them on every post — but nothing ever writes a
non-empty value. Every writer hardcodes `[]`, and the Settings screen shows a "Coming in next task"
placeholder instead of a control. So a feature the pricing table markets to Pro/Contact users is
dead: the enforcement path is live but permanently fed empty lists.

## Evidence

- `convex/schema.ts:102-103` — `posts.visibilityIndustries: v.array(v.string())` and
  `visibilityCountries: v.array(v.string())` exist on every post.
- `convex/feed.ts:134-138` — the feed **enforces** them: a post with a non-empty
  `visibilityIndustries` is dropped unless `viewer.industry` is in the list (same for countries).
- `convex/posts.ts:273-274` — `submitPost` (manual submit) hardcodes `visibilityIndustries: []`,
  `visibilityCountries: []`.
- `convex/jobs/processQueue.ts:97-98` — the overflow-queue promotion inserts `[]`, `[]`.
- `convex/jobs/syncPostsApify.ts:51-52` — the Apify sync path passes `[] as string[]`, `[]`.
- `app/src/pages/SettingsPage.tsx:247-252` — inside the `isPro` branch (line 83:
  `me.tier === 'pro' || me.tier === 'contact'`), the section renders only
  `t('settings.visibilityComingSoon')` (line 251); there is no input and no setter.
- `app/src/i18n/locales/en.json:88` — `"visibilityComingSoon": "Coming in next task"`.
- No mutation anywhere accepts `visibilityIndustries` / `visibilityCountries` (grep: only the three
  hardcoded-`[]` writers above reference the fields).

## Root cause

The schema field, the writer plumbing, and the feed filter were all shipped, but the UI + the
setter mutation were explicitly deferred ("Coming in next task") and never followed up. The two
values reach `upsertPost` as arguments (`convex/jobs/syncPosts.ts:25-26`), so the last mile is a
control that collects the lists plus a write path that passes them instead of `[]`.

## What we need to do

1. **Decide the model.** The schema stores visibility **per post**, but there is no per-post
   compose UI in-app (posts arrive via manual-URL submit + Apify sync). Two options:
   - (a) **User-default visibility**: store the two lists on the user (`users` table) and have every
     writer copy the user's current default at insert time. Simplest UX, matches the Settings
     placement.
   - (b) **Per-post editor in My Posts**: add an edit control per post. More work, matches the
     schema's per-post granularity.
   Recommendation: ship (a) first (one Settings control, one mutation, three writer edits); (b) can
   layer on later without a schema change.
2. **Add the setter.** For (a): extend `users.updateProfile` (already called from
   `SettingsPage.tsx:101` with `{ sessionToken, industry, country, headline }`) or add
   `users.setPostVisibility({ sessionToken, industries, countries })`. Validate each entry against
   `INDUSTRIES` / `COUNTRY_CODES` from `convex/lib/profileOptions` (reject unknown values — trust
   boundary). Gate to Pro/Contact server-side (do not rely on the UI `isPro` alone).
3. **Build the control.** Reuse the existing `VirtualizedCombobox`
   (`app/src/components/VirtualizedCombobox.tsx`) and the `INDUSTRIES` / `COUNTRY_CODES` /
   `countryLabel` lists already imported in `SettingsPage.tsx:6` — the same selectors the industry
   and country fields use. Support multi-select (the current combobox is single-select; either add a
   multi variant or render a list of removable chips). Replace the `visibilityComingSoon` line at
   `SettingsPage.tsx:251`.
4. **Wire the writers.** Replace the hardcoded `[]` at `convex/posts.ts:273-274`,
   `convex/jobs/processQueue.ts:97-98`, and `convex/jobs/syncPostsApify.ts:51-52` so they pass the
   user's chosen lists. For the Apify/queue paths the author is known from `authorId`, so read the
   user's stored defaults there.
5. **Localize** the new strings (en/pt/es) — see [[B16]].

## Acceptance criteria

- [ ] A Pro/Contact user can set visibility industries + countries in Settings and see them persist.
- [ ] The setter rejects values not in `INDUSTRIES` / `COUNTRY_CODES` and enforces the Pro/Contact
      gate server-side.
- [ ] A post authored while a visibility list is set stores the non-empty lists (verify the three
      writer paths), and the feed hides it from viewers outside the allowlist
      (`convex/feed.ts:134-138`).
- [ ] `settings.visibilityComingSoon` is removed; new strings exist in en/pt/es.
- [ ] `pnpm verify` is green (typecheck + lint + tests)
- [ ] `docs/PLATFORM.md` updated (see **Docs to update**)

## Risks / edge cases / open questions

- **Empty means "everyone"** — the feed treats an empty list as no restriction. Keep that invariant;
  a user clearing the lists must reopen the post to all.
- **Model choice (per-post vs user-default) is load-bearing** — picking (a) leaves the per-post
  schema fields effectively user-scoped; document the decision so a future per-post editor isn't a
  surprise.
- **Downgrade behavior**: if a Pro user downgrades, do their existing visibility restrictions still
  apply? Decide whether to clear or keep them.
- **`viewer.industry`/`viewer.country` may be unset** — the feed already drops restricted posts for
  viewers with no industry/country (`convex/feed.ts:135,138`); confirm that is the intended UX.

## Docs to update

- `docs/PLATFORM.md` §1 (tier table — mark visibility as shipped, not "planned") and the feed
  section documenting the visibility filter (note the new setter + the chosen model).

## References

- Related: [[B16]] (localize the new strings), [[B07]] (sibling "planned Pro feature with no write
  path")
- Prior art / plan: — (no plan file; placeholder string `visibilityComingSoon`)

## Update — 2026-08-20

Re-verified after commits `8417b51` (onboarding rework — heavily touched `SettingsPage.tsx`) and
`5fe86b8` (toast). **Status unchanged: still TODO.** The feature is still dead-but-enforced — no
setter exists, all three writers still hardcode `[]`, and the Settings placeholder still renders
`t('settings.visibilityComingSoon')`.

Line numbers corrected (the onboarding commit removed the "LinkedIn Identity" `<section>` from
`SettingsPage.tsx`, shifting everything below it up):
- `SettingsPage.tsx` — the `isPro` visibility `<section>` moved from `:320-325` to `:247-252`; the
  `visibilityComingSoon` line is now `:251`; the `isPro` definition moved from line 88 to line 83;
  the `updateProfile` call moved from `:107` to `:101`. The `INDUSTRIES`/`COUNTRY_CODES`/`countryLabel`
  imports are still at `:6`.
- `convex/schema.ts` — visibility fields moved `:101-102` → `:102-103`.
- `convex/posts.ts` — `submitPost` hardcoded `[]` moved `:253-254` → `:273-274`.
- `en.json` — `visibilityComingSoon` moved `:92` → `:88`.
- Unchanged (re-verified): `convex/feed.ts:134-138` (enforcement), `convex/jobs/processQueue.ts:97-98`,
  `convex/jobs/syncPostsApify.ts:51-52`, `convex/jobs/syncPosts.ts:25-26` (upsert validator args).
