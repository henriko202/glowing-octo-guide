# Admin Panel — Manual Sync Buttons Design

**Date:** 2026-06-18
**Context:** The Apify LinkedIn integration (post sync + profile scrape) currently runs only on a cron
(`convex/crons.ts` → `internal.jobs.syncPosts.syncAllPosts`, daily). There is no way for an admin to trigger a
sync on demand. This spec adds four manual triggers to the admin panel: **sync all posts** and **sync all
users** (Settings tab), and per-row **sync posts** and **sync profile** (Users tab). All four reuse the existing
Apify jobs; only one new fan-out job is added.

---

## Compliance gate (read first)

The Apify integration is **intentionally dormant** at launch — disabled by default and deliberately omitted from
the privacy docs (ROPA, sub-processor list). See the privacy spec §4.4 and `docs/compliance/`. A manual admin
button that hits Apify in production is, functionally, "running Apify in production."

**This feature does not change that posture.** Every button **respects the existing Apify toggles**: a button
only runs when its matching toggle (`apifySyncEnabled` for posts / `apifyProfileScrapeEnabled` for profiles, AND
the `apifyEnabled` master) is on. When the toggle is off the button is disabled in the UI **and** the server
wrapper refuses. Therefore this feature introduces **no new disclosure obligation** beyond flipping the toggles
that already exist — and flipping those in production already carries the documented compliance obligations
(disclosure + legal basis + sub-processor entry + DPA). No new always-on processing is added.

---

## Decisions

| Question                                           | Answer                                                                                                           |
|----------------------------------------------------|------------------------------------------------------------------------------------------------------------------|
| Relationship to the Apify kill-switches?           | **Respect the toggles.** Buttons run only when the matching flag (+ master) is on.                               |
| What does "sync user / sync all users" mean?       | **Profile scrape** — refresh `country` / `location` / `primaryLocale`.                                           |
| What does "sync posts / sync all posts" mean?      | LinkedIn **post sync** (existing `syncAllPosts` / `syncUserPostsViaApify`).                                      |
| How are the "sync all" jobs triggered from the UI? | Public admin **mutation** → `ctx.scheduler.runAfter(0, internalAction)` (returns instantly, runs in background). |
| Where do the "all" buttons live?                   | On the existing Settings-tab cards, co-located with each toggle.                                                 |
| Where do the per-user buttons live?                | Two new items in the existing `RowActionsMenu` (`···`) in the Users tab.                                         |
| "Sync all users" scope                             | All users with a `linkedinPublicIdentifier`, bounded `.take(500)`.                                               |
| Feedback channel (no toast system exists)          | Inline transient **flash** banner, matching the app's existing inline-feedback convention.                       |
| Visual direction                                   | **Match the existing admin UI exactly.** No new aesthetic; quality lives in states/gating/a11y.                  |
| i18n                                               | Admin strings stay hardcoded English (the admin panel does not use i18n).                                        |

---

## Backend (Convex)

### New public wrappers (all in `convex/admin.ts`)

All four follow the same shape every admin endpoint uses — `requireAuth(sessionToken)` →
`assertAdmin(user)` → flag check → schedule. They are **mutations** (not actions) so they can use the scheduler
and return immediately; the slow, paid Apify work runs in the background.

```typescript
// Posts — all active users
export const syncAllPosts = mutation({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    const user = await requireAuth(ctx, sessionToken)
    assertAdmin(user)
    const settings = await ctx.db.query('appSettings').first()
    if (!isApifyPostSyncEnabled(settings)) {
      throw new Error('Post sync is disabled — enable it in Settings first.')
    }
    await ctx.scheduler.runAfter(0, internal.jobs.syncPosts.syncAllPosts, {})
  }
})

// Posts — one user
export const syncUserPosts = mutation({
  args: { sessionToken: v.string(), userId: v.id('users') },
  handler: async (ctx, { sessionToken, userId }) => {
    const admin = await requireAuth(ctx, sessionToken)
    assertAdmin(admin)
    const settings = await ctx.db.query('appSettings').first()
    if (!isApifyPostSyncEnabled(settings)) {
      throw new Error('Post sync is disabled — enable it in Settings first.')
    }
    const target = await ctx.db.get(userId)
    if (!target) throw new Error('User not found')
    if (!target.linkedinPublicIdentifier) throw new Error('User has no LinkedIn URL on file.')
    await ctx.scheduler.runAfter(0, internal.jobs.syncPostsApify.syncUserPostsViaApify, { userId })
  }
})

// Profiles — all users with a LinkedIn identifier
export const syncAllProfiles = mutation({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    const user = await requireAuth(ctx, sessionToken)
    assertAdmin(user)
    const settings = await ctx.db.query('appSettings').first()
    if (!isApifyProfileScrapeEnabled(settings)) {
      throw new Error('Profile scrape is disabled — enable it in Settings first.')
    }
    await ctx.scheduler.runAfter(0, internal.jobs.scrapeProfileApify.scrapeAllProfilesViaApify, {})
  }
})

// Profiles — one user
export const syncUserProfile = mutation({
  args: { sessionToken: v.string(), userId: v.id('users') },
  handler: async (ctx, { sessionToken, userId }) => {
    const admin = await requireAuth(ctx, sessionToken)
    assertAdmin(admin)
    const settings = await ctx.db.query('appSettings').first()
    if (!isApifyProfileScrapeEnabled(settings)) {
      throw new Error('Profile scrape is disabled — enable it in Settings first.')
    }
    const target = await ctx.db.get(userId)
    if (!target) throw new Error('User not found')
    if (!target.linkedinPublicIdentifier) throw new Error('User has no LinkedIn URL on file.')
    await ctx.scheduler.runAfter(0, internal.jobs.scrapeProfileApify.scrapeUserProfile, { userId })
  }
})
```

> **Why the flag check lives in the wrapper:** `syncUserPostsViaApify` does **not** self-check the flag (the
> existing fan-out checks it before calling), so for the per-user posts trigger the wrapper's check is the only
> server gate. `scrapeUserProfile` and the `syncAllPosts` internal action *do* self-check, so for those the
> wrapper check is defense-in-depth plus a way to surface a clear error to the admin instead of a silent no-op.

`isApifyPostSyncEnabled` / `isApifyProfileScrapeEnabled` are imported from `./lib/apify` (already used by the jobs).

### New fan-out job (`convex/jobs/scrapeProfileApify.ts`)

Mirrors `syncAllPostsViaApify` in `syncPostsApify.ts`:

```typescript
export const scrapeAllProfilesViaApify = internalAction({
  args: {},
  handler: async ctx => {
    const actionCtx = ctx as unknown as ActionCtx
    const settings = await actionCtx.runQuery(internal.admin.getSettingsInternal, {})
    if (!isApifyProfileScrapeEnabled(settings as ApifyFlags)) {
      console.log('[Apify] Profile scrape disabled — skipping')
      return
    }
    const users = await actionCtx.runQuery(internal.users.getUsersWithLinkedin, {})
    const results = await Promise.allSettled(
      users.map(u => actionCtx.runAction(internal.jobs.scrapeProfileApify.scrapeUserProfile, { userId: u._id }))
    )
    const failed = results.filter(r => r.status === 'rejected')
    if (failed.length > 0) console.error(`[Apify] ${failed.length}/${users.length} profile scrapes failed`)
    await actionCtx.runMutation(internal.admin.updateProfileScrapeStatus, {
      lastProfileScrapeAt: Date.now(),
      lastProfileScrapeError: failed.length > 0 ? `${failed.length} user(s) failed` : undefined
    })
  }
})
```

`scrapeUserProfile` already re-checks the flag and skips users with no identifier, so the fan-out stays safe even
if the target set drifts.

### New internal query (`convex/users.ts`)

```typescript
export const getUsersWithLinkedin = internalQuery({
  args: {},
  handler: async ctx => {
    // Bounded admin/cron query. No index on linkedinPublicIdentifier; scan + filter is acceptable here.
    const users = await ctx.db.query('users').take(500)
    return users.filter(u => !!u.linkedinPublicIdentifier).map(u => ({ _id: u._id }))
  }
})
```

### New internal mutation (`convex/admin.ts`)

```typescript
export const updateProfileScrapeStatus = internalMutation({
  args: { lastProfileScrapeAt: v.number(), lastProfileScrapeError: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const settings = await ctx.db.query('appSettings').first()
    if (settings) await ctx.db.patch(settings._id, { ...args })
  }
})
```

### Schema widen (`convex/schema.ts`, `appSettings`)

Add two optional fields, symmetric with the existing post-sync status fields:

```typescript
lastProfileScrapeAt: v.optional(v.number()),
lastProfileScrapeError: v.optional(v.string())
```

`getSettings` (public) adds them to its fallback default object for shape consistency (both `undefined`).

### `listUsers` change (`convex/admin.ts`)

Add `linkedinPublicIdentifier: u.linkedinPublicIdentifier` to each returned row. It is public data (it's the slug
in the user's public profile URL), so it does not breach the "omit sensitive fields" rule the query documents.
The Users-tab row buttons use it to gate "has a LinkedIn URL."

---

## Frontend

### Shared: inline flash

No toast system exists. Add a tiny shared helper so both surfaces give identical feedback. A small hook +
presentational banner (≈15 lines), `app/src/components/useFlash.tsx`:

- `useFlash()` → `{ flash, showFlash }`, where `flash` is `{ kind: 'success' | 'error'; msg: string } | null`.
- `showFlash(kind, msg)` sets it and auto-clears after ~4s (`setTimeout`, cleared on unmount / re-trigger).
- A `<Flash flash={flash} />` element renders a dismissible slate/green/red inline banner consistent with the
  existing card styling. Respects `prefers-reduced-motion` (no slide animation when set).

Errors thrown by the wrappers (e.g. *"Profile scrape is disabled…"*) are caught at the call site and passed to
`showFlash('error', err.message)`.

### Settings tab (`AdminPage.tsx`)

Each of the two relevant cards gains a secondary **"Sync all now"** button next to its Enable/Disable toggle.

- **Apify Post Sync** card → "Sync all now" calls `api.admin.syncAllPosts`. The card already shows
  `Last sync: …` + error; that line is the durable result channel.
- **Apify Profile Scrape** card → "Sync all now" calls `api.admin.syncAllProfiles`, plus a new
  `Last profile sync: …` line driven by `settings.lastProfileScrapeAt` / `lastProfileScrapeError`.

Button states:

| State                        | Appearance                                                               |
|------------------------------|--------------------------------------------------------------------------|
| Feature on, idle             | Secondary button (slate border, white bg) reading **Sync all now**       |
| Feature off (flag or master) | `disabled`, grayed, `title="Enable <feature> to run a manual sync"`      |
| Scheduling in flight         | `disabled`, label **Starting…** (brief — the schedule call returns fast) |
| After schedule succeeds      | flash: *"Post sync started — running in the background."*                |
| Wrapper throws               | flash (error): the thrown message                                        |

Enabled-ness is computed in `AdminPage` from `settings` (`postSyncOn = settings?.apifyEnabled !== false &&
!!settings?.apifySyncEnabled`; `profileScrapeOn = settings?.apifyEnabled !== false &&
!!settings?.apifyProfileScrapeEnabled`) and `postSyncOn` / `profileScrapeOn` are passed down to `UsersTab` as
props (so it doesn't re-query settings).

### Users tab (`UsersTab.tsx`)

`actionsFor(user)` gains two items in the `···` menu:

- **Sync posts** → `api.admin.syncUserPosts({ userId })`
- **Sync profile** → `api.admin.syncUserProfile({ userId })`

Each item is `disabled` (grayed, with a `title` reason) when:

- the relevant feature flag is off → *"Enable post sync / profile scrape in Settings"*, **or**
- `user.linkedinPublicIdentifier` is absent → *"No LinkedIn URL on file"*.

On click (when enabled): call the mutation, then `showFlash('success', 'Profile sync started for <name>.')`;
on throw, `showFlash('error', err.message)`. Because the mutation only *schedules* the job, the result surfaces
later via the user's data updating (Convex reactivity) — the flash just confirms the request was accepted.

### `RowActionsMenu` enhancement (`RowActionsMenu.tsx`)

Extend `RowAction` with two optional fields, fully backward-compatible:

```typescript
export type RowAction = {
  label: string
  onClick: () => void
  danger?: boolean
  disabled?: boolean   // new
  title?: string       // new — tooltip explaining a disabled item
}
```

Disabled items render as a `disabled` `<button>` (cursor-not-allowed, muted text) carrying `title`; they do not
fire `onClick` and do not close the menu. Existing call sites are unaffected.

---

## Files Changed

| File                                    | Change                                                                                                                                                                                                            |
|-----------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `convex/schema.ts`                      | `appSettings`: add `lastProfileScrapeAt`, `lastProfileScrapeError` (both optional)                                                                                                                                |
| `convex/admin.ts`                       | Add `syncAllPosts`, `syncUserPosts`, `syncAllProfiles`, `syncUserProfile` (public); add `updateProfileScrapeStatus` (internal); add `linkedinPublicIdentifier` to `listUsers`; extend `getSettings` default shape |
| `convex/jobs/scrapeProfileApify.ts`     | Add `scrapeAllProfilesViaApify` internal action                                                                                                                                                                   |
| `convex/users.ts`                       | Add `getUsersWithLinkedin` internal query                                                                                                                                                                         |
| `app/src/pages/AdminPage.tsx`           | Add "Sync all now" to both cards; profile last-sync line; flash; compute + pass `postSyncOn`/`profileScrapeOn` to `UsersTab`                                                                                      |
| `app/src/components/UsersTab.tsx`       | Two new row-menu items; consume flags + `linkedinPublicIdentifier`; flash                                                                                                                                         |
| `app/src/components/RowActionsMenu.tsx` | Add `disabled` + `title` to `RowAction`; render disabled items                                                                                                                                                    |
| `app/src/components/useFlash.tsx`       | **New** — shared flash hook + `<Flash>` banner                                                                                                                                                                    |
| `convex/admin.test.ts`                  | **No change** — repo has no `convex-test`; wrapper gating is covered by `convex/lib/apify.test.ts` + the `convex codegen` typecheck (see Testing)                                                                 |
| `app/src/components/UsersTab.test.tsx`  | Update for the two new gated menu items                                                                                                                                                                           |
| `docs/PLATFORM.md`                      | Update the admin / Apify-sync section with the manual triggers + new status fields                                                                                                                                |

---

## Testing

> **Build-time correction:** this repo does **not** use `convex-test`. Its Convex tests alias `convex/server`
> to a stub (`convex-mocks/`) and unit-test the *pure* logic extracted from handlers; registered wrappers are
> validated by `convex codegen`'s TypeScript pass. The plan below follows that established convention rather than
> introducing a harness the project has deliberately avoided.

- **Backend gating** — the decision logic the four wrappers depend on (`isApifyPostSyncEnabled` /
  `isApifyProfileScrapeEnabled`) is already fully covered by `convex/lib/apify.test.ts`. The wrappers add no new
  pure logic worth its own unit (thin `requireAuth → assertAdmin → flag check → schedule`); their type
  correctness — including the `internal.*` schedule targets and the new fan-out — is verified by `convex codegen`.
- **`app/src/components/UsersTab.test.tsx`**: the two new items appear; are disabled (with the right reason) when
  the flag is off or the user has no `linkedinPublicIdentifier`; and call their mutation when enabled. A
  `renderTab` helper supplies the new `postSyncOn` / `profileScrapeOn` props to every existing test too.

---

## Verification

- `/admin` → **Settings**: with Post Sync **off**, "Sync all now" on that card is disabled with a hint; enabling
  the toggle enables the button.
- Click "Sync all now" (Post Sync) → flash *"Post sync started…"*; after the background run, `Last sync` updates.
- Apify Profile Scrape card shows a **Sync all now** button and a `Last profile sync` line; behaves the same and
  the line populates after the first manual run.
- Master kill-switch **off** → both "Sync all now" buttons and both row items are disabled.
- **Users** tab → `···` menu shows **Sync posts** and **Sync profile**; each is disabled (with a tooltip) when
  its feature flag is off or the user has no LinkedIn URL; enabled otherwise. Clicking shows a flash.
- Non-admin session → all four mutations throw `Forbidden: admin access required`.
- Calling a wrapper while its flag is off (e.g. via a stale client) throws the clear "…disabled…" error — the
  server gate holds independently of the UI.

---

## Out of scope

- Re-enabling Apify in production or any of the §4.4 compliance work — unchanged by this feature.
- A progress/job-history view for syncs — the existing last-run timestamps are the only status surface.
- Bulk per-tier or filtered "sync these users" — "all" and "one" only.
