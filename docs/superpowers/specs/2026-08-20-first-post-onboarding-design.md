# First-Post Onboarding Step + Settings Identity Cleanup — Design

**Date:** 2026-08-20 **Status:** Approved (pending spec review)
**Author:** Henriko (with Claude)

## 1. Summary

Add a **skippable onboarding gate** that prompts a brand-new user to **"Share your best recent post"** the first time
they reach the app, and **remove the now-redundant "LinkedIn Identity" section** from the Settings page.

The first post is the app's core action and the only trigger that seeds vanity-derivation
(`users.setDerivedPublicIdentifier`) and the downstream Apify profile sync, so nudging it early has real product value.
The gate is **skippable** — a user without a post URL handy is never locked out.

## 2. Requirements

- A distinct onboarding **step** (not a banner) that prompts the first post.
- Copy: "Share your best recent post."
- User can skip ("I'll do this later") and still enter the app.
- Remove the outdated "LinkedIn Identity" section from Settings.

Derived/clarified decisions:

- **Shape:** a full-screen gate in the existing `RequireAuth` chain, after the consent gate (parallels
  `PolicyUpdateScreen` / `ConsentPromptScreen`). Chosen over a redirect or feed banner because it reads as a real
  onboarding *step*.
- **Skippable:** prominent `PostComposer` + a muted "I'll do this later" link. Never blocks.
- **One-shot flag, not a live post count:** the gate is driven by a single `users`
  timestamp flag (mirrors `consentPromptedAt`), so the auth hot path adds no post-count query.
- **Flag is also satisfied by posting from anywhere:** submitting *any* post (incl. from the normal My Posts composer)
  sets the flag server-side, so onboarding never re-nags a user who has already posted.

## 3. Architecture

### 3.1 New gate screen — `app/src/components/FirstPostPromptScreen.tsx`

Mirrors `ConsentPromptScreen`: `bg-background` full-screen, centered card, `BrandMark`, headline + one-line rationale,
the existing `PostComposer` (`atLimit={false}`), and a muted
"I'll do this later" text button beneath.

- **Submit:** `PostComposer.onSubmit` → `api.posts.submitPost`. On success (no throw) →
  `window.location.reload()`. The server has set the flag during `submitPost`, so on reload the gate condition is false
  and the user lands on `/feed`. Submission errors are rendered by
  `PostComposer` itself (its own error state) — the gate stays put.
- **Skip:** `api.users.dismissFirstPostPrompt` → `window.location.reload()`.

### 3.2 Gate wiring — `app/src/App.tsx` (`RequireAuth`)

Insert one line after the consent gate (App.tsx:55):

```tsx
if (!me.consentPromptedAt) return <ConsentPromptScreen />
if (!me.firstPostPromptedAt) return <FirstPostPromptScreen />   // NEW
```

### 3.3 Data model — `convex/schema.ts`

Add one optional field to `users`:

```ts
firstPostPromptedAt: v.optional(v.number()), // set when the first-post onboarding step is
                                             // resolved (post submitted, or skipped)
```

New optional field = widen, no migration (pre-launch "widen, don't backfill" convention). The deprecated
`publicIdentifierPromptedAt` slot is intentionally NOT reused — a renamed-in-place flag would mislead future readers.

### 3.4 Flag lifecycle

`firstPostPromptedAt` is set (once, never overwritten) by either path:

- **`convex/posts.ts` → `submitPost`:** `submitPost` is an *action*, so the flag is set inside the internal **mutation**
  it already runs to persist the post (not by the action directly) — if the user has no `firstPostPromptedAt`, set it to
  `Date.now()` there. Covers posting from the gate *and* from the normal My Posts page.
- **`convex/users.ts` → `dismissFirstPostPrompt` (new mutation):** auth via session token, patch
  `firstPostPromptedAt = Date.now()` if unset.

Gate shows iff `!firstPostPromptedAt`.

### 3.5 Settings cleanup — `app/src/pages/SettingsPage.tsx`

Delete the "LinkedIn Identity" `<section>` (currently lines 222-243). `linkedinPublicIdentifier`
STAYS on the `MeProfile` interface and in the Refresh-button disable logic (`disabled={... ||
!me.linkedinPublicIdentifier}`) — only the display section is removed.

**Accepted tradeoff:** the user no longer sees their detected LinkedIn link anywhere in-app. Explicitly requested; the
vanity remains internal (Apify seed) only.

### 3.6 i18n

Gate screens use `t()` (Consent/Policy do). Add `onboarding.firstPost.*` keys to `en/pt/es`
(title, rationale, skip label). Remove the now-dead `onboarding.linkedinIdentifier.*` keys left over from the deleted
`PublicIdentifierPromptScreen`.

## 4. Testing

One light component test `FirstPostPromptScreen.test.tsx` (matches `MyPostsPage.test.tsx`
style): renders the composer, and clicking "I'll do this later" invokes the dismiss mutation. The gate condition
(`!flag`) and the two flag-set patches are trivial DB writes — no separate pure-logic unit test warranted under the
repo's "unit-test pure logic only" convention.

## 5. Out of scope

- No multi-step / "N posts to finish" onboarding progress.
- No analytics/telemetry events on prompt shown/skipped/completed.
- No server-side post-count query.

## 6. Docs to update (same change)

`docs/PLATFORM.md`: RequireAuth gate-chain section + its mermaid (add the first-post edge), new `FirstPostPromptScreen`
component entry, `users.firstPostPromptedAt` in the data dictionary, `submitPost` flag-set note,
`dismissFirstPostPrompt` in the function table, and the SettingsPage description (Identity section removed).
