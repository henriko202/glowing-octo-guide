# Profile Enrichment (Industry · Country · Location · Primary Locale) — Design Spec

- **Date:** 2026-06-14
- **Status:** Approved (brainstorm) — ready for implementation planning
- **Branch:** `feat/initial-setup`
- **Backend:** Convex · **Frontend:** React 19 + React Router 7 + raw Tailwind + i18next

## Problem & Goal

The `users` table already declares `industry` and `country`, and the Settings page already
_displays_ them with the note "Profile data is synced automatically from LinkedIn" — but **nothing
ever writes those fields**, so they always read "Not set." The note is a promise the app never keeps.

We want to:

1. **Enrich** a user's profile with **country**, **location**, and **primary locale** by scraping
   their LinkedIn profile via a dedicated Apify actor.
2. Let the user **edit** their **industry** and **country** in Settings (canonical dropdowns).
3. Seed the app's **UI language** (i18n) from the scraped **primary locale**.
4. Gate all Apify usage behind admin flags, including a global kill-switch.

**Industry is not available from any LinkedIn source we have** (neither OIDC `userinfo` nor the
profile scraper payload contains an industry taxonomy field), so industry is **manual entry only**.

## Existing architecture (context)

- **Auth:** custom LinkedIn OAuth (OpenID Connect) + opaque session tokens. Protected
  functions take a `sessionToken` and resolve it via `requireAuth`/`resolveSession` in
  [`convex/lib/auth.ts`](../../../convex/lib/auth.ts).
- **OIDC login:** [`convex/http.ts`](../../../convex/http.ts) `/auth/linkedin/callback` calls
  `fetchLinkedInUserInfo` ([`convex/linkedin/oauth.ts`](../../../convex/linkedin/oauth.ts)) →
  `internal.linkedin.auth.upsertUser` ([`convex/linkedin/auth.ts`](../../../convex/linkedin/auth.ts)).
  OIDC `userinfo` returns `sub`, `name`, `picture`, `locale {country, language}` — **no headline,
  no public identifier, no industry.**
- **LinkedIn identity:** `linkedinPublicIdentifier` (vanityName) is set **manually** by the user in
  Settings via `users.setPublicIdentifier` ([`convex/users.ts`](../../../convex/users.ts)). This is
  the **only** place we obtain the identifier the profile scraper needs.
- **Existing Apify integration:** [`convex/jobs/syncPostsApify.ts`](../../../convex/jobs/syncPostsApify.ts)
  scrapes _posts_ (not profile fields) via `run-sync-get-dataset-items`, gated by the
  `appSettings.apifySyncEnabled` flag, fanned out by an hourly cron.
- **Feed targeting:** [`convex/feed.ts`](../../../convex/feed.ts) does **exact-string matching** on
  `viewer.industry` / `viewer.country` against post `visibilityIndustries` / `visibilityCountries`.
  This makes industry/country **match keys**, not free display strings — hence canonical dropdowns.
- **Settings UI:** [`app/src/pages/SettingsPage.tsx`](../../../app/src/pages/SettingsPage.tsx)
  currently shows `industry`/`country` read-only and has the LinkedIn-identity input.
- **Admin UI:** [`app/src/pages/AdminPage.tsx`](../../../app/src/pages/AdminPage.tsx) Settings tab
  has one "Apify Post Sync" toggle → `api.admin.toggleApifySync`. `admin.getSettings` is
  **admin-gated** ([`convex/admin.ts`](../../../convex/admin.ts)).
- **i18n:** [`app/src/i18n/index.ts`](../../../app/src/i18n/index.ts) — i18next with
  `LanguageDetector` (order: localStorage `i18nextLng` → querystring → navigator), supported
  `['en','pt','es']`, fallback `en`. A manual language switcher exists in
  [`app/src/components/AppNav.tsx`](../../../app/src/components/AppNav.tsx).

## Decisions

| #   | Topic                              | Decision                                                                                                                                 |
| --- | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Industry source                    | **Manual entry only** (not in any LinkedIn payload we have)                                                                              |
| 2   | Country / location / locale source | **Profile scraper** (new Apify actor)                                                                                                    |
| 3   | Primary locale meaning             | **Language for i18n only** (`primaryLocale.language`); seeds UI language                                                                 |
| 4   | Country vs location                | **Separate fields**: `country` editable (geographic, ISO alpha-2); `location` read-only (display text)                                   |
| 5   | Edit UX                            | **Canonical dropdowns** for industry + country (consistent feed match keys); industry needs a **searchable** control given list size     |
| 6   | List strategy                      | **Shared module**: full ISO country list + **full LinkedIn industry codes v2** (store the _LinkedIn Industry Code_, display the _Label_) |
| 7   | Scrape trigger                     | **On `setPublicIdentifier`** + a **manual "Refresh from LinkedIn"** button (≤ 2/day)                                                     |
| 8   | Overwrite policy                   | **Fill-when-empty** for `country`; **always-refresh** for `location` + `primaryLocale`                                                   |
| 9   | Apify flags                        | **Three flags**: `apifyEnabled` (master kill-switch), `apifySyncEnabled` (posts), `apifyProfileScrapeEnabled` (profile)                  |
| 10  | Profile API surface                | Editable profile mutation **reads/writes only `industry` + `country`**; no Apify flags exposed to non-admin clients                      |

## Field model

| Field           | Source                                                        | Policy               | Editable    | Shown in Settings    |
| --------------- | ------------------------------------------------------------- | -------------------- | ----------- | -------------------- |
| `industry`      | manual                                                        | user sets it         | ✅ dropdown | always               |
| `country`       | scrape `location.countryCode` (`"BR"`)                        | fill when empty      | ✅ dropdown | always               |
| `location`      | scrape `location.linkedinText` (`"Curitiba, Paraná, Brazil"`) | refresh every scrape | ❌          | when value present   |
| `primaryLocale` | scrape `primaryLocale.language` (`"en"`)                      | refresh every scrape | i18n only   | (drives UI language) |

- `country` canonical form = **ISO 3166-1 alpha-2**, exactly what the scraper returns — no mapping.
- `industry` canonical form = **LinkedIn Industry Code** (stored), with the **Label** shown in the UI.
- `location` displays whenever the value is present. Because `location` is only ever written by an
  (enabled) profile scrape, "value present" is a sufficient proxy for "scraping was enabled" — so we
  do **not** expose any Apify flag to the client (per decision #10).

## The profile scraper

- **Env:** `APIFY_TASK_ID_PROFILE_SCRAPE`
- **Input:** `{ "profileScraperMode": "Profile details no email ($4 per 1k)", "queries": [<publicIdentifier>] }`
- **Output:** array; we read `result[0]`. Relevant fields (others ignored):
  - `location.countryCode` → `country` (e.g. `"BR"`)
  - `location.linkedinText` → `location` (e.g. `"Curitiba, Paraná, Brazil"`)
  - `primaryLocale.language` → `primaryLocale` (e.g. `"en"`)
- **Note:** `primaryLocale.country` (`"US"`) can differ from `location.countryCode` (`"BR"`) — UI
  locale ≠ geographic country. We use `location.countryCode` for `country` and
  `primaryLocale.language` for `primaryLocale`.

## 1. Schema — `convex/schema.ts`

Add two optional fields to `users`:

```ts
location: v.optional(v.string()),       // scraped display text, read-only
primaryLocale: v.optional(v.string()),  // scraped language code (en/pt/es/…), drives i18n
```

Add two optional flags to `appSettings`:

```ts
apifyEnabled: v.optional(v.boolean()),              // master kill-switch; absent ⇒ true (on)
apifyProfileScrapeEnabled: v.optional(v.boolean()), // profile scrape; absent ⇒ false (opt-in)
```

- `industry` / `country` already exist — no change.
- No new index. `getMe`/`toSafeMe` spread all non-token fields, so `location`/`primaryLocale`
  surface to the client automatically.
- Existing `apifySyncEnabled` is unchanged.

## 2. Apify flag helpers — `convex/lib/apify.ts` (new)

Centralize the gate logic + the shared REST helper so both jobs use one implementation.

```ts
// Pure gate helpers (testable, no ctx)
export function isApifyMasterEnabled(s): boolean // (s.apifyEnabled ?? true)
export function isApifyPostSyncEnabled(s): boolean // master && !!s.apifySyncEnabled
export function isApifyProfileScrapeEnabled(s): boolean // master && !!s.apifyProfileScrapeEnabled

// Shared REST runner (extracted from syncPostsApify.ts)
export async function runApifyTask(actorId, token, input): Promise<unknown[] | undefined>
```

**Refactor:** [`convex/jobs/syncPostsApify.ts`](../../../convex/jobs/syncPostsApify.ts) imports
`runApifyTask` from here (removes its private copy) and replaces its inline
`settings?.apifySyncEnabled` check with `isApifyPostSyncEnabled(settings)`.

## 3. Profile scrape action — `convex/jobs/scrapeProfileApify.ts` (new)

`internal.jobs.scrapeProfileApify.scrapeUserProfile({ userId })` — an `internalAction`:

1. Read `APIFY_API_TOKEN` + `APIFY_TASK_ID_PROFILE_SCRAPE`; bail (log) if unset.
2. Read app settings; **bail if `!isApifyProfileScrapeEnabled(settings)`**.
3. Read user via `internal.users.getWithTokens`; bail if no `linkedinPublicIdentifier`.
4. `runApifyTask(taskId, token, { profileScraperMode: 'Profile details no email ($4 per 1k)', queries: [publicIdentifier] })`.
5. Parse `result[0]` defensively into `{ country?, location?, primaryLocale? }` (any subset may be
   missing); bail quietly on empty dataset.
6. Call `internal.users.applyScrapedProfile` with the parsed subset.

A typed `ApifyProfileResult` interface covers only the fields we read.

## 4. Apply mutation — `convex/users.ts`

`internal.users.applyScrapedProfile({ userId, country?, location?, primaryLocale? })`
(`internalMutation`):

- `country`: patch **only if** `!existing.country` (protect manual edits).
- `location`, `primaryLocale`: **always** patch when provided.
- Omitted args are left untouched.

## 5. Triggers

- **`users.setPublicIdentifier`** (existing mutation): after patching the identifier, schedule the
  scrape — `await ctx.scheduler.runAfter(0, internal.jobs.scrapeProfileApify.scrapeUserProfile, { userId: user._id })`.
  Non-blocking; the mutation returns immediately.
- **`users.refreshProfileFromLinkedIn`** (new public mutation):
  - `requireAuth`; throw a user-facing error if no `linkedinPublicIdentifier`.
  - Read app settings; **throw a user-facing error if `!isApifyProfileScrapeEnabled(settings)`**
    (e.g. "Profile refresh is currently unavailable"). This gives the client immediate feedback
    without exposing the flag via a query.
  - **Rate-limit** to **2 per day** via the existing `rateLimits` table (action key
    `profile_refresh`) to cap Apify cost.
  - Schedule the same scrape action. Returns nothing (the result arrives via the reactive `getMe`).

## 6. Profile edit — `convex/users.ts`

- **`users.updateProfile({ sessionToken, industry?, country? })`** (new public mutation):
  - `requireAuth`.
  - **Writes only `industry` + `country`** — no other user fields are touched.
  - Validate each provided value against the shared lists (`isValidIndustry` / `isValidCountry`);
    throw on unknown. Allow clearing to empty/undefined.
  - Patch the user.
- **Reads** of these fields ride the existing `users.getMe` payload (which already returns the whole
  safe profile, including the read-only `location` / `primaryLocale`). **No separate public settings
  query is added** — the client never reads Apify flags (decision #10). The location row and the
  refresh control are driven by data presence + server-side guards instead (see §9).

## 7. Admin flag mutations + UI

- **Mutations** (`convex/admin.ts`, mirroring `toggleApifySync`, each `requireAuth` + `assertAdmin`):
  - `toggleApifyEnabled({ enabled })` → patches `apifyEnabled`.
  - `toggleApifyProfileScrape({ enabled })` → patches `apifyProfileScrapeEnabled`.
- **`admin.getSettings`** already returns the full `appSettings` row; ensure its default object
  includes the two new flags (`apifyEnabled: true`, `apifyProfileScrapeEnabled: false`).
- **UI** ([`app/src/pages/AdminPage.tsx`](../../../app/src/pages/AdminPage.tsx) Settings tab): add
  two toggle cards next to "Apify Post Sync":
  - **Apify (master)** — "Global kill-switch. Turns off all Apify integration." Red when on.
  - **Apify Profile Scrape** — "Scrapes profile country/location/locale when a user sets or
    refreshes their LinkedIn URL."
  - Generalize the local toggle handler to take a flag + mutation (avoid three copy-pasted handlers).

## 8. Shared canonical lists — `convex/lib/profileOptions.ts` (new)

A **pure-data** module (no Convex/server imports) so it's safe to import from both server validation
and the Vite client.

```ts
export const COUNTRIES: ReadonlyArray<{ code: string; name: string }> // full ISO 3166-1 alpha-2
export const INDUSTRIES: ReadonlyArray<{ code: string; label: string }> // full LinkedIn industry codes v2
export function isValidCountry(code: string): boolean
export function isValidIndustry(code: string): boolean
```

- **Industry source:** the official LinkedIn industry taxonomy at
  <https://learn.microsoft.com/en-us/linkedin/shared/references/reference-tables/industry-codes-v2>.
  Keep **only** two columns: the **Label** (display) and the **LinkedIn Industry Code** (stored
  value). The `INDUSTRIES` array is generated from that table during implementation.
- **Country source:** full ISO 3166-1 alpha-2 (`code` stored, `name` displayed).
- Store **codes**; display `name`/`label`. Feed matching compares the stored codes.
- Because the industry list is large (hundreds of entries), the Settings **industry dropdown should
  be a searchable/typeahead control**. A native `<select>` is the MVP fallback; a lightweight
  combobox is the enhancement. (Country, ~250 entries, can use a native `<select>`.)
- The future Pro visibility-targeting UI ("coming soon") reuses these lists.

## 9. Frontend — Settings (`app/src/pages/SettingsPage.tsx`)

- Extend the `MeProfile` interface with `location?` and `primaryLocale?`.
- Replace the read-only `industry`/`country` `<p>` lines with **dropdowns** bound to `COUNTRIES`
  /`INDUSTRIES`, plus a **Save** button → `api.users.updateProfile` (with saving/saved states like
  the existing identifier save).
- Add a read-only **Location** row, rendered only when `me.location` is present (no flag read).
- Add a **"Refresh from LinkedIn"** button → `api.users.refreshProfileFromLinkedIn`:
  - Disabled when there is no `linkedinPublicIdentifier`.
  - Shows a transient "Refreshing…" state; data updates reactively via `getMe`.
  - If the server throws (profile scrape disabled, or rate limit hit), surface the returned
    message inline. This is how the client learns the feature is off — it never reads the flag.
- Remove/replace the misleading "synced automatically from LinkedIn" note.
- Add new i18n keys to `en`/`pt`/`es` (industry/country labels, save, location label, refresh
  button + states, error message).

## 10. Frontend — i18n seeding (`app/src/App.tsx` or a small hook)

When `me` first loads with a value: if `localStorage.getItem('i18nextLng')` is null **and**
`me.primaryLocale` maps to a supported lang (`en`/`pt`/`es`), call `i18n.changeLanguage(mapped)`.
Seeds the UI language once from LinkedIn; the AppNav switcher (which persists to localStorage) wins
on any subsequent manual change.

## 11. What we deliberately leave out

- **No OIDC profile-field changes** — country/locale come from the scrape, so
  [`convex/http.ts`](../../../convex/http.ts) and [`convex/linkedin/auth.ts`](../../../convex/linkedin/auth.ts)
  are untouched.
- **`headline`** is present in the scrape payload and is currently never populated (OIDC lacks it),
  but it's **out of scope** for this feature — noted as a possible follow-up, not built.
- Rich scrape data (experience, education, skills, about, etc.) is **ignored**.

## 12. Testing

- **`convex/lib/apify.ts`**: gate helpers — master absent ⇒ on; master off ⇒ both off; per-feature
  flags respected.
- **`scrapeProfileApify` parse**: maps `countryCode`→country, `linkedinText`→location,
  `primaryLocale.language`→primaryLocale; tolerates missing `location`/`primaryLocale`/empty dataset.
- **`applyScrapedProfile`**: fills `country` only when empty; always refreshes `location`/`primaryLocale`.
- **`setPublicIdentifier`**: schedules the scrape action.
- **`refreshProfileFromLinkedIn`**: requires auth + a public identifier; **throws when the profile
  scrape flag is off**; enforces the 2/day rate limit.
- **`updateProfile`**: accepts canonical values; rejects unknown industry/country; touches only
  `industry`/`country`.
- **`SettingsPage`**: renders dropdowns, saves, shows Location only when `me.location` present;
  surfaces the refresh error message when the mutation throws.
- **`AdminPage`**: the two new toggles call the right mutations (extend the existing query-order test
  expectations).
- **i18n seed**: applies `primaryLocale` only when no localStorage preference exists.

## 13. Risks

- **Apify cost/latency** — scrapes run as **scheduled background actions** (never block a mutation);
  manual refresh is rate-limited; profile scrape defaults **off**; master kill-switch halts everything.
- **Empty dataset / profile not found** — the action no-ops gracefully (no partial writes beyond what
  was parsed).
- **Scraper field drift** — if Apify changes the payload shape, parsing degrades to "field missing"
  rather than crashing; the typed interface documents exactly what we depend on.
- **Country code casing** — normalize `countryCode` to the canonical case used in `COUNTRIES`
  (uppercase alpha-2) before storing, so feed matching stays consistent.
