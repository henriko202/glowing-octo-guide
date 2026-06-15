# Link Into The SSI — Platform Documentation

> **Canonical, end‑to‑end reference for how this platform works** — architecture, data
> model, business logic, every backend function, both frontends, environment variables,
> security posture, deployment, and flow charts.
>
> This document is **source‑of‑truth derived from the actual code**, not from prior docs.
> Where the root `README.md` disagrees with the code, the code wins; those conflicts are
> catalogued in [§19 Known Discrepancies & Dead Code](#19-known-discrepancies-dead-code--roadmap).
>
> **Keep this document up to date.** Per the rule in `CLAUDE.md`, whenever a feature is
> added/changed or any code is pushed, update the relevant section(s) here in the same change.
> See [§21 Maintaining This Document](#21-maintaining-this-document).

---

## Table of Contents

1. [Product Overview & Business Model](#1-product-overview--business-model)
2. [System Architecture](#2-system-architecture)
3. [Tech Stack](#3-tech-stack)
4. [Repository Layout](#4-repository-layout)
5. [Data Model](#5-data-model)
6. [Backend Architecture & Conventions](#6-backend-architecture--conventions)
7. [Authentication & Identity](#7-authentication--identity)
8. [Subscriptions & Billing](#8-subscriptions--billing)
9. [Plan Limits System](#9-plan-limits-system)
10. [Posts & Content Pipeline](#10-posts--content-pipeline)
11. [Feed & Engagement](#11-feed--engagement)
12. [Admin & Moderation](#12-admin--moderation)
13. [Scheduled Jobs (Crons)](#13-scheduled-jobs-crons)
13A. [Profile Enrichment (LinkedIn Profile Scrape)](#13a-profile-enrichment-linkedin-profile-scrape)
14. [Frontend — Authenticated App (`app/`)](#14-frontend--authenticated-app-app)
15. [Frontend — Landing Site (`landing/`)](#15-frontend--landing-site-landing)
16. [Environment Variables](#16-environment-variables)
17. [Security Posture](#17-security-posture)
18. [Configuration, Tooling & Testing](#18-configuration-tooling--testing)
19. [Known Discrepancies, Dead Code & Roadmap](#19-known-discrepancies-dead-code--roadmap)
20. [Glossary](#20-glossary)
21. [Maintaining This Document](#21-maintaining-this-document)

---

## 1. Product Overview & Business Model

**Link Into The SSI** is a LinkedIn growth‑accelerator SaaS. The product premise:

1. A user signs in with **LinkedIn OAuth**, authorizing the app to read their posts and to
   publish comments/reactions on their behalf.
2. The user joins a **shared real‑time feed** of posts from all other subscribers.
3. They **engage** (comment, react) on those posts directly from the app, using their **own
   LinkedIn identity** — every interaction is a real LinkedIn action published under their name.
4. Consistent, relevant engagement raises the user's **Social Selling Index (SSI)** — LinkedIn's
   0–100 score across four 25‑point pillars (brand, find the right people, engage with insights,
   build relationships).

**Network effect:** more users → richer feed → more engagement → higher SSI → more users.

**Monetization** is subscription‑based via Stripe across four tiers (Starter / Growth / Pro /
Contact‑Enterprise). Higher tiers unlock feed targeting (by industry/country), post‑visibility
controls, featured posts, and higher engagement/post‑volume limits. See
[§8](#8-subscriptions--billing) and [§9](#9-plan-limits-system).

### Subscription tiers (business view)

| Capability | Starter | Growth | Pro | Contact (Enterprise) |
|---|:--:|:--:|:--:|:--:|
| Price | $5/mo | $15/mo | $50/mo | Custom |
| Access shared feed | ✓ | ✓ | ✓ | ✓ |
| 3‑day free trial | ✓ | — | — | — |
| Feed filtered by industry + country | ✗ | ✓ (auto from profile) | ✓ (custom) | ✓ (custom) |
| Control who sees your posts | ✗ | ✗ | ✓ (planned) | ✓ (planned) |
| Interactions counted per post (cap) | 25 | 50 | 200 | 200 (per‑user override‑able) |
| Posts admitted to feed / week | 1 | 2 | 5 | 5 (per‑user override‑able) |
| Featured posts / month | 0 | 1 (planned) | 3 (planned) | Custom (planned) |
| AI comment generator | ✗ (future) | ✓ (future) | ✓ (future) | ✓ (future) |

The numeric limits (interactions/post, posts/week) are the **enforced** values from the
`planLimits` table; the featured‑post and AI rows are **marketing‑level/planned** (the
`featuredPostUsage` table exists but is not yet wired; AI is a UI placeholder). See
[§19](#19-known-discrepancies-dead-code--roadmap).

---

## 2. System Architecture

The repository is a **pnpm monorepo** with **three deployable packages sharing one Convex
backend**:

| Package | Stack | Deploy target | Domain (prod) |
|---|---|---|---|
| `landing/` | Next.js 15 (App Router), React 19, Tailwind 3 | **Vercel** | `linkintothessi.com` |
| `app/` | React 19 + Vite 6, TypeScript, Tailwind 4, react‑i18next | **Railway** | `app.linkintothessi.com` |
| `convex/` | Convex (serverless, real‑time, TS‑native) + `@convex-dev/stripe` | **Convex** managed | `<deployment>.convex.cloud` / `.convex.site` |

Cloudflare sits in front of Vercel and Railway for DNS/CDN. External services: **LinkedIn**
(OAuth + posting), **Stripe** (billing), **Apify** (LinkedIn post scraping).

### Deployment & integration topology

```mermaid
flowchart LR
  subgraph Client["User's Browser"]
    Landing["Landing site<br/>(Next.js / Vercel)"]
    App["SaaS App<br/>(React+Vite / Railway)"]
  end

  subgraph Convex["Convex Backend (managed)"]
    direction TB
    Cloud[".convex.cloud<br/>queries / mutations / actions<br/>(WebSocket + HTTP)"]
    Site[".convex.site<br/>HTTP actions:<br/>/auth/linkedin, callback,<br/>/stripe/webhook"]
    DB[("Convex DB<br/>10 tables")]
    Crons["Cron scheduler"]
    Cloud --- DB
    Site --- DB
    Crons --- DB
  end

  LinkedIn["LinkedIn<br/>OAuth + REST API"]
  Stripe["Stripe<br/>Checkout + Webhooks"]
  Apify["Apify<br/>post scraper"]

  Landing -- "CTA links (NEXT_PUBLIC_APP_URL)" --> App
  App -- "useQuery/useMutation/useAction<br/>(VITE_CONVEX_URL)" --> Cloud
  App -- "sign-in redirect<br/>(VITE_CONVEX_SITE)/auth/linkedin" --> Site
  Site <-- "3-legged OAuth + token exchange" --> LinkedIn
  Cloud -- "comment/react as user" --> LinkedIn
  App -- "Checkout redirect" --> Stripe
  Stripe -- "webhook → /stripe/webhook" --> Site
  Crons -- "scrape posts" --> Apify
  Cloud -- "on subscribe: scrape posts" --> Apify
```

### Why OAuth runs through `.convex.site` (key design decision)

The LinkedIn `redirect_uri` points at **Convex** (`https://<deployment>.convex.site/auth/linkedin/callback`),
**never** at the React app. LinkedIn returns the authorization `code` to Convex, which exchanges
it for tokens **server‑side**, so the **client secret and the user's access/refresh tokens never
touch the browser**. Convex then issues an opaque session token and redirects the browser back to
the app. This is the backbone of the [security model](#17-security-posture).

---

## 3. Tech Stack

- **Backend:** [Convex](https://convex.dev) `^1.33–1.34` — real‑time serverless TypeScript.
  Queries (reactive reads), mutations (transactional writes), actions (side‑effects/external
  fetch), HTTP actions, and cron jobs. Stripe via the official `@convex-dev/stripe` component.
- **App (`app/`):** React **19**, Vite **6**, TypeScript (strict), Tailwind CSS **4**,
  `react-router-dom` **7**, `convex/react` client, `i18next` **25** (en/pt/es).
- **Landing (`landing/`):** Next.js **15** (App Router), React **19**, Tailwind CSS **3.4**,
  TypeScript.
- **Payments:** Stripe (Checkout + Customer Portal + webhooks).
- **Post ingestion:** Apify REST API (`harvestapi~linkedin-profile-posts` actor) + manual
  user‑pasted post URLs.
- **Testing:** Vitest across all workspaces; React Testing Library + jsdom for the app; a custom
  `convex-mocks` shim for backend unit tests.
- **Tooling:** ESLint 9 (flat config, `--max-warnings 0`), Prettier (no‑semicolons, single‑quotes,
  120 cols), pnpm workspaces.

---

## 4. Repository Layout

```
/
├── landing/                     # Next.js marketing site → Vercel
│   ├── app/
│   │   ├── layout.tsx           # root layout + SEO metadata
│   │   ├── page.tsx             # home (composes 11 section components)
│   │   ├── pricing/page.tsx
│   │   ├── privacy/page.tsx     # LinkedIn app-review requirement
│   │   └── terms/page.tsx       # LinkedIn app-review requirement
│   ├── components/              # Nav, Hero, SSIExplainer, StatsBar, HowItWorks,
│   │                            #   Features, Testimonials, Pricing, FAQ, FinalCTA, Footer
│   ├── tailwind.config.ts       # custom ink/cream/lnblue/gold palette
│   └── next.config.js
│
├── app/                         # React + Vite SaaS dashboard → Railway
│   ├── index.html               # mount point + strict CSP meta
│   ├── vite.config.ts           # dev port 5174, inline Vitest config
│   └── src/
│       ├── main.tsx             # ConvexProvider + BrowserRouter bootstrap
│       ├── App.tsx              # routes + RequireAuth guard
│       ├── convex.ts            # re-export of convex/_generated/api
│       ├── pages/               # AuthSuccess, Feed, MyPosts, Settings, Billing, Admin
│       ├── components/          # PostCard, PostComposer, CommentBox, LinkedInEmbed,
│       │                        #   AppNav, Modal, BannedScreen, BanUserDialog,
│       │                        #   UsersTab, PlanLimitsTab, RowActionsMenu, LoadingSpinner
│       └── i18n/                # i18next init + locales/{en,pt,es}.json
│
├── convex/                      # Convex backend (shared by both apps)
│   ├── schema.ts                # 10-table database schema
│   ├── convex.config.ts         # registers @convex-dev/stripe component
│   ├── crons.ts                 # the ONLY file Convex reads for scheduled jobs
│   ├── http.ts                  # LinkedIn OAuth + Stripe webhook HTTP routes
│   ├── users.ts                 # getMe, subscription info, public identifier, logout
│   ├── sessions.ts              # session tokens + OAuth-state CSRF storage
│   ├── feed.ts                  # tier-gated feed query
│   ├── interactions.ts          # comment + react actions (use user's LinkedIn token)
│   ├── posts.ts                 # submitPost, getMyPosts, weekly usage
│   ├── billing.ts               # Stripe Checkout + Customer Portal sessions
│   ├── stripe.ts                # webhook-driven subscription sync mutations
│   ├── admin.ts                 # admin queries/mutations (users, plan limits, ban)
│   ├── convexTypes.ts           # hand-written ctx/db type shims (transitional)
│   ├── lib/
│   │   ├── auth.ts              # requireAuth / requireAuthAction / resolveSession / assertNotBanned
│   │   ├── planLimits.ts        # plan-limit lookup + tierToRank
│   │   └── rateLimit.ts         # fixed-window rate limiter
│   ├── linkedin/
│   │   ├── oauth.ts             # auth URL builder + token exchange + userinfo
│   │   ├── auth.ts              # upsertUser mutation
│   │   ├── posts.ts             # LinkedIn post fetch/parse helpers
│   │   ├── parsePostUrl.ts      # /posts/… and /feed/update/… URL parser
│   │   ├── parsePostContent.ts  # HTML → text + media extraction
│   │   ├── verifyPostOwnership.ts
│   │   └── types.ts             # LinkedIn API response interfaces
│   ├── jobs/
│   │   ├── syncPosts.ts         # upsertPost mutation + syncAllPosts router
│   │   ├── syncPostsApify.ts    # Apify scrape (per-user + fan-out)
│   │   └── processQueue.ts      # drains postQueue → posts when capacity opens
│   └── migrations/
│       └── seedPlanLimits.ts    # one-time seed of tier-default plan limits
│
├── convex-mocks/                # Vitest mock for `convex/server` (backend unit tests)
├── docs/                        # planning/spec markdown + THIS document
├── README.md                    # quickstart (partially stale — see §19)
├── CLAUDE.md / AGENTS.md        # agent instructions
└── pnpm-workspace.yaml, tsconfig.base.json, eslint.config.js, .prettierrc
```

---

## 5. Data Model

All state lives in **Convex** (`convex/schema.ts`). There are **10 tables**. Every document also
carries Convex‑managed `_id` (`Id<table>`) and `_creationTime` (ms epoch) fields implicitly.

Convex `v.id('table')` fields are **logical foreign keys** — there is **no DB‑enforced referential
integrity**; consistency is maintained in application code.

### Entity relationships

```mermaid
erDiagram
  users ||--o{ posts : "authors"
  users ||--o{ postQueue : "authors (overflow)"
  users ||--o{ subscriptions : "has"
  users ||--o{ sessions : "owns"
  users ||--o{ rateLimits : "subject of"
  users ||--o{ featuredPostUsage : "quota (unused)"
  users ||--o| planLimits : "contact override"
  users ||--o| users : "bannedBy (self-ref)"

  users {
    string linkedinId
    string name
    string tier "starter|growth|pro|contact (optional)"
    string subscriptionStatus "trialing|active|canceled|past_due|none"
    string linkedinAccessToken "secret - server only"
    string linkedinRefreshToken "secret - server only"
    string linkedinPublicIdentifier "vanity name"
    boolean isAdmin "DB-edit only"
    boolean isBanned
  }
  posts {
    string linkedinPostUrn "dedupe key"
    id authorId FK
    string content
    number publishedAt
    boolean hidden
    boolean isFeatured
    number authorTierRank "4=contact..1=starter"
    boolean interactionLimitReached
    string sourceUrl
  }
  planLimits {
    string tier
    id userId "set only for contact override"
    number interactionsPerPost
    number postsPerWeek
  }
  postQueue {
    string linkedinPostUrn
    id authorId FK
    number publishedAt
    number queuedAt
  }
```

### Table reference

#### `users` — central identity / subscription / OAuth / admin record
One row per authenticated LinkedIn member. Inserted on first login (`linkedin/auth.ts:upsertUser`),
patched thereafter (profile, subscription, ban). Read almost everywhere.

| Field | Type | Req | Meaning |
|---|---|:--:|---|
| `linkedinId` | string | ✓ | LinkedIn member id (`sub` from OIDC). Lookup key (`by_linkedin_id`). |
| `name` | string | ✓ | Display name. |
| `headline` | string | – | LinkedIn headline. |
| `profilePictureUrl` | string | – | Avatar URL. |
| `industry` | string | – | Drives feed targeting (Growth/Pro). |
| `country` | string | – | Drives feed targeting (Growth/Pro). |
| `location` | string | – | Scraped LinkedIn display location (e.g. "Curitiba, Paraná, Brazil"). Read-only (profile scrape only). |
| `primaryLocale` | string | – | Scraped LinkedIn primary-locale **language** (e.g. "en"). Seeds the UI i18n language; not user-editable. |
| `tier` | `'starter'\|'growth'\|'pro'\|'contact'` | – | Subscription tier. **Optional** → users with no tier are absent from the `by_tier` index. |
| `subscriptionStatus` | `'trialing'\|'active'\|'canceled'\|'past_due'\|'none'` | ✓ | Stripe‑mirrored status. |
| `trialEndsAt` | number | – | Trial expiry (ms). |
| `stripeCustomerId` | string | – | Resolves Stripe webhooks → user (`by_stripe_customer`). |
| `linkedinAccessToken` | string | – | **Secret.** Used to act as the user on LinkedIn. Never sent to clients. |
| `linkedinRefreshToken` | string | – | **Secret.** (No refresh flow is implemented — see §19.) |
| `tokenExpiresAt` | number | – | Access‑token expiry (ms). |
| `linkedinPublicIdentifier` | string | – | LinkedIn vanity name; set by the user in Settings, used for post‑ownership verification without Partner API. |
| `isAdmin` | boolean | – | **Set only by direct DB edit.** No application write path touches it. |
| `isBanned` | boolean | – | Ban flag; set/cleared by `banUser`/`unbanUser`. |
| `bannedAt` | number | – | Ban timestamp. |
| `bannedBy` | `id('users')` | – | Admin who banned (self‑reference). |
| `bannedReason` | string | – | User‑visible reason on the banned screen. |
| `createdAt` | number | ✓ | Creation timestamp (ms). |

Indexes: `by_linkedin_id [linkedinId]`, `by_stripe_customer [stripeCustomerId]`, `by_tier [tier]`.

#### `posts` — the shared feed
Inserted by `jobs/syncPosts.upsertPost` (manual + Apify) and `jobs/processQueue` (queue promotion).
Patched by `stripe.ts` (re‑stamp `authorTierRank` on tier change) and `interactions.ts`
(`interactionLimitReached`).

| Field | Type | Req | Meaning |
|---|---|:--:|---|
| `linkedinPostUrn` | string | ✓ | LinkedIn URN; dedupe key (`by_urn`). |
| `authorId` | `id('users')` | ✓ | Post author. |
| `content` | string | ✓ | Post text (composed text + appended media links). |
| `publishedAt` | number | ✓ | Publish time (ms); primary sort + 7‑day window key. |
| `likeCount` | number | ✓ | Reaction count (incremented on in‑app reactions). |
| `commentCount` | number | ✓ | Comment count (incremented on in‑app comments). |
| `mediaUrls` | string[] | ✓ | Extracted media URLs. |
| `isFeatured` | boolean | ✓ | Pinned to top of feed. |
| `featuredAt` | number | – | When featured (secondary sort for featured). |
| `visibilityIndustries` | string[] | ✓ | Author allowlist — only viewers in these industries see it. |
| `visibilityCountries` | string[] | ✓ | Author allowlist — only viewers in these countries see it. |
| `hidden` | boolean | ✓ | `true` = excluded from feed (trial posts; un‑hidden on activation). |
| `authorTierRank` | number | – | Denormalized tier rank at write time (4=contact, 3=pro, 2=growth, 1=starter). Defaults to 1 in feed sort when absent. |
| `interactionLimitReached` | boolean | – | `true` once `likeCount+commentCount ≥ interactionsPerPost`; filtered out of feed. |
| `sourceUrl` | string | – | Original submitted URL (preserved for correct back‑links). Absent for cron‑synced posts. |

Indexes: `by_author [authorId]`, `by_urn [linkedinPostUrn]`, `by_published [hidden, publishedAt]`,
`by_author_and_publishedAt [authorId, publishedAt]`, plus **`by_featured [isFeatured, featuredAt]`
and `by_feed [hidden, isFeatured, featuredAt]` which are defined but currently unused** (feed reads
via `by_published`).

#### `subscriptions` — Stripe subscription mirror
Written/read by `stripe.ts`; read by `users.getSubscriptionInfo`.

| Field | Type | Req | Meaning |
|---|---|:--:|---|
| `userId` | `id('users')` | ✓ | Subscriber. |
| `stripeSubscriptionId` | string | ✓ | Stripe sub id (`by_stripe_id`). |
| `tier` | `'starter'\|'growth'\|'pro'\|'contact'` | ✓ | Subscribed tier. |
| `status` | string | ✓ | **Free‑form** raw Stripe status (not a constrained union here). |
| `currentPeriodEnd` | number | – | Period end (ms). |

Indexes: `by_user [userId]`, `by_stripe_id [stripeSubscriptionId]`.

#### `planLimits` — tier limits + per‑user contact overrides
Tier‑default rows have **no `userId`**; override rows (contact tier only) set `userId`. Seeded by
`migrations/seedPlanLimits.ts`; read by `lib/planLimits.ts`; CRUD‑managed by `admin.ts`.

| Field | Type | Req | Meaning |
|---|---|:--:|---|
| `tier` | `'starter'\|'growth'\|'pro'\|'contact'` | ✓ | Tier this row applies to. |
| `userId` | `id('users')` | – | **Only** set for contact per‑user overrides. |
| `interactionsPerPost` | number | ✓ | Max likes+comments counted per post before lockout. |
| `postsPerWeek` | number | ✓ | Max posts admitted to feed per rolling 7 days. |

Indexes: `by_tier [tier]` (matches default **and** override rows — callers filter `userId===undefined`
in JS), `by_user [userId]`.

#### `postQueue` — weekly‑limit overflow buffer
Posts that couldn't be inserted because the author hit their weekly limit. Drained by the
`processQueue` cron when capacity reopens. Written by `syncPosts.upsertPost` (Apify path only).

| Field | Type | Req | Meaning |
|---|---|:--:|---|
| `linkedinPostUrn` | string | ✓ | Dedupe key (`by_urn`). |
| `authorId` | `id('users')` | ✓ | Author (`by_author`). |
| `content`, `publishedAt`, `likeCount`, `commentCount`, `mediaUrls`, `hidden`, `sourceUrl` | — | ✓/– | Snapshot carried so promotion needs no re‑fetch. |
| `queuedAt` | number | ✓ | Enqueue timestamp (ms). |

On promotion, `authorTierRank` is recomputed and `interactionLimitReached` is set `false`.

#### `sessions` — app's own auth tokens
Random UUID tokens issued by the OAuth callback. 30‑day TTL.

| Field | Type | Req | Meaning |
|---|---|:--:|---|
| `token` | string | ✓ | Opaque session token (`by_token`). |
| `userId` | `id('users')` | ✓ | Session owner (`by_userId`). |
| `expiresAt` | number | ✓ | Expiry (ms). |

#### `oauthStates` — CSRF nonces
Single‑use OAuth `state` values; ~10‑minute TTL; deleted on validation.

| Field | Type | Req | Meaning |
|---|---|:--:|---|
| `state` | string | ✓ | Random nonce (`by_state`). |
| `expiresAt` | number | ✓ | Expiry (ms). |

#### `rateLimits` — fixed‑window counters
| Field | Type | Req | Meaning |
|---|---|:--:|---|
| `userId` | `id('users')` | ✓ | Subject. |
| `action` | string | ✓ | Action name (`submitPost`, `commentOnPost`, `reactToPost`, `profile_refresh`). |
| `windowStart` | number | ✓ | Window start (ms). |
| `count` | number | ✓ | Calls in window. |

Index: `by_user_and_action [userId, action]`.

#### `appSettings` — singleton global settings
Accessed via `.first()` (treated as a singleton; no index).

| Field | Type | Req | Meaning |
|---|---|:--:|---|
| `apifySyncEnabled` | boolean | ✓ | Master toggle for the Apify post‑sync cron. |
| `apifyEnabled` | boolean | – | **Master Apify kill-switch.** Absent ⇒ enabled. When false, all Apify (post sync + profile scrape) halts. |
| `apifyProfileScrapeEnabled` | boolean | – | Gates the LinkedIn profile scrape. Absent ⇒ disabled (opt-in; paid actor). |
| `lastApifySyncAt` | number | – | Last sync timestamp. |
| `lastApifySyncError` | string | – | Last sync error message. |

#### `featuredPostUsage` — per‑user monthly featured quota **(defined but unused)**
`userId`, `month` (`"YYYY-MM"`), `usedCount`; index `by_user_month`. **No read/write call sites
exist** — the featured‑post quota feature is not yet implemented.

---

## 6. Backend Architecture & Conventions

### Convex function kinds used here

| Kind | Reactive? | DB access | External fetch | Used for |
|---|---|---|---|---|
| `query` | ✓ (live) | `ctx.db` read | ✗ | reads (feed, getMe, usage) |
| `mutation` | – | `ctx.db` read/write (transactional) | ✗ | writes (upsert, ban, plan limits) |
| `action` | – | via `ctx.runQuery/runMutation` | ✓ | LinkedIn/Stripe/Apify calls (submitPost, comment, react, checkout) |
| `internal*` | – | as above | as above | server‑only; not callable from clients |
| `httpAction` | – | via `ctx.run*` | ✓ | OAuth routes + Stripe webhook (`http.ts`) |
| cron | – | mutation/action | as above | scheduled jobs (`crons.ts`) |

### Auth helper pattern (every protected function uses it)

Clients **never** pass a `userId`. They pass a `sessionToken`; the server resolves it. All helpers
live in `convex/lib/auth.ts`:

- `resolveSession(ctx, token)` → `Doc<'users'> | null` — resolves token → user **without** ban
  enforcement. Used by `getMe` so a banned user gets an `isBanned` signal (not `null`).
- `requireAuth(ctx, token)` → `Doc<'users'>` — for queries/mutations. Throws `'Unauthorized'` if
  the token is missing/expired/invalid; throws `'Account suspended'` if banned.
- `requireAuthAction(ctx, token)` → `Doc<'users'>` — same for actions (resolves via
  `ctx.runQuery(internal.sessions.getByToken)` + `internal.users.getWithTokens`, returning the
  token‑bearing record).
- `assertNotBanned(user)` — the single definition of "what a ban blocks"; called by both
  `requireAuth*`.

### Error‑handling convention (system‑wide)

- **Reads soft‑fail:** `getMe`, `getFeed`, `getMyPosts`, `getWeeklyUsage`, `getSubscriptionInfo`,
  `checkIsAdmin` catch auth errors and return `null` / `[]` / `false` rather than throwing.
- **Writes hard‑fail:** mutations/actions `throw new Error(message)`.
- Backend throws **plain `Error`** (not `ConvexError`).
- External‑call failures are **logged server‑side with the real error** and surfaced to clients as
  **generic sanitized messages** (see [§17](#17-security-posture)).

### Type‑shim landscape (all transitional, replaced by codegen)

Three separate stopgaps exist because handwritten types stand in until `npx convex dev` regenerates
`convex/_generated/`:
1. `convex/convexTypes.ts` — hand‑mirrors `DataModel`/`ctx`/`db` shapes. Contains some **drift**
   (e.g. a `UserConnectionsDoc` for a non‑existent table; out‑of‑date `PostDoc`/`SubscriptionDoc`).
2. `convex/jobs/syncPostsApify.ts` — the only backend file that imports `internalActionGeneric as
   internalAction` and casts `ctx as unknown as ActionCtx`, matching what the `convex-mocks`
   Vitest alias is built to satisfy.
3. `app/src/convex.ts` — re‑exports `{ api }` from `convex/_generated/api` for a stable app‑side
   import path.

---

## 7. Authentication & Identity

LinkedIn **3‑legged OAuth 2.0 (OIDC)**, brokered entirely by Convex HTTP actions so secrets stay
server‑side. After OAuth the app uses its **own opaque session tokens**.

- **Scopes requested** (`convex/linkedin/oauth.ts`):
  `openid profile email r_basicprofile w_member_social_feed w_member_social`.
- **OAuth endpoints:** authorize `https://www.linkedin.com/oauth/v2/authorization`, token
  `https://www.linkedin.com/oauth/v2/accessToken`, userinfo `https://api.linkedin.com/v2/userinfo`
  (OIDC; replaces the deprecated `/v2/me`).
- **CSRF:** a random `state` is stored in `oauthStates` (10‑min TTL) before redirect and is
  single‑use validated on callback (deleted before the expiry check → replay‑safe).
- **Session token:** a random UUID stored in `sessions` (30‑day TTL); returned to the app in the
  redirect URL `?session=…`. The app keeps it in **`sessionStorage`** (key `sessionToken`).

### OAuth login flow

```mermaid
sequenceDiagram
  participant U as User (browser)
  participant A as App (React)
  participant CV as Convex .site (http.ts)
  participant LI as LinkedIn
  participant DB as Convex DB

  U->>A: open guarded route (e.g. /feed)
  A->>CV: useQuery getMe(sessionToken?)
  CV-->>A: null (no/invalid session)
  A->>CV: window.location = /auth/linkedin
  CV->>DB: createOAuthState(state, +10min)
  CV-->>U: 302 → LinkedIn authorize?scope=…&state
  U->>LI: authenticate & consent
  LI-->>CV: 302 /auth/linkedin/callback?code&state
  CV->>DB: validateAndConsumeOAuthState(state)
  alt invalid / expired state
    CV-->>U: 302 → APP_URL/?error=oauth_failed
  else valid
    CV->>LI: exchangeCodeForTokens(code)
    LI-->>CV: access_token, refresh_token, expires_in
    CV->>LI: GET /v2/userinfo
    LI-->>CV: sub, name, picture
    CV->>DB: upsertUser(...) → userId  (tokens stored server-side)
    CV->>DB: sessions.create(token=UUID, userId, +30d)
    CV-->>U: 302 → APP_URL/auth/success?session=UUID
    U->>A: /auth/success stores token → navigate /feed
  end
```

### Session‑authenticated request flow

```mermaid
flowchart TD
  C["Client calls fn(sessionToken, …)"] --> R{"requireAuth / requireAuthAction"}
  R -->|"token missing/expired/invalid"| E1["throw 'Unauthorized'<br/>(reads soft-fail → null/[])"]
  R -->|"user.isBanned"| E2["throw 'Account suspended'"]
  R -->|"ok"| OK["resolve Doc&lt;users&gt;<br/>(actions also load tokens)"]
  OK --> H["function handler runs"]
```

### Identity / user functions (`convex/users.ts`, `linkedin/auth.ts`, `sessions.ts`)

| Function | Kind | Purpose |
|---|---|---|
| `linkedin.auth.upsertUser` | internalMutation | Insert on first login (default `subscriptionStatus`, `createdAt`); patch profile + tokens thereafter. Never writes `isAdmin`. |
| `users.getMe` | query (public) | Safe profile via `resolveSession` + `toSafeMe` (strips tokens + raw `isAdmin`; re‑adds `isAdmin:true` only for admins; passes `isBanned`/`bannedReason`). |
| `users.getWithTokens` | internalQuery | Full record **incl. tokens** — server‑only. |
| `users.getActiveSubscribers` | internalQuery | All users with `subscriptionStatus === 'active'` (full‑table scan). |
| `users.getSubscriptionInfo` | query (public) | Billing‑page data; reads the Stripe component's live subscriptions + our `subscriptions.tier`. |
| `users.setPublicIdentifier` | mutation (public) | Stores validated LinkedIn vanity name (`^[A-Za-z0-9\-_]{3,100}$`, lowercased). |
| `users.updateProfile` | mutation (public) | User edits their own `industry`/`country` (validated against canonical lists; empty string clears). |
| `users.refreshProfileFromLinkedIn` | mutation (public) | User-triggered profile re-scrape; requires a public identifier; **throws when the profile-scrape flag is off**; rate-limited 2/day; schedules the scrape action. |
| `users.applyScrapedProfile` | internalMutation | Writes scraped fields: `country` **fill-when-empty**; `location`/`primaryLocale` always refresh. |
| `users.logout` | mutation (public) | Deletes the current session token. |
| `users.forceLogoutAll` | mutation (public) | Deletes **all** sessions for the user (compromise response). |
| `sessions.create` / `getByToken` / `deleteByToken` | internal | Session lifecycle. |
| `sessions.deleteAllForUser` | internalMutation | Revoke all sessions for a user (used by `forceLogoutAll`). |
| `sessions.createOAuthState` / `validateAndConsumeOAuthState` | internalMutation | CSRF nonce lifecycle. |
| `sessions.deleteExpiredSessions` / `deleteExpiredOAuthStates` | internalMutation | Cron cleanup (batches of 200). |

> **No token‑refresh flow exists.** Despite README claims, nothing refreshes LinkedIn tokens near
> expiry; `refreshToken`/`tokenExpiresAt` are stored but unused. See [§19](#19-known-discrepancies-dead-code--roadmap).

---

## 8. Subscriptions & Billing

Stripe is integrated via the **`@convex-dev/stripe`** component, registered in
`convex/convex.config.ts` (`app.use(stripe)`). The component auto‑syncs customers/subscriptions and
serves the webhook; our code adds **Checkout/Portal session creation** (`billing.ts`) and **webhook
callbacks** (`http.ts` → `stripe.ts`) that keep our `users`/`subscriptions` tables in sync.

### Price‑ID → tier mapping
`getTierFromPriceId(priceId)` maps the three `STRIPE_*_PRICE_ID` env values to `starter`/`growth`/
`pro` (unknown → `starter`). `contact` is admin‑assigned, not purchasable via Checkout.

### Checkout (subscribe) flow

```mermaid
sequenceDiagram
  participant A as App (BillingPage)
  participant B as billing.createCheckoutSession (action)
  participant SC as Stripe component
  participant DB as Convex DB
  participant S as Stripe Checkout

  A->>B: createCheckoutSession(priceId, sessionToken)
  B->>B: validate priceId ∈ ALLOWED_PRICE_IDS
  B->>B: requireAuthAction(sessionToken)
  B->>SC: getOrCreateCustomer(userId, name)
  B->>SC: createCheckoutSession(priceId, customerId, success/cancel URLs)
  B->>DB: setStripeCustomerId(userId)  (before checkout completes)
  B-->>A: { url }
  A->>S: window.location = url
```

`createPortalSession` similarly returns a Stripe **Customer Portal** URL (requires an existing
`stripeCustomerId`).

### Webhook‑driven subscription sync

`http.ts` registers handlers for these Stripe events, each delegating to an internal mutation in
`stripe.ts`:

| Stripe event | Handler effect |
|---|---|
| `customer.subscription.created` / `updated` | `syncUserSubscription`: set `tier` + `subscriptionStatus`, clear `trialEndsAt`, re‑stamp `authorTierRank` on all the user's posts, **upsert** our `subscriptions` row. If status `active` → **un‑hide** the user's hidden posts **and** schedule an immediate Apify sync. |
| `customer.subscription.deleted` | `cancelUserSubscription`: mark sub `canceled`, downgrade user to `starter` + `canceled`, re‑stamp posts to `starter` rank. |
| `invoice.payment_failed` | `markPastDue`: set `subscriptionStatus = past_due` (tier unchanged). |

```mermaid
flowchart TD
  W["Stripe webhook → /stripe/webhook"] --> T{"event type"}
  T -->|created/updated| SYNC["syncUserSubscription"]
  SYNC --> P1["patch user: tier, status, clear trialEndsAt"]
  SYNC --> P2["re-stamp authorTierRank on all posts"]
  SYNC --> P3["upsert subscriptions row"]
  SYNC --> ACT{"status == active?"}
  ACT -->|yes| U1["un-hide author's hidden posts"]
  ACT -->|yes| U2["scheduler.runAfter(0) → Apify sync this user"]
  T -->|deleted| CAN["cancelUserSubscription → downgrade to starter"]
  T -->|payment_failed| PD["markPastDue (tier unchanged)"]
```

### Status semantics
`toSubscriptionStatus(raw)` maps the raw Stripe status onto the
`trialing|active|canceled|past_due|none` union; **unknown values default to `active`** (with a
console warning).

---

## 9. Plan Limits System

Two enforced limits per tier, stored in `planLimits` and looked up via
`lib/planLimits.getPlanLimitsHelper`:

- **`interactionsPerPost`** — once a post's `likeCount + commentCount ≥ interactionsPerPost`, the
  post is flagged `interactionLimitReached = true` and **filtered out of the feed** (its engagement
  budget is spent). Set in `interactions.ts`.
- **`postsPerWeek`** — max posts admitted to `posts` within a **rolling 7‑day window** (counted via
  `by_author_and_publishedAt`). Overflow either **throws** (manual submit) or is **queued** to
  `postQueue` (Apify path).

### Seed values (and hardcoded safety‑net defaults)

| Tier | interactionsPerPost | postsPerWeek | tierToRank |
|---|:--:|:--:|:--:|
| starter | 25 | 1 | 1 |
| growth | 50 | 2 | 2 |
| pro | 200 | 5 | 3 |
| contact | 200 | 5 | 4 |

These are defined identically in **two places that must stay in sync**: the hardcoded `DEFAULTS` in
`lib/planLimits.ts` (used only if a DB row is missing) and the seed rows in
`migrations/seedPlanLimits.ts` (idempotent; run once via
`npx convex run migrations/seedPlanLimits:seedPlanLimits --prod`).

### Lookup precedence (`getPlanLimitsHelper(ctx, userId, tier)`)
- **`contact`:** (1) per‑user override row (`by_user` `.unique()`) → else (2) the contact **default**
  row (`by_tier` `.take(20).find(r => r.userId === undefined)` — a JS‑side filter, *not* `.unique()`,
  because `by_tier` also matches override rows) → else (3) hardcoded `DEFAULTS.contact`.
- **all other tiers:** the single `by_tier` `.unique()` row → else `DEFAULTS[tier]`.
- `getPlanLimits` is an `internalQuery` wrapper so **actions** (no `ctx.db`) reach this via
  `ctx.runQuery`.

`tierToRank(tier?)`: `contact→4, pro→3, growth→2, starter→1, undefined/unknown→1`. Used to stamp
`posts.authorTierRank`.

---

## 10. Posts & Content Pipeline

Posts enter the `posts` table through **three paths**, all funneling into the single
`jobs/syncPosts.upsertPost` mutation:

1. **Manual submission** — user pastes a LinkedIn post URL (`posts.submitPost`).
2. **Apify cron** — daily, **only when an admin enabled `apifySyncEnabled`**, for active subscribers.
3. **On‑activation sync** — `scheduler.runAfter(0)` triggered by the Stripe webhook when a
   subscription becomes `active`.

`upsertPost` is the gatekeeper: on an **existing** URN it only patches `likeCount/commentCount/hidden`
(no limit re‑check); on **insert** it performs an **atomic weekly‑limit check** in the same
transaction and either inserts, throws, or (Apify path) diverts to `postQueue`.

### Manual post submission (`posts.submitPost`, action)

```mermaid
flowchart TD
  S["submitPost(sessionToken, postUrl)"] --> P["parseLinkedInPostUrl(url)"]
  P -->|unrecognized| X1["throw 'Unrecognized LinkedIn post URL'"]
  P -->|ok| AU["requireAuthAction → user (+ token)"]
  AU -->|no token| X2["throw 'No LinkedIn access token'"]
  AU --> RL["rateLimit submitPost: 10/hour"]
  RL --> WL{"recent posts (7d) ≥ postsPerWeek?"}
  WL -->|yes| X3["throw 'Weekly post limit reached'"]
  WL -->|no| F["fetch(postUrl) HTML → extract data-attributed-urn"]
  F -->|no urn| X4["throw 'Could not find urn'"]
  F --> V["verifyPostOwnership(token, urn, linkedinId, vanityName, publicIdentifier)"]
  V --> PC["parsePostContent(html) → text + media; appendMediaLinks"]
  PC --> UP["upsertPost(hidden = subscriptionStatus=='trialing', sourceUrl=postUrl)"]
  UP --> R["return { postId }"]
```

**Ownership verification** (`linkedin/verifyPostOwnership.ts`) is a two‑step fallback: **Step A**
the UGC API (works when `w_member_social`/`r_member_social` is approved); **Step B** a local
comparison of the post's author against the user's stored `linkedinPublicIdentifier` / `vanityName`
(no API call). This lets the product work **without LinkedIn Partner/MDP access**.

**Content extraction** (`linkedin/parsePostContent.ts`) is best‑effort and non‑fatal (unrecognized
HTML yields `{ text: '', media: [] }`). From the already‑fetched page HTML it parses:

- **Text** — from JSON‑LD blocks (`articleBody` → `description` → `text`), falling back to the
  `og:description` meta tag.
- **Media** — typed as `image | article | document` (`PostMedia`), de‑duplicated, gathered from:
  `og:image` meta tags and JSON‑LD `image` (→ image); JSON‑LD `@type=Article` `url` and
  `sharedContent.url` (→ article); JSON‑LD `associatedMedia.contentUrl` and **direct `.pdf` links
  found in the page** (→ document). `findPdfLinks` tests only the path segment (before `?`/`#`) for
  the `.pdf` extension but **returns the full URL including its query string**, so signed/expiring
  document tokens are preserved (the `4603f40` fix).

`appendMediaLinks(text, media)` composes the stored `content`: the trimmed body, then (if any media)
a blank line, then one `[type] url` line per media item — self‑describing for future use. The
structured `mediaUrls` array (the bare URLs) is **persisted but not currently displayed** anywhere;
the feed/My Posts UI shows the post via the LinkedIn embed, not this stored text (see
[§11](#11-feed--engagement) / [§14](#14-frontend--authenticated-app-app)).

### Apify sync + queue pipeline

The daily cron calls `jobs/syncPosts.syncAllPosts`, which is **just a router**: it does nothing
unless `appSettings.apifySyncEnabled` is true, in which case it delegates to
`syncPostsApify.syncAllPostsViaApify`.

```mermaid
flowchart TD
  CRON["cron: syncAllPosts (daily)"] --> EN{"apifySyncEnabled?"}
  EN -->|no| STOP["return (no-op)"]
  EN -->|yes| FAN["syncAllPostsViaApify"]
  FAN --> SUBS["getActiveSubscribers (status=active)"]
  SUBS --> EACH["per user: syncUserPostsViaApify"]
  EACH --> PID{"has linkedinPublicIdentifier?"}
  PID -->|no| SKIP["skip"]
  PID -->|yes| API["Apify run-sync-get-dataset-items<br/>(maxPosts=3, postedLimit=month,<br/>targetUrls=/in/{vanity})"]
  API --> UPS["per post: upsertPost(queueOnLimitReached=true)"]
  UPS --> LIM{"weekly limit reached on insert?"}
  LIM -->|no| INS["insert into posts"]
  LIM -->|yes| Q["insert into postQueue (dedupe by URN)"]
  FAN --> ST["updateSyncStatus(lastApifySyncAt, error?)"]
```

> Because `getActiveSubscribers` returns only `active` users, the Apify path's `hidden =
> subscriptionStatus === 'trialing'` is effectively always `false` on the cron — trial‑hiding
> matters mainly for the **manual submit** and **on‑activation** paths.

### Queue drain (`jobs/processQueue.processPostQueue`, daily cron)

```mermaid
flowchart TD
  PQ["processPostQueue (daily)"] --> B["take up to BATCH_SIZE=100 queue rows"]
  B --> AUTH["for each distinct author"]
  AUTH --> EX{"author exists?"}
  EX -->|no| PURGE["delete their orphaned queued rows"]
  EX -->|yes| CAP["capacity = postsPerWeek − recentPosts(7d)"]
  CAP --> C0{"capacity > 0?"}
  C0 -->|no| NEXT["skip author"]
  C0 -->|yes| PROMO["promote oldest queued posts (by publishedAt)"]
  PROMO --> DUP{"URN already in posts?"}
  DUP -->|yes| DEL["delete queued row (dedupe)"]
  DUP -->|no| INS["insert into posts (recompute authorTierRank, interactionLimitReached=false) + delete queued row"]
  PQ --> RES{"batch full (100)?"}
  RES -->|yes| RE["scheduler.runAfter(0) reschedule itself"]
```

### Post‑related functions

| Function | Kind | Purpose |
|---|---|---|
| `posts.submitPost` | action (public) | Manual submission (above). |
| `posts.getMyPosts` | query (public) | Author's posts incl. hidden, sorted by `publishedAt` desc. |
| `posts.getWeeklyUsage` | query (public) | `{ postsThisWeek, postsPerWeek }` over the same rolling 7‑day window submitPost enforces. |
| `posts.countRecentPosts` | internalQuery | Count posts since a timestamp (shared by enforcement + usage pill). |
| `jobs/syncPosts.upsertPost` | internalMutation | Insert/update gatekeeper with atomic weekly‑limit + optional queueing. |
| `jobs/syncPosts.syncAllPosts` | internalAction | Cron router → Apify (if enabled). |
| `jobs/syncPostsApify.syncUserPostsViaApify` | internalAction | Scrape one user's recent posts via Apify REST. |
| `jobs/syncPostsApify.syncAllPostsViaApify` | internalAction | Fan‑out over active subscribers; records sync status. |
| `jobs/processQueue.processPostQueue` | internalMutation | Drain overflow queue when capacity opens. |

---

## 11. Feed & Engagement

### Feed resolution (`feed.getFeed`, query)

Args: `sessionToken`, `limit=20`, `filterIndustries?`, `filterCountries?`. Returns
`{ posts: enriched[], hasMore }` (posts include a **token‑stripped** author projection).

The viewer's tier sets the filter via `buildFeedFilter`:
- **starter:** no filters.
- **growth:** auto‑filter to the viewer's **own** `industry` + `country`.
- **pro / contact:** filter by the **caller‑supplied** `filterIndustries` / `filterCountries`
  (applied only when non‑empty).

```mermaid
flowchart TD
  G["getFeed(sessionToken, limit, filters)"] --> AU{"valid session?"}
  AU -->|no| EMPTY["return { posts: [], hasMore: false }"]
  AU -->|yes| BASE["query posts by_published(hidden=false) desc"]
  BASE --> F1["drop interactionLimitReached === true"]
  F1 --> F2["author visibility: post.visibilityIndustries/Countries must include viewer's"]
  F2 --> F3["viewer industry filter (growth/pro)"]
  F3 --> F4["viewer country filter (pro)"]
  F4 --> F5["drop posts whose author is 'trialing'"]
  F5 --> SORT["sort: featured (publishedAt desc)<br/>then regular (authorTierRank desc, publishedAt desc)"]
  SORT --> PAGE["slice(0, limit); hasMore = total > limit"]
  PAGE --> ENR["enrich with author (strip tokens) → return"]
```

> The current implementation `.collect()`s all visible posts and filters/sorts in memory — simple
> and correct at current scale; a candidate for index‑backed pagination as volume grows.

### Sort priority (effective order)
1. **Featured** posts first (newest first).
2. Then by **author tier rank** desc (contact → pro → growth → starter).
3. Then by **`publishedAt`** desc (newest first).

### Interactions (comment / react)

Both are **actions** that call LinkedIn with the **acting user's own token**, then increment the
local count (which may flip `interactionLimitReached`). Counts propagate to all viewers in real time
via Convex reactivity.

| Action | Validation | Rate limit | LinkedIn endpoint |
|---|---|---|---|
| `commentOnPost(postId, commentText, sessionToken)` | text ≤ 3000 chars | 20/hour | `POST /v2/socialActions/{urn}/comments`, actor `urn:li:person:{linkedinId}` |
| `reactToPost(postId, reactionType, sessionToken)` | `reactionType ∈ {LIKE,CELEBRATE,SUPPORT,FUNNY,LOVE,INSIGHTFUL}` | 30/hour | `POST /rest/reactions?actor=…`, header `Linkedin-Version: 202603` |

> Endpoint **asymmetry**: comments use the legacy `/v2/socialActions` API; reactions use the
> versioned `/rest/reactions` API. The app UI currently hard‑codes the reaction type to `LIKE`.

```mermaid
sequenceDiagram
  participant A as App (PostCard/CommentBox)
  participant I as interactions.* (action)
  participant RL as rateLimit
  participant LI as LinkedIn API
  participant DB as Convex DB

  A->>I: commentOnPost / reactToPost (postId, …, sessionToken)
  I->>I: validate + requireAuthAction (must have LinkedIn token)
  I->>RL: checkAndIncrement(userId, action, maxPerHour)
  RL-->>I: ok (or throw 'Rate limit exceeded')
  I->>DB: getPost(postId)
  I->>LI: POST comment / reaction (Bearer user's token)
  alt LinkedIn !ok
    LI-->>I: error → log + throw generic message
  else ok
    I->>DB: increment count → maybe set interactionLimitReached
    I-->>A: { success: true }  (reactive feed updates everywhere)
  end
```

### Rate limiting (`lib/rateLimit.ts`)
A **fixed window** keyed on `(userId, action)`: `WINDOW_MS = 3,600,000` (1h). On each call it reads
the current window row; if `windowStart` is older than the window it resets, otherwise it increments
and throws once `count` reaches the limit (`maxPerWindow`). (The header comment says "sliding window" but the
implementation is fixed‑window.) `checkRateLimit` now accepts an optional `windowMs` + `windowLabel`
(defaults to 1h / "hour") so callers can specify non-hourly windows. Limits: `submitPost` 10/h,
`commentOnPost` 20/h, `reactToPost` 30/h, `profile_refresh` 2/day. The `profile_refresh` budget is
**shared** by the manual Refresh button and the auto-scrape on identifier change; the latter uses the
non-throwing `tryConsumeRateLimit` so an exhausted budget never blocks saving the identifier.

---

## 12. Admin & Moderation

Admin is gated by the **`users.isAdmin`** boolean, which is **only settable by direct database
edit** — no application code writes it. Every admin function calls `assertAdmin(user)` after
`requireAuth`, throwing `'Forbidden: admin access required'` otherwise.

### Admin functions (`convex/admin.ts`)

| Function | Kind | Purpose |
|---|---|---|
| `checkIsAdmin` | query | `true/false` (soft‑fails to `false`) — drives the client route guard. |
| `getSettings` | query | App settings (3 Apify flags + last‑sync status). |
| `toggleApifySync(enabled)` | mutation | Master switch for the Apify post‑sync cron. |
| `toggleApifyEnabled(enabled)` | mutation | Master Apify kill-switch. |
| `toggleApifyProfileScrape(enabled)` | mutation | Toggle the LinkedIn profile scrape. |
| `listUsers` | query | Up to 1000 users (newest first), **without** tokens/Stripe IDs. |
| `setUserTier(userId, tier)` | mutation | Change tier; promoting to `contact` auto‑seeds a per‑user `planLimits` override from contact defaults. |
| `searchContactUsers(nameQuery)` | query | Up to 10 contact‑tier users matching a name (uses `by_tier`). |
| `listPlanLimits` | query | All `planLimits` rows, enriched with `userName` for overrides. |
| `updateTierDefault(tier, …)` | mutation | Edit a tier's **default** row (filters out per‑user overrides). |
| `setContactUserLimit(userId, …)` | mutation | Upsert a contact per‑user override (validates ≥ 1; target must be contact tier). |
| `removeContactUserLimit(userId)` | mutation | Delete a contact override (revert to tier default). |
| `banUser(userId, reason?)` | mutation | Set ban fields. **Cannot self‑ban** (`assertNotSelfBan`) — guarantees ≥ 1 admin remains; banning *other* admins is allowed. |
| `unbanUser(userId)` | mutation | Clear all ban fields. |
| `getSettingsInternal` / `updateSyncStatus` | internal | Used by the Apify jobs. |

`validateLimitArgs` enforces `interactionsPerPost ≥ 1` and `postsPerWeek ≥ 1`.

### Ban model — **reactive, not a forced logout**

`banUser` **only patches the user row** (`isBanned/bannedAt/bannedBy/bannedReason`). It does **not**
delete sessions. Enforcement is:
1. **Server:** the next `requireAuth`/`requireAuthAction` calls `assertNotBanned` → throws
   `'Account suspended'` (blocks all protected mutations/actions).
2. **Client:** Convex's reactive `getMe` query (which uses `resolveSession`, not `requireAuth`, so
   it still returns the user with `isBanned: true`) pushes the flag to any open tab → `RequireAuth`
   swaps the whole shell for `<BannedScreen>`.

An **unban** restores access on the **same** session token — no re‑login required.

```mermaid
flowchart TD
  ADM["admin: banUser(userId, reason?)"] --> CHK["assertAdmin + assertNotSelfBan"]
  CHK --> PATCH["patch user: isBanned=true, bannedAt, bannedBy, bannedReason"]
  PATCH --> SRV["next requireAuth* → assertNotBanned throws 'Account suspended'"]
  PATCH --> CLI["reactive getMe pushes isBanned → BannedScreen (session still valid)"]
```

---

## 13. Scheduled Jobs (Crons)

`convex/crons.ts` is the **only** file Convex reads for scheduled work. All are fixed‑interval
(`crons.interval`), not wall‑clock (the inline "3:00 UTC" comments are aspirational).

| Cron name | Interval | Target | Effect |
|---|---|---|---|
| `sync LinkedIn posts` | every **24h** | `jobs/syncPosts.syncAllPosts` | Apify sync **iff** `apifySyncEnabled` (else no‑op). |
| `process post queue` | every **25h** | `jobs/processQueue.processPostQueue` | Promote queued posts when authors regain weekly capacity. |
| `cleanup expired sessions` | every **6h** | `sessions.deleteExpiredSessions` | Purge expired sessions (≤ 200/run). |
| `cleanup expired oauth states` | every **1h** | `sessions.deleteExpiredOAuthStates` | Purge expired CSRF nonces (≤ 200/run). |

---

## 13A. Profile Enrichment (LinkedIn Profile Scrape)

A dedicated Apify actor (`APIFY_TASK_ID_PROFILE_SCRAPE`) enriches a user with `country`
(fill-when-empty), `location`, and `primaryLocale`. Industry is **not** scraped (absent from the
payload) — it's user-edited in Settings. The scrape is **triggered**, not cron-scheduled:

- on `users.setPublicIdentifier`, but only when the identifier **changes**, the scrape is
  **enabled**, and the shared 2/day budget allows it (charged on the same `profile_refresh` counter
  as the button — and the flag is checked *before* the budget, so a disabled scrape never charges it), and
- on the user-pressed **"Refresh from LinkedIn"** button (`refreshProfileFromLinkedIn`, ≤ 2/day).

Both schedule the internal action `jobs/scrapeProfileApify.scrapeUserProfile`, which bails if the
Apify env vars (`APIFY_API_TOKEN`/`APIFY_TASK_ID_PROFILE_SCRAPE`) are unset, or unless
`apifyEnabled && apifyProfileScrapeEnabled` (gate helpers in `lib/apify.ts`). It calls the Apify
actor, parses `location.countryCode` → `country`, `location.linkedinText` → `location`,
`primaryLocale.language` → `primaryLocale`, and writes via `users.applyScrapedProfile` (country only
if the user has none; location/locale always refresh). Results propagate to Settings via the
reactive `getMe`, which also seeds the UI language once.

```mermaid
flowchart TD
  T1["setPublicIdentifier (vanity saved)"] --> CHG{"changed & scrape enabled & within 2/day budget?"}
  CHG -->|no| SKIP["skip auto-scrape (no budget charged)"]
  CHG -->|yes| SCH["scheduler.runAfter(0)"]
  T2["Settings: Refresh from LinkedIn"] --> RF["refreshProfileFromLinkedIn"]
  RF --> G0{"public identifier set?"}
  G0 -->|no| ERRP["throw: set your LinkedIn URL first"]
  G0 -->|yes| GF{"apifyEnabled && profileScrapeEnabled?"}
  GF -->|no| ERR["throw: refresh unavailable"]
  GF -->|yes| RL{"<= 2 refreshes today?"}
  RL -->|no| ERRL["throw: rate limit"]
  RL -->|yes| SCH
  SCH --> ACT["scrapeUserProfile (internal action)"]
  ACT --> GATE{"apifyEnabled && profileScrapeEnabled?"}
  GATE -->|no| STOP["return (no-op)"]
  GATE -->|yes| PID{"has linkedinPublicIdentifier?"}
  PID -->|no| STOP
  PID -->|yes| API["Apify run-sync-get-dataset-items (queries=[vanity])"]
  API --> PARSE["parseProfileScrapeResult -> {country?, location?, primaryLocale?}"]
  PARSE --> APPLY["applyScrapedProfile: country fill-when-empty; location/locale refresh"]
  APPLY --> REACT["reactive getMe -> Settings updates + i18n seed"]
```

---

## 14. Frontend — Authenticated App (`app/`)

React 19 + Vite 6 SPA. Dev server runs on **port 5174**. Convex reactivity via `convex/react`.

### Bootstrap (`main.tsx`)
Imports `./i18n` (side‑effect init) → `./index.css` → mounts
`<StrictMode><ConvexProvider client={new ConvexReactClient(VITE_CONVEX_URL)}><BrowserRouter><App/>`.
`index.html` ships a strict **CSP** meta tag allowing `frame-src https://www.linkedin.com` (post
embeds) and `connect-src` to `*.convex.cloud` (wss) + `*.stripe.com`.

### Routing & session handling (`App.tsx`)

Declarative `react-router-dom` routes. The session token lives in **`sessionStorage`** (key
`sessionToken`) — there's no React context/store; each page reads it directly.

| Path | Page | Guarded |
|---|---|:--:|
| `/auth/success` | `AuthSuccessPage` | – (captures `?session=` → stores → `/feed`) |
| `/feed` | `FeedPage` | ✓ |
| `/my-posts` | `MyPostsPage` | ✓ |
| `/settings` | `SettingsPage` | ✓ |
| `/billing` | `BillingPage` | ✓ |
| `/admin` | `AdminPage` | ✓ (server‑gated via `checkIsAdmin`; not linked in nav) |
| `*` | → `/feed` | – |

`RequireAuth` calls `getMe`; if `null` it **hard‑redirects** to
`${VITE_CONVEX_SITE}/auth/linkedin` (straight into OAuth — there's no login page); if loading shows
`<LoadingSpinner>`; if `isBanned` shows `<BannedScreen>`; otherwise renders `<AppNav>` + the page.

```mermaid
flowchart TD
  L["index.html → main.tsx"] --> I["i18n init + ConvexProvider + Router"]
  I --> RT{"route guarded?"}
  RT -->|no e.g. /auth/success| LAND["capture ?session → store → /feed"]
  RT -->|yes| RA["RequireAuth: getMe(sessionToken)"]
  RA -->|undefined loading| SP["LoadingSpinner"]
  RA -->|null| OAUTH["window.location = VITE_CONVEX_SITE/auth/linkedin"]
  RA -->|isBanned| BAN["BannedScreen"]
  RA -->|user ok| SHELL["AppNav + page → page issues Convex queries"]
```

### Pages

- **AuthSuccessPage** — stores `?session` token in `sessionStorage`, navigates to `/feed`. No Convex
  calls.
- **FeedPage** — `getFeed`; a `PostComposer` (calls `submitPost`); a list of `PostCard`s, each
  rendering the post as a **LinkedIn embed** (Option B — see `PostCard` below; raw post text is not
  shown); reactions via `reactToPost` (hard‑coded `LIKE`); inline `CommentBox` toggled per card.
- **MyPostsPage** — `getMe` + `getWeeklyUsage` + `getMyPosts` + `submitPost`. Usage pill ("N of M
  posts this week") turns **amber** at the cap and disables the composer (`atLimit`). Renders each
  post via the shared `LinkedInEmbed` with an app footer (stats, relative time, "View on LinkedIn").
- **SettingsPage** — `getMe` + `setPublicIdentifier` + `updateProfile` + `refreshProfileFromLinkedIn`.
  Industry and country are editable canonical dropdowns (country names rendered via `Intl.DisplayNames`);
  a read-only **Location** row appears when `me.location` is present (populated by the profile scrape);
  a **"Refresh from LinkedIn"** button re-scrapes the profile (disabled without a public identifier;
  shows the server error inline when the scrape flag is off). Pro/contact see a **stubbed** "who can
  see your posts" card ("Coming in next task").
- **BillingPage** — `getMe` + `getSubscriptionInfo` + `createCheckoutSession` + `createPortalSession`.
  Trial/expired banners; per‑plan Subscribe CTAs (disabled if the plan's `VITE_STRIPE_*_PRICE_ID` is
  missing); "Manage Subscription" → Stripe portal; Enterprise → `mailto:`.
- **AdminPage** — `checkIsAdmin` (redirects non‑admins; server is the real gate). Three tabs:
  **Settings** (three Apify toggles: master kill-switch, post sync, and profile scrape + last‑sync
  status), **Plan Limits** (`PlanLimitsTab`), **Users** (`UsersTab`).

### Reusable components
`AppNav` (feed/my‑posts/settings/billing links + language `<select>` + sign‑out; **no admin link**),
`PostComposer` (dark/light themes, `atLimit`), `CommentBox` (calls `commentOnPost`), `Modal`,
`BannedScreen`, `BanUserDialog`, `UsersTab` (filter/search + `setUserTier`/`banUser`/`unbanUser`),
`PlanLimitsTab` (tier defaults + debounced contact override editor), `RowActionsMenu`,
`LoadingSpinner`, plus the two LinkedIn‑embed components:

- **`LinkedInEmbed`** — the **single shared** embed component used by **both** the Feed (`PostCard`)
  and **My Posts**. Renders a LinkedIn post in an iframe that is intentionally taller
  (`iframeHeight` 480) than its `overflow:hidden` container (`containerHeight` 420) so LinkedIn's
  native action bar is clipped, then overlays an optional opaque `footer` (the app's own controls)
  over that strip. `iframe` is sandboxed (`allow-scripts allow-same-origin`) and lazy‑loaded. Its
  exported `buildEmbedUrl(urn)` **preserves the stored URN namespace** (`urn:li:activity|share|ugcPost`)
  with raw (un‑encoded) colons as LinkedIn requires; only bare/legacy ids fall back to wrapping as
  `activity`.
- **`PostCard`** — the Feed's post renderer (**Option B layout**): an app‑owned header (Featured
  badge via `feed.featured` + author avatar/name/headline) **above** a `LinkedInEmbed`, whose
  `footer` is the app's in‑app **Like/Comment bar** (`type="button"` actions calling `onReact` /
  `onComment`) overlaying the clipped native bar. **`PostCard` does not render `post.content` or
  `mediaUrls`** — the post body comes entirely from the embed.

> As of `1fcc123`, `MyPostsPage` uses this shared `LinkedInEmbed` directly (its old local
> `buildEmbedUrl` that force‑normalized to `activity` was removed, eliminating the previous
> duplicate). `MyPostsPage` keeps only `buildLinkedInUrl` (prefers the stored `sourceUrl`, falls back
> to a `/feed/update/<urn>/` link) and `timeAgo` for its embed footer's "View on LinkedIn ↗" link.

### i18n (`i18n/index.ts`)
`i18next` + `react-i18next` + browser language detector. Resources `en`/`pt`/`es`, fallback `en`.
**Detection order:** `localStorage` → `?lang=` querystring → `navigator`. The `AppNav` language
selector persists the choice to `localStorage`. On the first authenticated load, if no
`localStorage` `i18nextLng` key is present, the UI language is seeded once from `me.primaryLocale`
(the scraped LinkedIn language); the `AppNav` switcher still overrides it thereafter.

---

## 15. Frontend — Landing Site (`landing/`)

Standalone **Next.js 15 (App Router)**, React 19, Tailwind 3.4. Pure marketing — **no API/Convex
calls**; all content (pricing, testimonials, FAQ, stats) is hard‑coded in module constants.

### Routes
| Route | Purpose |
|---|---|
| `/` | Home — composes `Nav → Hero → SSIExplainer → StatsBar → HowItWorks → Features → Testimonials → Pricing → FAQ → FinalCTA → Footer`. |
| `/pricing` | Standalone pricing (`Nav` + `Pricing`). |
| `/privacy` | Privacy Policy — **required for LinkedIn app review**. |
| `/terms` | Terms of Service — **required for LinkedIn app review**. |

`app/layout.tsx` defines static SEO metadata (title/description/OpenGraph) and the dark "ink"
theme. **Notable section content** (encodes the business rules): Pricing lists "Posts hidden during
trial"; Features tags tiers (Growth+/All tiers/Pro/Coming soon); FAQ states SSI is 0–100 across four
25‑point pillars, official OAuth, "no automation — you write your own comments". `Footer` links to
`/privacy`, `/terms`, and `mailto:hello@linkintothessi.com`.

### Why the legal pages exist
LinkedIn requires a publicly reachable **privacy policy** and **terms of service** before approving
an app that reads a user's posts and publishes comments/reactions on their behalf. `/privacy` states
tokens are stored securely server‑side and never exposed; `/terms` records the user's grant of
permission to act on their behalf and the monthly‑billing/cancellation policy.

### CTAs → app
Every conversion CTA (Nav "Join free", Hero, paid Pricing buttons, FinalCTA) is a plain
`<a href={NEXT_PUBLIC_APP_URL}>` to the product app. Internal nav (logo, footer, section anchors,
`/pricing`) uses Next `<Link>`.

### Styling
Tailwind with a custom palette — `ink` (dark navy bg), `cream` (text), `lnblue` (LinkedIn blue),
`gold` (accent) — Cormorant Garamond (display) + DM Sans (body), glassmorphic scrolled nav, radial
glows, a slot‑machine headline animation. No mobile hamburger menu.

---

## 16. Environment Variables

Canonical inventory (built by grepping every `process.env.*` / `import.meta.env.*` site). `.env*`
files are git‑ignored; the `.env*.example` files document the required set.

### Convex backend — set in the **Convex dashboard** (Settings → Environment Variables)

| Variable | Required | Consumed in | Purpose |
|---|:--:|---|---|
| `LINKEDIN_CLIENT_ID` | ✓ | `linkedin/oauth.ts` | OAuth client id (authorize URL + token exchange). |
| `LINKEDIN_CLIENT_SECRET` | ✓ | `linkedin/oauth.ts` | OAuth client secret (server‑side token exchange). |
| `LINKEDIN_REDIRECT_URI` | ✓ | `linkedin/oauth.ts` | Must be `https://<deployment>.convex.site/auth/linkedin/callback` (Convex, **not** the app). |
| `APP_URL` | – (default `http://localhost:5173`) | `http.ts`, `billing.ts` | Browser redirect base: OAuth success/error + Stripe success/cancel/portal URLs. |
| `STRIPE_STARTER_PRICE_ID` | ✓ (billing) | `billing.ts`, `stripe.ts`, `http.ts` | Price id → `starter` tier; checkout allowlist + price→tier map. |
| `STRIPE_GROWTH_PRICE_ID` | ✓ (billing) | `billing.ts`, `stripe.ts`, `http.ts` | Price id → `growth` tier. |
| `STRIPE_PRO_PRICE_ID` | ✓ (billing) | `billing.ts`, `stripe.ts`, `http.ts` | Price id → `pro` tier. |
| `STRIPE_SECRET_KEY` | ✓ (billing) | *(read by `@convex-dev/stripe`)* | Stripe API secret — not referenced directly in our source. |
| `STRIPE_WEBHOOK_SECRET` | ✓ (billing) | *(read by `@convex-dev/stripe`)* | Verifies webhook signatures at `/stripe/webhook`. |
| `APIFY_API_TOKEN` | ✓ (sync) | `jobs/syncPostsApify.ts` | Bearer token for Apify REST. If unset, sync no‑ops. |
| `APIFY_TASK_ID` | ✓ (sync) | `jobs/syncPostsApify.ts` | Apify actor (`harvestapi~linkedin-profile-posts`). |
| `APIFY_TASK_ID_PROFILE_SCRAPE` | ✓ (profile scrape) | `jobs/scrapeProfileApify.ts` | LinkedIn **profile** scraper actor (country/location/primary-locale enrichment). |
| `CONVEX_DEPLOYMENT` | ✓ (CLI) | Convex CLI | Selects the deployment for `convex dev`/`deploy`. |

### App (`app/`) — Vite, `VITE_` prefix (embedded in the browser bundle)

| Variable | Required | Consumed in | Purpose |
|---|:--:|---|---|
| `VITE_CONVEX_URL` | ✓ | `main.tsx` | `.convex.cloud` URL for `ConvexReactClient` (data transport). |
| `VITE_CONVEX_SITE` | ✓ | `App.tsx` | `.convex.site` base for the `/auth/linkedin` sign‑in redirect. |
| `VITE_STRIPE_STARTER_PRICE_ID` | ✓ (billing UI) | `BillingPage.tsx` | Starter price id for checkout. |
| `VITE_STRIPE_GROWTH_PRICE_ID` | ✓ (billing UI) | `BillingPage.tsx` | Growth price id. |
| `VITE_STRIPE_PRO_PRICE_ID` | ✓ (billing UI) | `BillingPage.tsx` | Pro price id (missing → that plan's button disabled). |

### Landing (`landing/`) — Next.js, `NEXT_PUBLIC_` prefix

| Variable | Required | Consumed in | Purpose |
|---|:--:|---|---|
| `NEXT_PUBLIC_APP_URL` | – (default `http://localhost:5173`) | `Nav.tsx`, `Hero.tsx`, `Pricing.tsx`, `FinalCTA.tsx` | Base URL of the app for all CTA links. |

> **Port caveat:** the Vite dev server actually runs on **5174** (`app/vite.config.ts`), but every
> default fallback / `.env.example` assumes **5173**. Align `LINKEDIN_REDIRECT_URI`/`APP_URL` with the
> port you actually run locally.

---

## 17. Security Posture

The codebase follows a consistent, defensible security model:

- **Secrets & internal fields never reach clients.** `toSafeMe` (`users.getMe`) strips tokens **and**
  `stripeCustomerId`/`bannedBy`/`bannedAt`/raw `isAdmin`. The feed sends authors through an
  **allow‑list** projection (`toFeedAuthor` — only `_id`/name/headline/picture/industry/country/tier),
  so other users' `isAdmin`, Stripe id, `linkedinId`, ban state, etc. are never exposed.
  `users.getWithTokens` is an `internalQuery` (server‑only). The OAuth client secret lives only in
  Convex env and is used only in server‑side token exchange.
- **Clients never pass a `userId`.** Identity is always resolved server‑side from an **opaque UUID
  session token** via `lib/auth.ts`. The only thing a client can do is present a valid token.
- **CSRF protection** on OAuth: a single‑use `state` nonce (10‑min TTL) stored before redirect and
  **deleted before** the expiry check on callback (replay‑safe).
- **Sessions:** random UUID, 30‑day TTL, stored in **`sessionStorage`** (cleared on tab close).
  The token is delivered to the SPA in the OAuth redirect's **URL fragment** (`#session=…`, never a
  query string), and `AuthSuccessPage` scrubs it from history after reading — so it can't leak via
  server/proxy access logs or the `Referer` header. `logout` invalidates one session,
  `forceLogoutAll` invalidates all; expired sessions are purged by cron.
- **Generic client‑facing errors.** Every LinkedIn/OAuth/Stripe/Apify failure logs the real error
  server‑side (`console.error`) and returns a sanitized message — no stack traces or upstream bodies
  leak to clients.
- **SSRF guard on outbound fetches.** `submitPost` fetches a user‑supplied URL, so
  `parseLinkedInPostUrl` rejects any non‑`https` scheme or non‑`linkedin.com` host **before** the
  fetch, and the URN scraped from the returned page is format‑validated before any downstream use.
- **Payments fail safe.** The Stripe webhook signature is verified by `@convex-dev/stripe` before any
  handler runs; checkout/portal require auth and an allow‑listed price id; `toSubscriptionStatus`
  maps any non‑access status (`incomplete`/`unpaid`/`paused`/unknown) to a **non‑active** state so a
  half‑finished or lapsed subscription never grants access; `getTierFromPriceId` fails to `starter`.
- **Rate limiting** (fixed window per `userId+action`): submitPost 10/h, comment 20/h, react 30/h,
  profile scrape 2/day (shared by manual Refresh + auto‑scrape on identifier change).
- **Privilege escalation guarded:** `isAdmin` is **DB‑edit only** — excluded from every write path
  (`upsertUser`, `setPublicIdentifier`, etc.). Admin endpoints re‑check `assertAdmin` on the
  server‑resolved user, never on a client‑supplied id. `banUser` cannot self‑ban (always leaves ≥ 1
  admin).
- **Input validation:** `setPublicIdentifier` validates the vanity‑name format; `commentOnPost`
  caps text at 3000 chars; `reactToPost` constrains the reaction enum; `commentOnPost`/`reactToPost`
  reject `hidden`/interaction‑limit‑reached posts; `banUser` caps the reason at 500 chars; checkout
  validates the price id against an allowlist before any work.
- **CSP** (`app/index.html`) restricts script/style/frame/connect sources and adds
  `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`. `script-src`/`style-src` keep
  `'unsafe-inline'` because the Vite dev server injects inline scripts/styles — tightening that needs
  a **prod‑only nonce/hash CSP served as an HTTP header** at the hosting layer (which is also where
  `frame-ancestors`/HSTS belong, since a `<meta>` CSP ignores `frame-ancestors`).

> **Open security‑relevant gaps / hardening backlog:** no LinkedIn token‑refresh flow (tokens
> silently expire ~60 days); the ban is reactive (a banned user's in‑flight reads still resolve until
> the next protected call / reactive push); `getFeed` scans up to `FEED_SCAN_LIMIT` posts in‑memory
> (bounded, but wants real cursor pagination at scale); `linkedinPublicIdentifier` is
> **self‑attributed** (format‑validated only — LinkedIn actions still use the user's own token, so it
> can't be used to act as someone else); and prod CSP / `frame-ancestors` / HSTS headers should be
> set at the hosting layer. See [§19](#19-known-discrepancies-dead-code--roadmap).

---

## 18. Configuration, Tooling & Testing

### Monorepo & scripts (root `package.json`)
pnpm workspaces (`pnpm-workspace.yaml`): `landing`, `app`, `convex`. Root scripts orchestrate via
`pnpm --filter`:

| Script | Does |
|---|---|
| `dev:landing` / `dev:app` / `dev:convex` | Run each workspace's dev server (`dev:convex` first runs `convex ai-files update`). |
| `build:landing` / `build:app` / `build:convex` | `next build` / `tsc && vite build` / `convex deploy`. |
| `lint` / `lint:fix` | `eslint . --max-warnings 0` (zero warnings tolerated) / `--fix`. |
| `format` / `format:check` | Prettier write / check. |

### Lint / format / TS
- **ESLint 9** flat config across all workspaces; `@typescript-eslint/no-explicit-any` is a **warn**
  (and `--max-warnings 0` makes any `any` fail CI), off in tests; React rules for `app/`+`landing/`;
  `no-console` off in `convex/`. Ignores `_generated`, `convex-mocks`, config files, agent dirs.
- **Prettier:** no semicolons, single quotes, `arrowParens: avoid`, no trailing commas, 120 cols,
  `singleAttributePerLine`, `prettier-plugin-tailwindcss`.
- **TS base** (`tsconfig.base.json`): `strict`, `ES2020`, `moduleResolution: bundler`. App builds
  gate on `tsc`; Vite runs an in‑dev type‑check overlay (`vite-plugin-checker`).

### Testing (Vitest everywhere)
- **Convex:** `convex/vitest.config.ts` aliases `convex/server` →
  `convex-mocks/_test/__mocks__/convex_server_generics.ts`, so backend handlers are testable as
  **plain functions** (the mock returns function definitions unchanged; `cronJobs`/`httpRouter` are
  no‑ops; a `components` Proxy yields `undefined`). Run: `pnpm --filter convex test`. Coverage spans
  schema, auth, oauth, feed, posts, processQueue, admin, parsePostUrl/Content, verifyPostOwnership.
- **App:** Vitest config inline in `vite.config.ts` (`jsdom`, `setupFiles` import
  `@testing-library/jest-dom` + `../i18n`). Component tests for PostCard, PostComposer,
  LinkedInEmbed, Modal, BannedScreen, BanUserDialog, UsersTab, PlanLimitsTab, AdminPage, MyPostsPage,
  SettingsPage, i18n. Run: `pnpm --filter app test`.
- **All:** `pnpm -r test`.
- **No CI config** (`.github/` doesn't exist) — lint/format/tests are run manually or by deploy
  platforms.

---

## 19. Known Discrepancies, Dead Code & Roadmap

### README ↔ code mismatches (trust the code)
- **Tables:** README says 5; there are **10**.
- **Post sync:** README says "hourly LinkedIn‑API cron"; reality is **daily, Apify‑only, admin‑gated**
  (no direct LinkedIn‑API ingestion path).
- **OAuth scopes:** README lists `r_liteprofile`/`r_member_social`/`r_network`; code uses
  `openid profile email r_basicprofile w_member_social_feed w_member_social`.
- **OAuth redirect:** README shows `?userId=…`; code uses `?session=…` (a session token).
- **Token refresh:** README claims a 60‑day refresh flow "implemented"/"attempted within 7 days of
  expiry"; **no refresh logic exists**.
- **Next.js:** README says 14; `landing/` is **15**.
- **Deploy artifacts:** README says `app/` includes a `Dockerfile` + `nginx.conf` for Railway;
  **neither file exists** in the repo (no `railway.*`, `Procfile`, `vercel.json`, etc. either).
- **Dev port:** README/`.env.example` assume 5173; Vite is configured for **5174**.
- README's project tree references files that don't exist (`jobs/syncConnections.ts`,
  `pages/LoginPage.tsx`).

### Dead / vestigial code
- `posts` indexes **`by_featured`** and **`by_feed`** are defined but unused (feed reads `by_published`).
- **`featuredPostUsage`** table — defined and tested but has **no read/write call sites**.
- `convexTypes.ts` **`UserConnectionsDoc`** — references a non‑existent `userConnections` table;
  `linkedin/types.ts` legacy `LinkedInProfile`/`LinkedInConnectionElement`/`LinkedInConnectionsResponse`
  are unused remnants of the abandoned `r_network` connections feature.
- `tailwind.config.ts`'s `slotRoll` keyframe is overridden by the one in `globals.css` (dead).

### Stubs / planned
- **Post‑visibility controls** (who sees your posts) — Settings card is a "Coming soon" placeholder
  (the underlying `visibilityIndustries`/`visibilityCountries` fields **are** enforced in the feed,
  but there's no UI to set them).
- **AI comment generator** — `CommentBox` advertises "AI suggestions coming soon"; no integration.
- **Featured posts quota** — `featuredPostUsage` table exists but is unwired.
- **LinkedIn token refresh** — needed before tokens hit their ~60‑day expiry.
- **Placeholder constants** — `BannedScreen.SUPPORT_EMAIL = 'contact@email.com'` (TODO);
  `STRIPE_WEBHOOK_SECRET=whsec_your_secret` in the committed `.env.local`.

### Roadmap (from README + specs in `docs/`)
AI comment generator (Pro+), LinkedIn MDP/Partner access (unlock mutual‑connections + home‑feed APIs),
SSI‑trend analytics dashboard, proactive token‑refresh cron.

---

## 20. Glossary

- **SSI** — LinkedIn Social Selling Index, 0–100, four 25‑point pillars. The product's north‑star
  metric.
- **URN** — LinkedIn's resource identifier (e.g. `urn:li:activity:…`, `urn:li:ugcPost:…`,
  `urn:li:share:…`). Used as the post dedupe key; namespaces are **not interchangeable**, which is
  why `sourceUrl` is preserved.
- **Public identifier / vanity name** — the `linkedin.com/in/<name>` slug; used for ownership
  verification without Partner API access.
- **Apify** — third‑party scraping platform; the `harvestapi~linkedin-profile-posts` actor fetches a
  user's recent posts.
- **MDP / Partner access** — LinkedIn Marketing/Member Data Partner program; required for the
  connections and home‑feed APIs the product does **not** currently use.
- **Tier rank** — denormalized numeric tier on a post (4 contact … 1 starter) for feed sorting
  without a join.

---

## 21. Maintaining This Document

This document is **canonical** and must not be allowed to drift. The rule in `CLAUDE.md` requires
that **any code change or push updates the relevant section(s) here in the same change**. Practical
checklist when you touch the codebase:

| If you change… | Update section(s) |
|---|---|
| `convex/schema.ts` (tables/fields/indexes) | [§5 Data Model](#5-data-model) (+ ER diagram) |
| Auth/session/OAuth (`http.ts`, `linkedin/*`, `sessions.ts`, `lib/auth.ts`) | [§7](#7-authentication--identity) (+ flow) and [§17](#17-security-posture) |
| Billing/Stripe (`billing.ts`, `stripe.ts`, `http.ts` webhooks, tiers) | [§8](#8-subscriptions--billing) (+ flow), [§1 tiers](#1-product-overview--business-model) |
| Plan limits (`lib/planLimits.ts`, `seedPlanLimits.ts`, `admin.ts`) | [§9](#9-plan-limits-system) |
| Posts/sync/queue (`posts.ts`, `jobs/*`, `linkedin/parse*`, `crons.ts`) | [§10](#10-posts--content-pipeline) (+ flows), [§13](#13-scheduled-jobs-crons) |
| Feed/interactions/rate limits (`feed.ts`, `interactions.ts`, `lib/rateLimit.ts`) | [§11](#11-feed--engagement) (+ flows) |
| Admin/moderation (`admin.ts`, ban UI) | [§12](#12-admin--moderation) |
| App UI (`app/src/**`) | [§14](#14-frontend--authenticated-app-app) |
| Landing (`landing/**`) | [§15](#15-frontend--landing-site-landing) |
| Any `process.env` / `import.meta.env` usage | [§16 Environment Variables](#16-environment-variables) |
| Tooling/tests/deploy | [§18](#18-configuration-tooling--testing) |
| Resolving a stale item / removing dead code | [§19](#19-known-discrepancies-dead-code--roadmap) |

When you add a **new subsystem**, add a new numbered section and a Table‑of‑Contents entry, and add
a flow chart (Mermaid) if it introduces a multi‑step flow.

---

*Last updated: 2026‑06‑14. Generated from a full read of the codebase at branch
`feat/initial-setup` (HEAD `f9e48dc`). Reflects the LinkedIn iframe + content‑capture feature
(commits `d1b40a2` → `1fcc123`): Feed/My Posts render posts via the single shared `LinkedInEmbed`
(Option B layout, no raw post text), `submitPost` persists parsed content + structured `mediaUrls`,
and `buildEmbedUrl` preserves the URN namespace. Also reflects the Profile Enrichment feature
(Task 14): Apify-driven LinkedIn profile scrape populating `location`, `primaryLocale`, and
`country` on the `users` table; user-editable `industry`/`country` dropdowns in Settings;
admin toggles for the master Apify kill-switch and profile scrape; and i18n seeding from
`me.primaryLocale` on first authenticated load.*
