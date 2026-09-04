# Cloudflare Deployment — Design

- **Date:** 2026-06-22
- **Status:** Draft (pending user review)
- **Author:** Henriko + Claude
- **Supersedes:** the `landing→Vercel` / `app→Railway` topology documented in `docs/PLATFORM.md §2`
  (never implemented — `§19` confirms no `vercel.*` / `railway.*` / `Dockerfile` ever existed).

## 1. Goal

Deploy the platform to **Cloudflare** (the domain `linkintothessi.com` is already on Cloudflare):

- `landing/` (Next.js 15) → runs on Cloudflare **Workers** via OpenNext.
- `app/` (Vite SPA) → served from a Cloudflare **Worker with Static Assets**.
- `convex/` → stays on **Convex cloud** (Cloudflare only fronts the two browser frontends).
- Production-grade **security headers + CSP** served at the Cloudflare hosting layer (closes the
  `PLATFORM.md §17` "prod CSP / frame-ancestors / HSTS at hosting layer" backlog item).

## 2. Locked decisions

| #  | Decision                                                                                                                                                                                                                    | Rationale                                                                                                                                                                                                         |
|----|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| D1 | **Landing = full Next.js via `@opennextjs/cloudflare`** (NOT `output: 'export'`)                                                                                                                                            | Keeps `middleware.ts` locale routing, `generateMetadata`, and server components with zero routing-code changes. Content is effectively static and edge-cached, so cost stays ~zero.                               |
| D2 | **App = Cloudflare Workers Static Assets** (NOT Pages)                                                                                                                                                                      | One toolchain (`wrangler`) and one platform primitive for both frontends; Pages is in maintenance mode. `not_found_handling: "single-page-application"` gives the `BrowserRouter` SPA correct deep-link fallback. |
| D3 | **Deploys = Cloudflare Git ("Workers Builds")**, push-to-`master`                                                                                                                                                           | Push-to-deploy, no CI to maintain. One **manual** deploy first to verify before wiring Git automation.                                                                                                            |
| D4 | **Domains:** apex `linkintothessi.com` → landing; `app.linkintothessi.com` → app; `www` → 301 → apex                                                                                                                        | Matches the existing `.env.example` conventions (`NEXT_PUBLIC_APP_URL`, `VITE_LANDING_URL`).                                                                                                                      |
| D5 | **Convex deploys independently** (`npx convex deploy`); its prod URL is pinned as a **build-time** env var in Cloudflare                                                                                                    | Frontends inline `VITE_CONVEX_URL` / `NEXT_PUBLIC_CONVEX_SITE` at build, so the prod deployment must exist first; the URL is stable thereafter.                                                                   |
| D6 | **CSP:** app uses a **SHA-256 hash** (one static inline script); landing uses a **nonce + `strict-dynamic`** via middleware (Next injects dynamic inline scripts). `style-src 'unsafe-inline'` stays (Radix/inline styles). | Static-vs-dynamic inline scripts dictate different-but-correct mechanisms.                                                                                                                                        |

## 3. Architecture / topology

```
Browser
 ├─ linkintothessi.com         → Landing Worker (OpenNext / Next.js 15)  ─┐
 ├─ app.linkintothessi.com     → App Worker (Vite SPA + Static Assets)   ─┤ both inline the prod
 │                                                                        │ Convex URL at BUILD time
 └─ <prod>.convex.cloud (wss/http: queries/mutations/actions)  ◄──────────┘
    <prod>.convex.site  (http: /auth/linkedin[/callback], /stripe/webhook)
        ↕ LinkedIn OAuth + REST   ↕ Stripe Checkout/Webhooks
```

Convex is **not** on Cloudflare. The OAuth `redirect_uri` must point at `<prod>.convex.site`
(never the app) — unchanged from today's design (`PLATFORM.md §2`).

## 4. Component designs

### 4.1 Landing — OpenNext Worker

New files:

- `landing/open-next.config.ts` — minimal OpenNext config. **No incremental (ISR) cache** needed (the
  site renders from local dictionaries, no runtime data) → use the default/no-op cache to keep it simple.
- `landing/wrangler.jsonc` — Worker config: `name = "linkintothessi-landing"`, recent
  `compatibility_date`, `compatibility_flags = ["nodejs_compat"]`, `main` → OpenNext's generated
  worker entry. Assets handled by OpenNext's output.

Build / deploy commands (used by Workers Builds and the manual smoke test):

- Build: `npx opennextjs-cloudflare build`
- Deploy: `npx opennextjs-cloudflare deploy`
- Local preview: `npx opennextjs-cloudflare preview`

No changes to `app/[lang]/*`, `middleware.ts` (except adding the CSP nonce — see §7), or i18n.

### 4.2 App — Workers Static Assets

New file:

- `app/wrangler.jsonc`:
  ```jsonc
  {
    "name": "linkintothessi-app",
    "compatibility_date": "2025-xx-xx",
    "assets": {
      "directory": "./dist",
      "not_found_handling": "single-page-application"
    }
  }
  ```
  `single-page-application` returns `dist/index.html` (HTTP 200) for unknown paths, so
  `app.linkintothessi.com/settings`, `/feed`, etc. (client-side `BrowserRouter` routes) resolve
  instead of 404ing.

Build: `pnpm build` (`tsc && vite build` → `dist/`). Deploy: `npx wrangler deploy`.
No app source changes except CSP relocation (see §7).

### 4.3 Convex production (prerequisite)

1. `npx convex deploy` from the **repo root** (per memory: never run convex CLI inside `convex/`) to
   create / identify the prod deployment; record its `.convex.cloud` and `.convex.site` URLs.
2. Set Convex **dashboard** env vars (runtime) per `PLATFORM.md §16`: `APP_URL=https://app.linkintothessi.com`,
   `LINKEDIN_CLIENT_ID/SECRET`, `LINKEDIN_REDIRECT_URI=https://<prod>.convex.site/auth/linkedin/callback`,
   `STRIPE_*` (keys, price ids, webhook secret), and **leave** `ALLOW_ADMIN_SHARE_ANY_POST` unset.
3. In the **LinkedIn developer app**, set the OAuth redirect URL to
   `https://<prod>.convex.site/auth/linkedin/callback`.
4. In **Stripe**, point the webhook endpoint at `https://<prod>.convex.site/stripe/webhook`.

## 5. Environment-variable matrix (production)

**Cloudflare → Landing Worker (build-time, baked into output):**

```
NEXT_PUBLIC_APP_URL=https://app.linkintothessi.com
NEXT_PUBLIC_CONVEX_SITE=https://<prod>.convex.site
NEXT_PUBLIC_COOKIE_DOMAIN=.linkintothessi.com
```

**Cloudflare → App Worker (build-time, baked into output):**

```
VITE_CONVEX_URL=https://<prod>.convex.cloud
VITE_CONVEX_SITE=https://<prod>.convex.site
VITE_LANDING_URL=https://linkintothessi.com
VITE_COOKIE_DOMAIN=.linkintothessi.com
VITE_STRIPE_STARTER_PRICE_ID=price_xxx
VITE_STRIPE_GROWTH_PRICE_ID=price_xxx
VITE_STRIPE_PRO_PRICE_ID=price_xxx
VITE_STRIPE_STARTER_ANNUAL_PRICE_ID=price_xxx
VITE_STRIPE_GROWTH_ANNUAL_PRICE_ID=price_xxx
VITE_STRIPE_PRO_ANNUAL_PRICE_ID=price_xxx
```

**Convex dashboard (runtime):** see §4.3 / `PLATFORM.md §16`.

> Cookie domain `.linkintothessi.com` (leading dot) is what lets theme + language cookies be shared
> across the apex landing and the `app.` subdomain.

## 6. DNS & custom domains

- Attach **Custom Domains** to each Worker (zone already in Cloudflare → DNS records + TLS auto-managed):
  apex → landing Worker, `app` → app Worker.
- `www.linkintothessi.com` → **301 redirect** to the apex (Cloudflare Redirect Rule).
- No `_redirects` needed for the app's SPA routing — `not_found_handling` (D2) handles it.

## 7. Security headers & CSP

All security headers move to the **HTTP layer** (Cloudflare), which is the only place
`frame-ancestors` and `Strict-Transport-Security` are honored (a `<meta>` CSP ignores them).

### 7.1 App (Workers Static Assets) — `_headers` file

- Remove the `<meta http-equiv="Content-Security-Policy">` from `app/index.html`.
- Serve security headers via a **`_headers`** file in the build output (Workers Static Assets honors
  the Pages `_headers` format). The CSP `script-src` hash for the pre-paint theme guard is computed
  from the **built** `dist/index.html` by a small post-build step (recommended) or hardcoded and
  regenerated when that script changes.
- Target CSP (tightened from today's `app/index.html`):
  ```
  default-src 'self';
  script-src 'self' 'sha256-<theme-guard-hash>';
  style-src 'self' 'unsafe-inline';
  img-src 'self' https: data:;
  frame-src https://www.linkedin.com;
  connect-src 'self' https://*.convex.cloud wss://*.convex.cloud https://*.convex.site https://*.stripe.com;
  object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none';
  ```
  Changes vs today: drop `script-src 'unsafe-inline'` → hash; add `connect-src https://*.convex.site`;
  add `frame-ancestors 'none'`.
- Additional headers (app + landing): `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`,
  `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`,
  `Permissions-Policy: camera=(), microphone=(), geolocation=()`.

### 7.2 Landing (Next.js / OpenNext) — nonce via middleware

> **Execution deviation (2026-06-22):** this was changed during implementation to **Option 1 — a static
> `script-src 'self' 'unsafe-inline'` set in `next.config.js` `headers()`** (no nonce, no middleware CSP).
> Reason: the landing prerenders as static HTML (`●`), where a per-request nonce can't match the baked
> HTML and a CSP3 browser would block the inline + hydration scripts (blank page). The landing renders
> only static dictionary copy (no user input), so `'unsafe-inline'` is acceptable; the strict hashed CSP
> stays reserved for the app. **Shipped state of record: `docs/PLATFORM.md §17`.** The D6 row and the
> nonce description below reflect the *original* plan, kept for history.

- Next.js injects **dynamic** inline scripts (hydration/flight) whose hashes change per build, so a
  hash CSP can't cover them. Use the documented Next pattern: the existing `middleware.ts` generates a
  per-request **nonce**, sets the CSP header, and passes the nonce down (request header) so the
  `NO_FLASH` inline `<script>` in `app/[lang]/layout.tsx` gets `nonce={nonce}`.
- CSP (CSP3 strict, with old-browser fallbacks that modern browsers ignore):
  ```
  script-src 'self' 'nonce-<v>' 'strict-dynamic' 'unsafe-inline' https:;
  style-src 'self' 'unsafe-inline'; img-src 'self' https: data:;
  connect-src 'self' https://*.convex.cloud https://*.convex.site;
  object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; default-src 'self';
  ```
- Static security headers (HSTS, nosniff, Referrer-Policy, Permissions-Policy) via `next.config.js`
  `headers()` (or the same middleware). Note: a nonce makes responses per-request (not fully static);
  acceptable for a marketing site, assets stay cached.

### 7.3 Trade-off explicitly accepted

`style-src 'unsafe-inline'` remains in both CSPs: Radix UI and inline `style={{…}}` (e.g.
`LinkedInEmbed`) emit inline style attributes that cannot be hashed/nonced. Scripts (the primary XSS
vector) are locked down; styles are not.

## 8. Deploy flow (D3)

1. **Verify manually first.** With prod Convex live and env vars set locally: `wrangler login`, then
   landing `npx opennextjs-cloudflare deploy` and app `npx wrangler deploy`. Smoke-test both domains
   (OAuth round-trip, deep links, theme/lang cookie sharing, CSP with no console violations).
2. **Wire Workers Builds.** Connect the GitHub repo as **two Workers**:
    - Landing: root `landing/`, build `npx opennextjs-cloudflare build`, deploy `npx opennextjs-cloudflare deploy`.
    - App: root `app/`, build `pnpm build`, deploy `npx wrangler deploy`.
      Both trigger on push to `master`; set the §5 build env vars in each Worker's dashboard settings.
      pnpm-workspace install nuances resolved in the build command during implementation.
3. **Convex** redeploys via `npx convex deploy` (manual now; its own Git integration is a later option).

## 9. Documentation updates (same change)

Per `CLAUDE.md`, update `docs/PLATFORM.md` in lockstep:

- **§2 System Architecture** — topology table + Mermaid: `Vercel`/`Railway` → Cloudflare Workers
  (landing = OpenNext Worker, app = Workers Static Assets).
- **§16 Environment Variables** — the frontend vars now live in **Cloudflare build settings**; add the
  `NEXT_PUBLIC_*` / `VITE_*` prod matrix and where each is set.
- **§17 Security Posture** — replace the "prod CSP/HSTS *should be* set at hosting layer" note with the
  shipped headers (app hash CSP, landing nonce CSP, HSTS/frame-ancestors/etc.).
- **§18 Tooling** — new wrangler/OpenNext configs + deploy commands; note "No CI" → "Cloudflare Workers Builds".
- **§19 Discrepancies** — drop the stale Vercel/Railway deploy-artifact mismatch lines.

## 10. Success criteria

- `linkintothessi.com` serves the localized landing; `/` redirects to a locale; `www` → apex.
- `app.linkintothessi.com` loads the SPA; deep links (`/settings`, `/feed`) work on hard refresh.
- LinkedIn sign-in completes end-to-end (app → `.convex.site/auth/linkedin` → callback → `/auth/success`).
- Theme + language persist across landing ↔ app (shared cookie).
- Both sites pass an observatory/CSP check: HSTS + `frame-ancestors 'none'` present, **no CSP
  violations** in the browser console, no `script-src 'unsafe-inline'`.
- `pnpm verify` stays green; `docs/PLATFORM.md` reflects the new topology.

## 11. Out of scope

- GitHub Actions CI (Workers Builds replaces it for now).
- Convex's own Git-based deploy integration (manual `convex deploy` for now).
- Preview/staging environments (can be added via Workers Builds preview deployments later).

## 12. Inputs required from Henriko (human steps)

- Cloudflare account + the `linkintothessi.com` zone (already present).
- Prod **Convex** deployment + dashboard secrets (LinkedIn, Stripe).
- **LinkedIn** app OAuth redirect URL updated to the prod `.convex.site` callback.
- **Stripe** prod price IDs + webhook endpoint.
- GitHub repo connected in the Cloudflare dashboard (for D3 step 2).
