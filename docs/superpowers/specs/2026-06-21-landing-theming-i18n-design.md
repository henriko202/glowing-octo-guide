# Landing Theming + i18n (cross-site) — Design

**Status:** For review (decisions locked) · **Date:** 2026-06-21

## Goal

Add to the **landing** site: (1) auto + toggleable **light/dark** theme, (2) **locale-routed i18n** (en/pt/es) with
browser-language detection + a selector, (3) **pt/es legal pages** — and **persist theme + language across both sites
** (landing `linkintothessi.com` + app `app.linkintothessi.com`).

## Decisions (locked)

| #  | Decision               | Choice                                                                                                                                                                                                         |
|----|------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| D1 | Cross-site persistence | **Cookie on `.linkintothessi.com`** (both sites read/write; app updated too)                                                                                                                                   |
| D2 | Landing i18n           | **Locale-routed `/pt` `/es`** (SEO; `app/[locale]/` refactor + middleware)                                                                                                                                     |
| D3 | Light theme            | **Reuse the app's light palette** (warm off-white)                                                                                                                                                             |
| D4 | Legal translations     | **Draft all 3 (privacy/terms/cookies) in pt/es now**, same "DRAFT pending legal review" status                                                                                                                 |
| D5 | Landing Tailwind       | **Migrate v3 → v4** (CSS-first; aligns with the app, makes the CSS-var theming idiomatic)                                                                                                                      |
| D6 | Dark palette           | **Unify with the app's dark values** (cross-site consistency): landing `#060B18`→app `#0e1320`, `ink-800/600/400` and `cream-muted` likewise. Not just the light palette — the whole dark palette is replaced. |

## The app's contract (what we match/extend)

- **Theme:** `localStorage['theme']` ∈ `light|dark|system`; OS via `matchMedia('(prefers-color-scheme: dark)')`; applied
  as `class="dark"` on `<html>` + `colorScheme` + `<meta theme-color>`. Code: `app/src/lib/theme.ts`,
  `app/src/components/ThemeProvider.tsx`.
- **Palette (app/src/index.css):** CSS vars on `:root` (light) / `.dark` (dark). Light: `--background #f2eee6`,
  `--foreground #1c1813`, `--primary #c9963e`, `--gold-text #8a6418`, `--card #fff`, `--muted-foreground #6e6757`,
  `--border #e4dccd`. Dark: `--background #0e1320`, `--foreground #f5f0e8`, `--primary #d8a94e`, `--gold-text #e8c474`,
  `--card #161c2b`.
- **Language:** `localStorage['i18nextLng']` ∈ `en|pt|es` (detector order localStorage → ?lang → navigator). Code:
  `app/src/i18n/index.ts`.

---

## Architecture

### A. Cross-site persistence (cookie)

A cookie scoped to the **registrable parent domain** is sent to both the apex and the app subdomain (localStorage can't
cross origins).

- **Cookies:** `theme` (`light|dark|system`) and `lang` (`en|pt|es`), `Path=/`, `SameSite=Lax`, ~1yr, `Domain=<parent>`.
- **Cookie domain is env-configured:** `NEXT_PUBLIC_COOKIE_DOMAIN` (landing) / `VITE_COOKIE_DOMAIN` (app) =
  `.linkintothessi.com` in prod; **unset in dev** (host-only cookies — cross-site sync only works in prod, since dev is
  `localhost:3000` vs `:5173`, different origins). This is an accepted dev limitation.
- **App changes:** `app/src/lib/theme.ts` `getStoredTheme/setStoredTheme` read/write the `theme` cookie (cookie is
  source of truth; keep a localStorage mirror for speed). `app/src/i18n/index.ts` adds a **cookie detector** (
  `order: ['cookie','localStorage','querystring','navigator']`, `lookupCookie: 'lang'`,
  `caches: ['cookie','localStorage']`, `cookieDomain` from env). A tiny shared cookie helper.
- **Landing:** a cookie helper; the theme no-flash script + ThemeToggle write the `theme` cookie; the locale
  middleware + LanguageSelector use the `lang` cookie.

### B. Landing → Tailwind v4 + light/dark theme

**Migrate the landing to Tailwind v4** (CSS-first, like the app) and port the app palette as CSS variables so component
classes stay unchanged. `globals.css` mirrors the app's `index.css`: `@import 'tailwindcss'`;
`@custom-variant dark (&:is(.dark *))`;
`@theme inline { --color-ink: var(--ink); --color-cream: var(--cream); --color-gold: var(--gold); --color-gold-text: var(--gold-text); --color-lnblue: var(--lnblue); ... }`;
then `:root` (light) + `.dark` (dark) token blocks. **`tailwind.config.ts` is removed** (v4 is CSS-first; keep only a
`@config` shim if some plugin truly needs it); PostCSS switches to `@tailwindcss/postcss`; deps drop `tailwindcss@3` +
`autoprefixer` and add `tailwindcss@^4` + `@tailwindcss/postcss`. The shared `prettier-plugin-tailwindcss` already
handles v4. Opacity utilities (`text-cream/50`) work natively on the `--color-*` tokens — no channel hack.

- `globals.css` token values (app palette mapped to landing token names):
    - `--ink` (page bg): light `#f2eee6` / dark `#0e1320`; `--ink-800`: light `#faf7f0` / dark `#161c2b`; `--ink-600`:
      light `#ffffff` / dark `#1c2433`; `--ink-400`: light `#e4dccd` / dark `#2a3142`.
    - `--cream` (text): light `#1c1813` / dark `#f5f0e8`; `--cream-muted`: light `#6e6757` / dark `#9a9384`.
    - `--gold` (accent/buttons): light `#c9963e` / dark `#d8a94e`. **New `--gold-text`** (legible gold for
      eyebrows/links): light `#8a6418` / dark `#e8c474`.
    - `--lnblue`: light `#0077b5` / dark `#0a84ff` (and `-light`).
- Dark mode via `@custom-variant dark (&:is(.dark *))` (v4) — same as the app; no `darkMode: 'class'` JS config needed.
- **Config → CSS-first port (don't drop these on the floor):** the v3 `tailwind.config.ts` `theme.extend` carries more
  than colors. Port into `globals.css`: the `fadeUp`/`shimmer` **keyframes** +
  `@theme { --animate-fade-up / --animate-shimmer }` (components use `animate-fadeUp`/`animate-shimmer`), the **fonts
  ** (`--font-display`, `--font-body` — keep the existing Google-Fonts `@import url(...)`), and the **named accent
  colors** (`cream.dim` → `--color-cream-dim`, `gold.light`/`lnblue.light` → `--color-gold-light`/
  `--color-lnblue-light`). Audit that `font-display`, `text-gold-light`, `hover:bg-lnblue-light`, `text-cream-dim` still
  resolve post-migration.
- **The gold split:** replace `text-gold` used for *eyebrow labels / inline links* with `text-gold-text` (legible on
  both themes); keep `bg-gold`/`text-gold` for *buttons/icons on accent surfaces*. Audit each `text-gold` usage across
  the 12 components.
- **Decorative rgba** (Hero/FinalCTA radial glows, `.circle-ring`): convert the hardcoded `rgba(...)` to theme-aware CSS
  vars (e.g. `--glow-gold`, `--ring-border`) with light/dark values, so they're visible on light too.
- **No-flash:** an inline `<script>` in `landing/app/[locale]/layout.tsx` reads the `theme` cookie (+ system) and sets
  `class="dark"` + `colorScheme` on `<html>` before paint. A `'use client'` `ThemeToggle` (3-state system/light/dark)
  added to `Nav.tsx`, writing the cookie + toggling the class. `<meta name="theme-color">` updated.

### C. Landing i18n (locale-routed)

- **Routing:** move pages under `landing/app/[locale]/` (`en|pt|es`). `middleware.ts` detects locale from the `lang`
  cookie → else `Accept-Language` → else `en`, and redirects `/` → `/<locale>` (and rewrites/validates the segment).
  `generateStaticParams` pre-renders the 3 locales.
- **Dictionaries (no heavy lib):** `landing/i18n/dictionaries/{en,pt,es}.json` + `getDictionary(locale)` (server).
  Server components receive the dict (or locale → dict) and render translated strings; the 4 client components (`Nav`,
  `Pricing`, `FAQ`, `CookieNotice`) receive their dict slice as props from the server page/layout. ~120 strings
  extracted from the components into the dictionaries.
- **`<html lang={locale}>`** dynamic; **hreflang** alternates + `og:locale` in metadata; canonical per locale.
- **LanguageSelector** (`'use client'`, in Nav): sets the `lang` cookie + `router.push` to the same path under the
  chosen locale.
- **CTAs:** the OAuth/`SIGN_IN_URL` links already carry `?plan=&interval=`; locale doesn't need to propagate to the
  app (the app detects its own language from the shared `lang` cookie — D1).

### D. Legal pages (pt/es)

Translate `privacy`, `terms`, `cookies` into pt/es as **drafts** (keep the `[PLACEHOLDER]` tokens + the "pending legal
review" banner + the incomplete §7 marker verbatim, just translated). They live under the new
`app/[locale]/{privacy,terms,cookies}` routes. The Brazil-specific LGPD section stays in all locales (consistent with
the English source) unless you say otherwise. **Legal review still required** before launch — translation does not
change that.

---

## Phased plan (each phase independently shippable)

- **Phase A — Cross-site cookie foundation:** shared cookie helper(s); app `lib/theme.ts` + `i18n` read/write the
  cookie; env vars `*_COOKIE_DOMAIN`. (Touches `app/`.)
- **Phase B — Landing Tailwind v4 migration + light/dark:** migrate to v4 (CSS-first: drop `tailwind.config.ts` +
  `autoprefixer`, add `tailwindcss@^4` + `@tailwindcss/postcss`, swap the PostCSS plugin); port the app palette as CSS
  vars; `@custom-variant dark` (replaces `darkMode: 'class'`); gold-text split; decorative-rgba vars; no-flash script;
  `ThemeToggle` in Nav; theme cookie. Verify the dark look renders identically post-migration before layering light. (
  Touches `landing/`.)
- **Phase C — Landing i18n:** `app/[locale]/` refactor, middleware, dictionaries + ~120 translations (en/pt/es),
  `LanguageSelector`, hreflang, lang cookie. (Touches `landing/`.)
- **Phase D — Legal pt/es:** translated privacy/terms/cookies under the locale routes. (Touches `landing/`; depends on
  C's routing.)

Suggested order: **A → B → C → D** (C and D can merge — the legal pages are part of the locale routing).

## Risks / notes

- **Dev cross-site cookie won't sync** (different localhost ports) — prod-only feature; fine.
- **Gold legibility on light** is the main theme gotcha — the `text-gold` → `text-gold-text` audit must be thorough.
- **`app/[locale]/` is a real refactor** — every landing route moves; links/middleware must be consistent.
- **Legal translations are drafts** — the pages remain "pending legal review"; pt/es will need re-translation once the
  English legal text is finalized (placeholders, §7).
- **Tailwind v4 migration breaking changes** to audit in the landing: default `border` color (now `currentColor`),
  default `ring` width (3→1px) and color, `outline-none`→`outline-hidden`, any renamed/removed utilities, and the
  PostCSS plugin swap. Sequence the migration in two checkpoints: first the **pure v3→v4 port with dark unchanged** (
  `#060B18` etc.) must build and render before touching values, *then* swap the dark token block to the app's values (
  D6) and layer in light — so a v4 regression and a palette change are never debugged together.

## Files / surfaces

`app/`: `src/lib/theme.ts`, `src/i18n/index.ts`, a cookie helper, `.env*.example`. `landing/`: `tailwind.config.ts` (*
*removed**), `postcss.config.*` + `package.json` (v4 dep/plugin swap), `app/globals.css` (rewritten CSS-first),
`middleware.ts` (new), `app/[locale]/**` (moved), `i18n/dictionaries/*` (new), `getDictionary` (new),
`components/{Nav,Pricing,FAQ,CookieNotice,...}.tsx`, `components/ThemeToggle.tsx` + `LanguageSelector.tsx` (new),
`app/[locale]/{privacy,terms,cookies}/page.tsx`. `docs/PLATFORM.md` §15/§16 (+ §14 for the app cookie).
