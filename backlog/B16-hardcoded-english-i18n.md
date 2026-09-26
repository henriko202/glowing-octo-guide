# B16 — Hardcoded English — i18n gaps across user-facing screens

> **Status:** PARTIAL · **Priority:** P2 · **Effort:** M · **Category:** i18n
> **Depends on:** — · **Blocks:** [[B18]] (localize the confirm/toast text it introduces)
>
> _One listed surface (the SettingsPage "LinkedIn Identity" block) was **removed** by the onboarding
> rework (`8417b51`), so its strings are no longer a gap. Every other listed literal is still
> hardcoded. See **Update — 2026-08-20**._

## Summary

The app is internationalized (react-i18next with en/pt/es locale files), but several **user-facing** screens
still hardcode English strings instead of calling `t()`. A pt/es user sees English on My Posts, the post
composer, the account gate screens (Banned / Cancel-deletion), and a few labels on the feed card and billing
page. (The Settings "LinkedIn Identity" block was originally listed here too but has since been **removed** by
the onboarding rework — see **Update — 2026-08-20**.) Fix: extract each string to a key in **all three** locale
files (`en.json`, `pt.json`, `es.json` — structurally identical, so every new key goes in all three with a
real translation) and replace the literal with `t()`. Where an identical string already exists under
`onboarding.linkedinIdentifier.*`, reuse it rather than adding a duplicate key.

## Evidence

All line numbers re-verified against current source on 2026-08-20 (post `8417b51` + `5fe86b8`). Every
group below is **still hardcoded** except the SettingsPage identity block, which was removed. Line numbers
for the still-open groups are all **unchanged** from the original listing.

**`app/src/pages/MyPostsPage.tsx`** (highest-traffic gap):
- `:36-38` — `timeAgo()` returns `'Today'` / `'1 day ago'` / `` `${days} days ago` `` (needs pluralized keys)
- `:110` — `` `{me.tier} plan` `` rendered as `{me.tier} plan`
- `:115` — `title="In the last 7 days"` (usage badge tooltip)
- `:119` — `{usage.postsThisWeek} of {usage.postsPerWeek} posts this week`
- `:129` — `limitHint="Weekly limit reached"`
- `:134` — `Your posts ({posts.length})`
- `:146` — empty state `Share your first post using the composer above ↑`
- `:163` / `:165` — `Hidden from feed` / `Visible in feed`
- `:174` — `Unhide` / `Hide`
- `:182` — `Delete`
- `:202` — `View on LinkedIn ↗`
- `:77` — delete confirm string (also see [[B18]] — replace the native `window.confirm`)
- `:68` / `:84` — error fallbacks `'Could not update the post.'` / `'Could not delete the post.'`

**`app/src/components/PostComposer.tsx`**:
- `:42` — `Share a post`
- `:48` — input `placeholder="https://www.linkedin.com/posts/your-name_…"`
- `:57` — hint `Paste your LinkedIn post URL`
- `:63` — `Submitting…` / `Submit →`
- `:31` — error fallback `'Failed to submit post'`

**`app/src/pages/SettingsPage.tsx`** — the "LinkedIn Identity" `<section>` (was `:242-293`): **RESOLVED
(removed).** Commit `8417b51` (onboarding rework) deleted this entire section from `SettingsPage.tsx` —
the LinkedIn identifier is no longer set from Settings. None of the strings below exist in the file
anymore, so this is no longer an i18n gap:
- ~~`:243` heading `LinkedIn Identity`~~ — gone
- ~~`:247` `Verified as`~~ — gone
- ~~`:256` `. Update below if your profile URL changes.`~~ — gone
- ~~`:259` unverified intro~~ — gone
- ~~`:280` `Saved ✓` / `Saving…` / `Save`~~ — gone (the profile Save button uses `t('settings.saved/saving/save')`)
- ~~`:285` `Couldn't extract a username…`~~ — gone
- ~~`:289-290` `Will save as: {extractedVanity}`~~ — gone
- Note (now moot): the `onboarding.linkedinIdentifier.*` keys this item said to reuse were also **deleted**
  by `8417b51`. The onboarding namespace now only holds `onboarding.firstPost.*` (`en.json:29-33`). There
  is nothing left here to localize or to reuse.

**`app/src/components/CancelDeletionScreen.tsx`** (gate screen, `:36-59`):
- `:36` — badge `Account deletion pending`
- `:39` — heading `Your account is scheduled for deletion`
- `:41-43` — body (two variants, with/without `dateLabel`, interpolating the date)
- `:51` — `Cancelling…` / `Keep my account`
- `:58` — `Sign out`

**`app/src/components/BannedScreen.tsx`** (gate screen, `:19-49`):
- `:19` — badge `Account suspended`
- `:22` — heading `Your account has been suspended`
- `:24` — body `An administrator has revoked your access to this app.`
- `:29` — label `Reason`
- `:40` — `Contact support`
- `:48` — `Sign out`
- (the support *address* itself is [[B14]] — keep it a constant, translate only the label)

**`app/src/components/PostCard.tsx`** (mostly localized already via `t()`; only this literal remains):
- `:158` and `:167` — `View on LinkedIn ↗` (gated `<button>` and active `<a>`)

**`app/src/pages/BillingPage.tsx`**:
- `:78` / `:89` — alert() error text `` `Checkout failed: …` `` / `` `Failed to open portal: …` `` (also [[B18]])
- `:256` — `Custom` (the enterprise/custom plan price label)

**`app/src/components/LinkedInEmbed.tsx`**:
- `:58` — `title="LinkedIn post"` (iframe accessibility label — translate for a11y parity)

## Root cause

These screens were built (or re-skinned during the UI revamp) with inline English and never routed through
`t()`. The i18n plumbing exists; the strings simply weren't extracted. Some (SettingsPage identity block)
duplicate wording that was already translated for the onboarding flow, so the gap is partly missed reuse.

## What we need to do

1. For each string above, add a key to **all three** locale files (`app/src/i18n/locales/en.json`, `pt.json`,
   `es.json`) under a sensible namespace (e.g. `myPosts.*`, `composer.*`, `settings.identity.*`, reuse
   `feed.*` / `nav.*` where a key already fits). Keep the three files structurally identical.
2. Replace each literal with `t('…')`; use interpolation for the dynamic ones
   (`t('myPosts.usage', { count, limit })`, `timeAgo` via i18next plurals, `willSaveAs` with `{{vanity}}`).
3. ~~**Reuse `onboarding.linkedinIdentifier.*`** for the SettingsPage identity strings…~~ **N/A as of
   2026-08-20** — the SettingsPage identity section and the `onboarding.linkedinIdentifier.*` keys were
   both removed by `8417b51`. Skip this step; there is no identity block left to localize.
4. Provide real **pt** and **es** translations for every new key (not English copies).
5. **Prioritize** the user-facing surfaces in this order: MyPostsPage → PostComposer → gate screens
   (Banned / CancelDeletion) → Settings identity block → PostCard label → BillingPage/LinkedInEmbed.
6. Admin UI is **out of scope** here — handled separately in [[B17]].

## Acceptance criteria

- [ ] None of the listed literals remain in the components (all go through `t()`).
- [ ] Every new key exists in `en.json`, `pt.json`, and `es.json` with a genuine translation; the three files
      stay structurally identical.
- [x] ~~SettingsPage reuses `onboarding.linkedinIdentifier.*`~~ — N/A (identity block removed by `8417b51`).
- [ ] Interpolated/pluralized strings (counts, dates, tier) render correctly in all three locales.
- [ ] `pnpm verify` is green (typecheck + lint + tests).
- [ ] `docs/PLATFORM.md` updated (see **Docs to update**).

## Risks / edge cases / open questions

- `timeAgo` needs i18next plural rules ("1 day ago" vs "N days ago"), not string concatenation — pt/es
  pluralization differs; use `t(key, { count })`.
- Emoji/arrows (`↗`, `→`, `↑`, `✓`, `★`) are language-neutral — keep them in the value, don't translate them.
- Keep the LinkedIn URL placeholders (`linkedin.com/in/your-name`) intact inside translated strings.
- `{me.tier}` and `{extractedVanity}` are data, not translatable — pass as interpolation vars.

## Docs to update

- `docs/PLATFORM.md §14` (Frontend — i18n) — note that My Posts, the composer, gate screens, and the
  Settings identity block are now fully localized, and that SettingsPage reuses the onboarding identity keys.

## References

- Related: [[B14]] (support email constant vs label), [[B17]] (admin locale decision), [[B18]] (localize confirm/toast)
- Prior art / plan: ~~existing `onboarding.linkedinIdentifier.*` keys~~ (removed by `8417b51`; onboarding now
  has only `onboarding.firstPost.*` at `app/src/i18n/locales/en.json:29-33`)

## Update — 2026-08-20

Re-verified after `8417b51` (onboarding: replaced the LinkedIn-identifier step with a first-post prompt;
heavily edited `SettingsPage.tsx` and all three locale files) and `5fe86b8` (toast; rewrote `PostCard.tsx`,
`CommentBox.tsx`, `MyPostsPage.tsx`). **Status: TODO → PARTIAL** — one listed surface removed, all others
still open.

**Resolved (by removal, not localization):**
- **SettingsPage "LinkedIn Identity" block** (was `:242-293`) — deleted by `8417b51`. The 8 hardcoded
  strings (`LinkedIn Identity`, `Verified as`, `. Update below…`, the unverified intro, `Saved ✓/Saving…/Save`,
  the extraction-error, `Will save as: …`) no longer exist. The `onboarding.linkedinIdentifier.*` keys that
  were slated for reuse were removed too.

**Still hardcoded (re-verified; line numbers UNCHANGED unless noted):**
- **`MyPostsPage.tsx`** — all listed literals remain: `timeAgo()` `:36-38`; `{me.tier} plan` `:110`;
  `title="In the last 7 days"` `:115`; `{n} of {n} posts this week` `:119`; `limitHint="Weekly limit reached"`
  `:129`; `Your posts ({n})` `:134`; empty state `:146`; `Hidden from feed`/`Visible in feed` `:163`/`:165`;
  `Unhide`/`Hide` `:174`; `Delete` `:182`; `View on LinkedIn ↗` `:202`; delete-confirm string `:77`; error
  fallbacks `:68`/`:84`. (Despite the `5fe86b8` rewrite, none were routed through `t()`.)
- **`PostComposer.tsx`** — `:42`, `:48`, `:57`, `:63`, `:31` all unchanged, still hardcoded (untouched by both commits).
- **`CancelDeletionScreen.tsx`** — `:36-59` unchanged, still hardcoded.
- **`BannedScreen.tsx`** — `:19-49` unchanged, still hardcoded.
- **`PostCard.tsx`** — `View on LinkedIn ↗` still at `:158` (gated) and `:167` (active), still hardcoded
  (the `5fe86b8` rewrite kept the literals at the same lines).
- **`BillingPage.tsx`** — `alert()` text `:78`/`:89` and `Custom` `:256` unchanged, still hardcoded.
- **`LinkedInEmbed.tsx`** — `title="LinkedIn post"` at `:58` unchanged, still hardcoded.
