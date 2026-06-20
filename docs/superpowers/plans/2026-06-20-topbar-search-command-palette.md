# Top-Bar Search & Command Palette — Implementation Plan (DEFERRED)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:
> executing-plans. Steps use checkbox (`- [ ]`) syntax.

> **DEFERRED.** This replaces the non-functional search placeholder shipped in the App-Shell phase (Phase 2). It depends
> on Phase 2 being in place (`TopBar`, `AppShell`).

**Goal:** Turn the top-bar search placeholder into a working **command palette** (⌘K) that searches **posts** (by
content) and **people** (by name) via Convex search indexes, and offers **quick actions** (navigate, toggle theme, sign
out).

**Architecture:** Two Convex `searchIndex`es back a single `search` query that returns `{ posts, people }` with safe
projections (reusing `toFeedAuthor` and a new `toSearchPerson`). The frontend `CommandPalette` reuses the existing
`cmdk` wrapper in `app/src/components/ui/command.tsx`, debounces input, and queries reactively. `AppShell` owns the open
state; the top-bar search button and a global ⌘K listener both open it.

**Tech Stack:** Convex search indexes, React 19, cmdk (via `ui/command.tsx`), React Router, i18next, vitest.

**Spec:** `docs/superpowers/specs/2026-06-20-ui-revamp-design.md` §12 (Deferred plan B), §8D. **Depends on Phase 2** (
`docs/superpowers/plans/2026-06-20-ui-revamp-phase-2-app-shell.md`).

## Global Constraints

- **Commits:** agent never runs `git commit`/`git push`; each task ends with a **Checkpoint (Henriko commits)**.
- **Convex tooling:** pnpm; run `convex` CLI from the **repo root** (never inside `convex/`). Adding a search index is a
  schema change — apply with `npx convex dev` from the root. Pre-launch with disposable dev data, so no
  backfill/migration is needed.
- **Auth/visibility:** `search` requires a valid session; post results must respect the same visibility/eligibility
  rules as the feed (no leaking hidden/visibility-restricted/ineligible-author posts). People results expose only safe
  display fields (name, headline, picture, public identifier) — never tokens/PII.
- **i18n:** all palette strings via i18next (en/pt/es).
- **a11y:** the palette is a focus-trapped dialog (cmdk/radix Dialog) with a labeled input; ⌘K and the search button
  both open it; `Esc` closes.

---

### Task 1: Add the search indexes (schema)

**Files:**

- Modify: `convex/schema.ts` (posts + users)

**Interfaces:**

- Produces: `posts.search_content` (searchField `content`, filterField `inFeed`) and `users.search_name` (searchField
  `name`).

- [ ] **Step 1: Add the indexes**

In `convex/schema.ts`, on the `posts` table add (after the existing `.index(...)` chain):

```ts
    .searchIndex('search_content', { searchField: 'content', filterFields: ['inFeed'] })
```

On the `users` table add:

```ts
    .searchIndex('search_name', { searchField: 'name' })
```

- [ ] **Step 2: Apply the schema**

Run (from repo root): `npx convex dev --once`
Expected: schema pushes successfully; the two search indexes build.

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter convex exec tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 4: Checkpoint (Henriko commits)**

---

### Task 2: `convex/search.ts` — the `search` query

**Files:**

- Create: `convex/search.ts`
- Test: `convex/search.test.ts`

**Interfaces:**

- Consumes: `requireAuth`, `toFeedAuthor` (`convex/feed.ts`), `isAuthorFeedEligible` (`convex/feed.ts`).
- Produces: `toSearchPerson(user): { _id, name, headline?, profilePictureUrl?, linkedinPublicIdentifier? }` (pure,
  tested) and the `search` query returning
  `{ posts: Array<{ _id, content, sourceUrl?, author }>, people: Array<ReturnType<typeof toSearchPerson>> }`.

- [ ] **Step 1: Write the failing test for `toSearchPerson`**

Create `convex/search.test.ts`:

```ts
import { toSearchPerson } from './search'

describe('toSearchPerson', () => {
  it('projects only safe display fields', () => {
    const out = toSearchPerson({
      _id: 'u1', name: 'Mariana', headline: 'Designer', profilePictureUrl: 'p',
      linkedinPublicIdentifier: 'mariana', linkedinAccessToken: 'secret', isAdmin: true
    } as never)
    expect(out).toEqual({ _id: 'u1', name: 'Mariana', headline: 'Designer', profilePictureUrl: 'p', linkedinPublicIdentifier: 'mariana' })
    expect(out).not.toHaveProperty('linkedinAccessToken')
    expect(out).not.toHaveProperty('isAdmin')
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter convex test search`
Expected: FAIL ("Failed to resolve import './search'").

- [ ] **Step 3: Implement `convex/search.ts`**

```ts
import { query } from './_generated/server'
import { v } from 'convex/values'
import type { Doc } from './_generated/dataModel'
import { requireAuth } from './lib/auth'
import { toFeedAuthor, isAuthorFeedEligible } from './feed'

const MAX_POSTS = 8
const MAX_PEOPLE = 6

/** Pure allow-list projection of a person for search results. Never returns tokens/PII. */
export function toSearchPerson(u: Doc<'users'>) {
  return {
    _id: u._id,
    name: u.name,
    headline: u.headline,
    profilePictureUrl: u.profilePictureUrl,
    linkedinPublicIdentifier: u.linkedinPublicIdentifier
  }
}

export const search = query({
  args: { sessionToken: v.optional(v.string()), queryText: v.string() },
  handler: async (ctx, { sessionToken, queryText }) => {
    const text = queryText.trim()
    if (!sessionToken || text.length < 2) return { posts: [], people: [] }

    let viewer: Doc<'users'>
    try {
      viewer = await requireAuth(ctx, sessionToken)
    } catch {
      return { posts: [], people: [] }
    }

    // Posts: in-feed matches, then apply the same visibility + author-eligibility rules as getFeed.
    const rawPosts = await ctx.db
      .query('posts')
      .withSearchIndex('search_content', q => q.search('content', text).eq('inFeed', true))
      .take(MAX_POSTS * 3)

    const authorIds = [...new Set(rawPosts.map(p => p.authorId))]
    const authors = await Promise.all(authorIds.map(id => ctx.db.get(id)))
    const authorMap = new Map(authors.filter((a): a is Doc<'users'> => a !== null).map(a => [a._id, a]))

    const posts = rawPosts
      .filter(post => {
        if (post.visibilityIndustries.length > 0 && (!viewer.industry || !post.visibilityIndustries.includes(viewer.industry))) return false
        if (post.visibilityCountries.length > 0 && (!viewer.country || !post.visibilityCountries.includes(viewer.country))) return false
        return isAuthorFeedEligible(authorMap.get(post.authorId) ?? null)
      })
      .slice(0, MAX_POSTS)
      .map(post => {
        const author = authorMap.get(post.authorId)
        return { _id: post._id, content: post.content, sourceUrl: post.sourceUrl, author: author ? toFeedAuthor(author) : null }
      })

    const people = (
      await ctx.db.query('users').withSearchIndex('search_name', q => q.search('name', text)).take(MAX_PEOPLE)
    ).map(toSearchPerson)

    return { posts, people }
  }
})
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter convex test search`
Expected: PASS (the `toSearchPerson` test; the `search` query is verified manually in Task 5 since search indexes need
the Convex runtime — the project convention does not use `convex-test`).

- [ ] **Step 5: Checkpoint (Henriko commits)**

---

### Task 3: Palette i18n strings (en/pt/es)

**Files:**

- Modify: `app/src/i18n/locales/{en,pt,es}.json`

**Interfaces:**

- Produces: `shell.commandTitle`, `shell.searchPlaceholder`, `shell.noResults`, `shell.groupActions`,
  `shell.groupPeople`, `shell.groupPosts`, `shell.actionToggleTheme`.

- [ ] **Step 1: Add to `en.json` `shell`**

```json
    "commandTitle": "Search & commands",
    "searchPlaceholder": "Search posts and people…",
    "noResults": "No results.",
    "groupActions": "Quick actions",
    "groupPeople": "People",
    "groupPosts": "Posts",
    "actionToggleTheme": "Toggle theme"
```

- [ ] **Step 2: Add the same keys to `pt.json`** (`"Pesquisa e comandos"`, `"Pesquisar publicações e pessoas…"`,
  `"Sem resultados."`, `"Ações rápidas"`, `"Pessoas"`, `"Publicações"`, `"Alternar tema"`).

- [ ] **Step 3: Add the same keys to `es.json`** (`"Búsqueda y comandos"`, `"Buscar publicaciones y personas…"`,
  `"Sin resultados."`, `"Acciones rápidas"`, `"Personas"`, `"Publicaciones"`, `"Cambiar tema"`).

- [ ] **Step 4: Typecheck + checkpoint**

Run: `pnpm --filter app exec tsc --noEmit`
Expected: no errors. Checkpoint (Henriko commits).

---

### Task 4: `CommandPalette` component

**Files:**

- Create: `app/src/components/shell/CommandPalette.tsx`
- Test: `app/src/components/shell/CommandPalette.test.tsx`

**Interfaces:**

- Consumes: `ui/command.tsx` exports, `api.search.search`, `useTheme`, `performSignOut`, `NAV_GROUPS` (Phase 2), React
  Router `useNavigate`.
- Produces: `<CommandPalette open onOpenChange />` with a debounced query, Quick-actions/People/Posts groups.

- [ ] **Step 1: Implement `CommandPalette.tsx`**

```tsx
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../convex'
import { performSignOut } from '@/lib/session'
import { useTheme } from '../ThemeProvider'
import { NAV_GROUPS } from './navItems'
import {
  CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem
} from '../ui/command'

export default function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { setPref, pref } = useTheme()
  const logout = useMutation(api.users.logout)
  const [text, setText] = useState('')
  const [debounced, setDebounced] = useState('')

  useEffect(() => {
    const id = setTimeout(() => setDebounced(text), 180)
    return () => clearTimeout(id)
  }, [text])

  const results = useQuery(
    api.search.search,
    debounced.trim().length >= 2
      ? { sessionToken: sessionStorage.getItem('sessionToken') ?? undefined, queryText: debounced }
      : 'skip'
  )

  function run(action: () => void) {
    onOpenChange(false)
    action()
  }

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} title={t('shell.commandTitle')} description={t('shell.searchPlaceholder')}>
      <CommandInput value={text} onValueChange={setText} placeholder={t('shell.searchPlaceholder')} />
      <CommandList>
        <CommandEmpty>{t('shell.noResults')}</CommandEmpty>

        <CommandGroup heading={t('shell.groupActions')}>
          {NAV_GROUPS.flatMap(g => g.items).map(item => (
            <CommandItem key={item.path} onSelect={() => run(() => navigate(item.path))}>
              {t(item.labelKey)}
            </CommandItem>
          ))}
          <CommandItem onSelect={() => run(() => setPref(pref === 'dark' ? 'light' : 'dark'))}>
            {t('shell.actionToggleTheme')}
          </CommandItem>
          <CommandItem onSelect={() => run(() => void performSignOut(logout, sessionStorage.getItem('sessionToken')))}>
            {t('nav.signOut')}
          </CommandItem>
        </CommandGroup>

        {results?.people.length ? (
          <CommandGroup heading={t('shell.groupPeople')}>
            {results.people.map(p => (
              <CommandItem
                key={p._id}
                onSelect={() => run(() => p.linkedinPublicIdentifier && window.open(`https://www.linkedin.com/in/${p.linkedinPublicIdentifier}`, '_blank', 'noopener'))}
              >
                {p.name}
                {p.headline ? <span className="text-muted-foreground ml-2 truncate text-xs">{p.headline}</span> : null}
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}

        {results?.posts.length ? (
          <CommandGroup heading={t('shell.groupPosts')}>
            {results.posts.map(post => (
              <CommandItem key={post._id} onSelect={() => run(() => post.sourceUrl && window.open(post.sourceUrl, '_blank', 'noopener'))}>
                <span className="truncate">{post.content.slice(0, 80)}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}
      </CommandList>
    </CommandDialog>
  )
}
```

> `useQuery(..., 'skip')` is the Convex idiom for a conditional/disabled query — it returns `undefined` until a non-skip
> arg is supplied. Posts/people groups render only when results exist.

- [ ] **Step 2: Write the test** (mock `convex/react` + the search result)

Create `app/src/components/shell/CommandPalette.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'

vi.mock('convex/react', () => ({
  useMutation: () => vi.fn(),
  useQuery: () => ({
    people: [{ _id: 'u1', name: 'Mariana Costa', headline: 'Designer', linkedinPublicIdentifier: 'mariana' }],
    posts: [{ _id: 'p1', content: 'Lifted our SSI by 18 points', sourceUrl: 'https://x', author: null }]
  })
}))

import { ThemeProvider } from '../ThemeProvider'
import CommandPalette from './CommandPalette'

describe('CommandPalette', () => {
  it('renders quick actions, people, and posts when open', () => {
    render(
      <ThemeProvider>
        <MemoryRouter><CommandPalette open onOpenChange={() => {}} /></MemoryRouter>
      </ThemeProvider>
    )
    expect(screen.getByText(/quick actions/i)).toBeInTheDocument()
    expect(screen.getByText('Mariana Costa')).toBeInTheDocument()
    expect(screen.getByText(/lifted our ssi/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 3: Run to verify it passes**

Run: `pnpm --filter app exec vitest run src/components/shell/CommandPalette.test.tsx`
Expected: PASS.

- [ ] **Step 4: Checkpoint (Henriko commits)**

---

### Task 5: Wire the palette into the shell (⌘K + search button)

**Files:**

- Modify: `app/src/components/shell/AppShell.tsx` (own palette open state, render `CommandPalette`, global ⌘K listener)
- Modify: `app/src/components/shell/TopBar.tsx` (the search button opens the palette via a new `onOpenSearch` prop)

**Interfaces:**

- Consumes: `CommandPalette`.

- [ ] **Step 1: AppShell owns palette state + ⌘K**

In `AppShell.tsx`, add:

```tsx
const [paletteOpen, setPaletteOpen] = useState(false)
useEffect(() => {
  const onKey = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault()
      setPaletteOpen(o => !o)
    }
  }
  window.addEventListener('keydown', onKey)
  return () => window.removeEventListener('keydown', onKey)
}, [])
```

Pass `onOpenSearch={() => setPaletteOpen(true)}` to `<TopBar>`, and render
`<CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />` inside the shell.

- [ ] **Step 2: TopBar search button opens the palette**

In `TopBar.tsx`, add an `onOpenSearch: () => void` prop and set the search button's `onClick={onOpenSearch}`; remove the
`title={t('shell.searchComingSoon')}` placeholder hint.

- [ ] **Step 3: Update the `TopBar` test**

Update `TopBar.test.tsx` to pass `onOpenSearch` and assert clicking the search button calls it. Remove any assertion
tied to the old placeholder behavior.

- [ ] **Step 4: Typecheck + suites + manual smoke**

Run: `pnpm --filter app exec tsc --noEmit && pnpm --filter app test`
Then `pnpm --filter app dev`: press ⌘K (and click the search field) → palette opens; typing ≥2 chars shows People/Posts;
quick actions navigate; `Esc` closes. Stop the dev server.

- [ ] **Step 5: Checkpoint (Henriko commits)**

---

### Task 6: Docs

**Files:**

- Modify: `docs/PLATFORM.md`

- [ ] **Step 1: Document search**

Add a short "Search & command palette" subsection: the two Convex search indexes, the `search` query's auth +
feed-parity visibility rules, and the ⌘K palette (posts/people/quick actions). Update the Maintaining-This-Document
mapping.

- [ ] **Step 2: Checkpoint (Henriko commits)**

---

## Done Criteria

- [ ] ⌘K and the top-bar search button open a working palette; typing searches posts + people; quick actions work.
- [ ] Post results honor feed visibility + author eligibility; people results expose only safe fields.
- [ ] All palette strings localized (en/pt/es); `pnpm verify` passes.
- [ ] `docs/PLATFORM.md` documents search.

## Self-Review (completed by plan author)

- **Spec coverage:** §12 Deferred plan B → Tasks 1–5; §8D (deep-linkable/state) partially — the palette navigates via
  `<Link>`/`navigate`; full URL-sync of a search route is out of scope (palette is ephemeral by design).
- **Placeholder scan:** none — `search.ts`, `CommandPalette.tsx`, and the wiring are fully coded; the only manual step
  is the runtime verification of the search query (search indexes can't be unit-tested under the project's no-
  `convex-test` convention — explicitly noted).
- **Type consistency:** `toSearchPerson` shape (Task 2) matches the `CommandPalette` people mapping (Task 4);
  `onOpenSearch` added to `TopBar` (Task 5) matches `AppShell`'s usage; `useQuery(..., 'skip')` guards the disabled
  state.
- **Dependency:** requires Phase 2 `TopBar`/`AppShell`/`navItems`/`performSignOut` to exist.
