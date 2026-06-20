# UI Revamp — Phase 1 (Foundation) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:
> executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the stock-shadcn grayscale theme with the "warm premium" branded token system (light + dark),
self-host the brand fonts, add a theme provider with persistence, and ship the three new base primitives (Avatar, Badge,
PageHeader) — so the whole app re-themes at the token level before any screen is hand-touched.

**Architecture:** Tokens are CSS variables in `app/src/index.css` mapped to shadcn's semantic names; the existing
`Button`/`Input` primitives are already token-driven and adopt the new look automatically. A small pure `lib/theme.ts`
module handles light/dark resolution + persistence; a thin `ThemeProvider` applies it. New primitives are shadcn-style (
cva + `cn`) and live in `app/src/components/ui/`.

**Tech Stack:** React 19, Vite, Tailwind CSS v4, shadcn/ui, class-variance-authority, `@fontsource`, vitest +
@testing-library/react (jsdom).

**Spec:** `docs/superpowers/specs/2026-06-20-ui-revamp-design.md` (§3 decisions, §4 foundations, §8 QC requirements).

## Global Constraints

- **Commits:** Per `CLAUDE.md`, the implementing agent **NEVER** runs `git commit`/`git push`. Each task ends with a *
  *Checkpoint** (run tests + typecheck green, then hand off to Henriko to review and commit). Do not stage-and-commit
  autonomously.
- **Package manager:** use **pnpm**, never npm. App-scoped commands use `pnpm --filter app …`.
- **Color tokens** in this plan are the **starting point**; before the phase is declared done, verify every
  foreground/background pair meets **WCAG AA** (esp. `--gold-text` on `--background` cream, and all dark-mode pairs) and
  darken `--gold-text` toward `#7A5816` if it fails.
- **Two-gold rule:** `--primary` (bright gold) for fills/borders/focus/underline only; `--gold-text` for
  text/links/icons.
- **Fonts self-hosted** via `@fontsource` (no Google Fonts CDN — privacy).
- **Casing:** Title Case for interactive labels (buttons/nav/tabs); sentence-case for serif page `<h1>`s.
- **Tests:** keep existing vitest suites green; update only tests that assert a specific class/color. Run
  `pnpm verify` (format + lint + typecheck + tests) before declaring the phase done.

---

### Task 1: Self-host brand fonts (DM Sans + Cormorant Garamond), remove Geist

**Files:**

- Modify: `app/package.json` (dependencies)
- Modify: `app/src/index.css:1-4` (font imports) and `app/src/index.css:29-30` (`@theme` font vars)

**Interfaces:**

- Produces: the `--font-sans` (DM Sans) and `--font-display` (Cormorant Garamond) theme variables, generating Tailwind's
  `font-sans` and `font-display` utilities used by later tasks.

- [ ] **Step 1: Install the font packages**

Run:

```bash
pnpm --filter app add @fontsource-variable/dm-sans @fontsource/cormorant-garamond
pnpm --filter app remove @fontsource-variable/geist
```

Expected: `app/package.json` gains `@fontsource-variable/dm-sans` and `@fontsource/cormorant-garamond`, loses
`@fontsource-variable/geist`.

> If `@fontsource-variable/cormorant-garamond` is preferred and exists, it may be used instead; this plan pins the
> static `@fontsource/cormorant-garamond` weights 500/600 (the only weights the display font needs).

- [ ] **Step 2: Swap the font imports in `index.css`**

Replace line 4 (`@import '@fontsource-variable/geist';`) with:

```css
@import '@fontsource-variable/dm-sans';
@import '@fontsource/cormorant-garamond/500.css';
@import '@fontsource/cormorant-garamond/600.css';
```

- [ ] **Step 3: Update the `@theme` font variables**

In the `@theme inline { … }` block, replace `--font-sans: 'Geist Variable', sans-serif;` with the two lines:

```css
--font-sans: 'DM Sans Variable', sans-serif;
--font-display: 'Cormorant Garamond', Georgia, serif;
```

(Leave `--font-heading: var(--font-sans);` as-is.)

- [ ] **Step 4: Verify the app boots with the new fonts**

Run: `pnpm --filter app dev` and open `http://localhost:5174`.
Expected: app loads with no console font errors; body text renders in DM Sans. (Pure font/CSS wiring — verified by
running, not a unit test.) Stop the dev server.

- [ ] **Step 5: Typecheck**

Run: `pnpm --filter app exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Checkpoint (Henriko commits)**

Report: fonts swapped, `index.css` imports + `@theme` updated, typecheck clean. Hand off to Henriko to review and
commit. Do **not** commit.

---

### Task 2: Replace the color tokens with the warm-premium palette (light + dark)

**Files:**

- Modify: `app/src/index.css` — the `@theme inline` mappings, the `:root` block, and the `.dark` block.

**Interfaces:**

- Produces: all semantic color utilities used everywhere downstream (`bg-background`, `text-foreground`, `bg-primary`,
  `text-gold-text`, `bg-success`, `bg-accent`, etc.) in their warm-premium values, for both themes.

- [ ] **Step 1: Add new token mappings to `@theme inline`**

Inside the `@theme inline { … }` block, add these lines (next to the existing `--color-*` mappings):

```css
--color-gold-text: var(--gold-text);
--color-success: var(--success);
--color-success-foreground: var(--success-foreground);
--color-destructive-foreground: var(--destructive-foreground);
```

- [ ] **Step 2: Replace the entire `:root` block (light theme)**

Replace the current `:root { … }` block with:

```css
:root {
  --radius: 0.75rem;
  --background: #f2eee6;
  --foreground: #1c1813;
  --popover: #ffffff;
  --popover-foreground: #1c1813;
  --primary: #c9963e;
  --primary-foreground: #1c1813;
  --secondary: #faf7f0;
  --secondary-foreground: #2a251d;
  --muted: #efeae0;
  --muted-foreground: #6e6757;
  --accent: #f6ead0;
  --accent-foreground: #8a6418;
  --border: #e4dccd;
  --input: #e4dccd;
  --ring: #c9963e;
  --card: #ffffff;
  --card-foreground: #1c1813;
  --destructive: #b4231f;
  --destructive-foreground: #ffffff;
  --gold-text: #8a6418;
  --success: #e6f1dd;
  --success-foreground: #3b6d2e;
  --chart-1: #c9963e;
  --chart-2: #8a6418;
  --chart-3: #6e6757;
  --chart-4: #b4231f;
  --chart-5: #3b6d2e;
  --sidebar: #faf7f0;
  --sidebar-foreground: #2a251d;
  --sidebar-primary: #c9963e;
  --sidebar-primary-foreground: #1c1813;
  --sidebar-accent: #f6ead0;
  --sidebar-accent-foreground: #8a6418;
  --sidebar-border: #e4dccd;
  --sidebar-ring: #c9963e;
}
```

- [ ] **Step 3: Replace the entire `.dark` block (dark theme)**

Replace the current `.dark { … }` block with:

```css
.dark {
  --background: #0e1320;
  --foreground: #f5f0e8;
  --popover: #161c2b;
  --popover-foreground: #f5f0e8;
  --primary: #d8a94e;
  --primary-foreground: #0e1320;
  --secondary: #131a28;
  --secondary-foreground: #e7e1d6;
  --muted: #1c2433;
  --muted-foreground: #9a9384;
  --accent: #2a2418;
  --accent-foreground: #e8c474;
  --border: #2a3142;
  --input: #2a3142;
  --ring: #d8a94e;
  --card: #161c2b;
  --card-foreground: #f5f0e8;
  --destructive: #e06a5e;
  --destructive-foreground: #0e1320;
  --gold-text: #e8c474;
  --success: #1e2a1c;
  --success-foreground: #8fcb8a;
  --chart-1: #d8a94e;
  --chart-2: #e8c474;
  --chart-3: #9a9384;
  --chart-4: #e06a5e;
  --chart-5: #8fcb8a;
  --sidebar: #131a28;
  --sidebar-foreground: #e7e1d6;
  --sidebar-primary: #d8a94e;
  --sidebar-primary-foreground: #0e1320;
  --sidebar-accent: #2a2418;
  --sidebar-accent-foreground: #e8c474;
  --sidebar-border: #2a3142;
  --sidebar-ring: #d8a94e;
}
```

- [ ] **Step 4: Verify both themes render**

Run: `pnpm --filter app dev`, open `http://localhost:5174`. In devtools, add the `dark` class to `<html>` to preview
dark mode.
Expected: light mode shows a cream canvas with white cards and gold buttons; dark mode shows ink-navy canvas with cream
text. No invisible text. Stop the dev server.

- [ ] **Step 5: Contrast verification (required)**

Using any WCAG contrast checker, verify these pairs reach **AA (4.5:1 for text)**: `--foreground`/`--background`,
`--muted-foreground`/`--background`, `--gold-text`/`--background`, `--gold-text`/`--card`, `--accent-foreground`/
`--accent`, and the dark equivalents. If `--gold-text` on cream `--background` fails, change `--gold-text` (light) to
`#7a5816` and re-verify.
Expected: all pairs pass; record any value change.

- [ ] **Step 6: Run the existing suite (catch class regressions)**

Run: `pnpm --filter app test`
Expected: PASS. If a test fails because it asserts a removed hardcoded color/class, that screen is restyled in a later
phase — note it; do not loosen the token here.

- [ ] **Step 7: Checkpoint (Henriko commits)**

Report: tokens replaced (light + dark), contrast verified (note any `--gold-text` adjustment), tests green. Hand off to
Henriko.

---

### Task 3: Theme system — `lib/theme.ts` + `ThemeProvider` (light/dark + persistence)

**Files:**

- Create: `app/src/lib/theme.ts`
- Test: `app/src/lib/theme.test.ts`
- Create: `app/src/components/ThemeProvider.tsx`
- Modify: `app/src/main.tsx` (wrap the app)
- Modify: `app/index.html` (add `<meta name="theme-color">`)

**Interfaces:**

- Produces: `ThemePref = 'light' | 'dark' | 'system'`, `resolveTheme(pref, prefersDark): 'light'|'dark'`,
  `getStoredTheme(): ThemePref`, `setStoredTheme(pref): void`, `applyTheme(resolved, doc?): void`, and a
  `useTheme(): { pref, setPref }` hook + `ThemeProvider`. The UserMenu toggle (Phase 2) consumes `useTheme`.

- [ ] **Step 1: Write the failing test for `lib/theme.ts`**

Create `app/src/lib/theme.test.ts`:

```ts
import { beforeEach } from 'vitest'
import { resolveTheme, getStoredTheme, setStoredTheme, applyTheme } from './theme'

beforeEach(() => {
  localStorage.clear()
  document.documentElement.className = ''
  document.documentElement.style.colorScheme = ''
})

describe('resolveTheme', () => {
  it('returns the explicit preference unchanged', () => {
    expect(resolveTheme('light', true)).toBe('light')
    expect(resolveTheme('dark', false)).toBe('dark')
  })
  it('resolves "system" from prefersDark', () => {
    expect(resolveTheme('system', true)).toBe('dark')
    expect(resolveTheme('system', false)).toBe('light')
  })
})

describe('stored theme', () => {
  it('defaults to "system" when nothing stored', () => {
    expect(getStoredTheme()).toBe('system')
  })
  it('round-trips a stored preference', () => {
    setStoredTheme('dark')
    expect(getStoredTheme()).toBe('dark')
  })
  it('ignores a junk stored value', () => {
    localStorage.setItem('theme', 'banana')
    expect(getStoredTheme()).toBe('system')
  })
})

describe('applyTheme', () => {
  it('adds the dark class and sets color-scheme for dark', () => {
    applyTheme('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(document.documentElement.style.colorScheme).toBe('dark')
  })
  it('removes the dark class for light', () => {
    document.documentElement.classList.add('dark')
    applyTheme('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(document.documentElement.style.colorScheme).toBe('light')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter app exec vitest run src/lib/theme.test.ts`
Expected: FAIL with "Failed to resolve import './theme'".

- [ ] **Step 3: Implement `lib/theme.ts`**

Create `app/src/lib/theme.ts`:

```ts
export type ThemePref = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

const STORAGE_KEY = 'theme'
const THEME_COLORS: Record<ResolvedTheme, string> = { light: '#f2eee6', dark: '#0e1320' }

export function getStoredTheme(): ThemePref {
  const v = localStorage.getItem(STORAGE_KEY)
  return v === 'light' || v === 'dark' || v === 'system' ? v : 'system'
}

export function setStoredTheme(pref: ThemePref): void {
  localStorage.setItem(STORAGE_KEY, pref)
}

export function resolveTheme(pref: ThemePref, prefersDark: boolean): ResolvedTheme {
  if (pref === 'system') return prefersDark ? 'dark' : 'light'
  return pref
}

export function applyTheme(resolved: ResolvedTheme, doc: Document = document): void {
  doc.documentElement.classList.toggle('dark', resolved === 'dark')
  doc.documentElement.style.colorScheme = resolved
  doc.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[resolved])
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter app exec vitest run src/lib/theme.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Implement `ThemeProvider` + `useTheme`**

Create `app/src/components/ThemeProvider.tsx`:

```tsx
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { type ThemePref, getStoredTheme, setStoredTheme, resolveTheme, applyTheme } from '@/lib/theme'

type ThemeContextValue = { pref: ThemePref; setPref: (pref: ThemePref) => void }
const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [pref, setPrefState] = useState<ThemePref>(() => getStoredTheme())

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const sync = () => applyTheme(resolveTheme(pref, mq.matches))
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [pref])

  const setPref = (next: ThemePref) => {
    setStoredTheme(next)
    setPrefState(next)
  }

  return <ThemeContext.Provider value={{ pref, setPref }}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
```

- [ ] **Step 6: Wrap the app and add the theme-color meta tag**

In `app/src/main.tsx`, import `ThemeProvider` and wrap the root element (outermost, around the existing tree):

```tsx
import { ThemeProvider } from './components/ThemeProvider'
// …
<ThemeProvider>
  {/* existing app tree (router/ConvexProvider/etc.) */}
</ThemeProvider>
```

In `app/index.html`, inside `<head>`, add:

```html
<meta name="theme-color" content="#f2eee6" />
```

- [ ] **Step 7: Typecheck + full app suite**

Run: `pnpm --filter app exec tsc --noEmit && pnpm --filter app test`
Expected: no type errors; all tests PASS.

- [ ] **Step 8: Checkpoint (Henriko commits)**

Report: theme module + provider added, app wrapped, meta tag added, tests green. Hand off to Henriko.

---

### Task 4: `Avatar` primitive (extract the initials fallback)

**Files:**

- Create: `app/src/components/ui/avatar.tsx`
- Test: `app/src/components/ui/avatar.test.tsx`

**Interfaces:**

- Produces: `getInitials(name: string): string` and
  `<Avatar name={string} src?={string|null} size?={'sm'|'md'|'lg'} className?={string} />`. Consumed later by PostCard,
  the sidebar user chip, and admin rows.

- [ ] **Step 1: Write the failing test**

Create `app/src/components/ui/avatar.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { Avatar, getInitials } from './avatar'

describe('getInitials', () => {
  it('uses first and last initial for a full name', () => {
    expect(getInitials('Mariana Costa')).toBe('MC')
  })
  it('uses one initial for a single name', () => {
    expect(getInitials('Mariana')).toBe('M')
  })
  it('falls back to "?" for an empty name', () => {
    expect(getInitials('   ')).toBe('?')
  })
})

describe('Avatar', () => {
  it('renders an img with dimensions when src is provided', () => {
    render(<Avatar name="Mariana Costa" src="https://example.com/a.jpg" />)
    const img = screen.getByRole('img')
    expect(img).toHaveAttribute('width', '40')
    expect(img).toHaveAttribute('height', '40')
    expect(img).toHaveAttribute('loading', 'lazy')
  })
  it('renders initials when there is no src', () => {
    render(<Avatar name="Mariana Costa" />)
    expect(screen.getByText('MC')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter app exec vitest run src/components/ui/avatar.test.tsx`
Expected: FAIL with "Failed to resolve import './avatar'".

- [ ] **Step 3: Implement `avatar.tsx`**

Create `app/src/components/ui/avatar.tsx`:

```tsx
import { cn } from '@/lib/utils'

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0]!.charAt(0).toUpperCase()
  return (parts[0]!.charAt(0) + parts[parts.length - 1]!.charAt(0)).toUpperCase()
}

const SIZES = {
  sm: { cls: 'size-8 text-xs', px: 32 },
  md: { cls: 'size-10 text-sm', px: 40 },
  lg: { cls: 'size-12 text-base', px: 48 }
} as const

export function Avatar({
  name,
  src,
  size = 'md',
  className
}: {
  name: string
  src?: string | null
  size?: keyof typeof SIZES
  className?: string
}) {
  const { cls, px } = SIZES[size]
  if (src) {
    return (
      <img
        src={src}
        alt=""
        width={px}
        height={px}
        loading="lazy"
        className={cn('rounded-full object-cover', cls, className)}
      />
    )
  }
  return (
    <span
      aria-hidden="true"
      className={cn('inline-flex items-center justify-center rounded-full bg-accent font-semibold text-accent-foreground', cls, className)}
    >
      {getInitials(name)}
    </span>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter app exec vitest run src/components/ui/avatar.test.tsx`
Expected: PASS.

- [ ] **Step 5: Checkpoint (Henriko commits)**

Report: Avatar primitive + tests green. Hand off to Henriko.

---

### Task 5: `Badge` primitive

**Files:**

- Create: `app/src/components/ui/badge.tsx`
- Test: `app/src/components/ui/badge.test.tsx`

**Interfaces:**

- Produces: `<Badge variant?={'default'|'success'|'warning'|'destructive'|'outline'} />` and `badgeVariants`. Consumed
  by My Posts, Billing, and Admin (status/plan).

- [ ] **Step 1: Write the failing test**

Create `app/src/components/ui/badge.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { Badge } from './badge'

describe('Badge', () => {
  it('renders its children', () => {
    render(<Badge>Active</Badge>)
    expect(screen.getByText('Active')).toBeInTheDocument()
  })
  it('applies the success variant classes', () => {
    render(<Badge variant="success">Active</Badge>)
    expect(screen.getByText('Active').className).toContain('bg-success')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter app exec vitest run src/components/ui/badge.test.tsx`
Expected: FAIL with "Failed to resolve import './badge'".

- [ ] **Step 3: Implement `badge.tsx`**

Create `app/src/components/ui/badge.tsx`:

```tsx
import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva('inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold', {
  variants: {
    variant: {
      default: 'bg-muted text-muted-foreground',
      success: 'bg-success text-success-foreground',
      warning: 'bg-accent text-accent-foreground',
      destructive: 'bg-destructive/10 text-destructive',
      outline: 'border border-border text-foreground'
    }
  },
  defaultVariants: { variant: 'default' }
})

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter app exec vitest run src/components/ui/badge.test.tsx`
Expected: PASS.

- [ ] **Step 5: Checkpoint (Henriko commits)**

Report: Badge primitive + tests green. Hand off to Henriko.

---

### Task 6: `PageHeader` primitive (serif H1 + gold underline + lead + actions)

**Files:**

- Create: `app/src/components/PageHeader.tsx`
- Test: `app/src/components/PageHeader.test.tsx`

**Interfaces:**

- Produces: `<PageHeader title={string} lead?={string} className?={string}>{actions}</PageHeader>`, rendering the page
  `<h1>`. Consumed by every screen in Phases 2–5.

- [ ] **Step 1: Write the failing test**

Create `app/src/components/PageHeader.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { PageHeader } from './PageHeader'

describe('PageHeader', () => {
  it('renders the title as an h1', () => {
    render(<PageHeader title="Feed" />)
    expect(screen.getByRole('heading', { level: 1, name: 'Feed' })).toBeInTheDocument()
  })
  it('renders the lead when provided', () => {
    render(<PageHeader title="Feed" lead="Posts from your circle." />)
    expect(screen.getByText('Posts from your circle.')).toBeInTheDocument()
  })
  it('renders action children', () => {
    render(<PageHeader title="Feed"><button>Add post</button></PageHeader>)
    expect(screen.getByRole('button', { name: 'Add post' })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter app exec vitest run src/components/PageHeader.test.tsx`
Expected: FAIL with "Failed to resolve import './PageHeader'".

- [ ] **Step 3: Implement `PageHeader.tsx`**

Create `app/src/components/PageHeader.tsx`:

```tsx
import { type ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function PageHeader({
  title,
  lead,
  className,
  children
}: {
  title: string
  lead?: string
  className?: string
  children?: ReactNode
}) {
  return (
    <div className={cn('mb-6 flex flex-wrap items-end justify-between gap-3', className)}>
      <div>
        <h1 className="inline-block border-b-2 border-primary pb-1 font-display text-3xl font-semibold text-balance text-foreground">
          {title}
        </h1>
        {lead ? <p className="mt-2 text-sm text-muted-foreground">{lead}</p> : null}
      </div>
      {children ? <div className="flex items-center gap-2">{children}</div> : null}
    </div>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter app exec vitest run src/components/PageHeader.test.tsx`
Expected: PASS.

- [ ] **Step 5: Checkpoint (Henriko commits)**

Report: PageHeader primitive + tests green. Hand off to Henriko.

---

### Task 7: Fix the `Button` `link` variant for the two-gold rule

**Files:**

- Modify: `app/src/components/ui/button.tsx:21` (link variant) and `:12` (default hover)
- Test: `app/src/components/ui/button.test.tsx`

**Interfaces:**

- Consumes: the `text-gold-text` utility (from Task 2).
- Produces: a `link` Button that uses gold-text (AA-safe) and a `default` Button whose hover deepens the gold.

- [ ] **Step 1: Write the failing test**

Create `app/src/components/ui/button.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { Button } from './button'

describe('Button variants', () => {
  it('uses gold-text for the link variant (not bright primary)', () => {
    render(<Button variant="link">View on LinkedIn</Button>)
    const btn = screen.getByRole('button', { name: 'View on LinkedIn' })
    expect(btn.className).toContain('text-gold-text')
    expect(btn.className).not.toContain('text-primary')
  })
  it('keeps the gold fill on the default variant', () => {
    render(<Button>Add post</Button>)
    expect(screen.getByRole('button', { name: 'Add post' }).className).toContain('bg-primary')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter app exec vitest run src/components/ui/button.test.tsx`
Expected: FAIL on the link assertion (`text-gold-text` not present; current is `text-primary`).

- [ ] **Step 3: Update the two variant strings**

In `app/src/components/ui/button.tsx`, change the `default` variant value to:

```
'bg-primary text-primary-foreground hover:bg-[color-mix(in_oklch,var(--primary),black_12%)]'
```

and the `link` variant value to:

```
'text-gold-text underline-offset-4 hover:underline'
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter app exec vitest run src/components/ui/button.test.tsx`
Expected: PASS.

- [ ] **Step 5: Checkpoint (Henriko commits)**

Report: Button link/default variants updated, tests green. Hand off to Henriko.

---

### Task 8: Document the design system in `docs/PLATFORM.md`

**Files:**

- Modify: `docs/PLATFORM.md` (new "Design System" section + ToC entry + "Maintaining This Document" mapping)

**Interfaces:** none (documentation).

- [ ] **Step 1: Read `docs/PLATFORM.md`**

Read the file to learn its heading style, Table-of-Contents format, and the "Maintaining This Document" mapping table.

- [ ] **Step 2: Add a "Design System" section**

Insert a new numbered section (matching the file's existing numbering/heading conventions) with this content, and add
the matching ToC entry:

```markdown
## Design System

The app (`app/`) uses a "warm premium" branded theme — the landing site's identity
(gold, cream, ink-navy) expressed as a calm working surface, in light (default) and dark.

- **Tokens:** semantic CSS variables in `app/src/index.css` (`:root` = light, `.dark` = dark),
  mapped to shadcn names via `@theme inline`. Components consume tokens only — no hardcoded
  palette colors.
- **Two-gold rule:** `--primary` (bright gold `#c9963e`) for fills/borders/focus/underlines;
  `--gold-text` (`#8a6418` light / `#e8c474` dark) for text, links, and small icons (bright gold
  fails WCAG on white).
- **Typography:** DM Sans (`--font-sans`, body/UI) + Cormorant Garamond (`--font-display`,
  page titles), both self-hosted via `@fontsource` (no Google CDN). Numeric data uses
  `tabular-nums`.
- **Theme:** `app/src/lib/theme.ts` + `ThemeProvider` resolve light/dark/system, persist the
  choice to `localStorage` (`theme`), seed from `prefers-color-scheme`, and set `color-scheme`
  + `<meta name="theme-color">`.
- **Primitives:** `app/src/components/ui/` (Button, Input, Badge, Avatar, …) are shadcn-style
  (cva + `cn`); `PageHeader` provides the serif H1 + gold underline used by every screen.
```

- [ ] **Step 3: Update the "Maintaining This Document" mapping**

Add a row mapping the app's design tokens / theme / primitives → this new "Design System" section, following the table's
existing format.

- [ ] **Step 4: Checkpoint (Henriko commits)**

Report: PLATFORM.md Design System section + ToC + maintaining-map added. Hand off to Henriko.

---

## Phase 1 Done Criteria

- [ ] App re-themes to warm premium in light and dark with no hardcoded colors changed yet in screens (those are Phases
  2–5).
- [ ] `pnpm verify` passes (format + lint + typecheck + all tests, including the new `theme`/`avatar`/`badge`/
  `PageHeader`/`button` suites).
- [ ] Contrast AA verified for all token pairs (Task 2 Step 5), with any `--gold-text` adjustment recorded.
- [ ] `docs/PLATFORM.md` has the Design System section.
- [ ] Each task reviewed and committed by Henriko (the agent committed nothing).

## Self-Review (completed by plan author)

- **Spec coverage:** §4.1 tokens → Task 2; §4.3 fonts → Task 1; §4.6 dark mode/`color-scheme`/`theme-color` → Tasks 2–3;
  §4.2 two-gold rule → Tasks 2 & 7; §6 primitives (Avatar/Badge/PageHeader, Button) → Tasks 4–7; §8A contrast → Task 2
  Step 5; §11 docs → Task 8. (Sidebar/TopBar/screens are Phases 2–5, out of this plan by design.)
- **Placeholder scan:** none — every code/test step shows full content.
- **Type consistency:** `getInitials`/`Avatar` (Task 4), `badgeVariants`/`Badge` (Task 5), `PageHeader` props (Task 6),
  and `theme.ts` exports (Task 3) are referenced consistently; Task 7 consumes `text-gold-text` defined in Task 2.
