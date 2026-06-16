# Profile Enrichment (Industry · Country · Location · Primary Locale) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **⚠️ PROJECT GIT POLICY (overrides the skill template):** This repo's `CLAUDE.md` says **NEVER run `git commit` or `git push`.** Every task below ends with a **Checkpoint** step instead of a commit — stage the files with `git add` and pause for the user (Henriko) to review and commit. Do **not** commit yourself.

**Goal:** Enrich users with `country`, `location`, and `primaryLocale` scraped from their LinkedIn profile (new Apify actor), let users edit `industry`/`country` in Settings via canonical dropdowns, seed the UI language from the scraped locale, and gate all Apify usage behind admin flags (incl. a master kill-switch).

**Architecture:** A new Apify _profile_ scraper action runs (scheduled, non-blocking) when a user sets their LinkedIn URL or hits a rate-limited "Refresh" button. It writes `country` (fill-when-empty), `location`/`primaryLocale` (always refresh). Industry stays manual. Canonical lists live in one pure-data module shared by server validation and the client. Three flags (`apifyEnabled` master, `apifySyncEnabled` posts, `apifyProfileScrapeEnabled` profile) gate the integration; clients never read the flags.

**Tech Stack:** Convex (TypeScript backend), React 19 + React Router 7 + raw Tailwind, i18next, Vitest + @testing-library/react. Apify via REST (`run-sync-get-dataset-items`).

**Spec:** [docs/superpowers/specs/2026-06-14-profile-enrichment-design.md](../specs/2026-06-14-profile-enrichment-design.md)

**Before any Convex work:** read `convex/_generated/ai/guidelines.md` first (per `CLAUDE.md`). This plan already conforms (arg validators on every function; no `.filter()`/`.collect()` added; actions use `ctx.runQuery`/`ctx.runMutation`, never `ctx.db`; `fetch` needs no `"use node"`).

**Testing conventions (follow these — they match the codebase, and intentionally diverge from the guidelines' `convex-test` suggestion):**

- This repo does **not** use `convex-test`. `convex/vitest.config.ts` aliases `convex/server` → the `convex-mocks` shim, so backend logic is tested as **plain functions**. Keep this pattern.
- Convex logic is tested by extracting **pure handler functions** (e.g. `upsertUserHandler`) and testing them with a **hand-rolled mock db**, exactly like [`convex/linkedin/auth.test.ts`](../../../convex/linkedin/auth.test.ts).
- Pure validators/helpers are exported and unit-tested directly (e.g. `validateLimitArgs` in `admin.ts`).
- Components use `@testing-library/react` with `vi.mock('convex/react')` and `vi.mock('react-router-dom')`, like [`app/src/pages/AdminPage.test.tsx`](../../../app/src/pages/AdminPage.test.tsx).
- Run a single backend test: `npx vitest run convex/path/to/file.test.ts`
- Run a single frontend test: `npx vitest run app/src/path/to/file.test.tsx`

---

## Task 1: Schema + shared types

**Files:**

- Modify: `convex/schema.ts` (users table; appSettings table)
- Modify: `convex/convexTypes.ts` (`UserDoc`, `AppSettingsDoc`)

- [ ] **Step 1: Add the two user fields**

In `convex/schema.ts`, inside the `users` table definition, add after the existing `country` line (currently line 11):

```ts
    // Scraped LinkedIn profile location, e.g. "Curitiba, Paraná, Brazil". Read-only display
    // (set only by the profile scrape). Distinct from `country` (geographic ISO alpha-2 code).
    location: v.optional(v.string()),
    // Scraped LinkedIn primary-locale language code (e.g. "en"). Drives the UI i18n seed only.
    primaryLocale: v.optional(v.string()),
```

- [ ] **Step 2: Add the two app-settings flags**

In `convex/schema.ts`, change the `appSettings` table (currently lines 92-96) to:

```ts
  appSettings: defineTable({
    apifySyncEnabled: v.boolean(),
    // Master Apify kill-switch. Absent ⇒ treated as enabled (true). When false, ALL Apify
    // integration halts (post sync AND profile scrape).
    apifyEnabled: v.optional(v.boolean()),
    // Gates the LinkedIn profile scrape. Absent ⇒ disabled (false) — opt-in (paid actor).
    apifyProfileScrapeEnabled: v.optional(v.boolean()),
    lastApifySyncAt: v.optional(v.number()),
    lastApifySyncError: v.optional(v.string())
  }),
```

- [ ] **Step 3: Mirror the fields in the hand-written types**

In `convex/convexTypes.ts`, add to `interface UserDoc` (after `country?: string` on line 90):

```ts
  location?: string
  primaryLocale?: string
```

And change `interface AppSettingsDoc` (lines 133-137) to:

```ts
export interface AppSettingsDoc extends ConvexDocument {
  apifySyncEnabled: boolean
  apifyEnabled?: boolean
  apifyProfileScrapeEnabled?: boolean
  lastApifySyncAt?: number
  lastApifySyncError?: string
}
```

- [ ] **Step 4: Verify it typechecks**

Run: `npx tsc -p convex --noEmit`
Expected: no errors. (If `convex/_generated` is stale, run `npx convex codegen` first.)

- [ ] **Step 5: Checkpoint (user commits)**

```bash
git add convex/schema.ts convex/convexTypes.ts
```

Pause for Henriko to review and commit (suggested message: `feat(schema): add user location/primaryLocale + apify master/profile flags`).

---

## Task 2: Apify gate helpers + shared `runApifyTask`

**Files:**

- Create: `convex/lib/apify.ts`
- Create: `convex/lib/apify.test.ts`
- Modify: `convex/jobs/syncPostsApify.ts` (use shared helper + gate)

- [ ] **Step 1: Write the failing test**

Create `convex/lib/apify.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { isApifyMasterEnabled, isApifyPostSyncEnabled, isApifyProfileScrapeEnabled } from './apify'

describe('apify gate helpers', () => {
  it('master defaults ON when the flag is absent', () => {
    expect(isApifyMasterEnabled(undefined)).toBe(true)
    expect(isApifyMasterEnabled(null)).toBe(true)
    expect(isApifyMasterEnabled({})).toBe(true)
    expect(isApifyMasterEnabled({ apifyEnabled: false })).toBe(false)
  })

  it('post sync requires master AND the post flag', () => {
    expect(isApifyPostSyncEnabled({ apifySyncEnabled: true })).toBe(true) // master absent ⇒ on
    expect(isApifyPostSyncEnabled({ apifyEnabled: true, apifySyncEnabled: true })).toBe(true)
    expect(isApifyPostSyncEnabled({ apifyEnabled: false, apifySyncEnabled: true })).toBe(false)
    expect(isApifyPostSyncEnabled({ apifySyncEnabled: false })).toBe(false)
    expect(isApifyPostSyncEnabled(null)).toBe(false)
  })

  it('profile scrape requires master AND the profile flag (default off)', () => {
    expect(isApifyProfileScrapeEnabled({})).toBe(false)
    expect(isApifyProfileScrapeEnabled({ apifyProfileScrapeEnabled: true })).toBe(true)
    expect(isApifyProfileScrapeEnabled({ apifyEnabled: false, apifyProfileScrapeEnabled: true })).toBe(false)
  })
})
```

- [ ] **Step 2: Run it — expect failure**

Run: `npx vitest run convex/lib/apify.test.ts`
Expected: FAIL — `Cannot find module './apify'`.

- [ ] **Step 3: Create the module**

Create `convex/lib/apify.ts`:

```ts
// convex/lib/apify.ts
// Shared Apify helpers: feature-gate logic + the REST task runner used by both
// the post-sync and profile-scrape jobs.

const APIFY_BASE = 'https://api.apify.com/v2'

/** Shape of the Apify-related fields on the appSettings doc (all optional / nullable). */
export type ApifyFlags =
  | {
      apifyEnabled?: boolean
      apifySyncEnabled?: boolean
      apifyProfileScrapeEnabled?: boolean
    }
  | null
  | undefined

/** Master kill-switch. Absent ⇒ enabled (true). When false, all Apify is off. */
export function isApifyMasterEnabled(settings: ApifyFlags): boolean {
  return settings?.apifyEnabled ?? true
}

/** Hourly post sync runs only when master AND the post flag are on. */
export function isApifyPostSyncEnabled(settings: ApifyFlags): boolean {
  return isApifyMasterEnabled(settings) && !!settings?.apifySyncEnabled
}

/** Profile scrape runs only when master AND the profile flag are on (profile flag defaults off). */
export function isApifyProfileScrapeEnabled(settings: ApifyFlags): boolean {
  return isApifyMasterEnabled(settings) && !!settings?.apifyProfileScrapeEnabled
}

/**
 * Starts an Apify task run synchronously and returns its dataset items.
 * Throws on a non-OK response. Returns the parsed JSON array (caller casts to its row type).
 */
export async function runApifyTask(
  actorId: string,
  token: string,
  input: Record<string, unknown>
): Promise<unknown[] | undefined> {
  const res = await fetch(`${APIFY_BASE}/acts/${actorId}/run-sync-get-dataset-items`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(input)
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Apify task run failed: ${res.status} — ${body}`)
  }

  return (await res.json()) as unknown[] | undefined
}
```

- [ ] **Step 4: Run the test — expect pass**

Run: `npx vitest run convex/lib/apify.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Refactor `syncPostsApify.ts` to use the shared helper + gate**

In `convex/jobs/syncPostsApify.ts`:

1. Add the import near the top (after the existing imports):

```ts
import { runApifyTask, isApifyPostSyncEnabled } from '../lib/apify.js'
```

2. **Delete** the local `APIFY_BASE` constant (line 7) and the entire local `runApifyTask` function (the `async function runApifyTask(...) { ... }` block, ~lines 60-81). Both now come from `../lib/apify.js`.

3. The remaining local `runApifyTask` call returns `unknown[]`, so cast it. Change the call inside `syncUserPostsViaApify`:

```ts
const items = (await runApifyTask(actorId, token, input)) as ApifyPostResult[] | undefined
```

4. In `syncAllPostsViaApify`, replace the gate check:

```ts
if (!isApifyPostSyncEnabled(settings)) {
  console.log('[Apify] Sync is disabled — skipping')
  return
}
```

(Replaces the previous `if (!settings?.apifySyncEnabled) { ... }`.)

- [ ] **Step 6: Verify nothing broke**

Run: `npx vitest run convex/lib/apify.test.ts && npx tsc -p convex --noEmit`
Expected: tests PASS, no type errors.

- [ ] **Step 7: Checkpoint (user commits)**

```bash
git add convex/lib/apify.ts convex/lib/apify.test.ts convex/jobs/syncPostsApify.ts
```

Pause for review/commit (suggested: `feat(apify): shared runApifyTask + 3-flag gate helpers`).

---

## Task 3: Canonical lists (`profileOptions.ts`)

**Files:**

- Create: `convex/lib/profileOptions.ts`
- Create: `convex/lib/profileOptions.test.ts`

> **Data sourcing note:** `COUNTRY_CODES` is the full ISO 3166-1 alpha-2 set (below, complete — paste as-is). `INDUSTRIES` is the **full** LinkedIn industry-codes-v2 taxonomy (~420 rows) — store **only** the LinkedIn Industry Code (`code`) and English Label (`label`) columns. Source: <https://learn.microsoft.com/en-us/linkedin/shared/references/reference-tables/industry-codes-v2>. A small accurate seed is given below to make the file compile; **you must populate the remaining rows from the source.** The integrity test in this task fails until the list is complete (it asserts `length >= 400`, unique codes, and the presence of labels that appear _after_ the easily-fetched portion of the table — Software Development, IT Services and IT Consulting, Retail, Real Estate, Telecommunications, Legal Services, Technology/Internet, Transportation/Logistics). Note: a single WebFetch of that page truncates — fetch in sections or copy the rendered table to get all rows.

- [ ] **Step 1: Write the failing test**

Create `convex/lib/profileOptions.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { COUNTRY_CODES, INDUSTRIES, isValidCountry, isValidIndustry } from './profileOptions'

describe('country list', () => {
  it('contains common ISO alpha-2 codes and validates case-insensitively', () => {
    for (const code of ['US', 'BR', 'GB', 'DE', 'JP', 'IN', 'ZA', 'AU']) {
      expect(COUNTRY_CODES).toContain(code)
    }
    expect(COUNTRY_CODES.length).toBeGreaterThanOrEqual(240)
    expect(isValidCountry('br')).toBe(true)
    expect(isValidCountry('BR')).toBe(true)
    expect(isValidCountry('ZZ')).toBe(false)
    expect(isValidCountry('')).toBe(false)
  })

  it('has no duplicate codes', () => {
    expect(new Set(COUNTRY_CODES).size).toBe(COUNTRY_CODES.length)
  })
})

describe('industry list', () => {
  it('is the full taxonomy with unique numeric codes and non-empty labels', () => {
    expect(INDUSTRIES.length).toBeGreaterThanOrEqual(400)
    const codes = INDUSTRIES.map(i => i.code)
    expect(new Set(codes).size).toBe(codes.length)
    for (const { code, label } of INDUSTRIES) {
      expect(code).toMatch(/^\d+$/)
      expect(label.length).toBeGreaterThan(0)
    }
  })

  it('includes labels from across the whole table (completeness guard)', () => {
    const labels = new Set(INDUSTRIES.map(i => i.label))
    for (const required of [
      'Banking',
      'Staffing and Recruiting',
      'Hospitals and Health Care',
      'Software Development',
      'IT Services and IT Consulting',
      'Retail',
      'Real Estate',
      'Telecommunications',
      'Legal Services'
    ]) {
      expect(labels.has(required)).toBe(true)
    }
  })

  it('validates by code', () => {
    expect(isValidIndustry(INDUSTRIES[0].code)).toBe(true)
    expect(isValidIndustry('not-a-code')).toBe(false)
    expect(isValidIndustry('')).toBe(false)
  })
})
```

- [ ] **Step 2: Run it — expect failure**

Run: `npx vitest run convex/lib/profileOptions.test.ts`
Expected: FAIL — `Cannot find module './profileOptions'`.

- [ ] **Step 3: Create the module (full countries; seed industries)**

Create `convex/lib/profileOptions.ts`. Paste the full `COUNTRY_CODES` exactly as below, the seed `INDUSTRIES` rows, and the helpers. **Then extend `INDUSTRIES` with the rest of the taxonomy from the source URL.**

```ts
// convex/lib/profileOptions.ts
// PURE DATA — no Convex/server imports. Safe to import from both convex functions
// (validation) and the Vite client (dropdowns). Industry/country values are the
// canonical match keys used by the feed's visibility targeting.

/** Full ISO 3166-1 alpha-2 country codes. Display names are derived in the UI via Intl.DisplayNames. */
export const COUNTRY_CODES: readonly string[] = [
  'AD',
  'AE',
  'AF',
  'AG',
  'AI',
  'AL',
  'AM',
  'AO',
  'AQ',
  'AR',
  'AS',
  'AT',
  'AU',
  'AW',
  'AX',
  'AZ',
  'BA',
  'BB',
  'BD',
  'BE',
  'BF',
  'BG',
  'BH',
  'BI',
  'BJ',
  'BL',
  'BM',
  'BN',
  'BO',
  'BQ',
  'BR',
  'BS',
  'BT',
  'BV',
  'BW',
  'BY',
  'BZ',
  'CA',
  'CC',
  'CD',
  'CF',
  'CG',
  'CH',
  'CI',
  'CK',
  'CL',
  'CM',
  'CN',
  'CO',
  'CR',
  'CU',
  'CV',
  'CW',
  'CX',
  'CY',
  'CZ',
  'DE',
  'DJ',
  'DK',
  'DM',
  'DO',
  'DZ',
  'EC',
  'EE',
  'EG',
  'EH',
  'ER',
  'ES',
  'ET',
  'FI',
  'FJ',
  'FK',
  'FM',
  'FO',
  'FR',
  'GA',
  'GB',
  'GD',
  'GE',
  'GF',
  'GG',
  'GH',
  'GI',
  'GL',
  'GM',
  'GN',
  'GP',
  'GQ',
  'GR',
  'GS',
  'GT',
  'GU',
  'GW',
  'GY',
  'HK',
  'HM',
  'HN',
  'HR',
  'HT',
  'HU',
  'ID',
  'IE',
  'IL',
  'IM',
  'IN',
  'IO',
  'IQ',
  'IR',
  'IS',
  'IT',
  'JE',
  'JM',
  'JO',
  'JP',
  'KE',
  'KG',
  'KH',
  'KI',
  'KM',
  'KN',
  'KP',
  'KR',
  'KW',
  'KY',
  'KZ',
  'LA',
  'LB',
  'LC',
  'LI',
  'LK',
  'LR',
  'LS',
  'LT',
  'LU',
  'LV',
  'LY',
  'MA',
  'MC',
  'MD',
  'ME',
  'MF',
  'MG',
  'MH',
  'MK',
  'ML',
  'MM',
  'MN',
  'MO',
  'MP',
  'MQ',
  'MR',
  'MS',
  'MT',
  'MU',
  'MV',
  'MW',
  'MX',
  'MY',
  'MZ',
  'NA',
  'NC',
  'NE',
  'NF',
  'NG',
  'NI',
  'NL',
  'NO',
  'NP',
  'NR',
  'NU',
  'NZ',
  'OM',
  'PA',
  'PE',
  'PF',
  'PG',
  'PH',
  'PK',
  'PL',
  'PM',
  'PN',
  'PR',
  'PS',
  'PT',
  'PW',
  'PY',
  'QA',
  'RE',
  'RO',
  'RS',
  'RU',
  'RW',
  'SA',
  'SB',
  'SC',
  'SD',
  'SE',
  'SG',
  'SH',
  'SI',
  'SJ',
  'SK',
  'SL',
  'SM',
  'SN',
  'SO',
  'SR',
  'SS',
  'ST',
  'SV',
  'SX',
  'SY',
  'SZ',
  'TC',
  'TD',
  'TF',
  'TG',
  'TH',
  'TJ',
  'TK',
  'TL',
  'TM',
  'TN',
  'TO',
  'TR',
  'TT',
  'TV',
  'TW',
  'TZ',
  'UA',
  'UG',
  'UM',
  'US',
  'UY',
  'UZ',
  'VA',
  'VC',
  'VE',
  'VG',
  'VI',
  'VN',
  'VU',
  'WF',
  'WS',
  'YE',
  'YT',
  'ZA',
  'ZM',
  'ZW'
]

export interface Industry {
  code: string
  label: string
}

/**
 * LinkedIn industry codes v2 — store the LinkedIn Industry Code + English Label only.
 * SEED below is accurate but PARTIAL. Populate the full ~420-row taxonomy from:
 * https://learn.microsoft.com/en-us/linkedin/shared/references/reference-tables/industry-codes-v2
 * The integrity test (length >= 400 + required labels) fails until this is complete.
 */
export const INDUSTRIES: readonly Industry[] = [
  { code: '2190', label: 'Accommodation Services' },
  { code: '34', label: 'Food and Beverage Services' },
  { code: '32', label: 'Restaurants' },
  { code: '31', label: 'Hospitality' },
  { code: '2194', label: 'Hotels and Motels' },
  { code: '1912', label: 'Administrative and Support Services' },
  { code: '104', label: 'Staffing and Recruiting' },
  { code: '48', label: 'Construction' },
  { code: '91', label: 'Consumer Services' },
  { code: '100', label: 'Non-profit Organizations' },
  { code: '1999', label: 'Education' },
  { code: '68', label: 'Higher Education' },
  { code: '67', label: 'Primary and Secondary Education' },
  { code: '28', label: 'Entertainment Providers' },
  { code: '43', label: 'Financial Services' },
  { code: '41', label: 'Banking' },
  { code: '42', label: 'Insurance' },
  { code: '45', label: 'Investment Banking' },
  { code: '46', label: 'Investment Management' },
  { code: '75', label: 'Government Administration' },
  { code: '14', label: 'Hospitals and Health Care' },
  { code: '2081', label: 'Hospitals' },
  { code: '13', label: 'Medical Practices' },
  { code: '25', label: 'Manufacturing' },
  { code: '15', label: 'Pharmaceutical Manufacturing' },
  { code: '55', label: 'Machinery Manufacturing' },
  { code: '332', label: 'Oil, Gas, and Mining' },
  { code: '56', label: 'Mining' },
  { code: '57', label: 'Oil and Gas' },
  { code: '1810', label: 'Professional Services' },
  { code: '47', label: 'Accounting' },
  { code: '80', label: 'Advertising Services' }
  // TODO(data): append the remaining LinkedIn industry-codes-v2 rows from the source URL.
  // Must include (among others): Software Development, IT Services and IT Consulting,
  // Technology/Information and Internet, Retail, Real Estate, Telecommunications,
  // Legal Services, Transportation/Logistics, Utilities, Research Services,
  // Architecture and Planning, Design Services, Media/Broadcast, Wholesale, etc.
]

const COUNTRY_SET = new Set(COUNTRY_CODES)
const INDUSTRY_CODE_SET = new Set(INDUSTRIES.map(i => i.code))

export function isValidCountry(code: string): boolean {
  return typeof code === 'string' && code.length > 0 && COUNTRY_SET.has(code.toUpperCase())
}

export function isValidIndustry(code: string): boolean {
  return typeof code === 'string' && code.length > 0 && INDUSTRY_CODE_SET.has(code)
}

/** UI helper: localized country display name for a code (falls back to the code). */
export function countryLabel(code: string, locale = 'en'): string {
  try {
    return new Intl.DisplayNames([locale], { type: 'region' }).of(code) ?? code
  } catch {
    return code
  }
}
```

- [ ] **Step 4: Populate the full industry list, then run the test — expect pass**

After appending the remaining rows from the source URL (keep `{ code, label }` shape; codes are the numeric "LinkedIn Industry Code" as strings; remove the `TODO(data)` comment when done):

Run: `npx vitest run convex/lib/profileOptions.test.ts`
Expected: PASS (all describe blocks). If `industry list` fails on `length` or required labels, the taxonomy is still incomplete — add the missing rows.

- [ ] **Step 5: Checkpoint (user commits)**

```bash
git add convex/lib/profileOptions.ts convex/lib/profileOptions.test.ts
```

Pause for review/commit (suggested: `feat(profile): canonical country + LinkedIn industry lists`).

---

## Task 4: Generalize the rate limiter to support a daily window

**Files:**

- Modify: `convex/lib/rateLimit.ts`
- Create: `convex/lib/rateLimit.test.ts`

- [ ] **Step 1: Write the failing test**

Create `convex/lib/rateLimit.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { checkRateLimit } from './rateLimit'

const DAY_MS = 24 * 60 * 60 * 1000

// Minimal mock ctx: db.query(...).withIndex(...).unique() + patch + insert
function createMockCtx(existing?: any) {
  const inserts: any[] = []
  const patches: any[] = []
  return {
    db: {
      query: () => ({
        withIndex: () => ({ unique: async () => existing ?? null })
      }),
      insert: async (_t: string, d: any) => {
        inserts.push(d)
      },
      patch: async (id: string, d: any) => {
        patches.push({ id, d })
      }
    },
    _inserts: inserts,
    _patches: patches
  } as any
}

describe('checkRateLimit (windowed)', () => {
  it('inserts a fresh counter when none exists', async () => {
    const ctx = createMockCtx()
    await checkRateLimit(ctx, 'u1' as any, 'profile_refresh', 2, DAY_MS, 'day')
    expect(ctx._inserts).toHaveLength(1)
    expect(ctx._inserts[0]).toMatchObject({ action: 'profile_refresh', count: 1 })
  })

  it('increments within the window below the cap', async () => {
    const ctx = createMockCtx({ _id: 'r1', windowStart: Date.now(), count: 1 })
    await checkRateLimit(ctx, 'u1' as any, 'profile_refresh', 2, DAY_MS, 'day')
    expect(ctx._patches[0].d).toEqual({ count: 2 })
  })

  it('throws once the cap is hit within the window', async () => {
    const ctx = createMockCtx({ _id: 'r1', windowStart: Date.now(), count: 2 })
    await expect(checkRateLimit(ctx, 'u1' as any, 'profile_refresh', 2, DAY_MS, 'day')).rejects.toThrow(
      /at most 2 times per day/
    )
  })

  it('resets after the window elapses', async () => {
    const ctx = createMockCtx({ _id: 'r1', windowStart: Date.now() - 2 * DAY_MS, count: 2 })
    await checkRateLimit(ctx, 'u1' as any, 'profile_refresh', 2, DAY_MS, 'day')
    expect(ctx._patches[0].d).toMatchObject({ count: 1 })
  })
})
```

- [ ] **Step 2: Run it — expect failure**

Run: `npx vitest run convex/lib/rateLimit.test.ts`
Expected: FAIL — `checkRateLimit` currently takes only 4 args; the message says "per hour", so the `/per day/` assertion fails (and TS may flag extra args).

- [ ] **Step 3: Generalize `checkRateLimit`**

In `convex/lib/rateLimit.ts`, replace the `checkRateLimit` function signature + body with the windowed version (keeps backward-compatible defaults so existing 4-arg callers in `posts.ts`/`interactions.ts` are unchanged):

```ts
export async function checkRateLimit(
  ctx: MutationCtx,
  userId: Id<'users'>,
  action: string,
  maxPerWindow: number,
  windowMs: number = WINDOW_MS,
  windowLabel: string = 'hour'
): Promise<void> {
  const now = Date.now()

  const existing = await ctx.db
    .query('rateLimits')
    .withIndex('by_user_and_action', q => q.eq('userId', userId).eq('action', action))
    .unique()

  if (!existing || now - existing.windowStart > windowMs) {
    if (existing) {
      await ctx.db.patch(existing._id, { windowStart: now, count: 1 })
    } else {
      await ctx.db.insert('rateLimits', { userId, action, windowStart: now, count: 1 })
    }
    return
  }

  if (existing.count >= maxPerWindow) {
    throw new Error(
      `Rate limit exceeded. You can perform this action at most ${maxPerWindow} times per ${windowLabel}.`
    )
  }

  await ctx.db.patch(existing._id, { count: existing.count + 1 })
}
```

Also extend the `checkAndIncrement` internal mutation so action-side callers can pass the window:

```ts
export const checkAndIncrement = internalMutation({
  args: {
    userId: v.id('users'),
    action: v.string(),
    maxPerHour: v.number(),
    windowMs: v.optional(v.number()),
    windowLabel: v.optional(v.string())
  },
  handler: async (ctx, { userId, action, maxPerHour, windowMs, windowLabel }) => {
    await checkRateLimit(ctx, userId, action, maxPerHour, windowMs, windowLabel)
  }
})
```

- [ ] **Step 4: Run the test — expect pass**

Run: `npx vitest run convex/lib/rateLimit.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Verify existing callers still typecheck**

Run: `npx tsc -p convex --noEmit`
Expected: no errors (existing `checkRateLimit(ctx, userId, 'submitPost', 10)` calls still valid).

- [ ] **Step 6: Checkpoint (user commits)**

```bash
git add convex/lib/rateLimit.ts convex/lib/rateLimit.test.ts
```

Pause for review/commit (suggested: `feat(rateLimit): optional window size + label`).

---

## Task 5: `applyScrapedProfile` (fill-when-empty country; always refresh location/locale)

**Files:**

- Modify: `convex/users.ts` (add pure handler + internal mutation)
- Create: `convex/users.applyScrapedProfile.test.ts`

- [ ] **Step 1: Write the failing test**

Create `convex/users.applyScrapedProfile.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { applyScrapedProfileHandler } from './users'

function createMockDb(existing?: any) {
  const patches: any[] = []
  return {
    get: async (_id: string) => existing ?? null,
    patch: async (id: string, data: any) => {
      patches.push({ id, data })
    },
    _patches: patches
  }
}

describe('applyScrapedProfileHandler', () => {
  it('sets country (uppercased), location and locale when country is empty', async () => {
    const db = createMockDb({ _id: 'u1' })
    await applyScrapedProfileHandler(db as any, {
      userId: 'u1',
      country: 'br',
      location: 'Curitiba, Paraná, Brazil',
      primaryLocale: 'en'
    })
    expect(db._patches).toHaveLength(1)
    expect(db._patches[0].data).toEqual({
      location: 'Curitiba, Paraná, Brazil',
      primaryLocale: 'en',
      country: 'BR'
    })
  })

  it('does NOT overwrite an existing country but still refreshes location/locale', async () => {
    const db = createMockDb({ _id: 'u1', country: 'US' })
    await applyScrapedProfileHandler(db as any, {
      userId: 'u1',
      country: 'br',
      location: 'Curitiba, Paraná, Brazil',
      primaryLocale: 'pt'
    })
    expect(db._patches[0].data).toEqual({
      location: 'Curitiba, Paraná, Brazil',
      primaryLocale: 'pt'
    })
  })

  it('no-ops when nothing is provided', async () => {
    const db = createMockDb({ _id: 'u1' })
    await applyScrapedProfileHandler(db as any, { userId: 'u1' })
    expect(db._patches).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run it — expect failure**

Run: `npx vitest run convex/users.applyScrapedProfile.test.ts`
Expected: FAIL — `applyScrapedProfileHandler` is not exported from `./users`.

- [ ] **Step 3: Implement the handler + internal mutation**

In `convex/users.ts`:

1. Update imports. Change the server import line to add `internalMutation`:

```ts
import { internalMutation, internalQuery, mutation, query } from './_generated/server'
```

2. Add the pure handler + its narrow db type (place after the `toSafeMe` function):

```ts
/** Narrow db surface for applyScrapedProfileHandler — only needs get + patch. */
interface ScrapedProfileDb {
  get(id: string): Promise<{ country?: string } | null>
  patch(id: string, fields: Record<string, unknown>): Promise<void>
}

export interface ApplyScrapedProfileArgs {
  userId: string
  country?: string
  location?: string
  primaryLocale?: string
}

/**
 * Applies scraped profile fields. `country` is filled ONLY when the user has none
 * (protects manual edits); `location` + `primaryLocale` always refresh when provided.
 */
export async function applyScrapedProfileHandler(db: ScrapedProfileDb, args: ApplyScrapedProfileArgs): Promise<void> {
  const existing = await db.get(args.userId)
  const patch: Record<string, unknown> = {}
  if (args.location !== undefined) patch.location = args.location
  if (args.primaryLocale !== undefined) patch.primaryLocale = args.primaryLocale
  if (args.country !== undefined && !existing?.country) patch.country = args.country.toUpperCase()
  if (Object.keys(patch).length > 0) await db.patch(args.userId, patch)
}
```

3. Register the internal mutation (place near the other mutations):

```ts
// Internal: write scraped profile fields. Called by the profile-scrape action.
export const applyScrapedProfile = internalMutation({
  args: {
    userId: v.id('users'),
    country: v.optional(v.string()),
    location: v.optional(v.string()),
    primaryLocale: v.optional(v.string())
  },
  handler: async (ctx, args) =>
    applyScrapedProfileHandler(ctx.db as unknown as ScrapedProfileDb, args as ApplyScrapedProfileArgs)
})
```

- [ ] **Step 4: Run the test — expect pass**

Run: `npx vitest run convex/users.applyScrapedProfile.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Checkpoint (user commits)**

```bash
git add convex/users.ts convex/users.applyScrapedProfile.test.ts
```

Pause for review/commit (suggested: `feat(users): applyScrapedProfile mutation (fill-when-empty country)`).

---

## Task 6: Profile-scrape parser + action

**Files:**

- Create: `convex/jobs/scrapeProfileApify.ts`
- Create: `convex/jobs/scrapeProfileApify.test.ts`

- [ ] **Step 1: Write the failing test (the pure parser)**

Create `convex/jobs/scrapeProfileApify.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { parseProfileScrapeResult } from './scrapeProfileApify'

const SAMPLE = [
  {
    publicIdentifier: 'henriko202',
    location: {
      linkedinText: 'Curitiba, Paraná, Brazil',
      countryCode: 'BR'
    },
    primaryLocale: { country: 'US', language: 'en' }
  }
]

describe('parseProfileScrapeResult', () => {
  it('maps countryCode → country, linkedinText → location, primaryLocale.language → primaryLocale', () => {
    expect(parseProfileScrapeResult(SAMPLE)).toEqual({
      country: 'BR',
      location: 'Curitiba, Paraná, Brazil',
      primaryLocale: 'en'
    })
  })

  it('returns only the fields present', () => {
    expect(parseProfileScrapeResult([{ location: { countryCode: 'br' } }])).toEqual({ country: 'BR' })
    expect(parseProfileScrapeResult([{ primaryLocale: { language: 'pt' } }])).toEqual({ primaryLocale: 'pt' })
  })

  it('returns {} for empty / non-array / missing fields', () => {
    expect(parseProfileScrapeResult([])).toEqual({})
    expect(parseProfileScrapeResult(undefined)).toEqual({})
    expect(parseProfileScrapeResult([{}])).toEqual({})
  })
})
```

- [ ] **Step 2: Run it — expect failure**

Run: `npx vitest run convex/jobs/scrapeProfileApify.test.ts`
Expected: FAIL — `Cannot find module './scrapeProfileApify'`.

- [ ] **Step 3: Create the action file (parser + action)**

Create `convex/jobs/scrapeProfileApify.ts`:

```ts
// LinkedIn profile scrape via a dedicated Apify actor (APIFY_TASK_ID_PROFILE_SCRAPE).
// Populates users.country (fill-when-empty), users.location + users.primaryLocale (refresh).
import { internalActionGeneric as internalAction } from 'convex/server'
import { v } from 'convex/values'
import { internal } from '../_generated/api.js'
import type { ActionCtx } from '../convexTypes.js'
import { runApifyTask, isApifyProfileScrapeEnabled } from '../lib/apify.js'

// Only the fields we read from the (much larger) profile-scraper payload.
interface ApifyProfileResult {
  location?: { linkedinText?: string; countryCode?: string }
  primaryLocale?: { country?: string; language?: string }
}

export interface ParsedProfile {
  country?: string
  location?: string
  primaryLocale?: string
}

/** Pure: extract the three fields we care about from the actor's dataset items. */
export function parseProfileScrapeResult(items: unknown): ParsedProfile {
  const first = Array.isArray(items) ? (items[0] as ApifyProfileResult | undefined) : undefined
  if (!first) return {}
  const out: ParsedProfile = {}
  const countryCode = first.location?.countryCode
  if (typeof countryCode === 'string' && countryCode.length > 0) out.country = countryCode.toUpperCase()
  const locText = first.location?.linkedinText
  if (typeof locText === 'string' && locText.length > 0) out.location = locText
  const lang = first.primaryLocale?.language
  if (typeof lang === 'string' && lang.length > 0) out.primaryLocale = lang
  return out
}

export const scrapeUserProfile = internalAction({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }: { userId: string }) => {
    const actionCtx = ctx as unknown as ActionCtx
    const token = process.env.APIFY_API_TOKEN
    const actorId = process.env.APIFY_TASK_ID_PROFILE_SCRAPE
    if (!token || !actorId) {
      console.error('APIFY_API_TOKEN or APIFY_TASK_ID_PROFILE_SCRAPE not configured')
      return
    }

    const settings = (await actionCtx.runQuery(internal.admin.getSettingsInternal, {})) as Record<
      string,
      unknown
    > | null
    if (!isApifyProfileScrapeEnabled(settings)) {
      console.log('[Apify] Profile scrape disabled — skipping')
      return
    }

    const user = (await actionCtx.runQuery(internal.users.getWithTokens, { userId })) as Record<string, unknown> | null
    if (!user?.linkedinPublicIdentifier) {
      console.warn(`User ${userId} has no linkedinPublicIdentifier — skipping profile scrape`)
      return
    }

    const items = await runApifyTask(actorId, token, {
      profileScraperMode: 'Profile details no email ($4 per 1k)',
      queries: [user.linkedinPublicIdentifier as string]
    })

    const parsed = parseProfileScrapeResult(items)
    if (parsed.country === undefined && parsed.location === undefined && parsed.primaryLocale === undefined) {
      console.log(`[Apify] No profile fields parsed for user ${userId}`)
      return
    }

    await actionCtx.runMutation(internal.users.applyScrapedProfile, { userId, ...parsed })
  }
})
```

- [ ] **Step 4: Run the test — expect pass**

Run: `npx vitest run convex/jobs/scrapeProfileApify.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Verify Convex codegen picks up the new action**

Run: `npx convex codegen && npx tsc -p convex --noEmit`
Expected: no errors; `internal.jobs.scrapeProfileApify.scrapeUserProfile` now exists in `_generated/api`.

- [ ] **Step 6: Checkpoint (user commits)**

```bash
git add convex/jobs/scrapeProfileApify.ts convex/jobs/scrapeProfileApify.test.ts convex/_generated
```

Pause for review/commit (suggested: `feat(apify): LinkedIn profile scrape action + parser`).

---

## Task 7: Trigger the scrape on `setPublicIdentifier`

**Files:**

- Modify: `convex/users.ts` (`setPublicIdentifier`)

- [ ] **Step 1: Schedule the scrape after saving the identifier**

In `convex/users.ts`, in the `setPublicIdentifier` mutation handler, change the final line so that after patching the identifier it schedules the scrape (`internal` is already imported in this file):

```ts
// Store lowercase for consistent comparison (LinkedIn vanityNames are case-insensitive)
await ctx.db.patch(user._id, { linkedinPublicIdentifier: trimmed })
// Kick off a profile scrape now that we have the identifier (non-blocking; the action
// itself bails if the profile-scrape flag is off).
await ctx.scheduler.runAfter(0, internal.jobs.scrapeProfileApify.scrapeUserProfile, { userId: user._id })
```

- [ ] **Step 2: Verify it typechecks**

Run: `npx tsc -p convex --noEmit`
Expected: no errors (the scheduled ref resolves against `_generated/api`).

- [ ] **Step 3: Manual verification (no unit test — scheduler wiring)**

With `npx convex dev` running and `apifyProfileScrapeEnabled` on (Task 9 ships the toggle; until then set it in the dashboard), save a LinkedIn URL in Settings and confirm a `[Apify]` profile-scrape log appears and `location`/`primaryLocale` populate on the user. (Defer this to the end-to-end pass in Task 13 if the toggle isn't built yet.)

- [ ] **Step 4: Checkpoint (user commits)**

```bash
git add convex/users.ts
```

Pause for review/commit (suggested: `feat(users): schedule profile scrape on setPublicIdentifier`).

---

## Task 8: `updateProfile` + `refreshProfileFromLinkedIn`

**Files:**

- Modify: `convex/users.ts`
- Create: `convex/users.updateProfile.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `convex/users.updateProfile.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { updateProfileHandler, assertCanRefresh } from './users'

function createMockDb() {
  const patches: any[] = []
  return {
    patch: async (id: string, data: any) => {
      patches.push({ id, data })
    },
    _patches: patches
  }
}

describe('updateProfileHandler', () => {
  it('patches valid industry + country (country uppercased)', async () => {
    const db = createMockDb()
    await updateProfileHandler(db as any, 'u1', { industry: '41', country: 'br' })
    expect(db._patches[0].data).toEqual({ industry: '41', country: 'BR' })
  })

  it('rejects an unknown industry code', async () => {
    const db = createMockDb()
    await expect(updateProfileHandler(db as any, 'u1', { industry: 'nope' })).rejects.toThrow(/industry/i)
    expect(db._patches).toHaveLength(0)
  })

  it('rejects an unknown country code', async () => {
    const db = createMockDb()
    await expect(updateProfileHandler(db as any, 'u1', { country: 'ZZ' })).rejects.toThrow(/country/i)
  })

  it('clears a field when passed an empty string', async () => {
    const db = createMockDb()
    await updateProfileHandler(db as any, 'u1', { industry: '' })
    expect('industry' in db._patches[0].data).toBe(true)
    expect(db._patches[0].data.industry).toBeUndefined()
  })
})

describe('assertCanRefresh', () => {
  it('throws without a public identifier', () => {
    expect(() => assertCanRefresh({}, { apifyProfileScrapeEnabled: true })).toThrow(/LinkedIn profile URL/i)
  })
  it('throws when profile scrape is disabled', () => {
    expect(() => assertCanRefresh({ linkedinPublicIdentifier: 'x' }, {})).toThrow(/unavailable/i)
  })
  it('passes when identifier present and scrape enabled', () => {
    expect(() => assertCanRefresh({ linkedinPublicIdentifier: 'x' }, { apifyProfileScrapeEnabled: true })).not.toThrow()
  })
})
```

- [ ] **Step 2: Run it — expect failure**

Run: `npx vitest run convex/users.updateProfile.test.ts`
Expected: FAIL — `updateProfileHandler` / `assertCanRefresh` not exported.

- [ ] **Step 3: Implement handler, guard, and the two mutations**

In `convex/users.ts`:

1. Add imports (top of file):

```ts
import { isValidCountry, isValidIndustry } from './lib/profileOptions'
import { isApifyProfileScrapeEnabled, type ApifyFlags } from './lib/apify'
import { checkRateLimit } from './lib/rateLimit'
```

2. Add the pure handler + guard (after `applyScrapedProfileHandler`):

```ts
interface PatchOnlyDb {
  patch(id: string, fields: Record<string, unknown>): Promise<void>
}

export interface UpdateProfileArgs {
  industry?: string
  country?: string
}

/** Validates + patches ONLY industry/country. Empty string clears the field. */
export async function updateProfileHandler(db: PatchOnlyDb, userId: string, args: UpdateProfileArgs): Promise<void> {
  const patch: Record<string, unknown> = {}
  if (args.industry !== undefined) {
    if (args.industry !== '' && !isValidIndustry(args.industry)) throw new Error('Invalid industry')
    patch.industry = args.industry === '' ? undefined : args.industry
  }
  if (args.country !== undefined) {
    const normalized = args.country.toUpperCase()
    if (args.country !== '' && !isValidCountry(normalized)) throw new Error('Invalid country')
    patch.country = args.country === '' ? undefined : normalized
  }
  if (Object.keys(patch).length > 0) await db.patch(userId, patch)
}

/** Guard for the refresh mutation. Throws a user-facing message; never leaks the flag. */
export function assertCanRefresh(user: { linkedinPublicIdentifier?: string }, settings: ApifyFlags): void {
  if (!user.linkedinPublicIdentifier) throw new Error('Set your LinkedIn profile URL first.')
  if (!isApifyProfileScrapeEnabled(settings)) throw new Error('Profile refresh is currently unavailable.')
}
```

3. Register the two public mutations (near the other mutations):

```ts
// Public: user edits their own industry/country (canonical values only).
export const updateProfile = mutation({
  args: {
    sessionToken: v.string(),
    industry: v.optional(v.string()),
    country: v.optional(v.string())
  },
  handler: async (ctx, { sessionToken, industry, country }) => {
    const user = await requireAuth(ctx, sessionToken)
    await updateProfileHandler(
      ctx.db as unknown as { patch: (id: string, f: Record<string, unknown>) => Promise<void> },
      user._id,
      {
        industry,
        country
      }
    )
  }
})

// Public: user-triggered re-scrape of their LinkedIn profile (rate-limited to 2/day).
export const refreshProfileFromLinkedIn = mutation({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    const user = await requireAuth(ctx, sessionToken)
    const settings = await ctx.db.query('appSettings').first()
    assertCanRefresh(user, settings as ApifyFlags)
    await checkRateLimit(ctx, user._id, 'profile_refresh', 2, 24 * 60 * 60 * 1000, 'day')
    await ctx.scheduler.runAfter(0, internal.jobs.scrapeProfileApify.scrapeUserProfile, { userId: user._id })
  }
})
```

- [ ] **Step 4: Run the test — expect pass**

Run: `npx vitest run convex/users.updateProfile.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Typecheck**

Run: `npx convex codegen && npx tsc -p convex --noEmit`
Expected: no errors.

- [ ] **Step 6: Checkpoint (user commits)**

```bash
git add convex/users.ts convex/users.updateProfile.test.ts convex/_generated
```

Pause for review/commit (suggested: `feat(users): updateProfile + refreshProfileFromLinkedIn`).

---

## Task 9: Admin flags — defaults + toggle mutations

**Files:**

- Modify: `convex/admin.ts`

- [ ] **Step 1: Include the new flags in the `getSettings` default object**

In `convex/admin.ts`, in the `getSettings` query, change the fallback object to:

```ts
return (
  settings ?? {
    apifySyncEnabled: false,
    apifyEnabled: true,
    apifyProfileScrapeEnabled: false,
    lastApifySyncAt: undefined,
    lastApifySyncError: undefined
  }
)
```

- [ ] **Step 2: Add the two toggle mutations**

In `convex/admin.ts`, after `toggleApifySync`, add:

```ts
export const toggleApifyEnabled = mutation({
  args: { sessionToken: v.string(), enabled: v.boolean() },
  handler: async (ctx, { sessionToken, enabled }) => {
    const user = await requireAuth(ctx, sessionToken)
    assertAdmin(user)
    const settings = await getOrCreateSettings(ctx.db)
    await ctx.db.patch(settings._id, { apifyEnabled: enabled })
  }
})

export const toggleApifyProfileScrape = mutation({
  args: { sessionToken: v.string(), enabled: v.boolean() },
  handler: async (ctx, { sessionToken, enabled }) => {
    const user = await requireAuth(ctx, sessionToken)
    assertAdmin(user)
    const settings = await getOrCreateSettings(ctx.db)
    await ctx.db.patch(settings._id, { apifyProfileScrapeEnabled: enabled })
  }
})
```

- [ ] **Step 3: Verify codegen + typecheck**

Run: `npx convex codegen && npx tsc -p convex --noEmit`
Expected: no errors; `api.admin.toggleApifyEnabled` and `api.admin.toggleApifyProfileScrape` exist.

- [ ] **Step 4: Checkpoint (user commits)**

```bash
git add convex/admin.ts convex/_generated
```

Pause for review/commit (suggested: `feat(admin): master + profile-scrape apify toggles`).

---

## Task 10: i18n keys for the new Settings UI

**Files:**

- Modify: `app/src/i18n/locales/en.json`
- Modify: `app/src/i18n/locales/pt.json`
- Modify: `app/src/i18n/locales/es.json`

- [ ] **Step 1: Replace the `settings` block in `en.json`**

In `app/src/i18n/locales/en.json`, replace the entire `"settings": { ... }` object (lines 27-38) with:

```json
  "settings": {
    "title": "Settings",
    "profile": "Your Profile",
    "industry": "Industry",
    "country": "Country",
    "location": "Location",
    "notSet": "Not set",
    "selectPlaceholder": "Select…",
    "save": "Save",
    "saving": "Saving…",
    "saved": "Saved ✓",
    "refresh": "Refresh from LinkedIn",
    "refreshing": "Refreshing…",
    "profileNote": "Edit your industry and country below. Location is synced from LinkedIn.",
    "visibility": "Who can see your posts",
    "visibilityNote": "Restrict which industries and countries can see your posts in the feed. Leave empty to show to all users.",
    "visibilityComingSoon": "Coming in next task",
    "upgradePrompt": "Upgrade to Pro to control who sees your posts."
  },
```

- [ ] **Step 2: Replace the `settings` block in `pt.json`**

Find the `"settings": { ... }` object in `app/src/i18n/locales/pt.json` and replace it with (keep the existing non-settings keys untouched):

```json
  "settings": {
    "title": "Configurações",
    "profile": "Seu Perfil",
    "industry": "Setor",
    "country": "País",
    "location": "Localização",
    "notSet": "Não definido",
    "selectPlaceholder": "Selecione…",
    "save": "Salvar",
    "saving": "Salvando…",
    "saved": "Salvo ✓",
    "refresh": "Atualizar do LinkedIn",
    "refreshing": "Atualizando…",
    "profileNote": "Edite seu setor e país abaixo. A localização é sincronizada do LinkedIn.",
    "visibility": "Quem pode ver suas publicações",
    "visibilityNote": "Restrinja quais setores e países podem ver suas publicações no feed. Deixe vazio para mostrar a todos.",
    "visibilityComingSoon": "Em breve",
    "upgradePrompt": "Faça upgrade para o Pro para controlar quem vê suas publicações."
  },
```

- [ ] **Step 3: Replace the `settings` block in `es.json`**

Find the `"settings": { ... }` object in `app/src/i18n/locales/es.json` and replace it with:

```json
  "settings": {
    "title": "Configuración",
    "profile": "Tu Perfil",
    "industry": "Sector",
    "country": "País",
    "location": "Ubicación",
    "notSet": "No definido",
    "selectPlaceholder": "Selecciona…",
    "save": "Guardar",
    "saving": "Guardando…",
    "saved": "Guardado ✓",
    "refresh": "Actualizar desde LinkedIn",
    "refreshing": "Actualizando…",
    "profileNote": "Edita tu sector y país abajo. La ubicación se sincroniza desde LinkedIn.",
    "visibility": "Quién puede ver tus publicaciones",
    "visibilityNote": "Restringe qué sectores y países pueden ver tus publicaciones en el feed. Déjalo vacío para mostrar a todos.",
    "visibilityComingSoon": "Próximamente",
    "upgradePrompt": "Mejora a Pro para controlar quién ve tus publicaciones."
  },
```

- [ ] **Step 4: Verify the i18n suite still passes (valid JSON + keys load)**

Run: `npx vitest run app/src/i18n/i18n.test.ts`
Expected: PASS (existing tests; JSON parses).

- [ ] **Step 5: Checkpoint (user commits)**

```bash
git add app/src/i18n/locales/en.json app/src/i18n/locales/pt.json app/src/i18n/locales/es.json
```

Pause for review/commit (suggested: `feat(i18n): settings profile-edit + location/refresh keys`).

---

## Task 11: Settings page — editable dropdowns, location row, refresh button

**Files:**

- Modify: `app/src/pages/SettingsPage.tsx`
- Create: `app/src/pages/SettingsPage.test.tsx`

- [ ] **Step 1: Write the failing component test**

Create `app/src/pages/SettingsPage.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

const me = {
  _id: 'u1',
  linkedinId: 'li1',
  name: 'Henriko',
  industry: '41',
  country: 'BR',
  location: 'Curitiba, Paraná, Brazil',
  primaryLocale: 'en',
  linkedinPublicIdentifier: 'henriko202',
  tier: 'starter',
  subscriptionStatus: 'trialing',
  createdAt: 0
}

vi.mock('convex/react', () => ({
  useQuery: vi.fn(() => me),
  useMutation: vi.fn(() => vi.fn())
}))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'en' } })
}))

import SettingsPage from './SettingsPage'

describe('SettingsPage profile editing', () => {
  it('renders industry + country dropdowns', () => {
    render(<SettingsPage />)
    expect(screen.getByLabelText('settings.industry')).toBeInTheDocument()
    expect(screen.getByLabelText('settings.country')).toBeInTheDocument()
  })

  it('shows the scraped location when present', () => {
    render(<SettingsPage />)
    expect(screen.getByText('Curitiba, Paraná, Brazil')).toBeInTheDocument()
  })

  it('renders the Refresh from LinkedIn button', () => {
    render(<SettingsPage />)
    expect(screen.getByRole('button', { name: 'settings.refresh' })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run it — expect failure**

Run: `npx vitest run app/src/pages/SettingsPage.test.tsx`
Expected: FAIL — no dropdowns / location text / refresh button yet.

- [ ] **Step 3: Update `SettingsPage.tsx`**

Edit `app/src/pages/SettingsPage.tsx`:

1. Extend imports and the `MeProfile` interface:

```ts
import { useState, useEffect } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { useTranslation } from 'react-i18next'
import { api } from '../convex'
import LoadingSpinner from '../components/LoadingSpinner'
import { COUNTRY_CODES, INDUSTRIES, countryLabel } from '../../../convex/lib/profileOptions'
```

In `MeProfile`, add the two fields after `country?: string`:

```ts
  location?: string
  primaryLocale?: string
```

2. Add mutation hooks + local state inside the component (after the existing `setPublicIdentifier` hook + state):

```ts
const updateProfile = useMutation(api.users.updateProfile)
const refreshProfile = useMutation(api.users.refreshProfileFromLinkedIn)

const [industry, setIndustry] = useState<string>('')
const [country, setCountry] = useState<string>('')
const [profileSaving, setProfileSaving] = useState(false)
const [profileSaved, setProfileSaved] = useState(false)
const [refreshing, setRefreshing] = useState(false)
const [refreshError, setRefreshError] = useState<string | null>(null)
```

Also change the existing `const { t } = useTranslation()` to `const { t, i18n } = useTranslation()`.

3. Seed the local select state **once when the user loads** (keyed on `me?._id`, so reactive updates to other fields — e.g. `location` after a scrape — don't clobber in-progress edits, and selecting "Not set" sticks). Add this `useEffect` among the hooks, **before** the `if (!me) { return <LoadingSpinner /> }` guard:

```ts
useEffect(() => {
  if (me) {
    setIndustry(me.industry ?? '')
    setCountry(me.country ?? '')
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [me?._id])
```

4. After the `if (!me)` guard, build the localized + sorted country options:

```ts
const lang = i18n.language?.split('-')[0] ?? 'en'
const countryOptions = COUNTRY_CODES.map(code => ({ code, name: countryLabel(code, lang) })).sort((a, b) =>
  a.name.localeCompare(b.name)
)
```

5. Add the save + refresh handlers (next to `handleSaveIdentifier`):

```ts
async function handleSaveProfile() {
  if (!sessionToken) return
  setProfileSaving(true)
  try {
    await updateProfile({ sessionToken, industry, country })
    setProfileSaved(true)
    setTimeout(() => setProfileSaved(false), 3000)
  } finally {
    setProfileSaving(false)
  }
}

async function handleRefresh() {
  if (!sessionToken) return
  setRefreshing(true)
  setRefreshError(null)
  try {
    await refreshProfile({ sessionToken })
  } catch (err) {
    setRefreshError(err instanceof Error ? err.message : 'Refresh failed')
  } finally {
    setRefreshing(false)
  }
}
```

6. Replace the existing read-only profile `<section>` (the one rendering `settings.industry`/`settings.country` as `<p>`) with the editable version:

```tsx
<section className="mb-4 rounded-xl border border-slate-200 bg-white p-5">
  <h2 className="mb-3 mt-0 text-base font-semibold text-slate-900">{t('settings.profile')}</h2>

  <label
    htmlFor="industry-select"
    className="mb-1 block text-sm font-medium text-slate-700"
  >
    {t('settings.industry')}
  </label>
  <select
    id="industry-select"
    aria-label={t('settings.industry')}
    value={industry}
    onChange={e => setIndustry(e.target.value)}
    className="mb-3 w-full rounded-md border border-slate-300 px-[10px] py-[7px] text-[13px] outline-none"
  >
    <option value="">{t('settings.notSet')}</option>
    {INDUSTRIES.map(i => (
      <option
        key={i.code}
        value={i.code}
      >
        {i.label}
      </option>
    ))}
  </select>

  <label
    htmlFor="country-select"
    className="mb-1 block text-sm font-medium text-slate-700"
  >
    {t('settings.country')}
  </label>
  <select
    id="country-select"
    aria-label={t('settings.country')}
    value={country}
    onChange={e => setCountry(e.target.value)}
    className="mb-3 w-full rounded-md border border-slate-300 px-[10px] py-[7px] text-[13px] outline-none"
  >
    <option value="">{t('settings.notSet')}</option>
    {countryOptions.map(c => (
      <option
        key={c.code}
        value={c.code}
      >
        {c.name}
      </option>
    ))}
  </select>

  {me.location && (
    <p className="my-1 text-sm text-slate-500">
      {t('settings.location')}: <span className="text-slate-700">{me.location}</span>
    </p>
  )}

  <div className="mt-3 flex items-center gap-2">
    <button
      onClick={handleSaveProfile}
      disabled={profileSaving}
      className={`rounded-md border-none px-4 py-[7px] text-[13px] text-white transition-colors duration-200 ${profileSaved ? 'bg-green-500' : 'bg-blue-500'} ${profileSaving ? 'cursor-not-allowed opacity-60' : 'cursor-pointer opacity-100'}`}
    >
      {profileSaved ? t('settings.saved') : profileSaving ? t('settings.saving') : t('settings.save')}
    </button>
    <button
      onClick={handleRefresh}
      disabled={refreshing || !me.linkedinPublicIdentifier}
      className={`rounded-md border border-slate-300 bg-white px-4 py-[7px] text-[13px] text-slate-700 ${refreshing || !me.linkedinPublicIdentifier ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
    >
      {refreshing ? t('settings.refreshing') : t('settings.refresh')}
    </button>
  </div>
  {refreshError && <p className="mb-0 mt-2 text-xs text-red-500">{refreshError}</p>}
  <p className="mb-0 mt-2 text-xs text-slate-400">{t('settings.profileNote')}</p>
</section>
```

- [ ] **Step 4: Run the test — expect pass**

Run: `npx vitest run app/src/pages/SettingsPage.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Typecheck the app**

Run: `npx tsc -p app --noEmit` (or the repo's app typecheck script, e.g. `npm run -w app build` dry-run)
Expected: no errors. The cross-package import `../../../convex/lib/profileOptions` resolves because the module is pure data (no server imports).

- [ ] **Step 6: Checkpoint (user commits)**

```bash
git add app/src/pages/SettingsPage.tsx app/src/pages/SettingsPage.test.tsx
```

Pause for review/commit (suggested: `feat(settings): editable industry/country + location + refresh`).

---

## Task 12: Seed the UI language from `primaryLocale`

**Files:**

- Create: `app/src/i18n/seedLanguage.ts`
- Create: `app/src/i18n/seedLanguage.test.ts`
- Modify: `app/src/App.tsx`

- [ ] **Step 1: Write the failing test (pure picker)**

Create `app/src/i18n/seedLanguage.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { pickSeedLanguage } from './seedLanguage'

const SUPPORTED = ['en', 'pt', 'es'] as const

describe('pickSeedLanguage', () => {
  it('returns the mapped language when supported and no stored preference', () => {
    expect(pickSeedLanguage('pt', SUPPORTED, false)).toBe('pt')
    expect(pickSeedLanguage('en-US', SUPPORTED, false)).toBe('en')
    expect(pickSeedLanguage('es_ES', SUPPORTED, false)).toBe('es')
  })

  it('returns null when the user already has a stored preference', () => {
    expect(pickSeedLanguage('pt', SUPPORTED, true)).toBeNull()
  })

  it('returns null for unsupported or missing locales', () => {
    expect(pickSeedLanguage('fr', SUPPORTED, false)).toBeNull()
    expect(pickSeedLanguage(undefined, SUPPORTED, false)).toBeNull()
    expect(pickSeedLanguage('', SUPPORTED, false)).toBeNull()
  })
})
```

- [ ] **Step 2: Run it — expect failure**

Run: `npx vitest run app/src/i18n/seedLanguage.test.ts`
Expected: FAIL — `Cannot find module './seedLanguage'`.

- [ ] **Step 3: Create the picker**

Create `app/src/i18n/seedLanguage.ts`:

```ts
/**
 * Decide which UI language to seed from a scraped LinkedIn primaryLocale.
 * Returns null when the user already chose a language (stored pref) or when the
 * locale is missing/unsupported — so the existing AppNav switcher always wins.
 */
export function pickSeedLanguage(
  primaryLocale: string | undefined,
  supported: readonly string[],
  hasStoredPref: boolean
): string | null {
  if (hasStoredPref) return null
  if (!primaryLocale) return null
  const lang = primaryLocale.split(/[-_]/)[0].toLowerCase()
  return supported.includes(lang) ? lang : null
}
```

- [ ] **Step 4: Run the test — expect pass**

Run: `npx vitest run app/src/i18n/seedLanguage.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Wire it into `RequireAuth` in `App.tsx`**

In `app/src/App.tsx`:

1. Add imports:

```ts
import i18n from './i18n'
import { pickSeedLanguage } from './i18n/seedLanguage'
```

2. Inside `RequireAuth`, add an effect after the existing `useEffect` that handles `me === null`:

```ts
useEffect(() => {
  if (me && !me.isBanned) {
    const hasStoredPref = localStorage.getItem('i18nextLng') !== null
    const seed = pickSeedLanguage(me.primaryLocale, ['en', 'pt', 'es'], hasStoredPref)
    if (seed) void i18n.changeLanguage(seed)
  }
}, [me])
```

(`me.primaryLocale` is present on the `getMe` payload because `toSafeMe` spreads all non-token fields.)

- [ ] **Step 6: Verify app tests + typecheck**

Run: `npx vitest run app/src/i18n/seedLanguage.test.ts && npx tsc -p app --noEmit`
Expected: tests PASS, no type errors.

- [ ] **Step 7: Checkpoint (user commits)**

```bash
git add app/src/i18n/seedLanguage.ts app/src/i18n/seedLanguage.test.ts app/src/App.tsx
```

Pause for review/commit (suggested: `feat(i18n): seed UI language from scraped primaryLocale`).

---

## Task 13: Admin UI — master + profile-scrape toggles

**Files:**

- Modify: `app/src/pages/AdminPage.tsx`
- Modify: `app/src/pages/AdminPage.test.tsx`

- [ ] **Step 1: Extend the failing test**

In `app/src/pages/AdminPage.test.tsx`, add inside `describe('AdminPage tabs', ...)`:

```tsx
it('renders the master and profile-scrape Apify toggles', () => {
  render(<AdminPage />)
  expect(screen.getByText(/apify \(master\)/i)).toBeInTheDocument()
  expect(screen.getByText(/profile scrape/i)).toBeInTheDocument()
})
```

(The existing `useQuery` mock returns `undefined` for `getSettings`, which is fine — the cards still render with default labels.)

- [ ] **Step 2: Run it — expect failure**

Run: `npx vitest run app/src/pages/AdminPage.test.tsx`
Expected: FAIL — the new toggle cards don't exist yet.

- [ ] **Step 3: Add the toggles to `AdminPage.tsx`**

In `app/src/pages/AdminPage.tsx`:

1. Add the two mutation hooks (after `const toggleSync = useMutation(api.admin.toggleApifySync)`):

```ts
const toggleMaster = useMutation(api.admin.toggleApifyEnabled)
const toggleProfileScrape = useMutation(api.admin.toggleApifyProfileScrape)
const [togglingMaster, setTogglingMaster] = useState(false)
const [togglingProfile, setTogglingProfile] = useState(false)
```

2. Add two handlers (after `handleToggle`):

```ts
async function handleToggleMaster() {
  if (!sessionToken || !settings) return
  setTogglingMaster(true)
  try {
    await toggleMaster({ sessionToken, enabled: settings.apifyEnabled === false })
  } finally {
    setTogglingMaster(false)
  }
}

async function handleToggleProfile() {
  if (!sessionToken || !settings) return
  setTogglingProfile(true)
  try {
    await toggleProfileScrape({ sessionToken, enabled: !settings.apifyProfileScrapeEnabled })
  } finally {
    setTogglingProfile(false)
  }
}
```

3. Inside the `{tab === 'settings' && (...)}` block, add two more cards after the existing "Apify Post Sync" card (compute `masterOn = settings?.apifyEnabled !== false`):

```tsx
          <div className="mb-4 rounded-lg border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="m-0 text-base font-semibold text-slate-900">Apify (master)</h2>
                <p className="mt-1 text-[13px] text-slate-500">
                  Global kill-switch. Turns off ALL Apify integration (post sync and profile scrape).
                </p>
              </div>
              <button
                onClick={handleToggleMaster}
                disabled={togglingMaster || !settings}
                className={`rounded-md border-none px-5 py-2 text-[13px] font-semibold text-white ${togglingMaster ? 'cursor-wait' : 'cursor-pointer'} ${settings?.apifyEnabled !== false ? 'bg-red-500' : 'bg-green-500'}`}
              >
                {togglingMaster ? '…' : settings?.apifyEnabled !== false ? 'Disable' : 'Enable'}
              </button>
            </div>
          </div>

          <div className="mb-4 rounded-lg border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="m-0 text-base font-semibold text-slate-900">Apify Profile Scrape</h2>
                <p className="mt-1 text-[13px] text-slate-500">
                  Scrapes profile country/location/locale when a user sets or refreshes their LinkedIn URL.
                </p>
              </div>
              <button
                onClick={handleToggleProfile}
                disabled={togglingProfile || !settings}
                className={`rounded-md border-none px-5 py-2 text-[13px] font-semibold text-white ${togglingProfile ? 'cursor-wait' : 'cursor-pointer'} ${settings?.apifyProfileScrapeEnabled ? 'bg-red-500' : 'bg-green-500'}`}
              >
                {togglingProfile ? '…' : settings?.apifyProfileScrapeEnabled ? 'Disable' : 'Enable'}
              </button>
            </div>
          </div>
```

- [ ] **Step 4: Run the test — expect pass**

Run: `npx vitest run app/src/pages/AdminPage.test.tsx`
Expected: PASS (existing tests + the new one).

- [ ] **Step 5: Typecheck**

Run: `npx tsc -p app --noEmit`
Expected: no errors.

- [ ] **Step 6: Checkpoint (user commits)**

```bash
git add app/src/pages/AdminPage.tsx app/src/pages/AdminPage.test.tsx
```

Pause for review/commit (suggested: `feat(admin-ui): master + profile-scrape toggles`).

---

## Task 14: Update `docs/PLATFORM.md` (canonical docs — required by CLAUDE.md)

**Files:**

- Modify: `docs/PLATFORM.md`

> `CLAUDE.md` makes `docs/PLATFORM.md` part of "done": the feature is not complete until the docs reflect it. Apply every edit below in this one task. No automated test — verification is a grep check (Step 9) + a Mermaid sanity read.

- [ ] **Step 1: §5 Data Model**
  - In the **`users`** table reference, add two rows after `country`:
    - `location` | string | – | Scraped LinkedIn display location (e.g. "Curitiba, Paraná, Brazil"). Read-only (profile scrape only).
    - `primaryLocale` | string | – | Scraped LinkedIn primary-locale **language** (e.g. "en"). Seeds the UI i18n language; not user-editable.
  - In the **`appSettings`** table reference, add two rows after `apifySyncEnabled`:
    - `apifyEnabled` | boolean | – | **Master Apify kill-switch.** Absent ⇒ treated as enabled. When `false`, all Apify (post sync + profile scrape) halts.
    - `apifyProfileScrapeEnabled` | boolean | – | Gates the LinkedIn profile scrape. Absent ⇒ disabled (opt-in; paid actor).
  - In the **`rateLimits`** table, update the `action` row to add `profile_refresh` to the example action names.

- [ ] **Step 2: §7 Authentication & Identity — identity functions table**

  Add three rows:
  - `users.updateProfile` | mutation (public) | User edits their own `industry`/`country` (validated against canonical lists; empty string clears).
  - `users.refreshProfileFromLinkedIn` | mutation (public) | User-triggered profile re-scrape; requires a public identifier; **throws when the profile-scrape flag is off**; rate-limited **2/day**; schedules the scrape action.
  - `users.applyScrapedProfile` | internalMutation | Writes scraped fields: `country` **fill-when-empty**; `location`/`primaryLocale` always refresh.

- [ ] **Step 3: §11 Feed & Engagement — rate limiting paragraph**

  Note that `checkRateLimit` now accepts an optional **window size + label** (defaults 1h/"hour"), and add `profile_refresh` **2/day** to the list of limits.

- [ ] **Step 4: §12 Admin & Moderation — admin functions table**
  - Update `getSettings` description to "App settings (3 Apify flags + last-sync status)".
  - Add: `toggleApifyEnabled(enabled)` | mutation | Master Apify kill-switch.
  - Add: `toggleApifyProfileScrape(enabled)` | mutation | Toggle the LinkedIn profile scrape.

- [ ] **Step 5: §14 Frontend — Authenticated App**
  - Rewrite the **SettingsPage** bullet: `getMe` + `setPublicIdentifier` + `updateProfile` + `refreshProfileFromLinkedIn`. Industry/country are now **editable canonical dropdowns** (country names via `Intl.DisplayNames`); a read-only **Location** row shows when `me.location` is present; a **"Refresh from LinkedIn"** button re-scrapes (disabled without a public identifier; surfaces the server error when scrape is off).
  - Update the **AdminPage** bullet: the **Settings** tab now has **three** Apify toggles (master, post sync, profile scrape).
  - In the **i18n** subsection, add: on first authenticated load the UI language is **seeded once** from `me.primaryLocale` (when no `localStorage` `i18nextLng` exists); the AppNav switcher still overrides.

- [ ] **Step 6: §16 Environment Variables**

  Change the `APIFY_TASK_ID_PROFILE_SCRAPE` row to: Required **✓ (profile scrape)**, Consumed in **`jobs/scrapeProfileApify.ts`**, Purpose "LinkedIn **profile** scraper actor (country/location/primary-locale enrichment)."

- [ ] **Step 7: §19 Known Discrepancies, Dead Code & Roadmap**
  - Remove the **"Profile enrichment …"** bullet from **Stubs / planned** (it's now implemented).
  - Update the roadmap line so it no longer lists profile enrichment as pending.

- [ ] **Step 8: Add a new numbered section + ToC entry + Mermaid flow**

  Add a Table-of-Contents entry **`13A. Profile Enrichment (LinkedIn Profile Scrape)`** (right after item 13), and a matching section after §13. (Using "13A" deliberately avoids renumbering §14–§21 and their anchor links.) Content:

  ````markdown
  ## 13A. Profile Enrichment (LinkedIn Profile Scrape)

  A dedicated Apify actor (`APIFY_TASK_ID_PROFILE_SCRAPE`) enriches a user with `country`
  (fill-when-empty), `location`, and `primaryLocale`. Industry is **not** scraped (absent from the
  payload) — it's user-edited in Settings. The scrape is **triggered**, not cron-scheduled:

  - on `users.setPublicIdentifier` (first time we have the vanity name), and
  - on the user-pressed **"Refresh from LinkedIn"** button (`refreshProfileFromLinkedIn`, ≤ 2/day).

  Both schedule the internal action `jobs/scrapeProfileApify.scrapeUserProfile`, which bails unless
  `apifyEnabled && apifyProfileScrapeEnabled` (see the gate helpers in `lib/apify.ts`). It calls the
  Apify actor, parses `location.countryCode` → `country`, `location.linkedinText` → `location`,
  `primaryLocale.language` → `primaryLocale`, and writes via `users.applyScrapedProfile`
  (country only if the user has none; location/locale always refresh). Results propagate to Settings
  via the reactive `getMe`, which also seeds the UI language once.

  ```mermaid
  flowchart TD
    T1["setPublicIdentifier (vanity saved)"] --> SCH["scheduler.runAfter(0)"]
    T2["Settings: Refresh from LinkedIn"] --> RF["refreshProfileFromLinkedIn"]
    RF --> G0{"public identifier set?"}
    G0 -->|no| ERRP["throw: set your LinkedIn URL first"]
    G0 -->|yes| GF{"apifyEnabled && profileScrapeEnabled?"}
    GF -->|no| ERR["throw: refresh unavailable"]
    GF -->|yes| RL{"≤ 2 refreshes today?"}
    RL -->|no| ERRL["throw: rate limit"]
    RL -->|yes| SCH
    SCH --> ACT["scrapeUserProfile (internal action)"]
    ACT --> GATE{"apifyEnabled && profileScrapeEnabled?"}
    GATE -->|no| STOP["return (no-op)"]
    GATE -->|yes| PID{"has linkedinPublicIdentifier?"}
    PID -->|no| STOP
    PID -->|yes| API["Apify run-sync-get-dataset-items (queries=[vanity])"]
    API --> PARSE["parseProfileScrapeResult → {country?, location?, primaryLocale?}"]
    PARSE --> APPLY["applyScrapedProfile: country fill-when-empty; location/locale refresh"]
    APPLY --> REACT["reactive getMe → Settings updates + i18n seed"]
  ```
  ````

  ```

  ```

- [ ] **Step 9: Footer + verification grep**

  Update the _Last updated_ footer line to mention the profile-enrichment feature. Then verify the key tokens are present:

  Run: `npx rg -n "primaryLocale|apifyProfileScrapeEnabled|scrapeProfileApify|refreshProfileFromLinkedIn|13A" docs/PLATFORM.md`
  Expected: matches in §5, §7, §12/§14, §16, and the new §13A.

- [ ] **Step 10: Checkpoint (user commits)**

```bash
git add docs/PLATFORM.md
```

Pause for review/commit (suggested: `docs(platform): profile enrichment subsystem + flags`).

---

## Task 15: Full verification + manual end-to-end

**Files:** none (verification only)

- [ ] **Step 1: Run the entire test suite**

Run: `npx vitest run`
Expected: all tests PASS (new + existing). Investigate any regressions before proceeding.

- [ ] **Step 2: Typecheck both packages**

Run: `npx convex codegen && npx tsc -p convex --noEmit && npx tsc -p app --noEmit`
Expected: no errors.

- [ ] **Step 3: Lint (if the repo lints in CI)**

Run: `npm run lint` (or the repo's lint command)
Expected: clean.

- [ ] **Step 4: Configure the new env var**

Add `APIFY_TASK_ID_PROFILE_SCRAPE` to the Convex deployment env (dashboard / `npx convex env set APIFY_TASK_ID_PROFILE_SCRAPE <task-id>`). `APIFY_API_TOKEN` already exists.

- [ ] **Step 5: Manual end-to-end (`npx convex dev` + `npm run dev`)**

1. As an **admin**, open `/admin` → Settings tab → enable **Apify Profile Scrape** (and confirm **Apify (master)** is on).
2. As a user, open `/settings`, enter your LinkedIn profile URL, Save. Confirm a `[Apify]` profile-scrape log appears and, after the run, **Location** shows and `country`/`primaryLocale` populate (check the dashboard).
3. Edit **Industry** + **Country** dropdowns → Save → reload → values persist.
4. Click **Refresh from LinkedIn** twice → third click within a day surfaces the rate-limit error inline.
5. Toggle **Apify (master)** OFF → Refresh now surfaces "Profile refresh is currently unavailable."; confirm the hourly post sync also no-ops.
6. New login with a fresh browser profile (no `i18nextLng` in localStorage) and a non-English `primaryLocale` → UI seeds to that language; switching via AppNav still overrides.

- [ ] **Step 6: Final checkpoint (user commits)**

Stage any remaining generated files and pause for Henriko's final review/commit.

---

## Self-review notes (for the planner)

- **Spec coverage:** schema (T1), 3-flag gating + shared runner (T2, T9, T13), canonical lists (T3), 2/day rate limit (T4), fill-when-empty apply (T5), parser + action (T6), setPublicIdentifier trigger (T7), updateProfile + refresh + assertCanRefresh (T8), i18n keys (T10), Settings UI incl. location-on-presence + refresh-via-server-throw (T11), language seeding (T12), admin toggles (T13), **PLATFORM.md sync incl. new §13A + Mermaid (T14)**, env var + E2E (T15). All spec sections map to a task.
- **CLAUDE.md compliance:** never commit (every task ends in a stage-and-pause Checkpoint); `docs/PLATFORM.md` updated in-feature (T14); Convex guidelines read before backend work (header note).
- **No client flag read:** confirmed — no `getPublicSettings`; location gates on `me.location`; refresh feedback comes from the mutation throwing (T8/T11).
- **Type consistency:** `applyScrapedProfileHandler`, `updateProfileHandler`, `assertCanRefresh`, `parseProfileScrapeResult`, `pickSeedLanguage`, `isApify*`, `runApifyTask`, `COUNTRY_CODES`/`INDUSTRIES`/`isValidCountry`/`isValidIndustry`/`countryLabel` are named identically where defined and consumed.
- **Known data task:** the industry list (T3) is populated from the cited LinkedIn reference and guarded by a completeness test — not a silent placeholder.
