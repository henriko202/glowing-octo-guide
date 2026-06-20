# UI Revamp — Phase 2 (App Shell) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:
> executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat top-bar [`AppNav`](../../../app/src/components/AppNav.tsx) with a professional **sidebar +
top bar** shell — grouped i18n nav, a user menu (absorbing the existing sign-out flow), a language switcher, a theme
toggle, a search placeholder, and a responsive mobile drawer — wired into `RequireAuth`.

**Architecture:** A composing `AppShell` renders a persistent `Sidebar` (≥`lg`) or, below `lg`, the same sidebar inside
a radix `Dialog` styled as a left sheet (free focus-trap, `Esc`, scroll-lock). `TopBar` holds the search placeholder,
`LanguageMenu`, and `ThemeToggle`. A new `DropdownMenu` primitive backs the user/language menus. The page title moves
into each screen's `PageHeader` (Phase 1), so the top bar stays global-actions only.

**Tech Stack:** React 19, React Router 7, radix-ui (DropdownMenu, Dialog), lucide-react, i18next, Tailwind v4, vitest +
@testing-library/react.

**Spec:** `docs/superpowers/specs/2026-06-20-ui-revamp-design.md` (§5 shell, §8A/§8E/§8F/§8G QC). **Depends on Phase 1
** (tokens, `useTheme`, primitives).

## Global Constraints

- **Commits:** agent **NEVER** runs `git commit`/`git push` (per `CLAUDE.md`). Each task ends with a **Checkpoint (
  Henriko commits)**.
- **Package manager:** pnpm; app commands via `pnpm --filter app …`.
- **i18n:** every shell string via `i18next` in all three locales (en/pt/es); no hardcoded UI text. `translate="no"` on
  the brand/identifier tokens ("Link Into The SSI", "LinkedIn", "SSI").
- **Casing:** Title Case interactive labels.
- **a11y:** sidebar is a `<nav>` landmark; active item `aria-current="page"`; icon-only buttons need `aria-label`;
  decorative icons `aria-hidden`; skip-to-content link; drawer traps focus, closes on `Esc`, restores focus to the
  trigger.
- **Admin:** **no** sidebar link / no command entry (URL-only).
- **Search:** placeholder only — non-functional trigger (functional search is a separate deferred plan).
- **Testing convention:** unit-test pure logic and render output; do **not** drive radix hover/portal open-state in
  jsdom (mirror the `ReactionOptions` extraction in [`PostCard.tsx`](../../../app/src/components/PostCard.tsx)). Run
  `pnpm verify` before declaring the phase done.

---

### Task 1: Add the shell i18n keys (en/pt/es)

**Files:**

- Modify: `app/src/i18n/locales/en.json`, `app/src/i18n/locales/pt.json`, `app/src/i18n/locales/es.json`

**Interfaces:**

- Produces: `nav.myPosts`, `nav.privacy`, `nav.groups.main`, `nav.groups.manage`, `nav.openMenu`, `shell.search`,
  `shell.searchComingSoon`, `shell.language`, `shell.theme`, `shell.themeLight`, `shell.themeDark`, `shell.profile`,
  `shell.openSidebar`, `shell.closeSidebar`, `shell.skipToContent`. (`nav.feed`, `nav.settings`, `nav.billing`,
  `nav.signOut` already exist.)

- [ ] **Step 1: Extend `en.json`**

In `app/src/i18n/locales/en.json`, replace the `"nav"` object with:

```json
  "nav": {
    "feed": "Feed",
    "myPosts": "My Posts",
    "settings": "Settings",
    "billing": "Billing",
    "privacy": "Privacy & Data",
    "signOut": "Sign out",
    "openMenu": "Open user menu",
    "groups": { "main": "Main", "manage": "Manage" }
  },
```

and add a top-level `"shell"` object (after `"nav"`):

```json
  "shell": {
    "search": "Search posts, people",
    "searchComingSoon": "Search is coming soon.",
    "language": "Language",
    "theme": "Toggle theme",
    "themeLight": "Light",
    "themeDark": "Dark",
    "profile": "Profile & settings",
    "openSidebar": "Open navigation",
    "closeSidebar": "Close navigation",
    "skipToContent": "Skip to content"
  },
```

- [ ] **Step 2: Extend `pt.json`** (match the existing pt-PT tone — e.g. "Definições", "Faturação")

Replace `"nav"` and add `"shell"`:

```json
  "nav": {
    "feed": "Feed",
    "myPosts": "As Minhas Publicações",
    "settings": "Definições",
    "billing": "Faturação",
    "privacy": "Privacidade e Dados",
    "signOut": "Terminar sessão",
    "openMenu": "Abrir menu do utilizador",
    "groups": { "main": "Principal", "manage": "Gerir" }
  },
  "shell": {
    "search": "Pesquisar publicações, pessoas",
    "searchComingSoon": "A pesquisa está para breve.",
    "language": "Idioma",
    "theme": "Alternar tema",
    "themeLight": "Claro",
    "themeDark": "Escuro",
    "profile": "Perfil e definições",
    "openSidebar": "Abrir navegação",
    "closeSidebar": "Fechar navegação",
    "skipToContent": "Saltar para o conteúdo"
  },
```

- [ ] **Step 3: Extend `es.json`**

```json
  "nav": {
    "feed": "Feed",
    "myPosts": "Mis Publicaciones",
    "settings": "Ajustes",
    "billing": "Facturación",
    "privacy": "Privacidad y Datos",
    "signOut": "Cerrar sesión",
    "openMenu": "Abrir menú de usuario",
    "groups": { "main": "Principal", "manage": "Gestionar" }
  },
  "shell": {
    "search": "Buscar publicaciones, personas",
    "searchComingSoon": "La búsqueda llegará pronto.",
    "language": "Idioma",
    "theme": "Cambiar tema",
    "themeLight": "Claro",
    "themeDark": "Oscuro",
    "profile": "Perfil y ajustes",
    "openSidebar": "Abrir navegación",
    "closeSidebar": "Cerrar navegación",
    "skipToContent": "Saltar al contenido"
  },
```

> Verify the existing `nav.feed`/`settings`/`billing`/`signOut` values in pt/es match what's above; keep their current
> translations if they differ in tone.

- [ ] **Step 4: Typecheck (JSON imports resolve)**

Run: `pnpm --filter app exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Checkpoint (Henriko commits)**

---

### Task 2: `DropdownMenu` primitive (radix-ui)

**Files:**

- Create: `app/src/components/ui/dropdown-menu.tsx`
- Test: `app/src/components/ui/dropdown-menu.test.tsx`

**Interfaces:**

- Produces: `DropdownMenu`, `DropdownMenuTrigger`, `DropdownMenuContent`, `DropdownMenuItem`. Consumed by `UserMenu` (
  Task 4) and `LanguageMenu` (Task 5); reused by admin (Phase 4).

- [ ] **Step 1: Write the failing test** (render content with `defaultOpen` to avoid driving radix open in jsdom)

Create `app/src/components/ui/dropdown-menu.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from './dropdown-menu'

describe('DropdownMenu', () => {
  it('renders items when open', () => {
    render(
      <DropdownMenu defaultOpen>
        <DropdownMenuTrigger>Open</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Sign out</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
    expect(screen.getByText('Sign out')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter app exec vitest run src/components/ui/dropdown-menu.test.tsx`
Expected: FAIL ("Failed to resolve import './dropdown-menu'").

- [ ] **Step 3: Implement `dropdown-menu.tsx`**

```tsx
import * as React from 'react'
import { DropdownMenu as Primitive } from 'radix-ui'
import { cn } from '@/lib/utils'

const DropdownMenu = Primitive.Root
const DropdownMenuTrigger = Primitive.Trigger

function DropdownMenuContent({
  className,
  align = 'end',
  sideOffset = 6,
  ...props
}: React.ComponentProps<typeof Primitive.Content>) {
  return (
    <Primitive.Portal>
      <Primitive.Content
        align={align}
        sideOffset={sideOffset}
        className={cn(
          'z-50 min-w-[11rem] overflow-hidden rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-md',
          className
        )}
        {...props}
      />
    </Primitive.Portal>
  )
}

function DropdownMenuItem({ className, ...props }: React.ComponentProps<typeof Primitive.Item>) {
  return (
    <Primitive.Item
      className={cn(
        'flex cursor-default items-center gap-2 rounded-md px-2.5 py-1.5 text-sm outline-none select-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        className
      )}
      {...props}
    />
  )
}

export { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter app exec vitest run src/components/ui/dropdown-menu.test.tsx`
Expected: PASS.

- [ ] **Step 5: Checkpoint (Henriko commits)**

---

### Task 3: `Sidebar` (brand, grouped nav, active state, user-chip slot)

**Files:**

- Create: `app/src/components/shell/navItems.ts`
- Test: `app/src/components/shell/navItems.test.ts`
- Create: `app/src/components/shell/Sidebar.tsx`
- Test: `app/src/components/shell/Sidebar.test.tsx`

**Interfaces:**

- Consumes: `nav.*` keys (Task 1), lucide icons.
- Produces: `NAV_GROUPS` (config), `isActivePath(itemPath, pathname): boolean`, and
  `<Sidebar onNavigate?={() => void} />` (the `onNavigate` callback lets the mobile drawer close on selection). Renders
  a `<nav>` landmark; the user chip is rendered by `UserMenu` (Task 4), imported here.

- [ ] **Step 1: Write the failing test for `navItems`**

Create `app/src/components/shell/navItems.test.ts`:

```ts
import { NAV_GROUPS, isActivePath } from './navItems'

describe('navItems', () => {
  it('exposes Main and Manage groups and never includes /admin', () => {
    const paths = NAV_GROUPS.flatMap(g => g.items.map(i => i.path))
    expect(paths).toEqual(['/feed', '/my-posts', '/billing', '/settings', '/privacy-data'])
    expect(paths).not.toContain('/admin')
  })
})

describe('isActivePath', () => {
  it('matches the exact path', () => {
    expect(isActivePath('/feed', '/feed')).toBe(true)
  })
  it('does not match a different path', () => {
    expect(isActivePath('/feed', '/billing')).toBe(false)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter app exec vitest run src/components/shell/navItems.test.ts`
Expected: FAIL ("Failed to resolve import './navItems'").

- [ ] **Step 3: Implement `navItems.ts`**

```ts
import { Rss, FileText, CreditCard, Settings, ShieldCheck, type LucideIcon } from 'lucide-react'

export type NavItem = { path: string; labelKey: string; icon: LucideIcon }
export type NavGroup = { labelKey: string; items: NavItem[] }

export const NAV_GROUPS: NavGroup[] = [
  {
    labelKey: 'nav.groups.main',
    items: [
      { path: '/feed', labelKey: 'nav.feed', icon: Rss },
      { path: '/my-posts', labelKey: 'nav.myPosts', icon: FileText }
    ]
  },
  {
    labelKey: 'nav.groups.manage',
    items: [
      { path: '/billing', labelKey: 'nav.billing', icon: CreditCard },
      { path: '/settings', labelKey: 'nav.settings', icon: Settings },
      { path: '/privacy-data', labelKey: 'nav.privacy', icon: ShieldCheck }
    ]
  }
]

export function isActivePath(itemPath: string, pathname: string): boolean {
  return itemPath === pathname
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter app exec vitest run src/components/shell/navItems.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing test for `Sidebar`**

Create `app/src/components/shell/Sidebar.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Sidebar from './Sidebar'

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Sidebar />
    </MemoryRouter>
  )
}

describe('Sidebar', () => {
  it('renders the grouped nav links', () => {
    renderAt('/feed')
    expect(screen.getByRole('link', { name: 'Feed' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'My Posts' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Billing' })).toBeInTheDocument()
  })
  it('marks the current route with aria-current', () => {
    renderAt('/billing')
    expect(screen.getByRole('link', { name: 'Billing' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Feed' })).not.toHaveAttribute('aria-current')
  })
  it('never renders an Admin link', () => {
    renderAt('/feed')
    expect(screen.queryByRole('link', { name: /admin/i })).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 6: Run to verify it fails**

Run: `pnpm --filter app exec vitest run src/components/shell/Sidebar.test.tsx`
Expected: FAIL ("Failed to resolve import './Sidebar'").

- [ ] **Step 7: Implement `Sidebar.tsx`**

```tsx
import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Link as LinkIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { NAV_GROUPS, isActivePath } from './navItems'
import UserMenu from './UserMenu'

export default function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { pathname } = useLocation()
  const { t } = useTranslation()

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-2.5 px-4 py-4">
        <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <LinkIcon className="size-4" aria-hidden="true" />
        </span>
        <span className="font-display text-base font-semibold" translate="no">
          Link Into The SSI
        </span>
      </div>

      <nav aria-label={t('nav.groups.main')} className="flex-1 overflow-y-auto px-3 py-2">
        {NAV_GROUPS.map(group => (
          <div key={group.labelKey} className="mb-2">
            <p className="px-2 pt-3 pb-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
              {t(group.labelKey)}
            </p>
            {group.items.map(item => {
              const active = isActivePath(item.path, pathname)
              const Icon = item.icon
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={onNavigate}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium no-underline transition-colors',
                    active
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                      : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/60'
                  )}
                >
                  <Icon className="size-[18px]" aria-hidden="true" />
                  {t(item.labelKey)}
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <UserMenu />
      </div>
    </div>
  )
}
```

- [ ] **Step 8: Run to verify it passes** (UserMenu must exist — implement Task 4 first if doing strict TDD; the import
  is satisfied there)

Run: `pnpm --filter app exec vitest run src/components/shell/Sidebar.test.tsx`
Expected: PASS once `UserMenu` (Task 4) exists.

> **Sequencing note:** Tasks 3 and 4 are mutually referencing (Sidebar imports UserMenu). Implement `UserMenu` (Task 4)
> before running Sidebar's render test, or stub the import then complete Task 4. The two tasks share one checkpoint if
> implemented together.

- [ ] **Step 9: Checkpoint (Henriko commits)**

---

### Task 4: `UserMenu` (absorbs the sign-out flow)

**Files:**

- Modify: `app/src/lib/session.ts` (add a testable `performSignOut`)
- Test: `app/src/lib/session.test.ts` (extend existing)
- Create: `app/src/components/shell/UserMenu.tsx`
- Test: `app/src/components/shell/UserMenu.test.tsx`

**Interfaces:**

- Consumes: `DropdownMenu*` (Task 2), `useMutation(api.users.logout)`, `Avatar` (Phase 1).
- Produces:
  `performSignOut(logout: (args: { sessionToken: string }) => Promise<unknown>, token: string | null): Promise<void>`
  and `<UserMenu />`.

- [ ] **Step 1: Write the failing test for `performSignOut`**

Add to `app/src/lib/session.test.ts`:

```ts
import { performSignOut } from './session'
import { vi } from 'vitest'

describe('performSignOut', () => {
  it('marks signed out, logs out server-side, then leaves for the landing site', async () => {
    const order: string[] = []
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation((k) => { if (k === 'signedOut') order.push('mark') })
    const assign = vi.fn(() => order.push('assign'))
    ;(window as any).location = { assign, href: '/', origin: window.location.origin }
    const logout = vi.fn(async () => { order.push('logout') })

    await performSignOut(logout, 'tok-1')

    expect(logout).toHaveBeenCalledWith({ sessionToken: 'tok-1' })
    expect(order).toEqual(['mark', 'logout', 'assign'])
    vi.restoreAllMocks()
  })

  it('still leaves even when there is no token', async () => {
    const assign = vi.fn()
    ;(window as any).location = { assign, href: '/', origin: window.location.origin }
    const logout = vi.fn()
    await performSignOut(logout, null)
    expect(logout).not.toHaveBeenCalled()
    expect(assign).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter app exec vitest run src/lib/session.test.ts`
Expected: FAIL ("performSignOut is not a function").

- [ ] **Step 3: Add `performSignOut` to `session.ts`**

Append to `app/src/lib/session.ts`:

```ts
/**
 * Full sign-out orchestration used by the app shell's user menu: set the explicit-sign-out marker
 * BEFORE logout (so the reactive getMe→null doesn't trip auto-OAuth), invalidate the session
 * server-side when a token exists, then leave the SPA for the landing site.
 */
export async function performSignOut(
  logout: (args: { sessionToken: string }) => Promise<unknown>,
  token: string | null
): Promise<void> {
  beginSignOut()
  if (token) {
    try {
      await logout({ sessionToken: token })
    } catch {
      /* ignore — we sign out locally regardless */
    }
  }
  signOut()
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter app exec vitest run src/lib/session.test.ts`
Expected: PASS.

- [ ] **Step 5: Implement `UserMenu.tsx`**

```tsx
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useMutation } from 'convex/react'
import { ChevronsUpDown, LogOut, Settings as SettingsIcon } from 'lucide-react'
import { api } from '../../convex'
import { performSignOut } from '@/lib/session'
import { Avatar } from '../ui/avatar'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '../ui/dropdown-menu'

export default function UserMenu({ name = 'Account' }: { name?: string }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const logout = useMutation(api.users.logout)

  async function handleSignOut() {
    await performSignOut(logout, sessionStorage.getItem('sessionToken'))
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t('nav.openMenu')}
        className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left outline-none hover:bg-sidebar-accent/60 focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Avatar name={name} size="sm" />
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{name}</span>
        <ChevronsUpDown className="size-4 text-muted-foreground" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top">
        <DropdownMenuItem onSelect={() => navigate('/settings')}>
          <SettingsIcon className="size-4" aria-hidden="true" />
          {t('shell.profile')}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={handleSignOut}>
          <LogOut className="size-4" aria-hidden="true" />
          {t('nav.signOut')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
```

- [ ] **Step 6: Write a render test for `UserMenu`** (open via `defaultOpen` wrapper is not available here; assert the
  trigger renders — open-state is radix/jsdom-fragile, so keep it to the trigger + the tested `performSignOut`)

Create `app/src/components/shell/UserMenu.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'

vi.mock('convex/react', () => ({ useMutation: () => vi.fn() }))

import UserMenu from './UserMenu'

describe('UserMenu', () => {
  it('renders the menu trigger with an accessible label', () => {
    render(
      <MemoryRouter>
        <UserMenu name="Mariana Costa" />
      </MemoryRouter>
    )
    expect(screen.getByRole('button', { name: /open user menu/i })).toBeInTheDocument()
    expect(screen.getByText('Mariana Costa')).toBeInTheDocument()
  })
})
```

- [ ] **Step 7: Run UserMenu + session tests**

Run: `pnpm --filter app exec vitest run src/components/shell/UserMenu.test.tsx src/lib/session.test.ts`
Expected: PASS.

- [ ] **Step 8: Checkpoint (Henriko commits)** — Sidebar (Task 3) render test now passes too; run
  `pnpm --filter app exec vitest run src/components/shell/Sidebar.test.tsx` to confirm.

---

### Task 5: `TopBar` (search placeholder + `LanguageMenu` + `ThemeToggle`)

**Files:**

- Create: `app/src/components/shell/ThemeToggle.tsx`
- Create: `app/src/components/shell/LanguageMenu.tsx`
- Create: `app/src/components/shell/TopBar.tsx`
- Test: `app/src/components/shell/TopBar.test.tsx`

**Interfaces:**

- Consumes: `useTheme` (Phase 1), `DropdownMenu*` (Task 2), `i18n`.
- Produces: `<TopBar onOpenSidebar={() => void} />` (the hamburger callback for the mobile drawer).

- [ ] **Step 1: Implement `ThemeToggle.tsx`**

```tsx
import { useTranslation } from 'react-i18next'
import { Moon, Sun } from 'lucide-react'
import { useTheme } from '../ThemeProvider'

export default function ThemeToggle() {
  const { t } = useTranslation()
  const { pref, setPref } = useTheme()
  const isDark = pref === 'dark'

  return (
    <button
      type="button"
      aria-label={t('shell.theme')}
      onClick={() => setPref(isDark ? 'light' : 'dark')}
      className="flex size-9 items-center justify-center rounded-lg border border-border text-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
    >
      {isDark ? <Sun className="size-[18px]" aria-hidden="true" /> : <Moon className="size-[18px]" aria-hidden="true" />}
    </button>
  )
}
```

- [ ] **Step 2: Implement `LanguageMenu.tsx`**

```tsx
import { useTranslation } from 'react-i18next'
import { Globe } from 'lucide-react'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '../ui/dropdown-menu'

const LANGUAGES = [
  { code: 'en', label: 'EN' },
  { code: 'pt', label: 'PT' },
  { code: 'es', label: 'ES' }
]

export default function LanguageMenu() {
  const { i18n, t } = useTranslation()
  const current = i18n.language?.split('-')[0] ?? 'en'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t('shell.language')}
        className="flex h-9 items-center gap-1.5 rounded-lg border border-border px-2.5 text-sm text-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Globe className="size-4" aria-hidden="true" />
        {LANGUAGES.find(l => l.code === current)?.label ?? 'EN'}
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {LANGUAGES.map(lang => (
          <DropdownMenuItem key={lang.code} onSelect={() => i18n.changeLanguage(lang.code)}>
            {lang.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
```

- [ ] **Step 3: Implement `TopBar.tsx`** (search is a placeholder — a button that announces "coming soon" via `alert`
  /no-op; non-functional by design)

```tsx
import { useTranslation } from 'react-i18next'
import { Menu, Search } from 'lucide-react'
import LanguageMenu from './LanguageMenu'
import ThemeToggle from './ThemeToggle'

export default function TopBar({ onOpenSidebar }: { onOpenSidebar: () => void }) {
  const { t } = useTranslation()

  return (
    <header className="flex h-14 items-center gap-2 border-b border-border bg-background px-3 sm:px-4">
      <button
        type="button"
        aria-label={t('shell.openSidebar')}
        onClick={onOpenSidebar}
        className="flex size-9 items-center justify-center rounded-lg text-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring lg:hidden"
      >
        <Menu className="size-5" aria-hidden="true" />
      </button>

      <button
        type="button"
        aria-label={t('shell.search')}
        title={t('shell.searchComingSoon')}
        className="ml-auto flex h-9 max-w-64 flex-1 items-center gap-2 rounded-lg border border-border bg-card px-2.5 text-sm text-muted-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Search className="size-4" aria-hidden="true" />
        <span className="truncate">{t('shell.search')}</span>
        <kbd className="ml-auto rounded border border-border px-1.5 text-[11px]">⌘&nbsp;K</kbd>
      </button>

      <LanguageMenu />
      <ThemeToggle />
    </header>
  )
}
```

- [ ] **Step 4: Write the `TopBar` test**

Create `app/src/components/shell/TopBar.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'
import { ThemeProvider } from '../ThemeProvider'
import TopBar from './TopBar'

function renderTopBar(onOpen = vi.fn()) {
  return render(
    <ThemeProvider>
      <TopBar onOpenSidebar={onOpen} />
    </ThemeProvider>
  )
}

describe('TopBar', () => {
  it('renders the search placeholder and theme/language controls', () => {
    renderTopBar()
    expect(screen.getByRole('button', { name: /search posts, people/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /toggle theme/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /language/i })).toBeInTheDocument()
  })
  it('calls onOpenSidebar when the hamburger is clicked', () => {
    const onOpen = vi.fn()
    renderTopBar(onOpen)
    fireEvent.click(screen.getByRole('button', { name: /open navigation/i }))
    expect(onOpen).toHaveBeenCalled()
  })
})
```

- [ ] **Step 5: Run to verify it passes**

Run: `pnpm --filter app exec vitest run src/components/shell/TopBar.test.tsx`
Expected: PASS.

- [ ] **Step 6: Checkpoint (Henriko commits)**

---

### Task 6: `AppShell` (compose + responsive drawer + skip link + MOTD slot)

**Files:**

- Create: `app/src/components/shell/AppShell.tsx`
- Test: `app/src/components/shell/AppShell.test.tsx`

**Interfaces:**

- Consumes: `Sidebar`, `TopBar`, radix `Dialog`.
- Produces: `<AppShell>{children}</AppShell>` — persistent sidebar ≥`lg`, drawer below `lg` (radix Dialog gives
  focus-trap + `Esc` + scroll-lock), a skip-to-content link, and a `<main id="main-content">` wrapper.

- [ ] **Step 1: Implement `AppShell.tsx`**

```tsx
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Dialog } from 'radix-ui'
import Sidebar from './Sidebar'
import TopBar from './TopBar'

export default function AppShell({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <div className="flex min-h-dvh bg-background">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
      >
        {t('shell.skipToContent')}
      </a>

      {/* Persistent sidebar (desktop) */}
      <aside className="hidden w-56 shrink-0 border-r border-sidebar-border lg:block">
        <Sidebar />
      </aside>

      {/* Drawer (mobile) */}
      <Dialog.Root open={drawerOpen} onOpenChange={setDrawerOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50 lg:hidden" />
          <Dialog.Content
            aria-label={t('shell.openSidebar')}
            className="fixed inset-y-0 left-0 z-50 w-64 overscroll-contain outline-none lg:hidden"
          >
            <Sidebar onNavigate={() => setDrawerOpen(false)} />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar onOpenSidebar={() => setDrawerOpen(true)} />
        <main id="main-content" className="flex-1">
          {children}
        </main>
      </div>
    </div>
  )
}
```

> The `Motd` banner and `FeedbackButton` stay as siblings rendered by `RequireAuth` (Task 7); `AppShell` only owns
> layout.

- [ ] **Step 2: Write the `AppShell` test**

Create `app/src/components/shell/AppShell.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'

vi.mock('convex/react', () => ({ useMutation: () => vi.fn() }))

import { ThemeProvider } from '../ThemeProvider'
import AppShell from './AppShell'

describe('AppShell', () => {
  it('renders children inside the main landmark with a skip link', () => {
    render(
      <ThemeProvider>
        <MemoryRouter initialEntries={['/feed']}>
          <AppShell>
            <p>Hello feed</p>
          </AppShell>
        </MemoryRouter>
      </ThemeProvider>
    )
    expect(screen.getByText('Hello feed')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /skip to content/i })).toHaveAttribute('href', '#main-content')
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main-content')
  })
})
```

- [ ] **Step 3: Run to verify it passes**

Run: `pnpm --filter app exec vitest run src/components/shell/AppShell.test.tsx`
Expected: PASS.

- [ ] **Step 4: Checkpoint (Henriko commits)**

---

### Task 7: Wire `AppShell` into `RequireAuth`; retire `AppNav`

**Files:**

- Modify: `app/src/App.tsx:59-67` (the authenticated render branch)
- Delete: `app/src/components/AppNav.tsx`
- Delete: `app/src/components/AppNav.test.tsx` (if present) — or confirm none exists

**Interfaces:**

- Consumes: `AppShell` (Task 6). The gate screens above the final `return` in `RequireAuth` are unchanged (they render
  without the shell).

- [ ] **Step 1: Replace the authenticated branch in `App.tsx`**

Change the final `return (...)` of `RequireAuth` from the current `<><Motd /><AppNav />{children}<FeedbackButton /></>`
to:

```tsx
  return (
    <AppShell>
      <Motd />
      {children}
      <FeedbackButton />
    </AppShell>
  )
```

Update imports: remove `import AppNav from './components/AppNav'`; add
`import AppShell from './components/shell/AppShell'`.

- [ ] **Step 2: Delete the old nav**

Run:

```bash
git rm app/src/components/AppNav.tsx
```

(If `app/src/components/AppNav.test.tsx` exists, `git rm` it too.) If any other file imports `AppNav`, update it —
search first:
Run: (use Grep) search for `AppNav` across `app/src`. Expected: only `App.tsx` referenced it.

> Note: `git rm` stages a deletion but does not commit — consistent with the no-commit rule; Henriko commits at the
> checkpoint.

- [ ] **Step 3: Typecheck + full suite**

Run: `pnpm --filter app exec tsc --noEmit && pnpm --filter app test`
Expected: no type errors; all tests PASS (no remaining `AppNav` references).

- [ ] **Step 4: Manual smoke (desktop + mobile drawer)**

Run: `pnpm --filter app dev`, open `http://localhost:5174/feed`. Verify: sidebar shows Main/Manage groups with Feed
active; language + theme toggle work; at <1024px the sidebar collapses and the hamburger opens a drawer that traps focus
and closes on `Esc`. Stop the dev server.

- [ ] **Step 5: Checkpoint (Henriko commits)**

---

## Phase 2 Done Criteria

- [ ] `RequireAuth` renders the `AppShell`; `AppNav` is deleted; no dangling imports.
- [ ] Sidebar shows Main/Manage groups (no Admin), active item has `aria-current="page"`; all labels are i18n (
  en/pt/es).
- [ ] User menu signs out via `performSignOut`; language switcher and theme toggle work; search is a non-functional
  placeholder.
- [ ] Mobile drawer opens from the hamburger, traps focus, closes on `Esc`/selection; skip link present.
- [ ] `pnpm verify` passes.
- [ ] Update `docs/PLATFORM.md` shell section + Mermaid flow (folded into this phase's docs task if not already covered
  by Phase 1's Design System section — add the navigation/shell description and the gate-screen bypass).

## Self-Review (completed by plan author)

- **Spec coverage:** §5.1 decomposition → Tasks 3–6; §5.2 sidebar/groups/active/user-chip → Tasks 3–4; §5.3 top bar (
  search placeholder, language, theme) → Task 5; §5.4 responsive drawer + focus mgmt → Task 6; §5.5 MOTD/feedback
  placement → Task 7; §5.6 i18n + `translate="no"` → Tasks 1, 3; §8E native-select replacement → Task 5 (`LanguageMenu`
  replaces the native `<select>`). Admin URL-only (D7) → Task 3 (`navItems` excludes `/admin`, with a guard test).
- **Placeholder scan:** the only "placeholder" is the intentional non-functional search (D8), explicitly scoped; no
  plan-content placeholders.
- **Type consistency:** `performSignOut` (Task 4) signature matches its call in `UserMenu`; `NAV_GROUPS`/
  `isActivePath` (Task 3) consistent; `onOpenSidebar`/`onNavigate` callbacks consistent across TopBar/Sidebar/AppShell.
- **Known sequencing:** Sidebar↔UserMenu mutual import — implement Task 4 alongside Task 3 (noted in Task 3 Step 8).
