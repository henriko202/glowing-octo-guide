# Cloudflare Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:
> executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy `landing/` (Next.js via OpenNext) and `app/` (Vite SPA) to Cloudflare Workers, fronting the existing
Convex backend, with production security headers/CSP.

**Architecture:** Two Cloudflare Workers — the landing as an OpenNext Worker (full Next.js + middleware), the app as a
Static-Assets Worker with SPA fallback. Convex stays on Convex cloud; both frontends inline its prod URL at build time.
Security headers move to the HTTP layer (app: hashed CSP via a generated `_headers`; landing: nonce CSP via middleware).

**Tech Stack:** Next.js 15, `@opennextjs/cloudflare`, Vite 6, Wrangler 4, Cloudflare Workers Static Assets, Convex.

**Spec:** `docs/superpowers/specs/2026-06-22-cloudflare-deployment-design.md`

## Global Constraints

- **NEVER run state-changing git commands** (`commit`, `push`, `stash`, `checkout`, `reset`, `rebase`, `clean`). Henriko
  makes ALL commits. Each task ends with a verification step + a checkpoint where Henriko reviews and commits. (Project
  `CLAUDE.md`; prior incident where a subagent ran `git stash` and stranded work.)
- **Package manager is `pnpm`, never `npm`.** Run the Convex CLI **only from the repo root** (running it inside
  `convex/` wipes the deployment).
- **Prettier style (enforced by `pnpm format:check`):** no semicolons, single quotes, `arrowParens: avoid`, no trailing
  commas, 120-col width, `singleAttributePerLine` for JSX, `prettier-plugin-tailwindcss`.
- **`pnpm verify` must stay green** = `format:check && lint (--max-warnings 0) && typecheck && pnpm -r test`.
- **Prod values (verbatim):** apex `https://linkintothessi.com`; app `https://app.linkintothessi.com`; cookie domain
  `.linkintothessi.com`; Convex `https://<prod>.convex.cloud` + `https://<prod>.convex.site` (`<prod>` = the real prod
  deployment slug, filled in at deploy time).
- **Convex is NOT on Cloudflare.** Cloudflare serves only the two frontends.

---

## File Structure

| File                              | Task   | Responsibility                                                                    |
|-----------------------------------|--------|-----------------------------------------------------------------------------------|
| `app/wrangler.jsonc`              | A1     | App Worker config — static assets + SPA fallback                                  |
| `app/package.json`                | A1, A2 | Add `wrangler` dep; wire `_headers` generation into build                         |
| `app/scripts/gen-headers.mjs`     | A2     | Post-build: derive CSP script hash from built `index.html`, write `dist/_headers` |
| `app/scripts/gen-headers.test.ts` | A2     | Unit tests for the pure hash/headers functions                                    |
| `app/index.html`                  | A2     | Remove the `<meta>` CSP (moves to HTTP header)                                    |
| `eslint.config.js`                | A2     | Node-globals override for `scripts/**/*.mjs`                                      |
| `landing/open-next.config.ts`     | B1     | OpenNext Cloudflare config (no ISR cache)                                         |
| `landing/wrangler.jsonc`          | B1     | Landing Worker config — OpenNext worker + assets                                  |
| `landing/package.json`            | B1     | `preview` / `deploy` scripts                                                      |
| `landing/lib/csp.ts`              | B2     | Pure `buildContentSecurityPolicy(nonce)`                                          |
| `landing/middleware.ts`           | B2     | Add per-request nonce + CSP to existing locale logic                              |
| `landing/app/[lang]/layout.tsx`   | B2     | Apply nonce to the `NO_FLASH` inline script                                       |
| `landing/next.config.js`          | B2     | Static security headers (HSTS, nosniff, etc.)                                     |
| `package.json` (root)             | C1     | `deploy:app` / `deploy:landing` / `preview:landing` scripts                       |
| `docs/PLATFORM.md`                | E1     | Sync §2/§16/§17/§18/§19 to the Cloudflare topology                                |

Tasks **D1–D3** are Cloudflare/Convex dashboard + DNS steps performed by Henriko (agents can't access the dashboard or
secrets); Claude provides the exact commands and verifies outputs.

---

## Phase A — App (Vite SPA) → Workers Static Assets

### Task A1: App Worker config (static assets + SPA fallback)

**Files:**

- Create: `app/wrangler.jsonc`
- Modify: `app/package.json` (add `wrangler` devDependency)

**Interfaces:**

- Produces: a deployable Static-Assets Worker named `linkintothessi-app` serving `app/dist/` with SPA deep-link
  fallback. Consumed by the `deploy:app` script (C1) and Workers Builds (D3).

- [ ] **Step 1: Add `wrangler` to the app package**

Run: `pnpm --filter app add -D wrangler@^4.103.0`
Expected: `app/package.json` devDependencies now include `wrangler`; lockfile updates.

- [ ] **Step 2: Create `app/wrangler.jsonc`**

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "linkintothessi-app",
  "compatibility_date": "2025-03-25",
  "assets": {
    "directory": "./dist",
    "not_found_handling": "single-page-application"
  }
}
```

This is an **assets-only Worker** (no `main`). `not_found_handling: "single-page-application"` serves
`dist/index.html` (HTTP 200) for unknown paths, so `BrowserRouter` deep links (`/feed`, `/settings`, `/admin`) resolve
on hard refresh instead of 404ing.

- [ ] **Step 3: Build the app**

Run: `pnpm --filter app build`
Expected: `app/dist/index.html` + hashed assets produced, exit 0.

- [ ] **Step 4: Dry-run the deploy to validate config**

Run: `pnpm --filter app exec wrangler deploy --dry-run`
Expected: Wrangler prints the asset upload plan (including `index.html`) and "Dry run complete" with no config errors. (
No login needed for `--dry-run`.)

- [ ] **Step 5: Verify the full suite still passes**

Run: `pnpm verify`
Expected: PASS (format, lint, typecheck, tests).

- [ ] **Step 6: ✋ Checkpoint** — Henriko reviews `app/wrangler.jsonc` + `app/package.json` and commits. (Claude does NOT
  run git.)

---

### Task A2: App security headers + hashed CSP

**Files:**

- Create: `app/scripts/gen-headers.mjs`
- Create: `app/scripts/gen-headers.test.ts`
- Modify: `app/index.html` (remove the `<meta>` CSP block)
- Modify: `app/package.json` (build script runs the generator)
- Modify: `eslint.config.js` (Node globals for `scripts/**/*.mjs`)

**Interfaces:**

- Produces: `app/dist/_headers` (Cloudflare Static-Assets header rules) on every build, with `script-src` locked to the
  SHA-256 of the pre-paint theme-guard inline script. Exports `extractInlineScriptHashes(html: string): string[]` and
  `buildHeadersContent(scriptHashes: string[]): string` for testing.

- [ ] **Step 1: Write the generator with pure, testable functions**

Create `app/scripts/gen-headers.mjs`:

```js
// Generates dist/_headers for Cloudflare Workers Static Assets after `vite build`.
// The pre-paint theme-guard inline script in index.html must run before first paint,
// so it can't be an external file — we lock script-src with its SHA-256 hash instead
// of 'unsafe-inline'. The hash is derived from the BUILT index.html so it always matches.
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const DIST = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist')

export function extractInlineScriptHashes(html) {
  const hashes = []
  const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi
  let match
  while ((match = re.exec(html)) !== null) {
    const body = match[1]
    if (body.trim() === '') continue
    hashes.push('sha256-' + createHash('sha256').update(body, 'utf8').digest('base64'))
  }
  return hashes
}

export function buildHeadersContent(scriptHashes) {
  const scriptSrc = ["'self'", ...scriptHashes].join(' ')
  const csp = [
    `default-src 'self'`,
    `script-src ${scriptSrc}`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' https: data:`,
    `frame-src https://www.linkedin.com`,
    `connect-src 'self' https://*.convex.cloud wss://*.convex.cloud https://*.convex.site https://*.stripe.com`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`
  ].join('; ')
  return [
    '/*',
    `  Content-Security-Policy: ${csp}`,
    '  Strict-Transport-Security: max-age=63072000; includeSubDomains; preload',
    '  X-Content-Type-Options: nosniff',
    '  Referrer-Policy: strict-origin-when-cross-origin',
    '  Permissions-Policy: camera=(), microphone=(), geolocation=()',
    ''
  ].join('\n')
}

function main() {
  const html = readFileSync(join(DIST, 'index.html'), 'utf8')
  const hashes = extractInlineScriptHashes(html)
  writeFileSync(join(DIST, '_headers'), buildHeadersContent(hashes))
  console.log(`Wrote dist/_headers with ${hashes.length} script hash(es).`)
}

// Run main() only when executed directly (`node scripts/gen-headers.mjs`), not on import.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main()
```

- [ ] **Step 2: Write the failing test**

Create `app/scripts/gen-headers.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { buildHeadersContent, extractInlineScriptHashes } from './gen-headers.mjs'

describe('extractInlineScriptHashes', () => {
  it('hashes inline scripts and ignores external ones', () => {
    const html =
      '<!doctype html><html><head>' +
      "<script>window.__t='dark'</script>" +
      '</head><body>' +
      '<script type="module" src="/app.js"></script>' +
      '</body></html>'
    expect(extractInlineScriptHashes(html)).toEqual(['sha256-ORwiB/dKZDCqKP3qym/M9HzVt4LfjYBx2NdHJzCndcU='])
  })

  it('skips empty scripts', () => {
    expect(extractInlineScriptHashes('<script>  </script>')).toEqual([])
  })
})

describe('buildHeadersContent', () => {
  it('embeds hashes in script-src and includes the hardening headers', () => {
    const out = buildHeadersContent(['sha256-abc'])
    expect(out).toContain("script-src 'self' sha256-abc")
    expect(out).toContain("frame-ancestors 'none'")
    expect(out).toContain('Strict-Transport-Security: max-age=63072000; includeSubDomains; preload')
    expect(out.startsWith('/*')).toBe(true)
  })
})
```

- [ ] **Step 3: Run the test to verify it passes**

Run: `pnpm --filter app exec vitest run scripts/gen-headers.test.ts`
Expected: 3 passing. (The expected hash `sha256-ORwiB/dKZDCqKP3qym/M9HzVt4LfjYBx2NdHJzCndcU=` is the real SHA-256 of
`window.__t='dark'`.)

- [ ] **Step 4: Remove the `<meta>` CSP from `app/index.html`**

Delete this block (the inline theme-guard `<script>` above it STAYS — it's now covered by the hash):

```html
    <meta
      content="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data:; frame-src https://www.linkedin.com; connect-src 'self' https://*.convex.cloud wss://*.convex.cloud https://*.stripe.com; object-src 'none'; base-uri 'self'; form-action 'self';"
      http-equiv="Content-Security-Policy"
    />
```

- [ ] **Step 5: Wire the generator into the build**

In `app/package.json`, change the `build` script:

```json
"build": "tsc && vite build && node scripts/gen-headers.mjs",
```

- [ ] **Step 6: Add the ESLint Node-globals override**

In `eslint.config.js`, insert this block immediately **before** the final `prettierConfig`:

```js
  // ─── Node build scripts (plain ESM, not TypeScript) ───────────────────────
  {
    files: ['**/scripts/**/*.mjs'],
    languageOptions: {
      globals: { process: 'readonly', console: 'readonly' }
    }
  },
```

- [ ] **Step 7: Build and verify the generated headers**

Run: `pnpm --filter app build`
Then inspect `app/dist/_headers`. Expected: a `/*` block whose `script-src` contains `'self'` + a real `sha256-…` hash (
NOT `'unsafe-inline'`), plus `Strict-Transport-Security`, `X-Content-Type-Options`, `frame-ancestors 'none'`. Confirm
`app/dist/index.html` no longer contains `http-equiv="Content-Security-Policy"`.

- [ ] **Step 8: Verify the full suite**

Run: `pnpm verify`
Expected: PASS. (Confirms the `.mjs` lints clean under the new override and Prettier is happy.)

- [ ] **Step 9: ✋ Checkpoint** — Henriko reviews and commits.

---

## Phase B — Landing (Next.js) → OpenNext Worker

### Task B1: OpenNext build + Worker config

**Files:**

- Create: `landing/open-next.config.ts`
- Create: `landing/wrangler.jsonc`
- Modify: `landing/package.json` (preview/deploy scripts)

**Interfaces:**

- Produces: `landing/.open-next/worker.js` + `landing/.open-next/assets/` from `opennextjs-cloudflare build`; a Worker
  named `linkintothessi-landing`. Consumed by `deploy:landing` (C1) and Workers Builds (D3).

- [ ] **Step 1: Create `landing/open-next.config.ts`**

```ts
import { defineCloudflareConfig } from '@opennextjs/cloudflare'

// No incremental (ISR) cache: the landing renders from local dictionaries with no
// runtime data, so the default in-memory behavior is all we need.
export default defineCloudflareConfig()
```

- [ ] **Step 2: Create `landing/wrangler.jsonc`**

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "linkintothessi-landing",
  "main": ".open-next/worker.js",
  "compatibility_date": "2025-03-25",
  "compatibility_flags": ["nodejs_compat"],
  "assets": {
    "binding": "ASSETS",
    "directory": ".open-next/assets"
  }
}
```

`nodejs_compat` is required by OpenNext's worker runtime.

- [ ] **Step 3: Add preview/deploy scripts to `landing/package.json`**

Add to `scripts`:

```json
"preview": "opennextjs-cloudflare build && opennextjs-cloudflare preview",
"deploy": "opennextjs-cloudflare build && opennextjs-cloudflare deploy",
```

- [ ] **Step 4: Run the OpenNext build**

Run: `pnpm --filter landing exec opennextjs-cloudflare build`
Expected: completes with `.open-next/worker.js` and `.open-next/assets/` created. (First run downloads/builds; may take
a minute. Requires `landing/.env.local` to have the `NEXT_PUBLIC_*` vars, or set them in the shell — `next build`
inlines them.)

- [ ] **Step 5: Local preview smoke test**

Run: `pnpm --filter landing exec opennextjs-cloudflare preview`
Then open `http://localhost:8788/` → expect a 307/308 redirect to `/en` (or your `Accept-Language` locale) and the
landing renders. Stop the preview (Ctrl-C) when done.

- [ ] **Step 6: Verify the suite**

Run: `pnpm verify`
Expected: PASS. (`*.config.ts` and `.next/`/`.open-next/` are ESLint-ignored; confirm typecheck still passes.)

- [ ] **Step 7: ✋ Checkpoint** — Henriko reviews and commits. (Note: ensure `landing/.open-next/` and
  `landing/.wrangler/` are git-ignored — add them to `.gitignore` in this step if absent.)

---

### Task B2: Landing CSP nonce + static security headers

**Files:**

- Create: `landing/lib/csp.ts`
- Modify: `landing/middleware.ts`
- Modify: `landing/app/[lang]/layout.tsx`
- Modify: `landing/next.config.js`

**Interfaces:**

- Consumes: `i18n` from `./i18n/config` (existing).
- Produces: `buildContentSecurityPolicy(nonce: string): string`; a `Content-Security-Policy` response header carrying a
  per-request nonce; an `x-nonce` request header read by the layout.

- [ ] **Step 1: Create the pure CSP builder `landing/lib/csp.ts`**

```ts
// CSP for the landing. Next injects dynamic inline bootstrap scripts whose hashes
// change per build, so we use a per-request nonce + 'strict-dynamic'. The trailing
// 'unsafe-inline' https: are CSP2 fallbacks that CSP3 browsers ignore when a nonce
// is present (kept for old-browser graceful degradation).
export function buildContentSecurityPolicy(nonce: string): string {
  return [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-inline' https:`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' https: data:`,
    `connect-src 'self' https://*.convex.cloud https://*.convex.site`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`
  ].join('; ')
}
```

- [ ] **Step 2: Update `landing/middleware.ts` to attach nonce + CSP**

Replace the file with (locale logic unchanged; CSP/nonce woven in):

```ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { i18n } from './i18n/config'
import { buildContentSecurityPolicy } from './lib/csp'

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
  const nonce = btoa(crypto.randomUUID())
  const csp = buildContentSecurityPolicy(nonce)

  const { pathname } = request.nextUrl
  const hasLocale = i18n.locales.some(l => pathname === `/${l}` || pathname.startsWith(`/${l}/`))

  if (!hasLocale) {
    const locale = getLocale(request)
    const url = request.nextUrl.clone()
    url.pathname = `/${locale}${pathname === '/' ? '' : pathname}`
    const redirect = NextResponse.redirect(url)
    redirect.headers.set('Content-Security-Policy', csp)
    return redirect
  }

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)
  requestHeaders.set('Content-Security-Policy', csp)
  const response = NextResponse.next({ request: { headers: requestHeaders } })
  response.headers.set('Content-Security-Policy', csp)
  return response
}

export const config = {
  // Skip API, Next internals, and any path with a file extension (static assets).
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)']
}
```

- [ ] **Step 3: Apply the nonce to the `NO_FLASH` script in `landing/app/[lang]/layout.tsx`**

Add the import and read the nonce, then pass it to the inline script. Add near the top:

```tsx
import { headers } from 'next/headers'
```

Inside `RootLayout`, after `const dict = await getDictionary(lang)`:

```tsx
  const nonce = (await headers()).get('x-nonce') ?? undefined
```

Change the inline script element to carry the nonce (note `singleAttributePerLine`):

```tsx
        <script
          nonce={nonce}
          dangerouslySetInnerHTML={{ __html: NO_FLASH }}
        />
```

- [ ] **Step 4: Add static security headers in `landing/next.config.js`**

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' }
        ]
      }
    ]
  }
}

export default nextConfig
```

(CSP stays in middleware because it needs the per-request nonce; the static headers live here so they also cover paths
the middleware matcher skips.)

- [ ] **Step 5: Build + preview, then inspect headers**

Run: `pnpm --filter landing exec opennextjs-cloudflare preview`
In another shell: `curl -sI http://localhost:8788/en`
Expected headers present: `content-security-policy: …'nonce-…' 'strict-dynamic'…`, `strict-transport-security`,
`x-content-type-options: nosniff`. In a browser at `http://localhost:8788/en`, the DevTools console shows **no CSP
violations** and the theme applies with no flash. (PowerShell alt:
`(Invoke-WebRequest http://localhost:8788/en -Method Head).Headers`.)

- [ ] **Step 6: Verify the suite**

Run: `pnpm verify`
Expected: PASS.

- [ ] **Step 7: ✋ Checkpoint** — Henriko reviews and commits.

> **Decision note for the executor (learning-mode):** the nonce makes landing responses render per-request (not fully
> static-cached). For a no-user-input marketing site that's a minor cost and the approved default. If Henriko prefers
> full
> static caching over a strict script CSP, the fallback is to drop the nonce/middleware-CSP and keep only Step 4's
> static
> headers with `script-src 'self' 'unsafe-inline'`. Confirm preference before/at this step.

---

## Phase C — Root deploy scripts

### Task C1: Root `package.json` deploy/preview scripts

**Files:**

- Modify: `package.json` (root)

**Interfaces:**

- Consumes: `app/wrangler.jsonc` (A1), `landing` OpenNext scripts (B1).
- Produces: `deploy:app`, `deploy:landing`, `preview:landing` — used for the manual smoke deploy (D2).

- [ ] **Step 1: Add scripts to root `package.json`**

```json
"deploy:app": "pnpm --filter app build && pnpm --filter app exec wrangler deploy",
"deploy:landing": "pnpm --filter landing deploy",
"preview:landing": "pnpm --filter landing preview",
```

- [ ] **Step 2: Validate the app path end-to-end (dry run)**

Run: `pnpm deploy:app -- --dry-run` (or `pnpm --filter app build && pnpm --filter app exec wrangler deploy --dry-run`)
Expected: builds then prints the asset upload plan, no errors.

- [ ] **Step 3: Verify the suite**

Run: `pnpm verify`
Expected: PASS.

- [ ] **Step 4: ✋ Checkpoint** — Henriko reviews and commits.

---

## Phase D — Convex prod, manual deploy, DNS, Git automation (Henriko-performed)

> These are account/dashboard/DNS actions an agent cannot perform. Claude supplies exact commands and verifies results;
> Henriko executes dashboard steps and holds the secrets.

### Task D1: Production Convex deployment + secrets

- [ ] **Step 1:** From the **repo root**, run `npx convex deploy` and record the prod `https://<prod>.convex.cloud` and
  `https://<prod>.convex.site` URLs.
- [ ] **Step 2:** In the **Convex dashboard → Settings → Environment Variables**, set per `PLATFORM.md §16`:
  `APP_URL=https://app.linkintothessi.com`, `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`,
  `LINKEDIN_REDIRECT_URI=https://<prod>.convex.site/auth/linkedin/callback`, all `STRIPE_*` (keys, monthly+annual price
  ids, webhook secret). Leave `ALLOW_ADMIN_SHARE_ANY_POST` **unset**.
- [ ] **Step 3:** In the **LinkedIn developer app**, set the OAuth redirect URL to
  `https://<prod>.convex.site/auth/linkedin/callback`.
- [ ] **Step 4:** In **Stripe**, set the webhook endpoint to `https://<prod>.convex.site/stripe/webhook` and copy its
  signing secret into the Convex `STRIPE_*` webhook var.
- [ ] **Step 5: Verify** — `curl -sI https://<prod>.convex.site/auth/linkedin` returns a `302` to `linkedin.com`. (
  Confirms the HTTP router + `buildAuthUrl` are live.)

### Task D2: Manual smoke deploy + custom domains

- [ ] **Step 1:** Create the prod env files locally (git-ignored): `app/.env.local` with the full `VITE_*` matrix (spec
  §5) and `landing/.env.local` with the `NEXT_PUBLIC_*` matrix, all pointing at the real `<prod>` +
  `linkintothessi.com`.
- [ ] **Step 2:** `wrangler login` (one-time browser auth).
- [ ] **Step 3:** `pnpm deploy:app` then `pnpm deploy:landing`. Expected: each prints a deployed `*.workers.dev` URL.
- [ ] **Step 4:** In the **Cloudflare dashboard → each Worker → Settings → Domains & Routes → Custom Domains**: add
  `app.linkintothessi.com` to the app Worker and `linkintothessi.com` to the landing Worker (DNS + TLS auto-provisioned
  since the zone is in Cloudflare). Add a **Redirect Rule**: `www.linkintothessi.com/*` →
  `https://linkintothessi.com/$1` (301).
- [ ] **Step 5: Verify (production):**
    - `curl -sI https://linkintothessi.com/` → 307/308 → a locale; `curl -sI https://www.linkintothessi.com/` → 301 →
      apex.
    - Browse `https://app.linkintothessi.com/feed` and hard-refresh → SPA loads (no 404), **and confirm the stylesheet
      loads** (watch the `/dist/styles.css` reference in `app/index.html`; if it 404s in prod, raise it — that's a
      pre-existing path quirk to fix separately, out of this plan's scope).
    - Full sign-in: app → LinkedIn → callback → `/auth/success` lands you in the app.
    - Toggle theme/language on the landing, navigate to the app → preference persists (shared `.linkintothessi.com`
      cookie).
    - Run both URLs through an HTTP-header check (e.g. securityheaders.com): HSTS + `frame-ancestors 'none'` present, *
      *no CSP console violations**.

### Task D3: Wire Cloudflare Workers Builds (Git push-to-deploy)

- [ ] **Step 1:** In the **Cloudflare dashboard → Workers & Pages → connect the GitHub repo** twice — once per Worker:
    - **Landing:** root directory `landing/`, build command `npx opennextjs-cloudflare build`, deploy command
      `npx opennextjs-cloudflare deploy`.
    - **App:** root directory `app/`, build command `pnpm build`, deploy command `npx wrangler deploy`.
- [ ] **Step 2:** Set each Worker's **build environment variables** to the §5 matrix (landing → `NEXT_PUBLIC_*`; app →
  `VITE_*`). Set the production branch to `master`.
- [ ] **Step 3:** (If the pnpm-workspace install fails in Workers Builds) set the build command to install from the repo
  root first, e.g. landing `cd .. && pnpm install --frozen-lockfile && cd landing && npx opennextjs-cloudflare build` (
  and the analogous form for the app). Confirm via the build log.
- [ ] **Step 4: Verify** — push a trivial commit to `master`; both Workers rebuild and redeploy; the live sites reflect
  the change.

---

## Phase E — Documentation

### Task E1: Sync `docs/PLATFORM.md` to the Cloudflare topology

**Files:**

- Modify: `docs/PLATFORM.md` (§2, §16, §17, §18, §19)

- [ ] **Step 1 — §2 System Architecture:** In the package table, change `landing/` deploy target `Vercel` →
  `Cloudflare Workers (OpenNext)` and `app/` `Railway` → `Cloudflare Workers (Static Assets)`. Update the prose line "
  Cloudflare sits in front of Vercel and Railway…" → "Cloudflare **hosts** the two frontends (Workers) and provides
  DNS/CDN/TLS." Update the Mermaid node labels `Next.js / Vercel` → `Next.js / Cloudflare (OpenNext)` and
  `React+Vite / Railway` → `React+Vite / Cloudflare Static Assets`.

- [ ] **Step 2 — §16 Environment Variables:** Add a subsection "Cloudflare build-time env (frontends)" documenting the
  `NEXT_PUBLIC_*` (landing Worker) and `VITE_*` (app Worker) matrices from spec §5, noting they're **baked at build** in
  the Worker's build settings (not runtime).

- [ ] **Step 3 — §17 Security Posture:** Replace the "tightening that needs a **prod-only nonce/hash CSP served as an
  HTTP header**…" / "prod CSP / frame-ancestors / HSTS should be set at the hosting layer" notes with the shipped
  reality: app = hashed `script-src` via generated `dist/_headers`; landing = nonce + `strict-dynamic` via middleware;
  both add HSTS, `frame-ancestors 'none'`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`. Note
  `style-src 'unsafe-inline'` is retained (Radix/inline styles).

- [ ] **Step 4 — §18 Tooling:** Add the new configs (`app/wrangler.jsonc`, `landing/wrangler.jsonc`,
  `landing/open-next.config.ts`, `app/scripts/gen-headers.mjs`) and the deploy scripts. Change "No CI config" → "Deploys
  via Cloudflare Workers Builds (Git push-to-`master`); Convex via `npx convex deploy`."

- [ ] **Step 5 — §19 Discrepancies:** Remove the now-resolved Vercel/Railway deploy-artifact mismatch bullet (the
  `Dockerfile`/`nginx.conf`/`vercel.*`/`railway.*` lines).

- [ ] **Step 6: Verify** — `pnpm format:check` passes for the doc (or note docs aren't Prettier-clean repo-wide, per
  project convention). Re-read each edited section for accuracy against the implemented code.

- [ ] **Step 7: ✋ Checkpoint** — Henriko reviews and commits.

---

## Self-Review (completed by plan author)

- **Spec coverage:** D1 landing-OpenNext (B1) ✓; D2 app-Static-Assets + SPA fallback (A1) ✓; D3 Cloudflare Git (D3) ✓;
  D4 domains/www (D2) ✓; D5 Convex-first build-time URL (D1) ✓; D6 CSP split — app hash (A2) / landing nonce (B2) ✓; env
  matrix (D2 env files + D3 build vars) ✓; DNS (D2) ✓; security headers (A2/B2) ✓; docs (E1) ✓. No uncovered spec
  sections.
- **Placeholder scan:** `<prod>` is an intentional deploy-time value (enumerated in Global Constraints + spec §12), not
  a TODO. All code steps contain complete code. No "add error handling"/"similar to Task N" placeholders.
- **Type consistency:** `extractInlineScriptHashes`/`buildHeadersContent` names match between A2 Step 1 (definition),
  the file-structure table, and the A2 test. `buildContentSecurityPolicy(nonce)` name matches between
  `landing/lib/csp.ts` (B2 Step 1) and `landing/middleware.ts` (B2 Step 2). `x-nonce` header set in middleware matches
  the layout read (B2 Step 3).
