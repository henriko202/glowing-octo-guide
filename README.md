# Link Into The SSI

A LinkedIn growth accelerator SaaS. Users sign in with LinkedIn, join a real-time feed of posts from all other
subscribers, and engage with those posts to grow their LinkedIn Social Selling Index (SSI). LinkedIn exposes no member
API to react/comment on someone else's post, so the app **hands off** to LinkedIn — it surfaces the post plus an
AI-drafted comment, opens it on LinkedIn, and the member acts there under their own identity.

**Network effect:** more users → richer feed → more engagement → higher SSI → more users.

> **`docs/PLATFORM.md` is the canonical, code-derived reference** (architecture, data model, every backend function,
> security, deployment). This README is the quickstart; when in doubt, PLATFORM.md wins.

---

## Architecture

pnpm monorepo — three deployable packages sharing one Convex backend:

```
/
├── landing/    # Next.js 15 — marketing site, SEO, pricing, legal (locale-routed en/pt/es)
├── app/        # React 19 + Vite — authenticated SaaS dashboard
└── convex/     # Convex backend — shared by both frontends
```

| Package    | Stack                                         | Deploy target                          | Domain (prod)                                |
|------------|-----------------------------------------------|----------------------------------------|----------------------------------------------|
| `landing/` | Next.js 15 (App Router), React 19, Tailwind 4 | **Cloudflare** Workers (OpenNext)      | `www.linkintothessi.com`                     |
| `app/`     | React 19 + Vite 6, TypeScript, Tailwind 4     | **Cloudflare** Workers (Static Assets) | `www.app.linkintothessi.com`                 |
| `convex/`  | Convex (serverless, real-time, TS-native)     | **Convex** managed                     | `<deployment>.convex.cloud` / `.convex.site` |

Cloudflare hosts both frontends and provides DNS/CDN/TLS. External services: **LinkedIn** (OAuth + profile/posts),
**Stripe** (billing), **Apify** (LinkedIn post/profile scraping), **OpenRouter** (AI), **Resend** (transactional email).

---

## Tech Stack

- **Backend:** [Convex](https://convex.dev) — real-time serverless TypeScript (queries, mutations, actions, HTTP
  actions, crons). Stripe via [@convex-dev/stripe](https://www.convex.dev/components/stripe).
- **App (`app/`):** React 19, Vite 6, TypeScript (strict), Tailwind CSS 4, `react-router-dom` 7, `convex/react`,
  `i18next` (en/pt/es), shadcn/ui primitives.
- **Landing (`landing/`):** Next.js 15 (App Router), React 19, Tailwind CSS 4 (CSS-first), TypeScript.
- **Auth:** LinkedIn 3-legged OAuth — Sign In with LinkedIn / OpenID Connect (`openid profile email`, Standard tier).
- **Payments:** Stripe (Checkout + Customer Portal + webhooks).
- **Post ingestion:** Apify REST (`harvestapi~linkedin-profile-posts` actor) + user-pasted post URLs.
- **AI:** OpenRouter → DeepInfra (Gemma, fp8, zero data retention) for reaction prediction + comment drafting.
- **Testing:** Vitest across all workspaces (React Testing Library + jsdom for the app; a `convex-mocks` shim for
  backend).

---

## Prerequisites

- Node.js 20+ and pnpm 9+
- A [Convex](https://dashboard.convex.dev) account
- A [LinkedIn Developer App](https://www.linkedin.com/developers/apps) with Sign In with LinkedIn (OIDC) enabled
- A [Stripe](https://dashboard.stripe.com) account (for billing)
- An [Apify](https://apify.com) account (post/profile ingestion) — sync no-ops without it
- An [OpenRouter](https://openrouter.ai) key (AI features) — AI no-ops without it

---

## Local Development

### 1. Install

```bash
pnpm install
```

### 2. Convex backend

```bash
pnpm dev:convex   # runs `convex ai-files update && convex dev` — creates _generated/ on first run
```

Set the backend environment variables in the [Convex dashboard](https://dashboard.convex.dev)
(Settings → Environment Variables). See `convex/.env.local.example` for the full annotated list — the essentials:

```
LINKEDIN_CLIENT_ID=...
LINKEDIN_CLIENT_SECRET=...
LINKEDIN_REDIRECT_URI=https://<your-deployment>.convex.site/auth/linkedin/callback
#   ↑ Must point to Convex (.convex.site), NOT the app. LinkedIn returns the code to Convex,
#     which exchanges it server-side so the client secret + user tokens never touch the browser.
APP_URL=http://localhost:5174
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_{STARTER,GROWTH,PRO}_PRICE_ID=price_...          # monthly
STRIPE_{STARTER,GROWTH,PRO}_ANNUAL_PRICE_ID=price_...   # annual (create in Stripe first)
APIFY_API_TOKEN=...                                     # post/profile sync (no-ops if unset)
OPENROUTER_API_KEY=...                                  # AI features (no-ops if unset)
```

### 3. App (`app/`)

```bash
cp app/.env.example app/.env.local
```

Fill in `VITE_CONVEX_URL` / `VITE_CONVEX_SITE` (your deployment's `.convex.cloud` / `.convex.site`), the six
`VITE_STRIPE_*_PRICE_ID` values (**must match** the Convex `STRIPE_*_PRICE_ID`), and `VITE_LANDING_URL`.

### 4. Landing (`landing/`)

```bash
cp landing/.env.example landing/.env.local
```

Set `NEXT_PUBLIC_CONVEX_SITE` (landing CTAs link straight to `/auth/linkedin`) and `NEXT_PUBLIC_APP_URL`.

### 5. Run

```bash
pnpm dev:convex   # Terminal 1 — Convex backend
pnpm dev:app      # Terminal 2 — React app  → http://localhost:5174
pnpm dev:landing  # Terminal 3 — Next.js landing → http://localhost:3000 (optional locally)
```

> The Vite dev server runs on **5174**; align `LINKEDIN_REDIRECT_URI` / `APP_URL` with the port you actually run.

---

## Subscription Tiers

Numeric caps are **enforced** (read from the `planLimits` table). The 7-day trial requires a card and starts a real
Stripe subscription for the tier chosen on the billing grid; it converts on **50 combined interactions OR 7 days**,
whichever comes first. Cancellation never revokes access — a canceled member keeps engaging; only their own posts stop
entering the feed once the paid period ends.

| Capability                          | Starter ($10/mo) | Growth ($15/mo) | Pro ($30/mo) |   Contact   |
|-------------------------------------|:----------------:|:---------------:|:------------:|:-----------:|
| Access shared feed                  |        ✓        |       ✓        |      ✓      |     ✓      |
| 7-day trial (card required)         |        ✓        |       ✓        |      ✓      |      —      |
| Feed filtered by industry + country |        ✗        |    ✓ (auto)    | ✓ (custom)  | ✓ (custom) |
| Control who sees your posts         |        ✗        |       ✗        |      ✓      |     ✓      |
| Interactions counted per post (cap) |        25        |       50        |     200      |    200+     |
| Posts admitted to feed / week       |        1         |        2        |      5       |     5+      |
| Featured posts / month              |        0         |        1        |      3       |   Custom    |
| AI comment generator                |        ✓        |       ✓        |      ✓      |     ✓      |

> AI comment drafting is **live for every tier** — gated on an active subscription (the same card-on-file gate as
> engaging) and rate-limited, but **not** tier-gated. See `docs/PLATFORM.md` §11A.

---

## Key Flows

### LinkedIn OAuth

1. User clicks "Sign in with LinkedIn" → Convex HTTP action (`.convex.site`) redirects to LinkedIn.
2. LinkedIn returns `code` → Convex exchanges it for tokens **server-side** + fetches the OIDC profile.
3. User record upserted; tokens stored server-side only. Convex issues an opaque session token and redirects to the app.

### Post ingestion (Apify)

- Posts are scraped via **Apify** (not the LinkedIn API): scheduled crons plus an on-subscribe scrape when a member
  starts a trial. Members can also paste their own post URLs.
- Feed admission is capped per week by tier; overflow lands in `postQueue` and is drained by `processQueue` as capacity
  frees up.

### Feed (real-time, tier-gated)

- **Starter:** all visible posts, chronological. **Growth:** filtered to the member's industry + country (auto from
  profile). **Pro/Contact:** user-configurable industry/country filters for both viewing and post visibility.
- Featured posts sort first; the rest is chronological.

### Engagement (handoff)

User taps comment/react → the app opens the post on LinkedIn (copying any AI-drafted comment to the clipboard) and the
member acts there under their own identity. The count is incremented **optimistically on tap** — the app cannot confirm
the LinkedIn action, and makes **no LinkedIn API writes**. Counters push in real-time to everyone viewing that post.

### AI assistance

An action calls OpenRouter (pinned to a zero-data-retention DeepInfra Gemma model) to predict the best reaction and
draft a comment tailored to the post (including any linked article's full text). Gated on an active subscription; no-ops
gracefully if `OPENROUTER_API_KEY` is unset.

---

## Testing

```bash
pnpm --filter convex test    # backend
pnpm --filter app test       # React app
pnpm -r test                 # everything
pnpm verify                  # format:check + lint + typecheck + all tests
```

---

## Internationalisation

App and landing both support **en / pt / es**. Selection is driven by a cross-site `lang` cookie shared between the two
sites (see `docs/PLATFORM.md` §14B), falling back to `?lang=` / `Accept-Language`, then English. The landing site is
locale-routed (`/[lang]/…`); legal pages (privacy / terms / cookies) are localised and required for LinkedIn app review.

---

## Deployment

Both frontends deploy to **Cloudflare Workers**; the backend deploys to Convex.

```bash
pnpm build:convex     # convex deploy
pnpm deploy:app       # build + wrangler deploy   (Cloudflare Static Assets)
pnpm deploy:landing   # OpenNext build + deploy    (Cloudflare Workers)
```

Set the production env vars in each Worker's build settings (`VITE_*` / `NEXT_PUBLIC_*`) and in the Convex dashboard.
Full inventory: `docs/PLATFORM.md` §16.

---

## LinkedIn API Notes

Login uses **Sign In with LinkedIn (OpenID Connect)** only — scopes `openid profile email` (Standard tier, so any member
can authenticate). The app makes **no LinkedIn API writes**.

| Capability                | How                                                                  |
|---------------------------|----------------------------------------------------------------------|
| Sign in / identity        | `openid profile email` → `/v2/userinfo` (Standard tier, all members) |
| Ingest a member's posts   | Apify scraper — not the LinkedIn API                                 |
| React / comment on a post | Handoff: app opens the post, member acts on LinkedIn (no API write)  |
| Read connections' feed    | ✗ — requires LinkedIn MDP partner access (not used)                 |

The `/privacy`, `/terms`, and `/cookies` pages are required by LinkedIn for app review.

---

For roadmap, known discrepancies, and dead-code tracking, see `docs/PLATFORM.md` §19.
