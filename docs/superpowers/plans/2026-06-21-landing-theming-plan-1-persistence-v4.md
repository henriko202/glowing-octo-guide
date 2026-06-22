# Landing Theming Plan 1 — Cross-site Persistence + Tailwind v4 + Light/Dark

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:
> executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the landing a persistent, system-aware light/dark theme that survives across the apex and the app
subdomain, on a Tailwind v4 CSS-first foundation that matches the app.

**Architecture:** Phase A makes the **app** read/write the cross-site `theme` + `lang` cookies (scoped to the
registrable parent domain) so the two sites share preference. Phase B migrates the **landing** from Tailwind v3 (JS
config) to v4 (CSS-first), ports the app's palette as CSS variables under the landing's existing token names, adds a
`:root` (light) / `.dark` (dark) split with dedicated on-accent tokens, and adds a no-flash boot script + a
`ThemeToggle`. This plan is Phases A + B of the design spec; Phases C (i18n locale routing) + D (pt/es legal) follow in
Plan 2.

**Tech Stack:** pnpm workspace. App = Vite 6 + React 19 + Vitest 4 + Tailwind v4 (`@tailwindcss/vite`). Landing = Next
15 App Router + React 19 + Tailwind (migrating v3 → v4 via `@tailwindcss/postcss`). i18next-browser-languagedetector
8.x. Source of truth for the palette: `app/src/index.css`.

---

## Global Constraints

Every task's requirements implicitly include this section.

- **NEVER run any git command.** No `git add/commit/push/stash/checkout/reset/restore/rm/clean` — not at the end of a
  task, not "to be safe," not ever. Henriko (the user) makes all commits. The final step of each task is **save files
  only**. (A past subagent ran `git stash` and stranded completed work — do not.)
- **pnpm, never npm.** Run package commands from the repo root with `--filter`, e.g. `pnpm --filter landing build`. Do *
  *not** run the Convex CLI for this plan.
- **Landing has no test harness.** Verify landing (`landing/`) work via typecheck (
  `pnpm --filter landing exec tsc --noEmit`) + build (`pnpm --filter landing build`) + lint (`pnpm lint`) + a visual
  check. Only the **app** (`app/`) has Vitest — write real unit tests there (TDD).
- **Do NOT gate on `pnpm format:check`** (docs are not Prettier-clean repo-wide, so it fails on unrelated files).
  Instead run `pnpm exec prettier --write <files-you-changed>` to normalize, then gate on **lint + typecheck + app
  test + landing build**.
- **Cookie domain is env-configured, unset in dev.** `VITE_COOKIE_DOMAIN` (app) / `NEXT_PUBLIC_COOKIE_DOMAIN` (
  landing) = `.linkintothessi.com` in prod, **unset in dev** (host-only cookie; cross-site sync is prod-only because dev
  is `localhost:3000` vs `:5173`). Cookies: `Path=/`, `SameSite=Lax`, ~1yr.
- **Cookie + localStorage:** the cookie is the cross-site source of truth; keep a **localStorage mirror** for
  speed/back-compat. Theme cookie name = `theme` (values `light|dark|system`); language cookie name = `lang` (values
  `en|pt|es`).
- **v4 must use `@theme inline`** (not plain `@theme`). The landing's tokens are `var(--x)` indirections that flip on
  `.dark`; `@theme inline` makes utilities emit `color-mix(in oklab, var(--token) N%, transparent)` so opacity
  utilities (`text-cream/50`, `bg-gold/[0.04]`) stay reactive to the `.dark` override. Plain `@theme` breaks every `/NN`
  opacity utility in dark mode.
- **D6 — dark palette unifies with the app.** The landing's deeper navy is replaced by the app's dark values (`#060B18`→
  `#0e1320`, etc.). See the palette table below.
- **lnblue is a brand color, not a theme color** — `#0077b5` (and `-light` `#0a84ff`) stay constant across both themes (
  define only in `:root`).
- **On-accent foregrounds are theme-constant.** `--on-gold` (dark text on gold fills) and `--on-lnblue` (light text on
  the blue badge) do **not** flip — define only in `:root`. Never reuse `text-ink`/`text-cream` as on-accent text (they
  invert per theme and fail contrast).
- **Drop dead code, don't port it.** The v3 `fadeUp`/`shimmer` keyframes and the `cream.dim` token have **zero usages
  ** (audited) — omit them from the v4 CSS entirely.
- **Keep `docs/PLATFORM.md` in sync** in the same change (final task).

### Palette table (landing token ← app value), light / dark

| Token                           | Light     | Dark      | Notes                   |
|---------------------------------|-----------|-----------|-------------------------|
| `--ink` (page bg)               | `#f2eee6` | `#0e1320` | flips                   |
| `--ink-800`                     | `#faf7f0` | `#161c2b` | flips                   |
| `--ink-600`                     | `#ffffff` | `#1c2433` | flips                   |
| `--ink-400`                     | `#e4dccd` | `#2a3142` | flips                   |
| `--cream` (body text)           | `#1c1813` | `#f5f0e8` | flips                   |
| `--cream-muted`                 | `#6e6757` | `#9a9384` | flips                   |
| `--gold` (accent fills)         | `#c9963e` | `#d8a94e` | flips                   |
| `--gold-text` (gold text on bg) | `#8a6418` | `#e8c474` | flips; **new token**    |
| `--gold-light` (hover)          | `#e8b96a` | `#e8b96a` | constant                |
| `--lnblue`                      | `#0077b5` | `#0077b5` | constant (brand)        |
| `--lnblue-light`                | `#0a84ff` | `#0a84ff` | constant                |
| `--on-gold` (text on gold)      | `#1c1813` | `#1c1813` | constant; **new token** |
| `--on-lnblue` (text on blue)    | `#f5f0e8` | `#f5f0e8` | constant; **new token** |

Decorative (theme-aware), light / dark: `--ring-line` `rgba(28,24,19,0.10)` / `rgba(245,240,232,0.07)`; `--ring-gold`
`rgba(201,150,62,0.14)` / `rgba(201,150,62,0.08)`; `--glow-lnblue` `rgba(0,119,181,0.06)` / `rgba(0,119,181,0.10)`;
`--glow-gold` `rgba(201,150,62,0.10)` / `rgba(201,150,62,0.07)`.

---

## File Structure

**Phase A (app):**

- Create `app/src/lib/cookies.ts` — SSR-safe cookie read/write + pure `serializeCookie`. One responsibility: cookie I/O.
- Create `app/src/lib/cookies.test.ts` — Vitest unit tests.
- Modify `app/src/lib/theme.ts` — `getStoredTheme`/`setStoredTheme` use the cookie (localStorage mirror).
- Modify `app/src/lib/theme.test.ts` (create if absent) — cookie-priority tests.
- Modify `app/src/i18n/index.ts` — add the `cookie` detector.
- Modify `app/.env.example` — document `VITE_COOKIE_DOMAIN`.

**Phase B (landing):**

- Modify `landing/package.json` — drop `tailwindcss@3` + `autoprefixer`, add `tailwindcss@^4` + `@tailwindcss/postcss`.
- Modify `landing/postcss.config.mjs` — swap to `@tailwindcss/postcss`.
- Delete `landing/tailwind.config.ts`.
- Rewrite `landing/app/globals.css` — v4 CSS-first, token blocks, `@custom-variant dark`.
- Create `landing/lib/cookies.ts` — SSR-safe cookie I/O (Next/`process.env`).
- Create `landing/lib/theme.ts` — theme types + `resolveTheme`/`applyTheme` + cookie get/set.
- Create `landing/components/ThemeToggle.tsx` — `'use client'` 3-state toggle.
- Modify `landing/app/layout.tsx` — no-flash script, `<meta theme-color>`, `suppressHydrationWarning`.
- Modify `landing/components/Nav.tsx` — mount `ThemeToggle`.
- Modify the 12 components + 3 legal pages — gold-split + on-accent class swaps.
- Modify `landing/components/Hero.tsx`, `landing/components/FinalCTA.tsx` — decorative `rgba` → `var(...)`.
- Modify `landing/.env.example` — document `NEXT_PUBLIC_COOKIE_DOMAIN`.
- Modify `docs/PLATFORM.md` — theming + cross-site persistence.

---

## Phase A — Cross-site cookie foundation (app)

### Task A1: Cookie helper + tests

**Files:**

- Create: `app/src/lib/cookies.ts`
- Test: `app/src/lib/cookies.test.ts`
- Modify: `app/.env.example`

**Interfaces:**

- Produces: `serializeCookie(name: string, value: string, days: number, domain?: string): string`;
  `getCookie(name: string): string | null`; `setCookie(name: string, value: string, days?: number): void` (default
  `days = 365`, domain from `import.meta.env.VITE_COOKIE_DOMAIN`).

- [ ] **Step 1: Write the failing tests**

```ts
// app/src/lib/cookies.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { serializeCookie, getCookie, setCookie } from './cookies'

describe('serializeCookie', () => {
  it('builds a host-only cookie string with Path, Max-Age (1yr), SameSite', () => {
    expect(serializeCookie('theme', 'dark', 365)).toBe('theme=dark; Path=/; Max-Age=31536000; SameSite=Lax')
  })
  it('appends Domain when provided', () => {
    expect(serializeCookie('lang', 'pt', 365, '.linkintothessi.com')).toBe(
      'lang=pt; Path=/; Max-Age=31536000; SameSite=Lax; Domain=.linkintothessi.com'
    )
  })
  it('url-encodes the value', () => {
    expect(serializeCookie('x', 'a b;c', 1)).toBe('x=a%20b%3Bc; Path=/; Max-Age=86400; SameSite=Lax')
  })
})

describe('getCookie / setCookie round-trip (jsdom)', () => {
  beforeEach(() => {
    // clear any cookies between tests
    document.cookie.split(';').forEach(c => {
      const name = c.split('=')[0].trim()
      if (name) document.cookie = `${name}=; Path=/; Max-Age=0`
    })
  })
  it('reads back a written value', () => {
    setCookie('theme', 'light')
    expect(getCookie('theme')).toBe('light')
  })
  it('returns null for a missing cookie', () => {
    expect(getCookie('nope')).toBeNull()
  })
  it('decodes encoded values', () => {
    setCookie('lang', 'es')
    expect(getCookie('lang')).toBe('es')
  })
})
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `pnpm --filter app test cookies`
Expected: FAIL ("Failed to resolve import './cookies'" / functions not defined).

- [ ] **Step 3: Implement the helper**

```ts
// app/src/lib/cookies.ts
// Cross-site cookie I/O for the theme + language preferences. In prod,
// VITE_COOKIE_DOMAIN='.linkintothessi.com' scopes the cookie to the apex so the app
// (app.linkintothessi.com) and the landing (linkintothessi.com) share one value.
// Unset in dev → a host-only cookie (cross-site sync is a prod-only feature).
const COOKIE_DOMAIN = (import.meta.env.VITE_COOKIE_DOMAIN as string | undefined) || undefined

export function serializeCookie(name: string, value: string, days: number, domain?: string): string {
  const maxAge = days * 24 * 60 * 60
  const domainPart = domain ? `; Domain=${domain}` : ''
  return `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; SameSite=Lax${domainPart}`
}

export function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  const escaped = name.replace(/[.$?*|{}()[\]\\/+^]/g, '\\$&')
  const match = document.cookie.match(new RegExp(`(?:^|; )${escaped}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}

export function setCookie(name: string, value: string, days = 365): void {
  if (typeof document === 'undefined') return
  document.cookie = serializeCookie(name, value, days, COOKIE_DOMAIN)
}
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `pnpm --filter app test cookies`
Expected: PASS (6 tests).

- [ ] **Step 5: Document the env var**

Append to `app/.env.example`:

```
# Cross-site cookie domain (theme + language shared between app + landing).
# Prod: .linkintothessi.com  |  Dev: leave UNSET (host-only cookie).
VITE_COOKIE_DOMAIN=
```

- [ ] **Step 6: Normalize + save (do NOT commit)**

Run: `pnpm exec prettier --write app/src/lib/cookies.ts app/src/lib/cookies.test.ts`
Then save. Do not run any git command.

---

### Task A2: Theme storage reads/writes the cookie

**Files:**

- Modify: `app/src/lib/theme.ts`
- Test: `app/src/lib/theme.test.ts` (create)

**Interfaces:**

- Consumes: `getCookie`, `setCookie` from `./cookies` (Task A1).
- Produces (unchanged signatures): `getStoredTheme(): ThemePref`; `setStoredTheme(pref: ThemePref): void`.

- [ ] **Step 1: Write the failing tests**

```ts
// app/src/lib/theme.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { getStoredTheme, setStoredTheme } from './theme'

function clearCookies() {
  document.cookie.split(';').forEach(c => {
    const name = c.split('=')[0].trim()
    if (name) document.cookie = `${name}=; Path=/; Max-Age=0`
  })
}

describe('theme storage (cookie-primary, localStorage mirror)', () => {
  beforeEach(() => {
    clearCookies()
    localStorage.clear()
  })
  it('defaults to system when nothing stored', () => {
    expect(getStoredTheme()).toBe('system')
  })
  it('setStoredTheme writes both cookie and localStorage', () => {
    setStoredTheme('dark')
    expect(document.cookie).toContain('theme=dark')
    expect(localStorage.getItem('theme')).toBe('dark')
    expect(getStoredTheme()).toBe('dark')
  })
  it('prefers the cookie over a stale localStorage value', () => {
    localStorage.setItem('theme', 'light')
    document.cookie = 'theme=dark; Path=/'
    expect(getStoredTheme()).toBe('dark')
  })
  it('ignores an invalid stored value', () => {
    document.cookie = 'theme=bogus; Path=/'
    expect(getStoredTheme()).toBe('system')
  })
})
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `pnpm --filter app test theme`
Expected: FAIL (getStoredTheme still localStorage-only — the cookie-priority and "writes cookie" assertions fail).

- [ ] **Step 3: Update `theme.ts`**

Change the imports and the two storage functions (leave `resolveTheme`/`applyTheme`/`THEME_COLORS` untouched):

```ts
// app/src/lib/theme.ts  (top)
import { getCookie, setCookie } from './cookies'

export type ThemePref = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

const STORAGE_KEY = 'theme'
const THEME_COLORS: Record<ResolvedTheme, string> = { light: '#f2eee6', dark: '#0e1320' }

export function getStoredTheme(): ThemePref {
  // Cookie is the cross-site source of truth; fall back to the localStorage mirror.
  const v = getCookie(STORAGE_KEY) ?? localStorage.getItem(STORAGE_KEY)
  return v === 'light' || v === 'dark' || v === 'system' ? v : 'system'
}

export function setStoredTheme(pref: ThemePref): void {
  setCookie(STORAGE_KEY, pref)
  localStorage.setItem(STORAGE_KEY, pref)
}
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `pnpm --filter app test theme`
Expected: PASS.

- [ ] **Step 5: Normalize + save (do NOT commit)**

Run: `pnpm exec prettier --write app/src/lib/theme.ts app/src/lib/theme.test.ts`

---

### Task A3: App i18n picks up the shared `lang` cookie

**Files:**

- Modify: `app/src/i18n/index.ts`

**Interfaces:**

- Consumes: `import.meta.env.VITE_COOKIE_DOMAIN`.
- Produces: nothing new (declarative config change).

- [ ] **Step 1: Add the cookie detector**

Replace the `detection` block in `app/src/i18n/index.ts` with:

```ts
    detection: {
      // 'cookie' first so the shared cross-site `lang` cookie (written by the landing's
      // LanguageSelector and by the app itself) wins. localStorage stays as a fast local mirror.
      order: ['cookie', 'localStorage', 'querystring', 'navigator'],
      lookupCookie: 'lang',
      lookupQuerystring: 'lang',
      lookupLocalStorage: 'i18nextLng',
      caches: ['cookie', 'localStorage'],
      cookieMinutes: 525600, // ~1 year
      cookieDomain: (import.meta.env.VITE_COOKIE_DOMAIN as string | undefined) || undefined,
      cookieOptions: { path: '/', sameSite: 'lax' }
    },
```

- [ ] **Step 2: Typecheck + existing tests + build**

Run: `pnpm --filter app exec tsc --noEmit`
Run: `pnpm --filter app test`
Expected: typecheck clean; existing app suite still green (no behavior regressions).

- [ ] **Step 3: Normalize + save (do NOT commit)**

Run: `pnpm exec prettier --write app/src/i18n/index.ts`

---

## Phase B — Landing Tailwind v4 + light/dark

> **Sequencing (risk control):** Task B1 is a **pure v3→v4 port with the dark palette UNCHANGED** — it must build and
> render identically before any value changes. Only Task B2 swaps to the app's dark values (D6) and adds light. This
> keeps
> a v4 regression and a palette change from ever being debugged together.

### Task B1: Pure Tailwind v4 migration (no palette change)

**Files:**

- Modify: `landing/package.json`, `landing/postcss.config.mjs`
- Delete: `landing/tailwind.config.ts`
- Rewrite: `landing/app/globals.css`

**Interfaces:**

- Produces: v4 utility names unchanged (`bg-ink`, `text-cream`, `text-gold`, `font-display`, `bg-gold/5`, etc.) backed
  by CSS variables.

- [ ] **Step 1: Swap dependencies**

In `landing/package.json` `devDependencies`: remove `"autoprefixer"` and change `"tailwindcss": "^3.4.19"` →
`"tailwindcss": "^4.2.2"`, and add `"@tailwindcss/postcss": "^4.2.2"`. Then install:

Run: `pnpm --filter landing install` (or `pnpm install` from root).

- [ ] **Step 2: Swap the PostCSS plugin**

Replace `landing/postcss.config.mjs` with:

```js
/** @type {import('postcss').Config} */
const config = {
  plugins: {
    '@tailwindcss/postcss': {}
  }
}

export default config
```

- [ ] **Step 3: Delete the v3 config**

Delete `landing/tailwind.config.ts` (v4 is CSS-first; its colors/fonts move into `globals.css`; its `fadeUp`/`shimmer`
keyframes and `cream.dim` are dead code and are dropped).

- [ ] **Step 4: Rewrite `globals.css` (v4, CURRENT dark palette, no light yet)**

```css
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400;1,600&family=DM+Sans:wght@300;400;500;600&display=swap');
@import 'tailwindcss';

/* Tailwind v4 CSS-first: utilities resolve from these CSS vars. @theme inline (not @theme)
   keeps opacity utilities (text-cream/50) reactive to the .dark override via color-mix. */
@theme inline {
  --color-ink: var(--ink);
  --color-ink-800: var(--ink-800);
  --color-ink-600: var(--ink-600);
  --color-ink-400: var(--ink-400);
  --color-cream: var(--cream);
  --color-cream-muted: var(--cream-muted);
  --color-gold: var(--gold);
  --color-gold-light: var(--gold-light);
  --color-lnblue: var(--lnblue);
  --color-lnblue-light: var(--lnblue-light);
  --font-display: 'Cormorant Garamond', Georgia, serif;
  --font-body: 'DM Sans', system-ui, sans-serif;
}

:root {
  /* Current (pre-light) dark palette — unchanged from v3 for the pure-port checkpoint. */
  --ink: #060b18;
  --ink-800: #0c1425;
  --ink-600: #131d30;
  --ink-400: #1e2d45;
  --cream: #f5f0e8;
  --cream-muted: #a89f8c;
  --gold: #c9963e;
  --gold-light: #e8b96a;
  --lnblue: #0077b5;
  --lnblue-light: #0a84ff;
}

@layer base {
  html {
    scroll-behavior: smooth;
  }
  body {
    background-color: var(--color-ink);
    color: var(--color-cream);
    -webkit-font-smoothing: antialiased;
  }
}

.circle-ring {
  border-radius: 50%;
  border: 1px solid rgba(245, 240, 232, 0.07);
  position: absolute;
  pointer-events: none;
}
```

- [ ] **Step 5: Typecheck, lint, build**

Run: `pnpm --filter landing exec tsc --noEmit`
Run: `pnpm lint`
Run: `pnpm --filter landing build`
Expected: all clean. (v4 breaking-change audit: the landing always pairs `border`/`ring` with an explicit color —
`border-gold`, `border-cream/5` — so the v4 default-`border`-color and `ring` changes are low-risk; confirm the build
output has no PostCSS errors.)

- [ ] **Step 6: Visual checkpoint**

Run: `pnpm --filter landing dev`, open `http://localhost:3000`. The site must look **identical to before** (still the
deep-navy dark theme). Confirm fonts (`font-display` headings), the eyebrow pills, the gold buttons, the Pricing
highlight, and the Hero decorative rings all render. If anything regressed, fix before B2.

- [ ] **Step 7: Normalize + save (do NOT commit)**

Run: `pnpm exec prettier --write landing/postcss.config.mjs landing/app/globals.css landing/package.json`

---

### Task B2: Light/dark palette split (adopt app values, add tokens)

**Files:**

- Rewrite: `landing/app/globals.css`

**Interfaces:**

- Produces: new utilities `text-gold-text`, `text-on-gold`, `text-on-lnblue`; decorative vars `--ring-line`,
  `--ring-gold`, `--glow-lnblue`, `--glow-gold`; a working `.dark` variant.

- [ ] **Step 1: Rewrite `globals.css` with the light/dark split**

```css
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400;1,600&family=DM+Sans:wght@300;400;500;600&display=swap');
@import 'tailwindcss';

@custom-variant dark (&:is(.dark *));

@theme inline {
  --color-ink: var(--ink);
  --color-ink-800: var(--ink-800);
  --color-ink-600: var(--ink-600);
  --color-ink-400: var(--ink-400);
  --color-cream: var(--cream);
  --color-cream-muted: var(--cream-muted);
  --color-gold: var(--gold);
  --color-gold-light: var(--gold-light);
  --color-gold-text: var(--gold-text);
  --color-lnblue: var(--lnblue);
  --color-lnblue-light: var(--lnblue-light);
  --color-on-gold: var(--on-gold);
  --color-on-lnblue: var(--on-lnblue);
  --font-display: 'Cormorant Garamond', Georgia, serif;
  --font-body: 'DM Sans', system-ui, sans-serif;
}

:root {
  /* Light — ported from app/src/index.css :root */
  --ink: #f2eee6;
  --ink-800: #faf7f0;
  --ink-600: #ffffff;
  --ink-400: #e4dccd;
  --cream: #1c1813;
  --cream-muted: #6e6757;
  --gold: #c9963e;
  --gold-text: #8a6418;

  /* Theme-constant: brand blue + hover gold + on-accent foregrounds (defined once). */
  --gold-light: #e8b96a;
  --lnblue: #0077b5;
  --lnblue-light: #0a84ff;
  --on-gold: #1c1813; /* dark text on gold fills, both themes */
  --on-lnblue: #f5f0e8; /* light text on the blue badge, both themes */

  /* Decorative, theme-aware (light values) */
  --ring-line: rgba(28, 24, 19, 0.1);
  --ring-gold: rgba(201, 150, 62, 0.14);
  --glow-lnblue: rgba(0, 119, 181, 0.06);
  --glow-gold: rgba(201, 150, 62, 0.1);
}

.dark {
  /* Dark — unified with app/src/index.css .dark (D6) */
  --ink: #0e1320;
  --ink-800: #161c2b;
  --ink-600: #1c2433;
  --ink-400: #2a3142;
  --cream: #f5f0e8;
  --cream-muted: #9a9384;
  --gold: #d8a94e;
  --gold-text: #e8c474;

  /* Decorative (original dark values) */
  --ring-line: rgba(245, 240, 232, 0.07);
  --ring-gold: rgba(201, 150, 62, 0.08);
  --glow-lnblue: rgba(0, 119, 181, 0.1);
  --glow-gold: rgba(201, 150, 62, 0.07);
}

@layer base {
  html {
    scroll-behavior: smooth;
  }
  body {
    background-color: var(--color-ink);
    color: var(--color-cream);
    -webkit-font-smoothing: antialiased;
  }
}

.circle-ring {
  border-radius: 50%;
  border: 1px solid var(--ring-line);
  position: absolute;
  pointer-events: none;
}
```

- [ ] **Step 2: Verify dark is unchanged-in-spirit, light renders**

Run: `pnpm --filter landing build` (clean), then `pnpm --filter landing dev`. In devtools, toggle `class="dark"` on
`<html>`:

- **With `.dark`:** the site is dark (now the app's `#0e1320` navy — slightly softer than before; this is D6, expected).
- **Without `.dark`:** the page background is warm off-white (`#f2eee6`), body text is dark. Buttons/badges will still
  have wrong on-accent text and some gold text may be low-contrast — that is fixed in B3/B4. Just confirm the split
  works (bg + body text flip) and the build is clean.

- [ ] **Step 3: Normalize + save (do NOT commit)**

Run: `pnpm exec prettier --write landing/app/globals.css`

---

### Task B3: Landing theme helpers + no-flash script + ThemeToggle

**Files:**

- Create: `landing/lib/cookies.ts`, `landing/lib/theme.ts`, `landing/components/ThemeToggle.tsx`
- Modify: `landing/app/layout.tsx`, `landing/components/Nav.tsx`, `landing/.env.example`

**Interfaces:**

- Produces: `landing/lib/cookies.ts` → `getCookie`, `setCookie`; `landing/lib/theme.ts` → `ThemePref`, `ResolvedTheme`,
  `getStoredTheme`, `setStoredTheme`, `resolveTheme`, `applyTheme`; `<ThemeToggle />` (default export, `'use client'`).

- [ ] **Step 1: Landing cookie helper (SSR-safe, Next env)**

```ts
// landing/lib/cookies.ts
// SSR-safe cookie I/O for the cross-site theme + language preferences.
// Prod: NEXT_PUBLIC_COOKIE_DOMAIN='.linkintothessi.com' (shared with the app). Dev: unset (host-only).
const COOKIE_DOMAIN = process.env.NEXT_PUBLIC_COOKIE_DOMAIN || undefined

export function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  const escaped = name.replace(/[.$?*|{}()[\]\\/+^]/g, '\\$&')
  const match = document.cookie.match(new RegExp(`(?:^|; )${escaped}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}

export function setCookie(name: string, value: string, days = 365): void {
  if (typeof document === 'undefined') return
  const maxAge = days * 24 * 60 * 60
  const domainPart = COOKIE_DOMAIN ? `; Domain=${COOKIE_DOMAIN}` : ''
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; SameSite=Lax${domainPart}`
}
```

- [ ] **Step 2: Landing theme helper**

```ts
// landing/lib/theme.ts
import { getCookie, setCookie } from './cookies'

export type ThemePref = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

const STORAGE_KEY = 'theme'
const THEME_COLORS: Record<ResolvedTheme, string> = { light: '#f2eee6', dark: '#0e1320' }

export function getStoredTheme(): ThemePref {
  const v = getCookie(STORAGE_KEY)
  return v === 'light' || v === 'dark' || v === 'system' ? v : 'system'
}

export function setStoredTheme(pref: ThemePref): void {
  setCookie(STORAGE_KEY, pref)
}

export function resolveTheme(pref: ThemePref, prefersDark: boolean): ResolvedTheme {
  if (pref === 'system') return prefersDark ? 'dark' : 'light'
  return pref
}

export function applyTheme(resolved: ResolvedTheme): void {
  const el = document.documentElement
  el.classList.toggle('dark', resolved === 'dark')
  el.style.colorScheme = resolved
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[resolved])
}
```

- [ ] **Step 3: No-flash script + meta in `layout.tsx`**

Update `landing/app/layout.tsx`: add `suppressHydrationWarning` to `<html>`, a `<head>` containing the boot script +
`<meta name="theme-color">`. Keep the existing body classes and `CookieNotice`.

```tsx
import type {Metadata} from 'next'
import './globals.css'
import CookieNotice from '../components/CookieNotice'

export const metadata: Metadata = {
  title: 'Link Into The SSI · Grow Your LinkedIn Influence',
  description:
    'Grow your LinkedIn SSI through genuine engagement with the professionals and conversations in your field.',
  openGraph: {
    title: 'Link Into The SSI',
    description: 'Grow your LinkedIn SSI organically with real interactions.',
    type: 'website'
  }
}

// Runs before paint: reads the `theme` cookie (else system) and sets .dark + colorScheme on <html>
// so there is no light/dark flash. Inlined as a string because it must execute before hydration.
const NO_FLASH = `(function(){try{var m=document.cookie.match(/(?:^|; )theme=([^;]*)/);var p=m?decodeURIComponent(m[1]):'system';var d=p==='dark'||(p!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches);var e=document.documentElement;e.classList.toggle('dark',d);e.style.colorScheme=d?'dark':'light';}catch(e){}})();`

export default function RootLayout({children}: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className="scroll-smooth"
      suppressHydrationWarning
    >
    <head>
      <script dangerouslySetInnerHTML={{__html: NO_FLASH}}/>
      <meta
        name="theme-color"
        content="#0e1320"
      />
    </head>
    <body className="bg-ink font-body text-cream antialiased">
    {children}
    <CookieNotice/>
    </body>
    </html>
  )
}
```

- [ ] **Step 4: ThemeToggle component**

A 3-state cycle (system → light → dark → system), inline SVG icons (no icon dep on the landing), syncs the `.dark`
class + cookie + listens to system changes while on `system`.

```tsx
// landing/components/ThemeToggle.tsx
'use client'
import { useEffect, useState } from 'react'
import { type ThemePref, getStoredTheme, setStoredTheme, resolveTheme, applyTheme } from '../lib/theme'

const ORDER: ThemePref[] = ['system', 'light', 'dark']
const LABEL: Record<ThemePref, string> = { system: 'System theme', light: 'Light theme', dark: 'Dark theme' }

export default function ThemeToggle() {
  const [pref, setPref] = useState<ThemePref>('system')

  // Hydrate from the cookie after mount (server render is always lang="en"/no class).
  useEffect(() => {
    setPref(getStoredTheme())
  }, [])

  // Apply on pref change + keep `system` in sync with the OS.
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const sync = () => applyTheme(resolveTheme(pref, mq.matches))
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [pref])

  const cycle = () => {
    const next = ORDER[(ORDER.indexOf(pref) + 1) % ORDER.length]
    setStoredTheme(next)
    setPref(next)
  }

  return (
    <button
      type="button"
      onClick={cycle}
      aria-label={LABEL[pref]}
      title={LABEL[pref]}
      className="flex h-9 w-9 items-center justify-center rounded-full border border-cream/15 text-cream/70 transition-colors hover:border-cream/30 hover:text-cream"
    >
      {pref === 'system' ? (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect
            x="2"
            y="3"
            width="20"
            height="14"
            rx="2"
          />
          <path d="M8 21h8M12 17v4" />
        </svg>
      ) : pref === 'light' ? (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle
            cx="12"
            cy="12"
            r="4"
          />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
        </svg>
      ) : (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  )
}
```

- [ ] **Step 5: Mount ThemeToggle in Nav**

In `landing/components/Nav.tsx`, import the toggle and wrap it with the CTA in a flex row. Replace the lone CTA `<a>` (
lines ~52-57) with:

```tsx
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <a
            href={SIGN_IN_URL}
            className="rounded-full border border-gold/60 px-5 py-2 text-sm font-medium text-gold-text transition-all duration-200 hover:bg-gold hover:text-on-gold"
          >
            Start free
          </a>
        </div>
```

Add the import at the top: `import ThemeToggle from './ThemeToggle'`. (Note: the CTA's `text-gold` → `text-gold-text`
and `hover:text-ink` → `hover:text-on-gold` swaps are part of the B4 gold-split, applied here since this block is being
rewritten anyway.)

- [ ] **Step 6: Document the env var**

Append to `landing/.env.example`:

```
# Cross-site cookie domain (theme + language shared between landing + app).
# Prod: .linkintothessi.com  |  Dev: leave UNSET (host-only cookie).
NEXT_PUBLIC_COOKIE_DOMAIN=
```

- [ ] **Step 7: Typecheck, lint, build, visual**

Run: `pnpm --filter landing exec tsc --noEmit && pnpm lint && pnpm --filter landing build`
Then `pnpm --filter landing dev`: the toggle now appears in the nav and cycles system/light/dark; reload keeps the
choice (cookie); no light/dark flash on load.

- [ ] **Step 8: Normalize + save (do NOT commit)**

Run:
`pnpm exec prettier --write landing/lib/cookies.ts landing/lib/theme.ts landing/components/ThemeToggle.tsx landing/app/layout.tsx landing/components/Nav.tsx`

---

### Task B4: Gold-split + on-accent foreground swaps

Make gold text legible on light and fix on-accent text contrast. Use the audit map below. **Rule:** gold used as
*text/icon on a page/card background* → `text-gold-text`; gold/blue *fills* keep `bg-gold`/`bg-lnblue` but their text
becomes `text-on-gold` / `text-on-lnblue`.

**Files (modify):**
`landing/components/{Hero,FinalCTA,Proof,Pricing,Features,SSIExplainer,HowItWorks,FAQ,PainBeat,CookieNotice,Footer}.tsx`,
`landing/app/{cookies,terms,privacy}/page.tsx`. (`Nav.tsx` already done in B3.)

- [ ] **Step 1: `text-gold` → `text-gold-text` (text/icon on background)**

Apply at these sites (file:line from the audit; verify the className before editing):

- `Hero.tsx`: 36 (eyebrow), 45 (headline span)
- `FinalCTA.tsx`: 25 (headline span), 35 ("Be one of the first in")
- `Proof.tsx`: 19, 23, 56 (link — keep `hover:text-gold-light`), 65
- `Pricing.tsx`: 81, 132, 140 (✓ marker), 169 (link — keep `hover:text-gold-light`)
- `Features.tsx`: 30, 40 (icon; keep its `opacity-70`)
- `SSIExplainer.tsx`: 42, 46, 79 (stat numbers)
- `HowItWorks.tsx`: 27, 37 (`group-hover:text-gold` → `group-hover:text-gold-text`), 47 (`text-gold/80` →
  `text-gold-text/80`)
- `FAQ.tsx`: 41, 58
- `PainBeat.tsx`: 8
- `CookieNotice.tsx`: 37
- `cookies/page.tsx`: 23
- `terms/page.tsx`: 71, 98, 120, 146, 177, 187
- `privacy/page.tsx`: 26, 139, 206, 242, 273, 288, 307

(Display headline spans move to `gold-text` too: `--gold` on light cream is ~2.3:1 — fails even large-text AA;
`--gold-text` passes. In dark, headlines become the brighter `#e8c474` — intended.)

- [ ] **Step 2: `text-ink` on gold fills → `text-on-gold`**

- `Hero.tsx:63` CTA: `text-ink` → `text-on-gold`
- `FinalCTA.tsx:31` CTA: `text-ink` → `text-on-gold`
- `Pricing.tsx:93` and `:99` toggle active state: `text-ink` → `text-on-gold`
- `CookieNotice.tsx:49` "Got it" button: if it carries `text-ink`, → `text-on-gold` (verify; if it relies on a default,
  add `text-on-gold`)

- [ ] **Step 3: `text-cream` on the blue badge/CTA → `text-on-lnblue`**

- `Pricing.tsx` "Recommended" badge (~line 120-122): `text-cream` → `text-on-lnblue`
- `Pricing.tsx:149` Growth CTA (`bg-lnblue ... text-cream`): `text-cream` → `text-on-lnblue`

- [ ] **Step 4: Typecheck, lint, build, dual-theme visual**

Run: `pnpm --filter landing exec tsc --noEmit && pnpm lint && pnpm --filter landing build`
Then toggle light/dark in the running dev site and confirm:

- Gold eyebrows, links, ✓ markers, stat numbers, headline emphasis are **legible in both themes**.
- Gold buttons (Hero/FinalCTA) have **dark** text in both themes.
- The "Recommended" badge + Growth CTA have **light** text on blue in both themes.

- [ ] **Step 5: Normalize + save (do NOT commit)**

Run:
`pnpm exec prettier --write landing/components/*.tsx landing/app/cookies/page.tsx landing/app/terms/page.tsx landing/app/privacy/page.tsx`

---

### Task B5: Decorative rgba → theme-aware vars

**Files (modify):** `landing/components/Hero.tsx`, `landing/components/FinalCTA.tsx`. (The `.circle-ring` base border
was already moved to `var(--ring-line)` in B2.)

- [ ] **Step 1: Hero radial glow → var**

`Hero.tsx:9` — replace the inline style with:

```tsx
        style={{ background: 'radial-gradient(ellipse 80% 60% at 50% 40%, var(--glow-lnblue) 0%, transparent 70%)' }}
```

- [ ] **Step 2: FinalCTA radial glow + ring border → vars**

`FinalCTA.tsx:8`:

```tsx
        style={{ background: 'radial-gradient(ellipse 60% 50% at 50% 50%, var(--glow-gold) 0%, transparent 70%)' }}
```

`FinalCTA.tsx:18` (the circle-ring `borderColor` override): change `borderColor: 'rgba(201,150,62,0.08)'` →
`borderColor: 'var(--ring-gold)'`.

- [ ] **Step 3: Leave button/card glow shadows as-is**

Do **not** change the `shadow-[0_0_..._rgba(201,150,62,...)]` (gold) and `shadow-[..._rgba(0,119,181,...)]` (blue) on
buttons/cards/logo — a gold/blue glow under a gold/blue element reads correctly on both themes. (Documented decision;
not an omission.)

- [ ] **Step 4: Verify rings/glows visible on light**

Build + dev: in **light** mode the Hero/FinalCTA decorative rings are now faintly visible (ink-tinted, not invisible
cream-on-cream); the radial glows are subtle on cream. In **dark** mode they match the original.

Run: `pnpm --filter landing exec tsc --noEmit && pnpm lint && pnpm --filter landing build`

- [ ] **Step 5: Normalize + save (do NOT commit)**

Run: `pnpm exec prettier --write landing/components/Hero.tsx landing/components/FinalCTA.tsx`

---

### Task B6: Docs + full verification

**Files (modify):** `docs/PLATFORM.md`

- [ ] **Step 1: Update PLATFORM.md**

Read `docs/PLATFORM.md`'s Table of Contents and its final "Maintaining This Document" mapping. Update (or add) the
section(s) covering **frontend theming + cross-site persistence**:

- The app + landing now share `theme` + `lang` cookies on `NEXT_PUBLIC_COOKIE_DOMAIN` / `VITE_COOKIE_DOMAIN` (
  `.linkintothessi.com` prod, unset dev; cross-site sync is prod-only).
- The landing is now Tailwind v4 (CSS-first), light/dark with `@custom-variant dark`, no-flash boot script,
  `ThemeToggle` in the nav.
- Add the two env vars to the env-vars section.
- If a "Theming / cross-site persistence" section does not exist, add a numbered section + a ToC entry + a short Mermaid
  flow (cookie → system fallback → `applyTheme` sets `.dark`).

- [ ] **Step 2: Full verification gate**

Run each and confirm clean:

- `pnpm --filter app test` (Vitest — A1/A2 green, existing suite green)
- `pnpm --filter app exec tsc --noEmit`
- `pnpm --filter landing exec tsc --noEmit`
- `pnpm lint` (`eslint . --max-warnings 0`)
- `pnpm --filter landing build`

- [ ] **Step 3: Final dual-theme + persistence smoke test**

`pnpm --filter landing dev`: toggle through system/light/dark; reload (choice persists via cookie); no FOUC; spot-check
Hero, Pricing (badge + buttons + highlight), FAQ, Footer, and a legal page in **both** themes.

- [ ] **Step 4: Save (do NOT commit)**

Leave all changes saved and unstaged. Tell the controller the plan is complete and Henriko will commit.

---

## Notes for the executor

- **Cross-site sync is prod-only.** In dev the cookie is host-only, so toggling theme on `localhost:3000` will not
  reflect on `localhost:5173`. That is expected (Global Constraints) — verify each site honors the cookie on its own
  origin.
- **Phase C (i18n) depends on `landing/lib/cookies.ts`** (the `lang` cookie) — it is created here, reused there. The
  no-flash script + ThemeToggle currently live in the non-locale `app/layout.tsx`; Phase C moves them into
  `app/[locale]/layout.tsx`.
- If a reviewer flags that display-headline gold became brighter in dark mode, that is the intended `--gold-text` (
  #e8c474) per Step B4.1, not a regression.
