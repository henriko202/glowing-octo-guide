# Landing Theming Plan 2 — Locale-routed i18n (en/pt/es) + pt/es Legal

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:
> executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Serve the landing in English, Brazilian Portuguese, and Spanish via locale-routed URLs (`/en`, `/pt`, `/es`)
with browser-language detection, a language selector, hreflang, and pt/es drafts of the legal pages — sharing the `lang`
preference with the app via the cookie wired in Plan 1.

**Architecture:** Move all pages under `app/[lang]/` (the dynamic-segment layout becomes the Next 15 root layout that
renders `<html lang>`). A `middleware.ts` redirects locale-less paths using the `lang` cookie → `Accept-Language` →
`en`. Strings live in `i18n/dictionaries/{en,pt,es}.json`, loaded server-side by `getDictionary(lang)`; server
components receive their dict slice, the 5 client components (`Nav`, `Pricing`, `FAQ`, `CookieNotice`, `ThemeToggle`)
receive theirs as props. Legal pages translate via per-locale JSX content modules (preserving the hand-styled markup +
`[PLACEHOLDER]` tokens). A `LanguageSelector` writes the shared `lang` cookie and routes to the same path under the
chosen locale. This is Phases C + D of the design spec; Phases A + B shipped in Plan 1.

**Tech Stack:** Next 15 App Router + React 19, Tailwind v4 (from Plan 1). No i18n library — the dictionary +
`getDictionary` server pattern (Next's documented approach). Hand-rolled `Accept-Language` matcher (no `negotiator`/
`localematcher` deps). pnpm workspace.

## Global Constraints

Every task's requirements implicitly include this section.

- **NEVER run any git command.** No `git add/commit/push/stash/checkout/reset/restore/rm/clean` — not even to delete a
  moved file (use a filesystem delete, never `git rm`). A past subagent ran `git stash` and stranded completed work.
  Henriko commits. Each task ends with **save files only**.
- **pnpm, never npm.** Run from the repo root with `--filter` (e.g. `pnpm --filter landing build`). No Convex CLI in
  this plan.
- **Landing has no test harness.** Verify via `pnpm --filter landing exec tsc --noEmit` +
  `pnpm --filter landing build` + `pnpm lint`. Do NOT gate on `pnpm format:check` (docs aren't Prettier-clean
  repo-wide); run `pnpm exec prettier --write <changed files>` then gate on lint + typecheck + build.
- **Locales:** `['en', 'pt', 'es']`, default `en`. URL form `/<lang>/...`.
- **pt is Brazilian Portuguese (pt-BR)** — the founder is Brazilian and the likely pt market is Brazil. Use pt-BR
  vocabulary (e.g. "usuário" not "utilizador", "Carregando" not "A carregar", "salvar" not "guardar"). **es is neutral /
  Latin-American Spanish.** (Both are an assumption flagged for Henriko to confirm; the app's existing
  `app/src/i18n/locales/pt.json` is partly European Portuguese — do NOT copy its dialect, follow pt-BR.)
- **Do NOT translate:** the brand name `Link Into The SSI`; USD prices and their numerals ($5/$15/$50, $100/mo — the
  product is USD-priced in every locale, only the surrounding words translate); URLs, `SIGN_IN_URL`, `mailto:` targets,
  query-param values (`plan=`/`interval=`); the legal `[PLACEHOLDER]` tokens (`[LEGAL_ENTITY_NAME]`,
  `[PRIVACY_CONTACT_EMAIL]`, `[DPO_OR_REP_CONTACT]`, `[BUSINESS_ADDRESS]`, `[GOVERNING_LAW_JURISDICTION]`); policy
  version strings/dates.
- **Legal pages stay DRAFTS** in every locale: keep the "draft pending legal review" banner (translated) and every
  `[PLACEHOLDER]` token verbatim. Translation does not constitute legal review.
- **The shared `lang` cookie** (name `lang`, values `en|pt|es`) was set up in Plan 1: the app reads it (i18n cookie
  detector) and the landing's `landing/lib/cookies.ts` can write it. The `LanguageSelector` writes this same cookie so
  language carries across both sites (prod-only sync, like theme).
- **Next 15 specifics:** `params` is a `Promise` — `const { lang } = await params`. The root layout is
  `app/[lang]/layout.tsx` (renders `<html>/<body>`); there is no `app/layout.tsx`.
- **Keep `docs/PLATFORM.md` in sync** (final task).

### Dictionary key groups (from the inventory; ~208 strings total)

`meta` (per-locale `title`/`description`/`ogTitle`/`ogDescription`), `nav`, `hero`, `painBeat`, `howItWorks`,
`ssiExplainer`, `proof`, `features`, `tiers` (shared tier badge labels used by Features + Pricing), `pricing`, `faq`,
`finalCta`, `footer`, `cookieNotice`, `themeToggle`, `languageSelector`. Legal prose (`privacy`/`terms`/`cookies`, ~85
strings) is handled as per-locale JSX modules in Phase D, NOT in the JSON dictionaries.

---

## File Structure

**New (`landing/`):**

- `i18n/config.ts` — locales + `Locale` type.
- `i18n/getDictionary.ts` — server dictionary loader + `Dictionary` type (derived from `en.json`).
- `i18n/dictionaries/{en,pt,es}.json` — UI strings.
- `middleware.ts` — locale detection + redirect.
- `components/LanguageSelector.tsx` — client locale switcher.
- `app/[lang]/layout.tsx` — root layout (moved from `app/layout.tsx`).
- `app/[lang]/page.tsx`, `app/[lang]/pricing/page.tsx`, `app/[lang]/{privacy,terms,cookies}/page.tsx` — moved.
- `app/[lang]/{privacy,terms,cookies}/content/{en,pt,es}.tsx` — per-locale legal content modules.

**Modified (`landing/`):** all 13 components consume `dict` props; `Nav`/`Footer`/`CookieNotice` also take `lang` for
locale-prefixed links.

**Deleted:** `app/layout.tsx`, `app/page.tsx`, `app/pricing/page.tsx`, `app/privacy/page.tsx`, `app/terms/page.tsx`,
`app/cookies/page.tsx` (all moved under `[lang]`).

**Docs:** `docs/PLATFORM.md` §15/§16.

---

## Phase C — Locale routing + UI i18n

### Task C1: i18n foundation + English dictionary

**Files:**

- Create: `landing/i18n/config.ts`, `landing/i18n/getDictionary.ts`, `landing/i18n/dictionaries/en.json`

**Interfaces:**

- Produces: `i18n` + `Locale` (config); `getDictionary(locale): Promise<Dictionary>` + `Dictionary` type
  (getDictionary); the canonical `en.json` (source of truth for the `Dictionary` shape).

- [ ] **Step 1: Locale config**

```ts
// landing/i18n/config.ts
export const i18n = {
  locales: ['en', 'pt', 'es'],
  defaultLocale: 'en'
} as const

export type Locale = (typeof i18n.locales)[number]
```

- [ ] **Step 2: Dictionary loader**

```ts
// landing/i18n/getDictionary.ts
import 'server-only'
import type { Locale } from './config'

// Per-locale dynamic import so each route ships only its own dictionary.
const dictionaries = {
  en: () => import('./dictionaries/en.json').then(m => m.default),
  pt: () => import('./dictionaries/pt.json').then(m => m.default),
  es: () => import('./dictionaries/es.json').then(m => m.default)
}

// The English dictionary is the canonical shape; pt/es must match it key-for-key.
export type Dictionary = Awaited<ReturnType<(typeof dictionaries)['en']>>

export async function getDictionary(locale: Locale): Promise<Dictionary> {
  return (dictionaries[locale] ?? dictionaries.en)()
}
```

- [ ] **Step 3: Extract all UI strings into `en.json`**

Build `landing/i18n/dictionaries/en.json` by extracting the **current English copy verbatim** from every component + the
home/pricing pages, organised under the key groups in Global Constraints. Read each component and pull its visible
strings. Structure (fill every group; values are the exact current English text):

```jsonc
{
  "meta": {
    "title": "Link Into The SSI · Grow Your LinkedIn Influence",
    "description": "Grow your LinkedIn SSI through genuine engagement with the professionals and conversations in your field.",
    "ogTitle": "Link Into The SSI",
    "ogDescription": "Grow your LinkedIn SSI organically with real interactions."
  },
  "nav": { "howItWorks": "How it works", "features": "Features", "pricing": "Pricing", "cta": "Start free" },
  "hero": { "eyebrow": "Deliberate LinkedIn growth", "headlineLine1": "Stop chasing jobs.", "headlineLine2": "Let them find you.", "...": "..." },
  "tiers": { "starter": "Starter", "growth": "Growth", "pro": "Pro", "growthPlus": "Growth+", "allTiers": "All tiers" },
  "pricing": { "...": "..." },
  "faq": { "items": [ { "q": "...", "a": "..." } ] },
  "footer": { "privacy": "Privacy", "terms": "Terms", "cookies": "Cookies", "contact": "Contact" },
  "cookieNotice": { "text": "We use only essential browser storage to run the app (sign-in + language). No tracking cookies.", "learnMore": "Learn more", "dismiss": "Got it" },
  "themeToggle": { "system": "System theme", "light": "Light theme", "dark": "Dark theme" },
  "languageSelector": { "label": "Language", "en": "English", "pt": "Português", "es": "Español" }
  // ...every other group: painBeat, howItWorks, ssiExplainer, proof, features, finalCta
}
```

**The real `en.json` is valid JSON — no comments.** The `// …` and `"...": "..."` above are illustrative; produce a
complete, comment-free file (it is `import()`-ed, so JSONC would fail the build).

Rules: keep `Link Into The SSI`, prices, and the `→` arrows OUT of translatable values where they are structural (render
the arrow in JSX, not the string, OR keep it in the string consistently — pick one and be consistent). For list-type
content (FAQ items, pricing plan features, the 3 SSI pillars/stats, the 3 how-it-works steps, the 3 features) use *
*arrays of objects** so order is preserved. For the `CookieNotice` sentence with an inline "Learn more" link, store
three keys (`text` before, `learnMore` link label, and render the trailing period in JSX) — do not embed the anchor in
the string.

- [ ] **Step 4: Verify**

Run: `pnpm --filter landing exec tsc --noEmit` (the JSON imports + `Dictionary` type resolve) and
`pnpm --filter landing build` (unused dict does not break the build). Run
`pnpm exec prettier --write landing/i18n/**/*.ts landing/i18n/dictionaries/en.json`.

- [ ] **Step 5: Save (do NOT commit).**

---

### Task C2: Convert all components to `dict` props (strings only, links unchanged)

Switch every component from hardcoded English to reading its `dict` slice from props, and update the **current**
(pre-move) pages to feed them `getDictionary('en')`. This keeps a green build before the `[lang]` move. **Do not touch
links/hrefs yet** (locale-prefixing lands in C3).

**Files (modify):** all of
`landing/components/{Nav,Hero,PainBeat,HowItWorks,SSIExplainer,Proof,Features,Pricing,FAQ,FinalCTA,Footer,CookieNotice,ThemeToggle}.tsx`;
`landing/app/page.tsx`, `landing/app/pricing/page.tsx`, `landing/app/layout.tsx`.

**Interfaces (the prop contract each component gains):**

- Server components: `export default function Hero({ dict }: { dict: Dictionary['hero'] }) { ... }` — typed to its
  slice.
- Client components (`Nav`, `Pricing`, `FAQ`, `CookieNotice`, `ThemeToggle`): same `dict` prop, typed to their slice;
  they stay `'use client'`. `Pricing` keeps its `useState(annual)`; `FAQ` keeps its accordion state.

- [ ] **Step 1: Pattern — convert one server component (Hero) as the template**

```tsx
// landing/components/Hero.tsx
import type { Dictionary } from '@/i18n/getDictionary'
import { SIGN_IN_URL } from '@/lib/links'

export default function Hero({ dict }: { dict: Dictionary['hero'] }) {
  return (
    /* ...identical JSX, every literal string replaced by dict.<key>... */
    <span className="italic text-gold-text">{dict.headlineLine2}</span>
  )
}
```

- [ ] **Step 2: Convert the remaining 12 components** the same way — replace every visible string with `dict.<key>`,
  typed to `Dictionary['<group>']`. For arrays (FAQ items, pricing plans/features, SSI pillars/stats, how-it-works
  steps, features), map over `dict.<group>.items` (or the array key) instead of the current hardcoded arrays. `Pricing`'
  s `priceLabel()` keeps the numeric math but takes its words from `dict.pricing` (e.g. `dict.pricing.perYear`,
  `dict.pricing.billedAnnually`, `dict.pricing.twoMonthsFree`); the `$` amounts stay computed. `ThemeToggle`'s `LABEL`
  map comes from `dict.themeToggle`.

- [ ] **Step 3: Feed dicts from the current pages (temporary, English)**

`app/page.tsx` and `app/pricing/page.tsx` become `async` server components that call `getDictionary('en')` and pass
slices; `app/layout.tsx` calls `getDictionary('en')` and passes `dict={dict.cookieNotice}` to `<CookieNotice />`.
Example:

```tsx
// landing/app/page.tsx (temporary — replaced by app/[lang]/page.tsx in C3)
import {getDictionary} from '@/i18n/getDictionary'
import Nav from '../components/Nav'
// ...other imports
export default async function Home() {
  const dict = await getDictionary('en')
  return (
    <>
      <Nav dict={dict.nav}/>
      <Hero dict={dict.hero}/>
      {/* ...each component gets its slice... */}
      <Footer dict={dict.footer}/>
    </>
  )
}
```

- [ ] **Step 4: Verify** — `pnpm --filter landing exec tsc --noEmit` (every slice type matches), `pnpm lint`,
  `pnpm --filter landing build` (site still renders English, now from the dictionary). `pnpm exec prettier --write` the
  changed files.

- [ ] **Step 5: Save (do NOT commit).**

---

### Task C3: Move pages under `app/[lang]/` + locale-prefix links + metadata/hreflang

The atomic refactor: relocate the root layout + all 6 pages under `[lang]`, thread `lang`, prefix internal links, add
per-locale metadata + hreflang. After this the site lives at `/<lang>/...`.

**Files:**

- Create: `app/[lang]/layout.tsx`, `app/[lang]/page.tsx`, `app/[lang]/pricing/page.tsx`, `app/[lang]/privacy/page.tsx`,
  `app/[lang]/terms/page.tsx`, `app/[lang]/cookies/page.tsx`
- Delete (filesystem, not `git rm`): `app/layout.tsx`, `app/page.tsx`, `app/pricing/page.tsx`, `app/privacy/page.tsx`,
  `app/terms/page.tsx`, `app/cookies/page.tsx`
- Modify: `components/Nav.tsx`, `components/Footer.tsx`, `components/CookieNotice.tsx` (accept `lang`, prefix internal
  links)

- [ ] **Step 1: Root layout at `app/[lang]/layout.tsx`**

```tsx
import type {Metadata} from 'next'
import '../globals.css'
import CookieNotice from '../../components/CookieNotice'
import {getDictionary} from '@/i18n/getDictionary'
import {i18n, type Locale} from '@/i18n/config'

const NO_FLASH = `(function(){try{var m=document.cookie.match(/(?:^|; )theme=([^;]*)/);var p=m?decodeURIComponent(m[1]):'system';var d=p==='dark'||(p!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches);var e=document.documentElement;e.classList.toggle('dark',d);e.style.colorScheme=d?'dark':'light';}catch(e){}})();`

export async function generateStaticParams() {
  return i18n.locales.map(lang => ({lang}))
}

export async function generateMetadata({params}: { params: Promise<{ lang: Locale }> }): Promise<Metadata> {
  const {lang} = await params
  const dict = await getDictionary(lang)
  return {
    title: dict.meta.title,
    description: dict.meta.description,
    openGraph: {title: dict.meta.ogTitle, description: dict.meta.ogDescription, type: 'website', locale: lang},
    alternates: {
      canonical: `/${lang}`,
      languages: {...Object.fromEntries(i18n.locales.map(l => [l, `/${l}`])), 'x-default': '/en'}
    }
  }
}

export default async function RootLayout({
                                           children,
                                           params
                                         }: {
  children: React.ReactNode
  params: Promise<{ lang: Locale }>
}) {
  const {lang} = await params
  const dict = await getDictionary(lang)
  return (
    <html
      lang={lang}
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
    <CookieNotice
      dict={dict.cookieNotice}
      lang={lang}
    />
    </body>
    </html>
  )
}
```

- [ ] **Step 2: Move the home + pricing pages** to `app/[lang]/page.tsx` / `app/[lang]/pricing/page.tsx`, taking
  `params`, calling `getDictionary(lang)`, passing `lang` to `Nav`/`Footer` (for links). Fix the relative import depth (
  `../../components/...`, `../../i18n/...`). Example home page:

```tsx
import { getDictionary } from '@/i18n/getDictionary'
import type { Locale } from '@/i18n/config'
import Nav from '../../components/Nav'
// ...
export default async function Home({ params }: { params: Promise<{ lang: Locale }> }) {
  const { lang } = await params
  const dict = await getDictionary(lang)
  return (
    <>
      <Nav dict={dict.nav} lang={lang} />
      <Hero dict={dict.hero} />
      {/* ...server components unchanged (string-only)... */}
      <Footer dict={dict.footer} lang={lang} />
    </>
  )
}
```

- [ ] **Step 3: Move the 3 legal pages** to `app/[lang]/{privacy,terms,cookies}/page.tsx` **as-is for now** (still
  English inline JSX — Phase D adds pt/es). Make each `async`, take `params` (so the route is valid under `[lang]`), and
  **locale-prefix their internal cross-links** (`/privacy` → `/${lang}/privacy`, `/cookies` → `/${lang}/cookies`). They
  don't need the dictionary yet.

- [ ] **Step 4: Locale-prefix internal links** in `Nav`, `Footer`, `CookieNotice` (they now accept `lang: Locale`):
    - `Nav`: `/` → `/${lang}`, `/#how-it-works` → `/${lang}#how-it-works`, `/#features` → `/${lang}#features`,
      `/pricing` → `/${lang}/pricing`. (`SIGN_IN_URL` unchanged.)
    - `Footer`: `/privacy|/terms|/cookies` → `/${lang}/...`. (`mailto:` unchanged.)
    - `CookieNotice`: `/cookies` → `/${lang}/cookies`.

- [ ] **Step 5: Delete the 6 old files** (`app/layout.tsx` + the 5 old `page.tsx`) via filesystem delete. Confirm
  nothing else imports them.

- [ ] **Step 6: Verify** — `pnpm --filter landing exec tsc --noEmit`, `pnpm lint`, `pnpm --filter landing build` (expect
  static generation of `/en`, `/pt`, `/es` and their subroutes — `generateStaticParams` × the routes). The build output
  should show the per-locale routes. Visit nothing (no dev) — the build proves the routes resolve.
  `pnpm exec prettier --write` the changed/created files.

- [ ] **Step 7: Save (do NOT commit).**

---

### Task C4: Middleware (locale detection + redirect)

**Files:** Create `landing/middleware.ts`.

- [ ] **Step 1: Write the middleware**

```ts
// landing/middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { i18n } from './i18n/config'

const LANG_COOKIE = 'lang'

function getLocale(request: NextRequest): string {
  const cookie = request.cookies.get(LANG_COOKIE)?.value
  if (cookie && (i18n.locales as readonly string[]).includes(cookie)) return cookie
  const header = request.headers.get('accept-language')
  if (header) {
    for (const part of header.split(',')) {
      const code = part.split(';')[0].trim().toLowerCase()
      const base = code.split('-')[0]
      const hit = i18n.locales.find(l => l === code || l === base)
      if (hit) return hit
    }
  }
  return i18n.defaultLocale
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const hasLocale = i18n.locales.some(l => pathname === `/${l}` || pathname.startsWith(`/${l}/`))
  if (hasLocale) return
  const locale = getLocale(request)
  const url = request.nextUrl.clone()
  url.pathname = `/${locale}${pathname === '/' ? '' : pathname}`
  return NextResponse.redirect(url)
}

export const config = {
  // Skip API, Next internals, and any path with a file extension (static assets).
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)']
}
```

- [ ] **Step 2: Verify** — `pnpm --filter landing exec tsc --noEmit`, `pnpm lint`, `pnpm --filter landing build`.
  (Middleware runs at request time; the build just compiles it.) `pnpm exec prettier --write landing/middleware.ts`.

- [ ] **Step 3: Save (do NOT commit).**

---

### Task C5: pt-BR + es dictionaries

**Files:** Create `landing/i18n/dictionaries/pt.json`, `landing/i18n/dictionaries/es.json`.

- [ ] **Step 1: Translate `en.json` → `pt.json` (pt-BR) and `es.json` (neutral LatAm).** Match the English key structure
  **exactly** (same keys, same array lengths/order — the `Dictionary` type is derived from `en.json` and `getDictionary`
  casts to it, so a missing/renamed key is a runtime gap). Apply the Global-Constraints "do NOT translate" list (brand,
  prices, URLs, placeholders). Translate marketing copy idiomatically, not literally — these are conversion-oriented
  headlines. For pt-BR, use Brazilian vocabulary/spelling. Keep the same tone (confident, direct, no em dashes).

- [ ] **Step 2: Verify structural parity** — there is no test harness, so check key parity mechanically: the three files
  must have identical key paths. After writing, run `pnpm --filter landing exec tsc --noEmit` (the dynamic imports must
  satisfy the `Dictionary` type — a mismatch in shape surfaces at the `import().then(m => m.default)` site only loosely,
  so ALSO eyeball-diff the key trees) and `pnpm --filter landing build`. Then load each locale at build time: the build
  statically renders `/pt` and `/es`; a missing key renders `undefined` (visible as an empty node) — scan the build for
  errors. `pnpm exec prettier --write landing/i18n/dictionaries/pt.json landing/i18n/dictionaries/es.json`.

- [ ] **Step 3: Save (do NOT commit).**

---

### Task C6: LanguageSelector

**Files:** Create `landing/components/LanguageSelector.tsx`; modify `landing/components/Nav.tsx` (mount it).

**Interfaces:** Consumes `dict={dict.languageSelector}` + `lang={lang}`. Writes the `lang` cookie via
`landing/lib/cookies.ts` `setCookie` (Plan 1) and routes to the same path under the chosen locale.

- [ ] **Step 1: LanguageSelector (client)**

```tsx
// landing/components/LanguageSelector.tsx
'use client'
import { useRouter, usePathname } from 'next/navigation'
import { setCookie } from '@/lib/cookies'
import { i18n, type Locale } from '@/i18n/config'
import type { Dictionary } from '@/i18n/getDictionary'

export default function LanguageSelector({ dict, lang }: { dict: Dictionary['languageSelector']; lang: Locale }) {
  const router = useRouter()
  const pathname = usePathname()

  const switchTo = (next: Locale) => {
    if (next === lang) return
    setCookie('lang', next) // shared cross-site cookie (Plan 1) — carries the choice to the app
    // Swap the leading /<lang> segment for /<next>, preserving the rest of the path.
    const rest = pathname.replace(new RegExp(`^/(${i18n.locales.join('|')})`), '') || ''
    router.push(`/${next}${rest}`)
    router.refresh()
  }

  return (
    <div className="flex items-center gap-1 text-sm">
      {i18n.locales.map(l => (
        <button
          key={l}
          type="button"
          onClick={() => switchTo(l)}
          aria-label={`${dict.label}: ${dict[l]}`}
          aria-current={l === lang ? 'true' : undefined}
          className={`rounded px-1.5 py-0.5 uppercase transition-colors ${
            l === lang ? 'text-gold-text' : 'text-cream/50 hover:text-cream'
          }`}
        >
          {l}
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Mount in Nav** — `Nav` already receives `lang`; add
  `<LanguageSelector dict={dict.languageSelector} lang={lang} />` into the right-side `flex items-center gap-3` div
  (before `<ThemeToggle />`). `Nav`'s page caller passes `dict.languageSelector` (thread it through, or pass the whole
  `dict` to Nav — keep the slice approach: add `languageSelector` to Nav's props, or have the page render
  `<LanguageSelector>` as a sibling — simplest: give Nav `dict={dict.nav}`, `langSelectorDict={dict.languageSelector}`,
  `lang`). Pick one and keep types tight.

- [ ] **Step 3: Verify** — tsc, lint, build. The compact 3-letter selector (EN/PT/ES) appears in the nav.
  `pnpm exec prettier --write` the changed files.

- [ ] **Step 4: Save (do NOT commit).**

---

## Phase D — pt/es legal pages

### Task D1: Restructure legal pages into per-locale content modules (English)

Convert each legal page from inline JSX into a locale-selecting page + an English content module, preserving the exact
hand-styled markup, `[PLACEHOLDER]` tokens, the draft banner, and the incomplete-section marker.

**Files (per legal page — privacy/terms/cookies):**

- Create: `app/[lang]/<page>/content/en.tsx` (the current inline JSX, extracted into a component)
- Modify: `app/[lang]/<page>/page.tsx` → selects content by `lang`

- [ ] **Step 1: Extract English content modules.** Move the JSX body of each legal page into `content/en.tsx` as a
  default-exported component (keep every class, `[PLACEHOLDER]`, `&mdash;`, embedded link, the "draft pending legal
  review" line, and the incomplete §7 marker exactly). Keep internal cross-links locale-prefixed via a `lang` prop the
  content component receives.

- [ ] **Step 2: Page selects by locale.**

```tsx
// landing/app/[lang]/privacy/page.tsx
import type {Locale} from '@/i18n/config'
import En from './content/en'
import Pt from './content/pt'
import Es from './content/es'

const CONTENT = {en: En, pt: Pt, es: Es} as const

export default async function PrivacyPage({params}: { params: Promise<{ lang: Locale }> }) {
  const {lang} = await params
  const Content = CONTENT[lang] ?? En
  return <Content lang={lang}/>
}
```

(For Step 1 of D1, create only `en.tsx`; `pt.tsx`/`es.tsx` are added in D2. To keep the build green in D1, point
`CONTENT.pt`/`CONTENT.es` at `En` temporarily, or implement the `?? En` fallback and import only `En` until D2 — pick
the approach that builds; the cleanest is to add the imports in D2.)

- [ ] **Step 3: Verify** — tsc, lint, build (`/en/privacy` etc. render English). prettier-write.

- [ ] **Step 4: Save (do NOT commit).**

---

### Task D2: pt-BR + es legal translations

**Files (per legal page):** Create `app/[lang]/<page>/content/{pt,es}.tsx`; wire them into the page's `CONTENT` map.

- [ ] **Step 1: Translate each English content module** to pt-BR and es, producing `pt.tsx` + `es.tsx` with **identical
  JSX structure/classes** — translate only the human-readable text nodes. Keep verbatim: `Link Into The SSI`, every
  `[PLACEHOLDER]` token, `mailto:`/external hrefs, policy version + dates, the Brazil-specific LGPD section (present in
  all locales, consistent with the English source). Translate the "draft pending legal review" banner. pt-BR vocabulary;
  neutral es.

- [ ] **Step 2: Wire** `CONTENT.pt`/`CONTENT.es` to the new modules in each legal `page.tsx`.

- [ ] **Step 3: Verify** — tsc, lint, build (`/pt/privacy`, `/es/terms`, etc. statically render translated drafts with
  placeholders intact). prettier-write.

- [ ] **Step 4: Save (do NOT commit).**

---

### Task D3: Docs + full verification

**Files:** Modify `docs/PLATFORM.md`.

- [ ] **Step 1: Update PLATFORM.md** (follow its "Maintaining This Document" mapping): document the landing's locale
  routing (`app/[lang]/`, middleware, `getDictionary` dictionary pattern, `LanguageSelector`, hreflang, the shared
  `lang` cookie tie-in to the app's i18n detector from Plan 1) and that the legal pages now have pt/es drafts (still
  pending legal review). Add a short Mermaid flow of the locale resolution (request → middleware: `lang` cookie →
  Accept-Language → default → `/<lang>/...`). Update §15 (Landing) + any i18n/§16 section.

- [ ] **Step 2: Full verification gate** — `pnpm --filter landing exec tsc --noEmit`,
  `pnpm --filter app exec tsc --noEmit` (unchanged but confirm), `pnpm lint`, `pnpm --filter landing build` (static
  `/en`, `/pt`, `/es` + all subroutes generate cleanly). The app suite is untouched by this plan, but run
  `pnpm --filter app test` once to confirm no incidental breakage.

- [ ] **Step 3: Final visual/behavior checklist (deferred to Henriko — note it):** browser-language redirect (`/` →
  `/<detected>`); the EN/PT/ES selector switches locale + persists (cookie) + carries to the app; light/dark still works
  per locale; legal drafts render in all 3 languages with placeholders + draft banner intact; hreflang present in page
  source.

- [ ] **Step 4: Save (do NOT commit).**

---

## Risks / notes

- **The `[lang]` move (C3) is the high-risk task** — every route relocates and the root layout changes. The build
  (static generation of all per-locale routes) is the gate. Keep C1/C2 (string conversion) landing first so C3 is a pure
  move + link-prefix, not a move + rewrite.
- **Dictionary key parity** (en/pt/es) is enforced loosely by types — eyeball the key trees in C5/D2; a missing key
  renders blank, not an error.
- **pt-BR / es dialect is an assumption** (flagged in Global Constraints) — confirm with Henriko before C5/D2 if unsure;
  re-translation is the only cost if it changes.
- **Legal remains draft** — pt/es do not change the "pending legal review" status; placeholders stay. Re-translate once
  the English legal text is finalised.
- **Cross-site `lang` sync is prod-only** (host-only cookie in dev, like theme — Plan 1).
- **CTAs to the app** (`SIGN_IN_URL`) don't carry locale; the app detects its own language from the shared `lang`
  cookie (Plan 1 A3).
