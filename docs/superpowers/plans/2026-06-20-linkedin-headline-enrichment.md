# LinkedIn Headline Enrichment — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Populate each member's **LinkedIn headline** from two sources — the **dev-only** Apify profile scrape
(fill-when-empty) and a **user-editable field in Settings** (live, always wins) — and surface it as
`headline ?? industry`
in the sidebar user chip and post-author rows, alongside the LinkedIn profile picture that is already captured at login.

**Architecture:** The storage + most of the read path already exist. `users.headline` / `users.profilePictureUrl` are in
the schema; the OAuth callback already captures `picture` into `profilePictureUrl` on every login; `getMe` (via
`toSafeMe`) and `toFeedAuthor` already expose both fields. This plan adds the **writes** (scrape capture with
fill-when-empty precedence + a user-editable Settings field with validation) and finishes the **display** (the sidebar
chip, and an `industry` fallback in `PostCard`).

**Tech Stack:** Convex (internal action/mutation, pure handlers), React 19 + Vite, i18next (en/pt-BR/es), vitest +
@testing-library/react.

**Spec:** `docs/superpowers/specs/2026-06-20-ui-revamp-design.md` §12 (Deferred plan A), expanded per the 2026-06-21
brainstorming session (manual-edit field + dev-only Apify reframing). **Builds on:** the existing scrape pipeline in
`convex/jobs/scrapeProfileApify.ts` and the profile-edit path in `convex/users.ts`.

## Global Constraints

- **Commits:** the agent NEVER runs `git commit` / `git push` (per `CLAUDE.md`). Each task ends with a **Checkpoint
  (Henriko commits)** — stage nothing, just report the task is ready to commit.
- **Convex tooling:** use **pnpm** (never npm); run any `convex` CLI from the **repo root** (running it inside `convex/`
  wipes the deployment). Convex tests: `pnpm --filter convex test <pattern>`. App tests:
  `pnpm --filter app exec vitest run <file>`. App typecheck: `pnpm --filter app exec tsc --noEmit`.
- **Apify is dev/local-testing ONLY** — it is NOT a production sub-processor. Do **NOT** add Apify to any
  compliance/legal
  doc (`docs/compliance/SUBPROCESSORS.md`, `DATA-INVENTORY.md`, privacy policy). The
  `appSettings.apifyProfileScrapeEnabled`
  flag is a **dev/prod switch**, not a compliance gate. Only `docs/PLATFORM.md` (technical documentation) is updated.
- **Headline precedence:** the scrape writes `headline` **fill-when-empty** (only when the user has none) — exactly like
  `country` already works. This protects a manually-entered headline from being clobbered by a later local test scrape.
  The Settings edit always wins.
- **Headline validation:** trim whitespace; **max 220 characters** (LinkedIn's headline limit, named as a constant);
  empty/whitespace-only clears the field to `undefined`.
- **Fallback rule:** the UI shows `headline ?? industry` — never a fabricated value.
- **i18n:** every new user-facing string is keyed in `en.json`, `pt.json` (pt-**BR**: "Setor", "Título"), and `es.json`
  ("Sector", "Titular"). No hardcoded copy in components.
- **Testing convention:** no `convex-test`. Convex logic is unit-tested via plain in-memory db mocks against the
  exported
  pure handlers. React tests use `role`/text queries and do not drive Radix portal/hover open-state in jsdom.

---

### Task 1: Capture `headline` in the dev-only scrape parser

**Files:**

- Modify: `convex/jobs/scrapeProfileApify.ts` (`ApifyProfileResult`, `ParsedProfile`, `parseProfileScrapeResult`, the
  `scrapeUserProfile` no-fields guard, and the file header comment)
- Test: `convex/jobs/scrapeProfileApify.test.ts` (extend)

**Interfaces:**

- Produces: `ParsedProfile.headline?: string` — a non-empty headline string from the Apify dataset item, or absent.

- [ ] **Step 1: Write the failing tests**

Add these two `it(...)` blocks inside the existing `describe('parseProfileScrapeResult', ...)` in
`convex/jobs/scrapeProfileApify.test.ts`:

```ts
  it('extracts a non-empty headline from the dataset item', () => {
    expect(parseProfileScrapeResult([{ headline: 'Senior Product Designer · Fintech' }])).toEqual({
      headline: 'Senior Product Designer · Fintech'
    })
  })

  it('omits headline when blank or absent', () => {
    expect(parseProfileScrapeResult([{ headline: '' }])).toEqual({})
    expect(parseProfileScrapeResult([{ headline: '   ' }])).toEqual({ headline: '   ' })
  })
```

> Note on the second assertion: the parser guards only on `length > 0`, so a whitespace-only string passes through
> unchanged (the *manual* path in Task 3 is what trims). The empty-string case must yield `{}`.

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter convex test scrapeProfileApify`
Expected: FAIL — `parseProfileScrapeResult([{ headline: '...' }])` returns `{}` (headline not yet extracted).

- [ ] **Step 3: Add `headline` to the interfaces**

In `convex/jobs/scrapeProfileApify.ts`, add `headline?: string` to both interfaces:

```ts
interface ApifyProfileResult {
  location?: { linkedinText?: string; countryCode?: string }
  primaryLocale?: { country?: string; language?: string }
  headline?: string
}

export interface ParsedProfile {
  country?: string
  location?: string
  primaryLocale?: string
  headline?: string
}
```

- [ ] **Step 4: Extract the headline in `parseProfileScrapeResult`**

In `parseProfileScrapeResult`, after the `primaryLocale` block and before `return out`, add:

```ts
  const headline = first.headline
  if (typeof headline === 'string' && headline.length > 0) out.headline = headline
```

> **Field-name confirmation (dev task, not a placeholder):** the "Profile details no email" actor returns the member
> headline on the dataset item; the common key is `headline`. Since the scrape is dev-only, confirm the key against your
> local Apify dataset (the file already advises "check Apify console"). If the actor names it differently (e.g.
> `occupation`), read that key instead — keep the `typeof … === 'string' && length > 0` guard.

- [ ] **Step 5: Run to verify it passes**

Run: `pnpm --filter convex test scrapeProfileApify`
Expected: PASS (all blocks, including the pre-existing ones).

- [ ] **Step 6: Include `headline` in the no-fields early-return**

In `scrapeUserProfile`, so a headline-only scrape still writes, change the guard from:

```ts
    if (parsed.country === undefined && parsed.location === undefined && parsed.primaryLocale === undefined) {
```

to:

```ts
    if (
      parsed.country === undefined &&
      parsed.location === undefined &&
      parsed.primaryLocale === undefined &&
      parsed.headline === undefined
    ) {
```

(The existing `await actionCtx.runMutation(internal.users.applyScrapedProfile, { userId, ...parsed })` already spreads
`parsed`, so `headline` flows once Task 2 adds the arg.)

- [ ] **Step 7: Update the file header comment**

Change the top-of-file comment (line 2) from:

```ts
// Populates users.country (fill-when-empty), users.location + users.primaryLocale (refresh).
```

to:

```ts
// Populates users.country + users.headline (fill-when-empty), users.location + users.primaryLocale (refresh).
```

- [ ] **Step 8: Checkpoint (Henriko commits)** — report tests green; do not commit.

---

### Task 2: Write `headline` fill-when-empty in `applyScrapedProfile`

**Files:**

- Modify: `convex/users.ts` (`ScrapedProfileDb` interface, `ApplyScrapedProfileArgs`, `applyScrapedProfileHandler`, and
  the `applyScrapedProfile` internalMutation `args`)
- Test: `convex/users.applyScrapedProfile.test.ts` (extend)

**Interfaces:**

- Consumes: `ParsedProfile.headline` (Task 1), spread into `applyScrapedProfile`.
- Produces: `applyScrapedProfile` writes `users.headline` **only when the user has none** (fill-when-empty, like
  `country`).

- [ ] **Step 1: Write the failing tests**

Add these two `it(...)` blocks inside `describe('applyScrapedProfileHandler', ...)` in
`convex/users.applyScrapedProfile.test.ts` (matching the file's existing `createMockDb` style):

```ts
  it('fills headline when the user has none', async () => {
    const db = createMockDb({ _id: 'u1' })
    await applyScrapedProfileHandler(db as any, { userId: 'u1', headline: 'Senior Product Designer' })
    expect(db._patches[0].data).toEqual({ headline: 'Senior Product Designer' })
  })

  it('does NOT overwrite an existing headline but still refreshes location', async () => {
    const db = createMockDb({ _id: 'u1', headline: 'My own title' })
    await applyScrapedProfileHandler(db as any, { userId: 'u1', headline: 'Scraped title', location: 'Lisbon' })
    expect(db._patches[0].data).toEqual({ location: 'Lisbon' })
  })
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter convex test applyScrapedProfile`
Expected: FAIL — headline is neither written nor protected yet.

- [ ] **Step 3: Widen the `ScrapedProfileDb.get` shape**

In `convex/users.ts`, the `ScrapedProfileDb` interface's `get` must also surface the existing headline so the handler
can
check it. Change:

```ts
interface ScrapedProfileDb {
  get(id: string): Promise<{ country?: string } | null>
  patch(id: string, fields: Record<string, unknown>): Promise<void>
}
```

to:

```ts
interface ScrapedProfileDb {
  get(id: string): Promise<{ country?: string; headline?: string } | null>
  patch(id: string, fields: Record<string, unknown>): Promise<void>
}
```

- [ ] **Step 4: Add `headline` to `ApplyScrapedProfileArgs`**

```ts
export interface ApplyScrapedProfileArgs {
  userId: string
  country?: string
  location?: string
  primaryLocale?: string
  headline?: string
}
```

- [ ] **Step 5: Implement fill-when-empty in `applyScrapedProfileHandler`**

In `applyScrapedProfileHandler`, after the `country` line and before the `if (Object.keys(patch).length > 0)` line, add:

```ts
  if (args.headline !== undefined && !existing?.headline) patch.headline = args.headline
```

Also update the JSDoc comment above the handler to mention headline:

```ts
/**
 * Applies scraped profile fields. `country` and `headline` are filled ONLY when the user has none
 * (protects manual edits); `location` + `primaryLocale` always refresh when provided.
 */
```

- [ ] **Step 6: Add the arg to the `applyScrapedProfile` internalMutation**

In the `applyScrapedProfile` internalMutation `args`, add `headline`:

```ts
export const applyScrapedProfile = internalMutation({
  args: {
    userId: v.id('users'),
    country: v.optional(v.string()),
    location: v.optional(v.string()),
    primaryLocale: v.optional(v.string()),
    headline: v.optional(v.string())
  },
  handler: async (ctx, args) =>
    applyScrapedProfileHandler(ctx.db as unknown as ScrapedProfileDb, args as ApplyScrapedProfileArgs)
})
```

- [ ] **Step 7: Run to verify it passes**

Run: `pnpm --filter convex test applyScrapedProfile`
Expected: PASS (new + pre-existing blocks).

- [ ] **Step 8: Confirm the read path needs no change**

By reading only: confirm `toSafeMe` (`convex/users.ts`) does not strip `headline`, and `toFeedAuthor` (`convex/feed.ts`)
already returns `headline` + `industry`. No edits expected — note the confirmation in the checkpoint.

- [ ] **Step 9: Checkpoint (Henriko commits)** — report tests green; do not commit.

---

### Task 3: User-editable headline — backend (`updateProfile`)

**Files:**

- Modify: `convex/users.ts` (`UpdateProfileArgs`, `updateProfileHandler`, a new `MAX_HEADLINE_LENGTH` constant, and the
  `updateProfile` mutation `args` + handler call)
- Test: `convex/users.updateProfile.test.ts` (extend)

**Interfaces:**

- Produces: `updateProfile` mutation accepts `headline?: string`; `updateProfileHandler` validates + patches it (trim,
  ≤ 220, empty clears). The Settings UI (Task 4) consumes this.

- [ ] **Step 1: Write the failing tests**

Add these three `it(...)` blocks inside `describe('updateProfileHandler', ...)` in `convex/users.updateProfile.test.ts`:

```ts
  it('patches a trimmed headline', async () => {
    const db = createMockDb()
    await updateProfileHandler(db as any, 'u1', { headline: '  Senior PM · SaaS  ' })
    expect(db._patches[0].data).toEqual({ headline: 'Senior PM · SaaS' })
  })

  it('clears the headline when passed whitespace only', async () => {
    const db = createMockDb()
    await updateProfileHandler(db as any, 'u1', { headline: '   ' })
    expect('headline' in db._patches[0].data).toBe(true)
    expect(db._patches[0].data.headline).toBeUndefined()
  })

  it('rejects a headline longer than 220 characters', async () => {
    const db = createMockDb()
    await expect(updateProfileHandler(db as any, 'u1', { headline: 'x'.repeat(221) })).rejects.toThrow(/headline/i)
    expect(db._patches).toHaveLength(0)
  })
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter convex test updateProfile`
Expected: FAIL — `headline` is not part of `UpdateProfileArgs` / not handled.

- [ ] **Step 3: Add the length constant + `headline` to `UpdateProfileArgs`**

In `convex/users.ts`, just above `export interface UpdateProfileArgs`, add the constant:

```ts
/** LinkedIn's own headline limit; used to cap the user-editable headline field. */
export const MAX_HEADLINE_LENGTH = 220
```

Then extend the args type:

```ts
export interface UpdateProfileArgs {
  industry?: string
  country?: string
  headline?: string
}
```

- [ ] **Step 4: Validate + patch `headline` in `updateProfileHandler`**

In `updateProfileHandler`, after the `country` block and before `if (Object.keys(patch).length > 0)`, add:

```ts
  if (args.headline !== undefined) {
    const trimmed = args.headline.trim()
    if (trimmed.length > MAX_HEADLINE_LENGTH) throw new Error('Headline too long')
    patch.headline = trimmed === '' ? undefined : trimmed
  }
```

- [ ] **Step 5: Run to verify it passes**

Run: `pnpm --filter convex test updateProfile`
Expected: PASS (new + pre-existing blocks).

- [ ] **Step 6: Thread `headline` through the `updateProfile` mutation**

Change the public `updateProfile` mutation to accept and forward `headline`:

```ts
export const updateProfile = mutation({
  args: {
    sessionToken: v.string(),
    industry: v.optional(v.string()),
    country: v.optional(v.string()),
    headline: v.optional(v.string())
  },
  handler: async (ctx, { sessionToken, industry, country, headline }) => {
    const user = await requireAuth(ctx, sessionToken)
    await updateProfileHandler(
      ctx.db as unknown as { patch: (id: string, f: Record<string, unknown>) => Promise<void> },
      user._id,
      { industry, country, headline }
    )
  }
})
```

- [ ] **Step 7: Run the full convex suite**

Run: `pnpm --filter convex test`
Expected: PASS (no regressions across the suite).

- [ ] **Step 8: Checkpoint (Henriko commits)** — report tests green; do not commit.

---

### Task 4: User-editable headline — Settings UI + i18n

**Files:**

- Modify: `app/src/pages/SettingsPage.tsx` (state, mirror effect, save handler, profile-section input)
- Modify: `app/src/i18n/locales/en.json`, `app/src/i18n/locales/pt.json`, `app/src/i18n/locales/es.json`

**Interfaces:**

- Consumes: `api.users.updateProfile` (Task 3) with the new `headline` arg; `me.headline` from `getMe` (already typed on
  `MeProfile`).

- [ ] **Step 1: Add the i18n keys (en)**

In `app/src/i18n/locales/en.json`, inside the `"settings"` object, add three keys after the `"country": "Country",`
line:

```json
    "headline": "Headline",
    "headlinePlaceholder": "e.g. Senior Product Designer · Fintech",
    "headlineHint": "Shown under your name in the feed and sidebar. Falls back to your industry if left blank.",
```

- [ ] **Step 2: Add the i18n keys (pt-BR)**

In `app/src/i18n/locales/pt.json`, inside `"settings"`, after the `"country"` line, add:

```json
    "headline": "Título",
    "headlinePlaceholder": "ex.: Designer de Produto Sênior · Fintech",
    "headlineHint": "Exibido abaixo do seu nome no feed e na barra lateral. Usa seu setor se ficar em branco.",
```

- [ ] **Step 3: Add the i18n keys (es)**

In `app/src/i18n/locales/es.json`, inside `"settings"`, after the `"country"` line, add:

```json
    "headline": "Titular",
    "headlinePlaceholder": "p. ej., Diseñador de Producto Senior · Fintech",
    "headlineHint": "Se muestra bajo tu nombre en el feed y la barra lateral. Usa tu sector si lo dejas en blanco.",
```

> Keep each file valid JSON — the inserted block ends with a comma because more keys follow it (`"save"`, etc.).

- [ ] **Step 4: Add headline state + mirror effect in `SettingsPage.tsx`**

After the `const [countryDirty, setCountryDirty] = useState(false)` line, add:

```tsx
  const [headline, setHeadline] = useState<string>('')
  const [headlineDirty, setHeadlineDirty] = useState(false)
```

After the existing `meCountry` mirror `useEffect` (the one keyed on `[meCountry, countryDirty]`), add:

```tsx
  const meHeadline = me?.headline
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: mirror server value into editable state until the user edits the field
    if (!headlineDirty) setHeadline(meHeadline ?? '')
  }, [meHeadline, headlineDirty])
```

- [ ] **Step 5: Save the headline in `handleSaveProfile`**

In `handleSaveProfile`, change the mutation call + dirty-resets from:

```tsx
      await updateProfile({ sessionToken, industry, country })
      // Saved values are now the server truth — resume mirroring the reactive `me`.
      setIndustryDirty(false)
      setCountryDirty(false)
```

to:

```tsx
      await updateProfile({ sessionToken, industry, country, headline })
      // Saved values are now the server truth — resume mirroring the reactive `me`.
      setIndustryDirty(false)
      setCountryDirty(false)
      setHeadlineDirty(false)
```

- [ ] **Step 6: Render the headline input in the profile section**

In the JSX, immediately after the country `VirtualizedCombobox` wrapper `</div>` and **before** the `{me.location && (`
block, insert:

```tsx
        <div className="text-foreground mb-1 text-sm font-medium">{t('settings.headline')}</div>
        <div className="mb-1">
          <Input
            type="text"
            maxLength={220}
            value={headline}
            onChange={e => {
              setHeadline(e.target.value)
              setHeadlineDirty(true)
            }}
            placeholder={t('settings.headlinePlaceholder')}
            aria-label={t('settings.headline')}
          />
        </div>
        <p className="text-muted-foreground mb-3 mt-0 text-xs">{t('settings.headlineHint')}</p>
```

(`Input` is already imported at the top of the file; the existing Save button persists this along with
industry/country.)

- [ ] **Step 7: Typecheck + run the Settings/related app tests**

Run: `pnpm --filter app exec tsc --noEmit`
Then: `pnpm --filter app exec vitest run src/i18n/i18n.test.ts`
Expected: tsc clean; i18n parity test PASS (all three locales have the new keys).

- [ ] **Step 8: Checkpoint (Henriko commits)** — report tsc + tests green; do not commit.

---

### Task 5: Surface picture + headline in the sidebar `UserMenu` chip

**Files:**

- Modify: `app/src/components/shell/UserMenu.tsx` (self-fetch `getMe`; render avatar `src` + a `headline ?? industry`
  subtitle; drop the dead `name` prop)
- Test: `app/src/components/shell/UserMenu.test.tsx` (mock `useQuery`)

**Interfaces:**

- Consumes: `api.users.getMe` → `{ name, headline, industry, profilePictureUrl }`. `UserMenu` is rendered prop-less by
  `Sidebar` (`<UserMenu />`), so the current `name` prop is dead (always falls back to `'Account'`); self-fetching fixes
  the name, picture, and subtitle together.

- [ ] **Step 1: Update the failing test first**

Replace the body of `app/src/components/shell/UserMenu.test.tsx` with:

```tsx
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'

vi.mock('convex/react', () => ({
  useMutation: () => vi.fn(),
  useQuery: () => ({ name: 'Mariana Costa', headline: 'Senior Engineer' })
}))

import UserMenu from './UserMenu'

describe('UserMenu', () => {
  it('renders the signed-in user name + headline from getMe', () => {
    render(
      <MemoryRouter>
        <UserMenu />
      </MemoryRouter>
    )
    expect(screen.getByRole('button', { name: /open user menu/i })).toBeInTheDocument()
    expect(screen.getByText('Mariana Costa')).toBeInTheDocument()
    expect(screen.getByText('Senior Engineer')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter app exec vitest run src/components/shell/UserMenu.test.tsx`
Expected: FAIL — current `UserMenu` neither calls `useQuery` (mock provides it, but the component ignores it) nor
renders
the headline; `'Senior Engineer'` is not found.

- [ ] **Step 3: Rewrite `UserMenu.tsx` to self-fetch and render the subtitle**

Replace the whole file with:

```tsx
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery } from 'convex/react'
import { ChevronsUpDown, LogOut, Settings as SettingsIcon } from 'lucide-react'
import { api } from '../../convex'
import { performSignOut } from '@/lib/session'
import { Avatar } from '../ui/avatar'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '../ui/dropdown-menu'

export default function UserMenu() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const logout = useMutation(api.users.logout)
  const me = useQuery(api.users.getMe, { sessionToken: sessionStorage.getItem('sessionToken') ?? undefined })

  const name = me?.name ?? t('nav.openMenu')
  const subtitle = me?.headline ?? me?.industry

  async function handleSignOut() {
    await performSignOut(logout, sessionStorage.getItem('sessionToken'))
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t('nav.openMenu')}
        className="hover:bg-sidebar-accent/60 focus-visible:ring-ring flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left outline-none focus-visible:ring-2"
      >
        <Avatar
          name={name}
          src={me?.profilePictureUrl}
          size="sm"
        />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-medium">{name}</span>
          {subtitle ? <span className="text-muted-foreground truncate text-xs">{subtitle}</span> : null}
        </span>
        <ChevronsUpDown
          className="text-muted-foreground size-4 shrink-0"
          aria-hidden="true"
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        side="top"
      >
        <DropdownMenuItem onSelect={() => navigate('/settings')}>
          <SettingsIcon
            className="size-4"
            aria-hidden="true"
          />
          {t('shell.profile')}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={handleSignOut}>
          <LogOut
            className="size-4"
            aria-hidden="true"
          />
          {t('nav.signOut')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter app exec vitest run src/components/shell/UserMenu.test.tsx`
Expected: PASS — name + headline both render.

- [ ] **Step 5: Typecheck**

Run: `pnpm --filter app exec tsc --noEmit`
Expected: clean. (`Sidebar` already renders `<UserMenu />` with no props, so removing the prop introduces no caller
errors.)

- [ ] **Step 6: Checkpoint (Henriko commits)** — report tsc + test green; do not commit.

---

### Task 6: `PostCard` — `headline ?? industry` fallback

**Files:**

- Modify: `app/src/components/PostCard.tsx` (`PostWithAuthor['author']` type + the author subtitle line)
- Test: `app/src/components/PostCard.test.tsx` (extend)

**Interfaces:**

- Consumes: `PostWithAuthor.author.industry` — `toFeedAuthor` (`convex/feed.ts`) already returns `industry`, so this is
  a
  type + render change only.

- [ ] **Step 1: Write the failing test**

Add to `app/src/components/PostCard.test.tsx`, inside `describe('PostCard', ...)`:

```tsx
  it('falls back to the author industry when there is no headline', () => {
    render(
      <PostCard
        post={{ ...mockPost, author: { name: 'Léo Martins', industry: 'Fintech' } }}
        onComment={() => {}}
        onReact={() => {}}
      />
    )
    expect(screen.getByText('Fintech')).toBeInTheDocument()
  })
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter app exec vitest run src/components/PostCard.test.tsx`
Expected: FAIL — `industry` is not on the author type (tsc/runtime) and not rendered.

- [ ] **Step 3: Add `industry` to the author type**

In `PostCard.tsx`, extend the `author` shape in `PostWithAuthor`:

```tsx
  author: {
    name: string
    headline?: string
    profilePictureUrl?: string
    industry?: string
  } | null
```

- [ ] **Step 4: Render `headline ?? industry`**

Replace the author-subtitle line:

```tsx
              {post.author.headline && <p className="text-muted-foreground m-0 text-xs">{post.author.headline}</p>}
```

with:

```tsx
              {(post.author.headline ?? post.author.industry) && (
                <p className="text-muted-foreground m-0 text-xs">{post.author.headline ?? post.author.industry}</p>
              )}
```

- [ ] **Step 5: Run to verify it passes**

Run: `pnpm --filter app exec vitest run src/components/PostCard.test.tsx`
Expected: PASS (new + pre-existing blocks; the `headline: 'Engineer'` fixture still renders 'Engineer').

- [ ] **Step 6: Typecheck**

Run: `pnpm --filter app exec tsc --noEmit`
Expected: clean.

- [ ] **Step 7: Checkpoint (Henriko commits)** — report tsc + tests green; do not commit.

---

### Task 7: Documentation — `docs/PLATFORM.md`

**Files:**

- Modify: `docs/PLATFORM.md` (mutations table rows for `updateProfile` + `applyScrapedProfile`; §13A Profile Enrichment;
  its Mermaid chart)

**Interfaces:** none (technical docs only — NOT compliance disclosure).

- [ ] **Step 1: Update the `updateProfile` mutations-table row**

Find the row (≈ line 771):

```
| `users.updateProfile`                                         | mutation (public) | User edits their own `industry`/`country` (validated against canonical lists; empty string clears).                                                              |
```

Replace the description cell so it reads (keep the table's column padding intact):

> User edits their own `industry`/`country`/`headline`. `industry`/`country` validate against canonical lists;
`headline`
> is free text, trimmed, capped at 220 chars; empty string clears any of them.

- [ ] **Step 2: Update the `applyScrapedProfile` mutations-table row**

Find the row (≈ line 773):

```
| `users.applyScrapedProfile`                                   | internalMutation  | Writes scraped fields: `country` **fill-when-empty**; `location`/`primaryLocale` always refresh.                                                                 |
```

Replace the description cell so it reads:

> Writes scraped fields: `country` + `headline` **fill-when-empty**; `location`/`primaryLocale` always refresh.

- [ ] **Step 3: Update §13A (Profile Enrichment) prose**

In section `## 13A. Profile Enrichment (LinkedIn Profile Scrape)` (≈ line 1561):

1. Add `headline` to the scraped-fields sentence (≈ line 1564), e.g. change "…`country` (fill-when-empty), `location`,
   and `primaryLocale`. Industry is **not** scraped…" to "…`country` **and `headline`** (fill-when-empty), `location`,
   and `primaryLocale`. Industry is **not** scraped…".
2. Add `headline` to the parse/apply sentence (≈ line 1582) that lists `location.countryCode → country`, etc.: append
   "and the dataset `headline` → `headline` (fill-when-empty)".
3. Add a sentence clarifying the dual source + dev-only nature:

> The **headline** has two sources: the **dev-only** Apify scrape (fill-when-empty) and the **user-editable Settings
> field** (`users.updateProfile`, always wins). In production the Settings field is the only live source — the Apify
> scrape is a local-dev testing tool (the `appSettings.apifyProfileScrapeEnabled` flag is a dev/prod switch). The UI
> shows `headline ?? industry`.

- [ ] **Step 4: Update the §13A Mermaid chart**

In the Mermaid block (≈ lines 1606–1607), add `headline?` to the parse + apply node labels:

```
  API --> PARSE["parseProfileScrapeResult -> {country?, location?, primaryLocale?, headline?}"]
  PARSE --> APPLY["applyScrapedProfile: country + headline fill-when-empty; location/locale refresh"]
```

- [ ] **Step 5: Verify the doc renders + no broken anchors**

By reading: confirm the TOC entry `13A. Profile Enrichment` still resolves and the Mermaid block is still fenced
correctly. (No build step — visual read is sufficient.)

- [ ] **Step 6: Checkpoint (Henriko commits)** — report the doc is updated; do not commit.

---

## Done Criteria

- [ ] `parseProfileScrapeResult` extracts `headline`; `applyScrapedProfile` writes it **fill-when-empty** (tests green).
- [ ] `updateProfile` accepts a validated `headline` (trim, ≤ 220, empty clears); Settings has a live headline input in
  en/pt-BR/es (tests + tsc green).
- [ ] Sidebar `UserMenu` chip shows the LinkedIn picture + `headline ?? industry` subtitle; `PostCard` falls back to
  `industry`.
- [ ] `docs/PLATFORM.md` reflects both headline sources, the fill-when-empty precedence, and the `headline ?? industry`
  fallback. **No** Apify entry added to any compliance/legal doc.
- [ ] `pnpm --filter convex test` and `pnpm --filter app exec vitest run` both pass;
  `pnpm --filter app exec tsc --noEmit`
  is clean.

## Self-Review (completed by plan author)

- **Spec coverage:** §12 Deferred plan A → Tasks 1–2 (scrape capture + fill-when-empty) + Task 6 (display fallback);
  2026-06-21 expansion → Task 3–4 (manual edit, live) + Task 5 (sidebar chip picture+headline) + Task 7 (docs,
  no compliance disclosure).
- **Placeholder scan:** the only "confirm against real data" note (Task 1 headline key) references the actual dev-only
  Apify dataset, not an invented API; the defensive guard stays regardless.
- **Type consistency:** `ParsedProfile.headline` (T1) → `ApplyScrapedProfileArgs.headline` + `ScrapedProfileDb.get`
  headline (T2) → `applyScrapedProfile` arg; `MAX_HEADLINE_LENGTH` defined once (T3) and used in the handler; `UserMenu`
  drops its `name` prop and `Sidebar`'s prop-less call still typechecks (T5); `PostWithAuthor.author.industry` added
  where `toFeedAuthor` already supplies it (T6).
- **Precedence consistency:** scrape = fill-when-empty in BOTH the handler (T2) and the docs (T7); manual edit always
  wins (T3). No "refresh" semantics remain for headline.
