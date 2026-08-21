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
> added/changed or any code is pushed, update the relevant section (s) here in the same change.
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
    11A. [AI Reaction & Comment Assistance](#11a-ai-reaction--comment-assistance)
    11B. [Search & Command Palette](#11b-search--command-palette)
12. [Admin & Moderation](#12-admin--moderation)
    12A. [Feedback](#12a-feedback)
    12B. [Message of the Day (MOTD)](#12b-message-of-the-day-motd)
13. [Scheduled Jobs (Crons)](#13-scheduled-jobs-crons)
    13A. [Profile Enrichment (LinkedIn Profile Scrape)](#13a-profile-enrichment-linkedin-profile-scrape)
    13B. [Privacy & Compliance](#13b-privacy--compliance)
14. [Frontend — Authenticated App (`app/`)](#14-frontend--authenticated-app-app)
    14A. [Design System](#14a-design-system)
    14B. [Cross-site Theme & Language Persistence](#14b-cross-site-theme--language-persistence)
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

1. A user signs in with **LinkedIn OAuth** (OpenID Connect), so the app can identify them and show their posts in the
   shared feed.
2. The user joins a **shared real‑time feed** of posts from all other subscribers.
3. They **engage** (comment, react) on those posts — initiated in the app, completed on LinkedIn. LinkedIn exposes **no
   member API** to react/comment on another member's post, so the app surfaces the post plus an AI‑drafted comment and
   **hands off** to LinkedIn (opens the post, copies the draft to the clipboard); the user performs the action there
   under their own identity. The app counts the engagement **optimistically on tap** — it cannot confirm the LinkedIn
   action. See [§11](#11-feed--engagement).
4. Consistent, relevant engagement raises the user's **Social Selling Index (SSI)** — LinkedIn's 0–100 score across four
   25‑point pillars (brand, find the right people, engage with insights, build relationships).

**Network effect:** more users → richer feed → more engagement → higher SSI → more users.

**Monetization** is subscription‑based via Stripe across four tiers (Starter / Growth / Pro / Contact‑Enterprise).
Higher tiers unlock feed targeting (by industry/country), post‑visibility controls, featured posts, and higher
engagement/post‑volume limits. See
[§8](#8-subscriptions--billing) and [§9](#9-plan-limits-system).

### Subscription tiers (business view)

| Capability                          |   Starter   |               Growth                |     Pro      |     Contact (Enterprise)     |
|-------------------------------------|:-----------:|:-----------------------------------:|:------------:|:----------------------------:|
| Price                               |    $5/mo    |               $15/mo                |    $50/mo    |            Custom            |
| Access shared feed                  |     ✓      |                 ✓                  |      ✓      |              ✓              |
| 7‑day trial (card required)         |     ✓      | ✓ (tier chosen on landing, see §8) |      ✓      |              —               |
| Feed filtered by industry + country |     ✗      |       ✓ (auto from profile)        | ✓ (custom)  |         ✓ (custom)          |
| Control who sees your posts         |     ✗      |                 ✗                  | ✓ (planned) |         ✓ (planned)         |
| Interactions counted per post (cap) |     25      |                 50                  |     200      | 200 (per‑user override‑able) |
| Posts admitted to feed / week       |      1      |                  2                  |      5       |  5 (per‑user override‑able)  |
| Featured posts / month              |      0      |             1 (planned)             | 3 (planned)  |       Custom (planned)       |
| AI comment generator                | ✗ (future) |             ✓ (future)             | ✓ (future)  |         ✓ (future)          |

The numeric limits (interactions/post, posts/week) are the **enforced** values from the
`planLimits` table; the featured‑post and AI rows are **marketing‑level/planned** (the
`featuredPostUsage` table exists but is not yet wired; AI is a UI placeholder). See
[§19](#19-known-discrepancies-dead-code--roadmap).

**Trial model (Plan 2B).** New users start at `subscriptionStatus: 'none'` with no app-side trial. The trial begins when
they add a card via Stripe Checkout, which creates a real subscription in
`trialing` status for the **tier they pick on the billing plan grid** — every plan card starts the same trial for that
tier, with **Growth** recommended (`interval` is carried through OAuth via `sessionStorage` to pre-select the
monthly/annual toggle — see §14). Billing starts at **50 combined interactions (made + received)
OR 7 days, whichever comes first**: the 7-day side is Stripe's own `trial_period_days`; the 50-interaction milestone
fires `endTrialEarly` (server-side) to convert the trial immediately. Because the trial is a real Stripe subscription,
trialing users get the **chosen tier's plan limits naturally** — no tier mapping shim is needed. **Engaging** with
others (comment / react) is **card-gated server-side** via `assertCanEngage` in `convex/lib/access.ts`, which requires
an engage‑granting `subscriptionStatus ∈ {trialing, active, canceled}`; only `none` (never subscribed) and `past_due`
(failed payment) receive a `PAYMENT_REQUIRED` error. **Cancellation never revokes access** — a canceled member keeps
engaging; instead their own posts stop showing in the feed once their paid period ends (see §Feed). The app-facing UI
for this gate (disabled buttons, X/50 progress bar, SSI link-out, downgrade prompt) is **Plan 2C, deferred to after the
app/ UI revamp**.

---

## 2. System Architecture

The repository is a **pnpm monorepo** with **three deployable packages sharing one Convex backend**:

| Package    | Stack                                                            | Deploy target                          | Domain (prod)                                |
|------------|------------------------------------------------------------------|----------------------------------------|----------------------------------------------|
| `landing/` | Next.js 15 (App Router), React 19, Tailwind 4 (CSS-first)        | **Cloudflare** Workers (OpenNext)      | `linkintothessi.com`                         |
| `app/`     | React 19 + Vite 6, TypeScript, Tailwind 4, react‑i18next         | **Cloudflare** Workers (Static Assets) | `app.linkintothessi.com`                     |
| `convex/`  | Convex (serverless, real‑time, TS‑native) + `@convex-dev/stripe` | **Convex** managed                     | `<deployment>.convex.cloud` / `.convex.site` |

Cloudflare **hosts both frontends** (Workers) and provides DNS/CDN/TLS. External services: **LinkedIn**
(OAuth + posting), **Stripe** (billing), **Apify** (LinkedIn post scraping).

### Deployment & integration topology

```mermaid
flowchart LR
  subgraph Client["User's Browser"]
    Landing["Landing site<br/>(Next.js / Cloudflare OpenNext)"]
    App["SaaS App<br/>(React+Vite / Cloudflare Static Assets)"]
  end

  subgraph Convex["Convex Backend (managed)"]
    direction TB
    Cloud[".convex.cloud<br/>queries / mutations / actions<br/>(WebSocket + HTTP)"]
    Site[".convex.site<br/>HTTP actions:<br/>/auth/linkedin, callback,<br/>/stripe/webhook"]
    DB[("Convex DB<br/>16 tables")]
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
  App -- "engagement handoff: opens post on LinkedIn" --> LinkedIn
  App -- "Checkout redirect" --> Stripe
  Stripe -- "webhook → /stripe/webhook" --> Site
  Crons -- "scrape posts" --> Apify
  Cloud -- "on subscribe: scrape posts" --> Apify
```

### Why OAuth runs through `.convex.site` (key design decision)

The LinkedIn `redirect_uri` points at **Convex** (`https://<deployment>.convex.site/auth/linkedin/callback`), **never**
at the React app. LinkedIn returns the authorization `code` to Convex, which exchanges it for tokens **server‑side**, so
the **client secret and the user's access/refresh tokens never touch the browser**. Convex then issues an opaque session
token and redirects the browser back to the app. This is the backbone of the [security model](#17-security-posture).

---

## 3. Tech Stack

- **Backend:** [Convex](https://convex.dev) `^1.33–1.34` — real‑time serverless TypeScript. Queries (reactive reads),
  mutations (transactional writes), actions (side‑effects/external fetch), HTTP actions, and cron jobs. Stripe via the
  official `@convex-dev/stripe` component.
- **App (`app/`):** React **19**, Vite **6**, TypeScript (strict), Tailwind CSS **4**,
  `react-router-dom` **7**, `convex/react` client, `i18next` **25** (en/pt/es), plus **shadcn/ui**
  primitives (`cmdk`, `@radix-ui/react-popover`, `lucide-react`) + `@tanstack/react-virtual` for the searchable
  industry/country comboboxes (`@/*` alias → `app/src`; theme tokens in `index.css`).
- **Landing (`landing/`):** Next.js **15** (App Router), React **19**, Tailwind CSS **4** (CSS-first,
  `@tailwindcss/postcss`), TypeScript.
- **Payments:** Stripe (Checkout + Customer Portal + webhooks).
- **Post ingestion:** Apify REST API (`harvestapi~linkedin-profile-posts` actor) + manual user‑pasted post URLs.
- **Testing:** Vitest across all workspaces; React Testing Library + jsdom for the app; a custom
  `convex-mocks` shim for backend unit tests.
- **Tooling:** ESLint 9 (flat config, `--max-warnings 0`), Prettier (no‑semicolons, single‑quotes, 120 cols), pnpm
  workspaces.

---

## 4. Repository Layout

```
/
├── landing/                     # Next.js marketing site → Vercel
│   ├── app/
│   │   ├── layout.tsx           # root layout + SEO metadata + no-flash theme script
│   │   ├── globals.css          # Tailwind v4 CSS-first: @theme inline, :root/:dark tokens
│   │   ├── page.tsx             # home (composes 11 section components)
│   │   ├── pricing/page.tsx
│   │   ├── privacy/page.tsx     # LinkedIn app-review requirement
│   │   └── terms/page.tsx       # LinkedIn app-review requirement
│   ├── components/              # Nav, Hero, SSIExplainer, StatsBar, HowItWorks,
│   │                            #   Features, Testimonials, Pricing, FAQ, FinalCTA, Footer
│   │                            #   ThemeToggle (3-state light/dark/system)
│   ├── lib/
│   │   ├── cookies.ts           # SSR-safe cookie read/write (Next/process.env)
│   │   └── theme.ts             # resolveTheme / applyTheme / cookie get/set
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
│       │                        #   AppShell, Sidebar, TopBar, UserMenu, LanguageMenu,
│       │                        #   Modal, BannedScreen, BanUserDialog,
│       │                        #   UsersTab, PlanLimitsTab, RowActionsMenu, LoadingSpinner
│       └── i18n/                # i18next init + locales/{en,pt,es}.json
│
├── convex/                      # Convex backend (shared by both apps)
│   ├── schema.ts                # 16-table database schema
│   ├── convex.config.ts         # registers @convex-dev/stripe component
│   ├── crons.ts                 # the ONLY file Convex reads for scheduled jobs
│   ├── http.ts                  # LinkedIn OAuth + Stripe webhook HTTP routes
│   ├── users.ts                 # getMe, subscription info, public identifier, logout
│   ├── sessions.ts              # session tokens + OAuth-state CSRF storage
│   ├── feed.ts                  # tier-gated feed query
│   ├── interactions.ts          # comment + react engagement counters (optimistic; client hands off to LinkedIn)
│   ├── posts.ts                 # submitPost, getMyPosts, weekly usage
│   ├── billing.ts               # Stripe Checkout + Customer Portal sessions
│   ├── stripe.ts                # webhook-driven subscription sync mutations
│   ├── admin.ts                 # admin queries/mutations (users, plan limits, ban)
│   ├── lib/
│   │   ├── auth.ts              # requireAuth / requireAuthAction / resolveSession / assertNotBanned
│   │   ├── planLimits.ts        # plan-limit lookup + tierToRank
│   │   └── rateLimit.ts         # fixed-window rate limiter
│   ├── linkedin/
│   │   ├── oauth.ts             # auth URL builder + token exchange + userinfo
│   │   ├── auth.ts              # upsertUser mutation
│   │   ├── parsePostUrl.ts      # /posts/… and /feed/update/… URL parser
│   │   ├── parsePostContent.ts  # HTML → text/media + shared-article link (extractArticleUrl) + article enrichment (parseArticle)
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

All state lives in **Convex** (`convex/schema.ts`). There are **16 tables**. Every document also carries Convex‑managed
`_id` (`Id<table>`) and `_creationTime` (ms epoch) fields implicitly.

Convex `v.id('table')` fields are **logical foreign keys** — there is **no DB‑enforced referential integrity**;
consistency is maintained in application code.

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
  users ||--o{ consentRecords : "consent log"
  users ||--o{ dataExportRequests : "DSR exports"
  users ||--o{ auditLogs : "audit target"
  users ||--o{ feedback : "submits"
  feedback ||--o{ feedbackResponses : "replies"

  users {
    string linkedinId
    string name
    string tier "starter|growth|pro|contact (optional)"
    string subscriptionStatus "trialing|active|canceled|past_due|none"
    string linkedinAccessToken "secret - server only"
    string linkedinRefreshToken "secret - server only"
    string linkedinPublicIdentifier "vanity name (auto-derived)"
    boolean isAdmin "DB-edit only"
    boolean isBanned
    string email "OIDC email claim - privacy use only"
    string deletionReason "user_request|dormancy"
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
    number deletedAt "soft-delete; row kept for weekly count"
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

One row per authenticated LinkedIn member. Inserted on first login (`linkedin/auth.ts:upsertUser`), patched thereafter
(profile, subscription, ban). Read almost everywhere.

| Field                       | Type                                                   | Req | Meaning                                                                                                                                                                                                                                                                                                                                                                  |
|-----------------------------|--------------------------------------------------------|:---:|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `linkedinId`                | string                                                 | ✓  | LinkedIn member id (`sub` from OIDC). Lookup key (`by_linkedin_id`).                                                                                                                                                                                                                                                                                                     |
| `name`                      | string                                                 | ✓  | Display name.                                                                                                                                                                                                                                                                                                                                                            |
| `headline`                  | string                                                 |  –  | LinkedIn headline.                                                                                                                                                                                                                                                                                                                                                       |
| `profilePictureUrl`         | string                                                 |  –  | Avatar URL.                                                                                                                                                                                                                                                                                                                                                              |
| `industry`                  | string                                                 |  –  | Drives feed targeting (Growth/Pro).                                                                                                                                                                                                                                                                                                                                      |
| `country`                   | string                                                 |  –  | Drives feed targeting (Growth/Pro).                                                                                                                                                                                                                                                                                                                                      |
| `location`                  | string                                                 |  –  | Scraped LinkedIn display location (e.g. "Curitiba, Paraná, Brazil"). Read-only (profile scrape only).                                                                                                                                                                                                                                                                    |
| `primaryLocale`             | string                                                 |  –  | Scraped LinkedIn primary-locale **language** (e.g. "en"). Seeds the UI i18n language; not user-editable.                                                                                                                                                                                                                                                                 |
| `commentLanguage`           | string                                                 |  –  | Default language for AI-drafted comments: an ISO 639-1 code or `'auto'`. Absent ⇒ resolves to `'auto'` (match the post). User-set in Settings. Distinct from `primaryLocale`. See [§11A](#11a-ai-reaction--comment-assistance).                                                                                                                                          |
| `tier`                      | `'starter'\|'growth'\|'pro'\|'contact'`                |  –  | Subscription tier. **Optional** → users with no tier are absent from the `by_tier` index.                                                                                                                                                                                                                                                                                |
| `subscriptionStatus`        | `'trialing'\|'active'\|'canceled'\|'past_due'\|'none'` | ✓  | Stripe‑mirrored status; also admin‑overridable via `setUserSubscriptionStatus`. New users start at `none`; `trialing` begins on card-add (Stripe trial for the chosen tier — see §8); trialing users' posts are now **visible** in the feed. Engage access is granted for `{trialing, active, canceled}` — cancellation never revokes it (see `canEngage`).              |
| `trialEndsAt`               | number                                                 |  –  | Trial expiry (ms).                                                                                                                                                                                                                                                                                                                                                       |
| `subscriptionEndsAt`        | number                                                 |  –  | Paid‑through instant (ms; Stripe `current_period_end`), mirrored on every sync + cancel. A **canceled** author's posts stay in the feed until `now ≥ subscriptionEndsAt`, then drop out (`isAuthorFeedEligible`). Does not affect engage access.                                                                                                                         |
| `stripeCustomerId`          | string                                                 |  –  | Resolves Stripe webhooks → user (`by_stripe_customer`).                                                                                                                                                                                                                                                                                                                  |
| `linkedinAccessToken`       | string                                                 |  –  | **Secret.** Used to act as the user on LinkedIn. Never sent to clients.                                                                                                                                                                                                                                                                                                  |
| `linkedinRefreshToken`      | string                                                 |  –  | **Secret.** (No refresh flow is implemented — see §19.)                                                                                                                                                                                                                                                                                                                  |
| `tokenExpiresAt`            | number                                                 |  –  | Access‑token expiry (ms).                                                                                                                                                                                                                                                                                                                                                |
| `linkedinPublicIdentifier`  | string                                                 |  –  | LinkedIn vanity name, **auto‑derived (set‑once)** from the `author.url` of a name‑verified submitted post (`users.setDerivedPublicIdentifier`); never user‑typed. Seeds the Apify profile/post scrape. NOT the ownership check (that matches the post's author name against the OIDC `name`).                                                                            |
| `isAdmin`                   | boolean                                                |  –  | **Set only by direct DB edit.** No application write path touches it.                                                                                                                                                                                                                                                                                                    |
| `isBanned`                  | boolean                                                |  –  | Ban flag; set/cleared by `banUser`/`unbanUser`.                                                                                                                                                                                                                                                                                                                          |
| `bannedAt`                  | number                                                 |  –  | Ban timestamp.                                                                                                                                                                                                                                                                                                                                                           |
| `bannedBy`                  | `id('users')`                                          |  –  | Admin who banned (self‑reference).                                                                                                                                                                                                                                                                                                                                       |
| `bannedReason`              | string                                                 |  –  | User‑visible reason on the banned screen.                                                                                                                                                                                                                                                                                                                                |
| `email`                     | string                                                 |  –  | Email from LinkedIn OIDC `email` claim. Used for DSR confirmations and breach notification. Not used for marketing.                                                                                                                                                                                                                                                      |
| `emailVerified`             | boolean                                                |  –  | Whether LinkedIn verified the email address.                                                                                                                                                                                                                                                                                                                             |
| `deletionRequestedAt`       | number                                                 |  –  | When the user requested account deletion (ms).                                                                                                                                                                                                                                                                                                                           |
| `deletionScheduledAt`       | number                                                 |  –  | When the hard-delete cron will purge this account (ms). Presence signals pending erasure.                                                                                                                                                                                                                                                                                |
| `deletionReason`            | `'user_request'\|'dormancy'`                           |  –  | Why the deletion was scheduled.                                                                                                                                                                                                                                                                                                                                          |
| `lastLoginAt`               | number                                                 |  –  | Timestamp of most recent login (ms); updated on every `upsertUser` call. Powers the dormancy retention check.                                                                                                                                                                                                                                                            |
| `acknowledgedPolicyVersion` | string                                                 |  –  | Privacy-policy version string the user last accepted. Drives the re-consent prompt when it diverges from the current policy version.                                                                                                                                                                                                                                     |
| `consentPromptedAt`         | number                                                 |  –  | When the user completed the one-time consent prompt (ms). Unset ⇒ `ConsentPromptScreen` is shown on next login.                                                                                                                                                                                                                                                          |
| `firstPostPromptedAt`       | number                                                 |  –  | When the first‑post onboarding step was resolved (ms) — set once by submitting any post (`posts.submitPost` → `users.markFirstPostPrompted`) or skipping (`users.dismissFirstPostPrompt`). Unset ⇒ `FirstPostPromptScreen` is shown after the consent gate (to every new member; the onboarding post is created hidden for no-card members and funnels them to billing). |
| `createdAt`                 | number                                                 | ✓  | Creation timestamp (ms).                                                                                                                                                                                                                                                                                                                                                 |

Indexes: `by_linkedin_id [linkedinId]`, `by_stripe_customer [stripeCustomerId]`, `by_tier [tier]`,
`by_subscription_status [subscriptionStatus]` (active-subscriber fan-out for the Apify sync),
`by_token_expiry [tokenExpiresAt]` (retention cron targets expired tokens directly),
`by_deletion_and_last_login [deletionScheduledAt, lastLoginAt]` (compound — serves both the hard-delete sweep, ranging
the leading field, and the dormancy sweep, `eq(deletionScheduledAt,
undefined)` + range on `lastLoginAt`).

#### `posts` — the shared feed

Inserted by `jobs/syncPosts.upsertPost` (manual + Apify) and `jobs/processQueue` (queue promotion). Patched by
`stripe.ts` **and** `admin.setUserTier` (re‑stamp `authorTierRank` + `feedRank` on tier change, via the shared
`restampUserPostsTierRank` helper — which schedules a batched, self‑rescheduling re‑stamp so a high‑volume author never
exceeds one mutation's write budget), `interactions.ts`
(`interactionLimitReached`), and `posts.ts` (`setPostHidden` → `hidden`; `deletePost` → `deletedAt`). Every post writer
keeps the denormalized `feedRank` / `inFeed` fields in sync through the single
`computeFeedFields` helper (`lib/feedRank.ts`).

| Field                     | Type          | Req | Meaning                                                                                                                                                                                                                                                                                    |
|---------------------------|---------------|:---:|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `linkedinPostUrn`         | string        | ✓  | LinkedIn URN; dedupe key (`by_urn`).                                                                                                                                                                                                                                                       |
| `authorId`                | `id('users')` | ✓  | Post author.                                                                                                                                                                                                                                                                               |
| `content`                 | string        | ✓  | Post text (composed text + appended media links).                                                                                                                                                                                                                                          |
| `publishedAt`             | number        | ✓  | Publish time (ms); primary sort + 7‑day window key.                                                                                                                                                                                                                                        |
| `likeCount`               | number        | ✓  | Reaction count. Seeded from LinkedIn on submit/sync (`parsePostEngagement` / Apify), then incremented on in‑app reactions.                                                                                                                                                                 |
| `commentCount`            | number        | ✓  | Comment count. Seeded from LinkedIn on submit/sync, then incremented on in‑app comments.                                                                                                                                                                                                   |
| `mediaUrls`               | string[]      | ✓  | Extracted media URLs (images, documents, and the shared‑article link when the post links a LinkedIn article).                                                                                                                                                                              |
| `imageUrls`               | string[]      |  –  | Image‑typed media URLs only (subset of `mediaUrls`), captured at manual submit and sent to the AI as **vision input** (see [§11A](#11a-ai-reaction--comment-assistance)). Absent on synced/legacy posts.                                                                                   |
| `isFeatured`              | boolean       | ✓  | Pinned to top of feed.                                                                                                                                                                                                                                                                     |
| `featuredAt`              | number        |  –  | When featured (secondary sort for featured).                                                                                                                                                                                                                                               |
| `visibilityIndustries`    | string[]      | ✓  | Author allowlist — only viewers in these industries see it.                                                                                                                                                                                                                                |
| `visibilityCountries`     | string[]      | ✓  | Author allowlist — only viewers in these countries see it.                                                                                                                                                                                                                                 |
| `hidden`                  | boolean       | ✓  | `true` = excluded from feed (trial posts, un‑hidden on activation; also author/admin **Hide** via `setPostHidden`).                                                                                                                                                                        |
| `authorTierRank`          | number        |  –  | Denormalized tier rank at write time (4=contact, 3=pro, 2=growth, 1=starter). Defaults to 1 in feed sort when absent.                                                                                                                                                                      |
| `interactionLimitReached` | boolean       |  –  | `true` once `likeCount+commentCount ≥ interactionsPerPost`; filtered out of feed.                                                                                                                                                                                                          |
| `sourceUrl`               | string        |  –  | Original submitted URL (preserved for correct back‑links; powers PostCard's "View on LinkedIn"). Absent for cron‑synced posts.                                                                                                                                                             |
| `article`                 | object        |  –  | Best‑effort enrichment for a linked article (`{ url, title?, summary?, text?, author?, imageUrls }`, where `text` is the **full body**); see `lib/articleValidator.ts`. Feeds the AI reaction/comment prompts; not displayed. Absent when the post shares no article or enrichment failed. |
| `suggestedReaction`       | enum          |  –  | AI‑predicted most‑likely reaction (`LIKE\|PRAISE\|EMPATHY\|INTEREST\|APPRECIATION\|ENTERTAINMENT`), set async after submit. Absent ⇒ the UI picker treats it as `LIKE`. See [§11A](#11a-ai-reaction--comment-assistance).                                                                  |
| `deletedAt`               | number        |  –  | Soft‑delete marker (`deletePost`). Excluded from feed + My Posts, but the row is **kept** so it still counts toward the weekly limit.                                                                                                                                                      |
| `feedRank`                | number        |  –  | Denormalized single feed sort key (featured→tier→recency); see `lib/feedRank.ts`. Backs the `by_feed_rank` cursor index. Optional during rollout.                                                                                                                                          |
| `inFeed`                  | boolean       |  –  | `true` iff visible **and** under its interaction limit **and** not soft‑deleted. The filter column of `by_feed_rank`.                                                                                                                                                                      |

Indexes: `by_author [authorId]`, `by_urn [linkedinPostUrn]`,
`by_author_and_publishedAt [authorId, publishedAt]`, and `by_feed_rank [inFeed, feedRank]` which backs the **live
cursor‑paginated feed** — `getFeed` reads via this index (`eq(inFeed, true)`, `feedRank`
desc). The older `by_featured`, `by_published`, and `by_feed` indexes were **removed** once the feed migrated to
`by_feed_rank` (they had no remaining `withIndex` callers, and every index adds write amplification on this high‑write
table). See
[feed-cursor-pagination-plan.md](feed-cursor-pagination-plan.md).

#### `subscriptions` — Stripe subscription mirror

Written/read by `stripe.ts`; read by `users.getSubscriptionInfo`.

| Field                  | Type                                    | Req | Meaning                                                         |
|------------------------|-----------------------------------------|:---:|-----------------------------------------------------------------|
| `userId`               | `id('users')`                           | ✓  | Subscriber.                                                     |
| `stripeSubscriptionId` | string                                  | ✓  | Stripe sub id (`by_stripe_id`).                                 |
| `tier`                 | `'starter'\|'growth'\|'pro'\|'contact'` | ✓  | Subscribed tier.                                                |
| `status`               | string                                  | ✓  | **Free‑form** raw Stripe status (not a constrained union here). |
| `currentPeriodEnd`     | number                                  |  –  | Period end (ms).                                                |

Indexes: `by_user [userId]`, `by_stripe_id [stripeSubscriptionId]`.

#### `planLimits` — tier limits + per‑user contact overrides

Tier‑default rows have **no `userId`**; override rows (contact tier only) set `userId`. Seeded by
`migrations/seedPlanLimits.ts`; read by `lib/planLimits.ts`; CRUD‑managed by `admin.ts`.

| Field                 | Type                                    | Req | Meaning                                             |
|-----------------------|-----------------------------------------|:---:|-----------------------------------------------------|
| `tier`                | `'starter'\|'growth'\|'pro'\|'contact'` | ✓  | Tier this row applies to.                           |
| `userId`              | `id('users')`                           |  –  | **Only** set for contact per‑user overrides.        |
| `interactionsPerPost` | number                                  | ✓  | Max likes+comments counted per post before lockout. |
| `postsPerWeek`        | number                                  | ✓  | Max posts admitted to feed per rolling 7 days.      |

Indexes: `by_tier [tier]` (matches default **and** override rows — callers filter `userId===undefined`
in JS), `by_user [userId]`.

#### `postQueue` — weekly‑limit overflow buffer

Posts that couldn't be inserted because the author hit their weekly limit. Drained by the
`processQueue` cron when capacity reopens. Written by `syncPosts.upsertPost` (Apify path only).

| Field                                                                                     | Type          | Req  | Meaning                                          |
|-------------------------------------------------------------------------------------------|---------------|:----:|--------------------------------------------------|
| `linkedinPostUrn`                                                                         | string        |  ✓  | Dedupe key (`by_urn`).                           |
| `authorId`                                                                                | `id('users')` |  ✓  | Author (`by_author`).                            |
| `content`, `publishedAt`, `likeCount`, `commentCount`, `mediaUrls`, `hidden`, `sourceUrl` | —             | ✓/– | Snapshot carried so promotion needs no re‑fetch. |
| `queuedAt`                                                                                | number        |  ✓  | Enqueue timestamp (ms).                          |

On promotion, `authorTierRank` is recomputed and `interactionLimitReached` is set `false`.

#### `sessions` — app's own auth tokens

Random UUID tokens issued by the OAuth callback. 30‑day TTL.

| Field       | Type          | Req | Meaning                                                                                                                 |
|-------------|---------------|:---:|-------------------------------------------------------------------------------------------------------------------------|
| `token`     | string        | ✓  | Opaque session token (`by_token`).                                                                                      |
| `userId`    | `id('users')` | ✓  | Session owner (`by_userId`).                                                                                            |
| `expiresAt` | number        | ✓  | Expiry (ms). `by_expires_at` backs the indexed expired-session cleanup cron (range scan, not a full-table `.filter()`). |

#### `oauthStates` — CSRF nonces

Single‑use OAuth `state` values; ~10‑minute TTL; deleted on validation. The row also carries the plan-selection the user
made on the landing page, so it survives the OAuth redirect round-trip.

| Field       | Type                         | Req | Meaning                                                                                                                                        |
|-------------|------------------------------|:---:|------------------------------------------------------------------------------------------------------------------------------------------------|
| `state`     | string                       | ✓  | Random nonce (`by_state`).                                                                                                                     |
| `expiresAt` | number                       | ✓  | Expiry (ms). `by_expires_at` backs the indexed expired-state cleanup cron.                                                                     |
| `plan`      | `'starter'\|'growth'\|'pro'` |  –  | Tier chosen on the landing Pricing page before starting OAuth. Absent when OAuth is initiated without a plan selection (e.g. direct app link). |
| `interval`  | `'monthly'\|'annual'`        |  –  | Billing interval chosen alongside `plan`. Absent when `plan` is absent.                                                                        |

#### `rateLimits` — fixed‑window counters

| Field         | Type          | Req | Meaning                                                                        |
|---------------|---------------|:---:|--------------------------------------------------------------------------------|
| `userId`      | `id('users')` | ✓  | Subject.                                                                       |
| `action`      | string        | ✓  | Action name (`submitPost`, `commentOnPost`, `reactToPost`, `profile_refresh`). |
| `windowStart` | number        | ✓  | Window start (ms).                                                             |
| `count`       | number        | ✓  | Calls in window.                                                               |

Index: `by_user_and_action [userId, action]`.

#### `appSettings` — singleton global settings

Accessed via `.first()` (treated as a singleton; no index).

| Field                       | Type    | Req | Meaning                                                                                                   |
|-----------------------------|---------|:---:|-----------------------------------------------------------------------------------------------------------|
| `apifySyncEnabled`          | boolean | ✓  | Master toggle for the Apify post‑sync cron.                                                               |
| `apifyEnabled`              | boolean |  –  | **Master Apify kill-switch.** Absent ⇒ enabled. When false, all Apify (post sync + profile scrape) halts. |
| `apifyProfileScrapeEnabled` | boolean |  –  | Gates the LinkedIn profile scrape. Absent ⇒ disabled (opt-in; paid actor).                                |
| `lastApifySyncAt`           | number  |  –  | Last post‑sync timestamp (cron or manual "Sync all posts").                                               |
| `lastApifySyncError`        | string  |  –  | Last post‑sync error message.                                                                             |
| `lastProfileScrapeAt`       | number  |  –  | Last profile‑scrape fan‑out timestamp (manual "Sync all users").                                          |
| `lastProfileScrapeError`    | string  |  –  | Last profile‑scrape fan‑out error message.                                                                |

#### `featuredPostUsage` — per‑user monthly featured quota **(defined but unused)**

`userId`, `month` (`"YYYY-MM"`), `usedCount`; index `by_user_month`. **No read/write call sites exist** — the
featured‑post quota feature is not yet implemented.

#### `consentRecords` — append-only consent/withdrawal log (GDPR)

One row per consent event. Current effective consent for a given `(userId, purpose)` pair is the **most recent** row for
that pair. Queried via `by_user_and_purpose` index. The `purpose` union is intentionally narrow at launch (
`'marketing' | 'analytics'`); `'location_enrichment'` is reserved for a future Apify profile-scrape opt-in that is
disabled at launch.

| Field           | Type                       | Req | Meaning                                                |
|-----------------|----------------------------|:---:|--------------------------------------------------------|
| `userId`        | `id('users')`              | ✓  | User who granted or withdrew consent.                  |
| `purpose`       | `'marketing'\|'analytics'` | ✓  | Consent purpose.                                       |
| `granted`       | boolean                    | ✓  | `true` = consent granted; `false` = consent withdrawn. |
| `policyVersion` | string                     | ✓  | Policy version in effect at time of consent event.     |
| `createdAt`     | number                     | ✓  | Event timestamp (ms).                                  |

Indexes: `by_user [userId]`, `by_user_and_purpose [userId, purpose]`.

#### `dataExportRequests` — asynchronous data-export (Subject Access Request)

Tracks the lifecycle of data-export jobs. The generated bundle is stored in Convex file storage (`fileStorageId`); the
download link is short-lived (`expiresAt`). A retention cron purges expired records and their associated storage
objects.

| Field           | Type                                      | Req | Meaning                                                                         |
|-----------------|-------------------------------------------|:---:|---------------------------------------------------------------------------------|
| `userId`        | `id('users')`                             | ✓  | Requesting user (`by_user`).                                                    |
| `status`        | `'pending'\|'ready'\|'failed'\|'expired'` | ✓  | Job state.                                                                      |
| `requestedAt`   | number                                    | ✓  | When the request was received (ms).                                             |
| `fileStorageId` | `id('_storage')`                          |  –  | Convex storage id for the generated export bundle. Set when `status = 'ready'`. |
| `expiresAt`     | number                                    |  –  | When the download link/bundle expires (ms).                                     |

Indexes: `by_user [userId]`, `by_status [status]` — the latter lets the retention cron pull `'ready'`
exports via index instead of a full‑table `.filter()` scan.

#### `auditLogs` — accountability log (GDPR Art. 5 (2))

Append-only record of DSR actions, consent changes, and admin access to personal data. A pseudonymized subset is
retained past account deletion (actorId and targetUserId nulled out, action/metadata preserved).

| Field          | Type                        | Req | Meaning                                                                                                       |
|----------------|-----------------------------|:---:|---------------------------------------------------------------------------------------------------------------|
| `actor`        | `'user'\|'admin'\|'system'` | ✓  | Who triggered the action.                                                                                     |
| `actorId`      | `id('users')`               |  –  | Convex user id of the actor (absent for system-triggered events or after pseudonymization).                   |
| `action`       | string                      | ✓  | Structured action name (e.g. `'consent.granted'`, `'dsr.export_requested'`, `'admin.view_user'`).             |
| `targetUserId` | `id('users')`               |  –  | The user this action was performed on, if applicable.                                                         |
| `metadata`     | string                      |  –  | JSON-encoded additional context (e.g. `purpose`, `policyVersion`). Stored as string to avoid schema coupling. |
| `createdAt`    | number                      | ✓  | Event timestamp (ms).                                                                                         |

Indexes: `by_target [targetUserId]`, `by_created [createdAt]`.

#### `feedback` — user-submitted product feedback

One row per feedback submission. `userId` is cleared on account deletion (anonymization, not deletion). Legacy
single-reply fields (`responseText`, `respondedAt`, `respondedBy`) are kept as optional but **deprecated** —
`feedbackResponses` is now the source of truth for replies.

| Field          | Type                                                                                            | Req | Meaning                                      |
|----------------|-------------------------------------------------------------------------------------------------|:---:|----------------------------------------------|
| `userId`       | `id('users')`                                                                                   |  –  | Submitter (cleared on account deletion).     |
| `category`     | `'feature_request'\|'bug'\|'comment'\|'criticism'\|'praise'\|'question'\|'suggestion'\|'other'` | ✓  | Feedback category.                           |
| `message`      | string                                                                                          | ✓  | Free-text feedback body (≤4000 chars).       |
| `status`       | `'new'\|'responded'\|'archived'`                                                                | ✓  | Triage state.                                |
| `createdAt`    | number                                                                                          | ✓  | Submission timestamp (ms).                   |
| `responseText` | string                                                                                          |  –  | **Deprecated.** Legacy single-reply text.    |
| `respondedAt`  | number                                                                                          |  –  | **Deprecated.** Legacy reply timestamp (ms). |
| `respondedBy`  | `id('users')`                                                                                   |  –  | **Deprecated.** Legacy responding admin.     |

Indexes: `by_user [userId]`, `by_status [status]`.

#### `feedbackResponses` — append-only admin reply thread

Each row is one admin reply to a feedback item. Multiple rows per feedback item are allowed (threaded replies).

| Field         | Type             | Req | Meaning                     |
|---------------|------------------|:---:|-----------------------------|
| `feedbackId`  | `id('feedback')` | ✓  | Parent feedback item.       |
| `responderId` | `id('users')`    | ✓  | Admin who wrote this reply. |
| `text`        | string           | ✓  | Reply text.                 |
| `createdAt`   | number           | ✓  | Reply timestamp (ms).       |

Index: `by_feedback [feedbackId, createdAt]` (chronological per feedback item).

#### `motds` — admin Message of the Day

Admin-authored announcements. Exactly one is shown at a time: the newest `enabled` row whose
`[startAt, expiresAt)` window covers "now" (`convex/motd/motd.ts:selectActiveMotd`). Hard-deleted on removal (admin
content, not personal data).

| Field       | Type                     | Req | Meaning                                                                                          |
|-------------|--------------------------|:---:|--------------------------------------------------------------------------------------------------|
| `bodies`    | `record<string, string>` | ✓  | Locale code → markdown body. `en` required (validation) and is the fallback for missing locales. |
| `important` | boolean                  | ✓  | `false` → dismissible top banner; `true` → blocking modal (closable only via OK).                |
| `enabled`   | boolean                  | ✓  | Admin on/off switch.                                                                             |
| `startAt`   | number                   |  –  | Optional scheduled start (ms). Absent ⇒ active immediately.                                      |
| `expiresAt` | number                   |  –  | Optional "limited date" (ms). Absent ⇒ never expires.                                            |
| `createdBy` | `id('users')`            | ✓  | Admin who created it.                                                                            |
| `createdAt` | number                   | ✓  | Creation timestamp (ms); also the tie-breaker for "newest active".                               |
| `updatedAt` | number                   | ✓  | Last-edit timestamp (ms).                                                                        |

Index: `by_enabled_and_created [enabled, createdAt]` — the viewer query walks `enabled=true` newest-first.

#### `userInteractions` — per-user engagement log

One row per reaction or comment a user made on a post (written best-effort by `recordInteraction` after a successful
`reactToPost` / `commentOnPost`). Distinct from the aggregate `posts.likeCount` / `commentCount`. Powers the **DSR
export** (§13B — included in the user's data bundle, deleted in the erasure cascade) and a future admin dashboard.

| Field       | Type                      | Req | Meaning                                          |
|-------------|---------------------------|:---:|--------------------------------------------------|
| `userId`    | `id('users')`             | ✓  | Who reacted / commented.                         |
| `postId`    | `id('posts')`             | ✓  | The target post.                                 |
| `kind`      | `'reaction' \| 'comment'` | ✓  | Which interaction this row records.              |
| `reaction`  | enum                      |  –  | Reaction value (set when `kind === 'reaction'`). |
| `comment`   | string                    |  –  | Comment text (set when `kind === 'comment'`).    |
| `createdAt` | number                    | ✓  | Interaction timestamp (ms).                      |

Indexes: `by_user [userId]` (DSR export + a user's activity), `by_post [postId]` (admin: who engaged with a post).

#### `userPostState` — per- (user, post) engagement state

One lazily-created row per (user, post), distinct from the append-only `userInteractions` log. Holds **current** state:
`reactedAt` (set on the user's first reaction so a repeat doesn't double-count / double-bill — a member holds at most
one reaction per post) and `commentDraft` (the last AI-generated comment for the post, reloaded into `CommentBox` for
reuse/regeneration). Per-user data: included in the DSR export and deleted in the erasure cascade (§13B).

| Field          | Type          | Req | Meaning                                                        |
|----------------|---------------|:---:|----------------------------------------------------------------|
| `userId`       | `id('users')` | ✓  | Owner of the state row.                                        |
| `postId`       | `id('posts')` | ✓  | The target post.                                               |
| `reactedAt`    | number        |  –  | Set on the first reaction; presence = already counted (dedup). |
| `commentDraft` | string        |  –  | Last AI-generated comment for the post (reuse/regenerate).     |

Index: `by_user_and_post [userId, postId]` — the dedup/draft lookups and the by-user DSR/erasure scan.

---

## 6. Backend Architecture & Conventions

### Convex function kinds used here

| Kind         | Reactive? | DB access                           | External fetch | Used for                                                           |
|--------------|-----------|-------------------------------------|----------------|--------------------------------------------------------------------|
| `query`      | ✓ (live) | `ctx.db` read                       | ✗             | reads (feed, getMe, usage)                                         |
| `mutation`   | –         | `ctx.db` read/write (transactional) | ✗             | writes (upsert, ban, plan limits)                                  |
| `action`     | –         | via `ctx.runQuery/runMutation`      | ✓             | LinkedIn/Stripe/Apify calls (submitPost, comment, react, checkout) |
| `internal*`  | –         | as above                            | as above       | server‑only; not callable from clients                             |
| `httpAction` | –         | via `ctx.run*`                      | ✓             | OAuth routes + Stripe webhook (`http.ts`)                          |
| cron         | –         | mutation/action                     | as above       | scheduled jobs (`crons.ts`)                                        |

### Auth helper pattern (every protected function uses it)

Clients **never** pass a `userId`. They pass a `sessionToken`; the server resolves it. All helpers live in
`convex/lib/auth.ts`:

- `resolveSession(ctx, token)` → `Doc<'users'> | null` — resolves token → user **without** ban enforcement. Used by
  `getMe` so a banned user gets an `isBanned` signal (not `null`).
- `requireAuth(ctx, token)` → `Doc<'users'>` — for queries/mutations. Throws `'Unauthorized'` if the token is
  missing/expired/invalid; throws `'Account suspended'` if banned.
- `requireAuthAction(ctx, token)` → `Doc<'users'>` — same for actions (resolves via
  `ctx.runQuery(internal.sessions.getByToken)` + `internal.users.getWithTokens`, returning the token‑bearing record).
- `assertNotBanned(user)` — the single definition of "what a ban blocks"; called by both
  `requireAuth*`.

### Error‑handling convention (system‑wide)

- **Reads soft‑fail:** `getMe`, `getFeed`, `getMyPosts`, `getWeeklyUsage`, `getSubscriptionInfo`,
  `checkIsAdmin` catch auth errors and return `null` / `[]` / `false` rather than throwing.
- **Writes hard‑fail:** mutations/actions `throw new Error(message)`.
- Backend throws **plain `Error`** (not `ConvexError`).
- External‑call failures are **logged server‑side with the real error** and surfaced to clients as **generic sanitized
  messages** (see [§17](#17-security-posture)).

### LinkedIn member‑API calls

All authenticated requests to `api.linkedin.com` (Bearer = the user's token) route through the single
`linkedin/client.ts` `callMemberApi` seam, which owns the `Authorization` header, the
`Content-Type` header (when a body is present), and the log-real-error → throw-sanitized error policy. Only the OAuth
token exchange (`exchangeCodeForTokens`) calls LinkedIn directly — it targets
`www.linkedin.com` with a `client_secret` form‑POST and is a different auth shape.

### Type‑shim landscape

The former `convex/convexTypes.ts` hand‑mirror of `DataModel`/`ctx`/`db` shapes has been **removed**; all backend code
now imports generated `Doc<>`/`Id<>`/`QueryCtx`/`MutationCtx`/`ActionCtx` from
`convex/_generated/`. Two intentional patterns remain:

1. **Test mock seam.** `convex/lib/audit.ts` and the two Apify jobs (`jobs/syncPostsApify.ts`,
   `jobs/scrapeProfileApify.ts`) import `internalActionGeneric` / `internalMutationGeneric` from
   `convex/server` (the registration generic the `convex-mocks` Vitest alias replaces) and cast
   `ctx as unknown as ActionCtx` using the **generated** `ActionCtx`. Each fan‑out handler annotates its return type
   (`Promise<void>`) to break the same‑file `internal.*` type cycle that the precise generated ctx would otherwise
   introduce.
2. `app/src/convex.ts` — re‑exports `{ api }` from `convex/_generated/api` for a stable app‑side import path.

---

## 7. Authentication & Identity

LinkedIn **3‑legged OAuth 2.0 (OIDC)**, brokered entirely by Convex HTTP actions so secrets stay server‑side. After
OAuth the app uses its **own opaque session tokens**.

- **Scopes requested** (`convex/linkedin/oauth.ts`): `openid profile email` — the only Standard‑tier product (Sign In
  with LinkedIn / OIDC), so **every** LinkedIn member can authenticate. No
  `w_member_social*` / `r_basicprofile`: the app makes **no LinkedIn API writes** (react/comment happen on LinkedIn via
  the handoff, §11), and those scopes are Development‑tier/ungranted — requesting them throws
  `unauthorized_scope_error` for anyone without a role on the app (i.e. breaks login for all non‑team users).
- **OAuth endpoints:** authorize `https://www.linkedin.com/oauth/v2/authorization`, token
  `https://www.linkedin.com/oauth/v2/accessToken`, userinfo `https://api.linkedin.com/v2/userinfo`
  (OIDC; replaces the deprecated `/v2/me`).
- **CSRF:** a random `state` is stored in `oauthStates` (10‑min TTL) before redirect and is single‑use validated on
  callback (deleted before the expiry check → replay‑safe).
- **Session token:** a random UUID stored in `sessions` (30‑day TTL); returned to the app in the redirect URL
  `?session=…`. The app keeps it in **`sessionStorage`** (key `sessionToken`).
- **Sign‑out:** the app auto‑starts OAuth for any unauthenticated visit (see `RequireAuth`, §14), and LinkedIn keeps its
  own SSO session — so a naive sign‑out is silently re‑authenticated. Sign‑out therefore sets a **persistent `signedOut`
  marker** (`localStorage`, `lib/session.ts`) _before_
  calling `users.logout`, drops the local `sessionToken`, and redirects to the **marketing/landing site**
  (`VITE_LANDING_URL` — the separate Next.js app at its own origin, see §15). The marker does two jobs: **(1)** it wins
  the race against the **reactive** `getMe → null` that `users.logout`
  triggers while the SPA is still mounted (which would otherwise trip `RequireAuth`'s auto‑OAuth and silently re‑log the
  user in via LinkedIn SSO → `/auth/success` → `/feed`); and **(2)** it **persists across the return visit**, so when a
  signed‑out user navigates back to the app
  `RequireAuth` bounces them to the landing site instead of auto‑logging them in. It is cleared on the next successful
  login (`AuthSuccessPage`), so "auto‑redirect for login" resumes for fresh/expired sessions. To log back in, the
  landing site's CTAs point **straight at OAuth**
  (`${NEXT_PUBLIC_CONVEX_SITE}/auth/linkedin`, §15) — not the app root — so a signed‑out visitor doesn't ping‑pong
  between the landing site and the app. All three sign‑out buttons (`UserMenu`,
  `BannedScreen`, `CancelDeletionScreen`) route through the shared `performSignOut()` helper in
  `app/src/lib/session.ts`, which `await`s `users.logout` to invalidate the session server‑side.

### OAuth login flow

The `/auth/linkedin` start handler reads optional `plan` and `interval` query parameters from the URL (appended by the
landing Pricing page CTAs). The `plan` value is validated against the allowed tier list (`starter|growth|pro`) and,
together with `interval`, is stored on the `oauthStates` row so it survives the LinkedIn redirect round-trip.

```mermaid
sequenceDiagram
  participant U as User (browser)
  participant LP as Landing (Pricing CTA)
  participant CV as Convex .site (http.ts)
  participant LI as LinkedIn
  participant DB as Convex DB
  participant A as App (React)

  LP->>CV: /auth/linkedin?plan=growth&interval=annual
  Note over LP,CV: plan/interval optional — absent on direct app link
  CV->>DB: createOAuthState(state, +10min, plan?, interval?)
  CV-->>U: 302 → LinkedIn authorize?scope=…&state
  U->>LI: authenticate & consent
  LI-->>CV: 302 /auth/linkedin/callback?code&state
  CV->>DB: validateAndConsumeOAuthState(state) → { valid, plan?, interval? }
  alt invalid / expired state
    CV-->>U: 302 → APP_URL/?error=oauth_failed
  else valid
    CV->>LI: exchangeCodeForTokens(code)
    LI-->>CV: access_token, refresh_token, expires_in
    CV->>LI: GET /v2/userinfo
    LI-->>CV: sub, name, picture
    CV->>DB: upsertUser(...) → userId  (tokens stored server-side)
    CV->>DB: sessions.create(token=UUID, userId, +30d)
    CV-->>U: 302 → APP_URL/auth/success#session=UUID&plan=growth&interval=annual
    Note over CV,U: plan/interval omitted from hash when absent
    U->>A: /auth/success reads hash → stores token + plan/interval → navigate /feed
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

| Function                                                      | Kind                | Purpose                                                                                                                                                                                                                                                                                                                    |
|---------------------------------------------------------------|---------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `linkedin.auth.upsertUser`                                    | internalMutation    | Insert on first login (default `subscriptionStatus`, `createdAt`); patch profile + tokens thereafter. Never writes `isAdmin`.                                                                                                                                                                                              |
| `users.getMe`                                                 | query (public)      | Safe profile via `resolveSession` + `toSafeMe` (strips tokens + raw `isAdmin`; re‑adds `isAdmin:true` only for admins; passes `isBanned`/`bannedReason`).                                                                                                                                                                  |
| `users.getWithTokens`                                         | internalQuery       | Full record **incl. tokens** — server‑only.                                                                                                                                                                                                                                                                                |
| `users.getActiveSubscribers`                                  | internalQuery       | All users with `subscriptionStatus === 'active'` via the `by_subscription_status` index (reads only active subscribers, not the whole table).                                                                                                                                                                              |
| `users.getSubscriptionInfo`                                   | query (public)      | Billing‑page data; reads the Stripe component's live subscriptions + our `subscriptions.tier`.                                                                                                                                                                                                                             |
| `users.getTrialProgress`                                      | query (public)      | Trial meter data for `BillingPage`. Returns `{ made, received, combined, threshold, reached, status, trialEndsAt }` — `combined = made + received`; `threshold = TRIAL_INTERACTION_THRESHOLD` (50); `reached` when `combined >= threshold`. Returns `null` if unauthenticated. Mirrors `getMe`'s `resolveSession` pattern. |
| `users.setDerivedPublicIdentifier`                            | mutation (internal) | Set‑once: fills `linkedinPublicIdentifier` from a name‑verified post's author profile URL; triggers the budget‑guarded Apify profile scrape. Called by `posts.submitPost`.                                                                                                                                                 |
| `users.dismissFirstPostPrompt`                                | mutation (public)   | Set‑once stamp of `firstPostPromptedAt` when the user **skips** the first‑post onboarding step ("I'll do this later").                                                                                                                                                                                                     |
| `users.markFirstPostPrompted`                                 | mutation (internal) | Set‑once stamp of `firstPostPromptedAt`; called by `posts.submitPost` after a post persists, so posting from the gate **or** the normal composer clears the onboarding step.                                                                                                                                               |
| `users.updateProfile`                                         | mutation (public)   | User edits their own `industry`/`country`/`headline`. `industry`/`country` validate against canonical lists; `headline` is free text, trimmed, capped at 220 chars; empty string clears any of them.                                                                                                                       |
| `users.refreshProfileFromLinkedIn`                            | mutation (public)   | User-triggered profile re-scrape; requires a public identifier; **throws when the profile-scrape flag is off**; rate-limited 2/day; schedules the scrape action.                                                                                                                                                           |
| `users.isProfileRefreshEnabled`                               | query (public)      | Whether the dev-only Apify profile scrape is enabled; Settings uses it to **hide** the "Refresh from LinkedIn" button when off (the prod default).                                                                                                                                                                         |
| `users.applyScrapedProfile`                                   | internalMutation    | Writes scraped fields: `country` + `headline` **fill-when-empty**; `location`/`primaryLocale` always refresh.                                                                                                                                                                                                              |
| `users.logout`                                                | mutation (public)   | Deletes the current session token.                                                                                                                                                                                                                                                                                         |
| `users.forceLogoutAll`                                        | mutation (public)   | Deletes **all** sessions for the user (compromise response).                                                                                                                                                                                                                                                               |
| `sessions.create` / `getByToken` / `deleteByToken`            | internal            | Session lifecycle.                                                                                                                                                                                                                                                                                                         |
| `sessions.deleteAllForUser`                                   | internalMutation    | Revoke all sessions for a user (used by `forceLogoutAll`).                                                                                                                                                                                                                                                                 |
| `sessions.createOAuthState` / `validateAndConsumeOAuthState`  | internalMutation    | CSRF nonce lifecycle. `createOAuthState` accepts optional `plan`/`interval` and stores them on the `oauthStates` row. `validateAndConsumeOAuthState` returns `{ valid, plan?, interval? }` so the callback can forward the chosen tier to the app.                                                                         |
| `sessions.deleteExpiredSessions` / `deleteExpiredOAuthStates` | internalMutation    | Cron cleanup (batches of 200).                                                                                                                                                                                                                                                                                             |

> **No token‑refresh flow exists.** Despite README claims, nothing refreshes LinkedIn tokens near
> expiry; `refreshToken`/`tokenExpiresAt` are stored but unused. See [§19](#19-known-discrepancies-dead-code--roadmap).

---

## 8. Subscriptions & Billing

Stripe is integrated via the **`@convex-dev/stripe`** component, registered in
`convex/convex.config.ts` (`app.use(stripe)`). The component auto‑syncs customers/subscriptions and serves the webhook;
our code adds **Checkout/Portal session creation** and **webhook callbacks**
(`http.ts` → `stripe.ts`) that keep our `users`/`subscriptions` tables in sync.

### Price‑ID → tier mapping

`lib/stripePrices.ts` is the single source of truth for the price‑to‑tier mapping. It covers **both monthly and annual**
price IDs (six env vars total — see §16). The pure helpers
`buildPriceMap(env)` and `resolveTier(map, priceId)` are unit‑tested; the module‑level
`ALLOWED_PRICE_IDS` set and `getTierFromPriceId(priceId)` function read `process.env` once at load. Unknown or blank IDs
default to `starter`. `contact` is admin‑assigned, not purchasable via Checkout.

> **Tier pin — admins only.** Stripe webhook tier writes route through the pure, unit‑tested
> `resolveSyncedTier(currentTier, isAdmin, stripeTier)` in `stripe.ts`: an **admin's tier is never
> changed** by Stripe; everyone else follows Stripe. `contact` is **not** pinned — `contact` is
> admin‑assigned (not Stripe‑purchasable), but a contact member who subscribes to a paid plan moves to
> that tier like anyone else. Applied in `syncUserSubscription` and `cancelUserSubscription`.
>
> **Access is never revoked by cancellation** — this is enforced in `lib/access.canEngage`, not in the
> webhook: `canEngage` grants engagement for `subscriptionStatus ∈ {trialing, active, canceled}`, so a
> canceled member keeps commenting / reacting / submitting. Only `none` (never subscribed) and
> `past_due` (failed payment) are gated. What a cancellation *does* remove is **feed visibility of the
> member's own posts**, and only after their paid period ends: `cancelUserSubscription` stamps
> `subscriptionEndsAt = current_period_end`, and `feed.isAuthorFeedEligible(author, now)` drops a
> canceled author's posts once `now ≥ subscriptionEndsAt`. (The `subscriptions` row still records the
> real Stripe price/status verbatim.)

### Billing intervals

The BillingPage exposes a **monthly / annual toggle** (default: annual). Annual pricing is 2 months free:
Starter $50/yr · Growth $150/yr · Pro $500/yr.

### Checkout (subscribe) flow

Checkout runs through `billingNode.createCheckoutSession` (a `"use node"` Convex action that calls the Stripe Node SDK
directly). The `@convex-dev/stripe` component handles **customer creation/lookup** (`getOrCreateCustomer`) and **webhook
sync**; `billing.ts` retains only
`createPortalSession` and the `setStripeCustomerId` internal mutation.

Key checkout parameters:

- `trial_period_days: 7` — 7-day trial on every new subscription.
- `payment_method_collection: 'always'` — card required even during the trial (no free-ride signups).
- `allow_promotion_codes: true` — enables Henriko's manual free-month promotion-code campaign on Stripe hosted checkout.
  No coupons are created or auto-applied in code.

```mermaid
sequenceDiagram
  participant A as App (BillingPage)
  participant B as billingNode.createCheckoutSession (node action)
  participant SC as Stripe component
  participant DB as Convex DB
  participant S as Stripe Checkout

  A->>B: createCheckoutSession(priceId, sessionToken)
  B->>B: validate priceId ∈ ALLOWED_PRICE_IDS
  B->>B: requireAuthAction(sessionToken)
  B->>SC: getOrCreateCustomer(userId, email, name)
  B->>S: stripe().checkout.sessions.create(trial=7d, card-required, promo-codes)
  B->>DB: setStripeCustomerId(userId)  (if not already set)
  B-->>A: { url }
  A->>S: window.location = url
```

`createPortalSession` (still in `billing.ts`) returns a Stripe **Customer Portal** URL (requires an existing
`stripeCustomerId`).

**50-interaction milestone (Plan 2B).** `billingNode.endTrialEarly` (internalAction) sets
`trial_end: 'now'` on a Stripe subscription, converting the trial to a paid subscription immediately. It is scheduled by
the `bumpTrialInteraction` helper in `interactions.ts` whenever a trialing user's **combined**
`trialInteractionsMade + trialInteractionsReceived` first reaches 50 (the `TRIAL_INTERACTION_THRESHOLD` constant,
enforced by the pure `crossesThreshold` helper in
`convex/lib/trialMilestone.ts`). Counters are bumped in `incrementCommentCount` /
`incrementLikeCount` (awaited, reliable mutations — not the best-effort `recordInteraction` path). The check fires **at
most once** per user: the `subscriptionStatus !== 'trialing'` guard inside
`bumpTrialInteraction` skips any increment once the trial has already converted. The combined
"50 interactions OR 7 days" rule is therefore split: the 7-day side is Stripe's
`trial_period_days` (from Checkout); the 50-interaction side fires `endTrialEarly` to end it early.

### Webhook‑driven subscription sync

`http.ts` registers handlers for these Stripe events, each delegating to an internal mutation in
`stripe.ts`:

| Stripe event                                | Handler effect                                                                                                                                                                                                                                                                                                                                                                                                                        |
|---------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `customer.subscription.created` / `updated` | `syncUserSubscription`: set `tier` (via `resolveSyncedTier` — **admin tier never changes**) + `subscriptionStatus`, stamp `subscriptionEndsAt = current_period_end`, clear `trialEndsAt`, re‑stamp `authorTierRank` on all the user's posts, **upsert** our `subscriptions` row. If status `active` → **un‑hide** the user's hidden posts **and** schedule an immediate Apify sync (only when `isApifyPostSyncEnabled(appSettings)`). |
| `customer.subscription.deleted`             | `cancelUserSubscription`: mark sub `canceled`; set user `status = canceled` (access is **not** revoked — see `canEngage`) and `subscriptionEndsAt = the sub's last `current_period_end` (their posts leave the feed after this). Downgrade tier→`starter`, **except admins** whose tier is fixed. Re‑stamp posts.                                                                                                                     |
| `invoice.payment_failed`                    | `markPastDue`: set `subscriptionStatus = past_due` (tier unchanged) — this **does** gate engagement until payment clears.                                                                                                                                                                                                                                                                                                             |

```mermaid
flowchart TD
  W["Stripe webhook → /stripe/webhook"] --> T{"event type"}
  T -->|created/updated| SYNC["syncUserSubscription"]
  SYNC --> P1["patch user: tier (admin fixed), status, subscriptionEndsAt, clear trialEndsAt"]
  SYNC --> P2["re-stamp authorTierRank on all posts"]
  SYNC --> P3["upsert subscriptions row"]
  SYNC --> ACT{"status == active?"}
  ACT -->|yes| U1["un-hide author's hidden posts"]
  ACT -->|yes| G{"isApifyPostSyncEnabled(appSettings)?"}
  G -->|yes| U2["scheduler.runAfter(0) → Apify sync this user"]
  G -->|no| NOOP["no-op (Apify dormant at launch)"]
  T -->|deleted| CAN["cancelUserSubscription → tier→starter (admin fixed), status canceled (access kept), stamp subscriptionEndsAt"]
  T -->|payment_failed| PD["markPastDue (tier unchanged; past_due gates engagement)"]
```

> **Apify dormant guard:** `syncUserSubscription` reads `appSettings` and checks
> `isApifyPostSyncEnabled(settings)` (from `lib/apify.ts`) before scheduling any Apify sync.
> Apify is dormant at launch (compliance gate); billing alone cannot re‑enable it.

### Status semantics

`toSubscriptionStatus(raw)` maps the raw Stripe status onto the
`trialing|active|canceled|past_due|none` union; **unknown values default to `active`** (with a console warning).

---

## 9. Plan Limits System

> **Trial users.** Because the trial is a real Stripe subscription for the tier chosen on the
> landing page (see §8), `users.tier` is set to that tier by the webhook from the moment the card
> is added. Trial users therefore receive **the chosen tier's limits naturally** — no `effectiveTier`
> shim or special-case lookup is needed.

Two enforced limits per tier, stored in `planLimits` and looked up via
`lib/planLimits.getPlanLimitsHelper`:

- **`interactionsPerPost`** — once a post's `likeCount + commentCount ≥ interactionsPerPost`, the post is flagged
  `interactionLimitReached = true` and **filtered out of the feed** (its engagement budget is spent). Set in
  `interactions.ts`.
- **`postsPerWeek`** — max posts admitted to `posts` within a **rolling 7‑day window** (counted via
  `by_author_and_publishedAt`). Overflow either **throws** (manual submit) or is **queued** to
  `postQueue` (Apify path).

### Seed values (and hardcoded safety‑net defaults)

| Tier    | interactionsPerPost | postsPerWeek | tierToRank |
|---------|:-------------------:|:------------:|:----------:|
| starter |         25          |      1       |     1      |
| growth  |         50          |      2       |     2      |
| pro     |         200         |      5       |     3      |
| contact |         200         |      5       |     4      |

These are defined identically in **two places that must stay in sync**: the hardcoded `DEFAULTS` in
`lib/planLimits.ts` (used only if a DB row is missing) and the seed rows in
`migrations/seedPlanLimits.ts` (idempotent; run once via
`npx convex run migrations/seedPlanLimits:seedPlanLimits --prod`).

### Lookup precedence (`getPlanLimitsHelper(ctx, userId, tier)`)

- **`contact`:** (1) per‑user override row (`by_user` `.unique()`) → else (2) the contact **default**
  row (`by_tier` `.take(20).find(r => r.userId === undefined)` — a JS‑side filter, _not_ `.unique()`, because `by_tier`
  also matches override rows) → else (3) hardcoded `DEFAULTS.contact`.
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
3. **On‑activation sync** — `scheduler.runAfter(0)` triggered by the Stripe webhook when a subscription becomes
   `active`.

`upsertPost` is the gatekeeper: on an **existing** URN it only patches `likeCount/commentCount/hidden`
(no limit re‑check); on **insert** it performs an **atomic weekly‑limit check** in the same transaction and either
inserts, throws, or (Apify path) diverts to `postQueue`. The weekly‑limit decision is the pure helper `lib/postLimit.ts`
`isWeeklyLimitReached(recentCount, postsPerWeek)`.

### Manual post submission (`posts.submitPost`, action)

```mermaid
flowchart TD
  S["submitPost(sessionToken, postUrl)"] --> P["parseLinkedInPostUrl(url)"]
  P -->|unrecognized| X1["throw 'Unrecognized LinkedIn post URL'"]
  P -->|ok| AU["requireAuthAction → user (+ token)"]
  AU -->|no token| X2["throw 'No LinkedIn access token'"]
  AU --> ADM{"admin override?<br/>(isAdmin AND ALLOW_ADMIN_SHARE_ANY_POST=true)"}
  ADM -->|yes: skip throttles| F["fetch(postUrl) HTML → extract data-attributed-urn"]
  ADM -->|no| RL["rateLimit submitPost: 10/hour"]
  RL --> WL{"recent posts (7d) ≥ postsPerWeek?"}
  WL -->|yes| X3["throw 'Weekly post limit reached'"]
  WL -->|no| F
  F -->|no urn| X4["throw 'Could not find urn'"]
  F --> OWN{"admin override?"}
  OWN -->|yes: share ANY post| PC["parsePostContent(html) → text + media; appendMediaLinks"]
  OWN -->|no| V["verifyPostOwnership(postAuthorName vs OIDC name; vanity fallback)"]
  V --> PC
  PC --> ENG["parsePostEngagement(html) → likeCount, commentCount"]
  ENG --> ART{"post links an article?<br/>(extractArticleUrl finds the /pulse/… anchor)"}
  ART -->|no| UP
  ART -->|yes| AF["fetch(articleUrl) → parseArticle → article<br/>(best‑effort, SSRF‑guarded, non‑fatal)"]
  AF --> UP
  UP["upsertPost(authorId = submitter, likeCount, commentCount,<br/>hidden = false, sourceUrl=postUrl, article?)"]
  UP --> R["return { postId }"]
```

**Ownership verification** (`linkedin/verifyPostOwnership.ts`) anchors on the member's LinkedIn **name**, not an
editable field. **Primary:** the post page's JSON‑LD `author.name` (parsed by `parsePostAuthor`) must match the member's
OIDC `name` (from login; case‑/accent‑insensitive) — both come from LinkedIn and neither is editable in‑app, so it
cannot be spoofed via a settings field. **Fallback:** the older vanity heuristic (the URL's `vanityName` vs the stored
`linkedinPublicIdentifier`) runs **only** when the post page carried no author block — not attacker‑triggerable, since a
submitter can't make LinkedIn omit the author. On a name‑verified post, `submitPost` also auto‑fills the member's
`linkedinPublicIdentifier` (**set‑once**) from the author's profile URL via `users.setDerivedPublicIdentifier` — a
trustworthy, never‑typed seed for the Apify scrape. **No LinkedIn API call** is made.

**Admin override (testing only, dev‑gated).** The override is active **only** when the submitter is an admin **and** the
`ALLOW_ADMIN_SHARE_ANY_POST` env var is `'true'` — a flag set exclusively on the local / dev Convex deployment
(`isAdminShareOverrideEnabled`). In production the var is absent, so admins submit posts under exactly the same rules as
everyone else. When active, `submitPost` skips **both** the posting throttles (hourly rate limit + weekly per‑plan
limit) **and** the ownership check, so a dev admin may share **any** post in any volume. The ownership step is replaced
by a synthesized
`OwnershipResult` with `strategy: 'admin-override'`, empty `content` (it falls back to the HTML‑parsed text), and
`publishedAt = now`. The post is still attributed to the **admin** (`authorId = submitter`), because `posts.authorId`
must reference a real `users` row; the original LinkedIn author — who typically has no account — cannot be the
`authorId`.

**Engagement counts.** Manual submissions seed `likeCount` / `commentCount` from
`parsePostEngagement(html)`, which reads schema.org `interactionStatistic` (`InteractionCounter`)
out of the same page HTML already fetched for content — no extra API call. Best‑effort: missing data degrades to `0`.
This mirrors the Apify path, which reads `engagement.likes/comments`.

**Content extraction** (`linkedin/parsePostContent.ts`) is best‑effort and non‑fatal (unrecognized HTML yields
`{ text: '', media: [] }`). From the already‑fetched page HTML it parses:

- **Text** — from JSON‑LD blocks (`articleBody` → `description` → `text`), falling back to the
  `og:description` meta tag.
- **Media** — typed as `image | article | document` (`PostMedia`), de‑duplicated, gathered from:
  `og:image` meta tags and JSON‑LD `image` (→ image); the **shared‑article anchor in the post body**
  (`extractArticleUrl`) plus a JSON‑LD `@type=Article` `url` fallback (→ article); JSON‑LD
  `associatedMedia.contentUrl` and **direct `.pdf` links found in the page** (→ document).
  `findPdfLinks` tests only the path segment (before `?`/`#`) for the `.pdf` extension but **returns the full URL
  including its query string**, so signed/expiring document tokens are preserved (the
  `4603f40` fix).

**Shared‑article link** (`extractArticleUrl`). A LinkedIn post that links an article (e.g. a Pulse post) does **not**
expose the article URL in its JSON‑LD — the post is typed `SocialMediaPosting`, whose only URLs are the post's own
`@id`, the author profile, and the cover image. The article link lives only in the post body as an
`<a data-test-id="article-content">` element (also carrying a
`feed-article-content` class/tracking name). `extractArticleUrl` selects that anchor — ignoring the page's "more from
this author" `/pulse/…` links, which lack those markers — strips tracking query/hash to a clean canonical URL, and
re‑validates the LinkedIn host (it is fetched server‑side, so the SSRF guard applies). The earlier assumed
`sharedContent.url` field does not exist in real LinkedIn HTML and was removed.

`appendMediaLinks(text, media)` composes the stored `content`: the trimmed body, then (if any media)
a blank line, then one `[type] url` line per media item — self‑describing for future use. The structured `mediaUrls`
array (the bare URLs) is **persisted but not currently displayed** anywhere; the feed/My Posts UI shows the post via the
LinkedIn embed, not this stored text (see
[§11](#11-feed--engagement) / [§14](#14-frontend--authenticated-app-app)).

**Article enrichment** (`parseArticle`). When `extractArticleUrl` finds a shared article, `submitPost`
does one extra **best‑effort, SSRF‑guarded** `fetch` of that article page and runs `parseArticle` to capture
`{ url, title?, summary?, text?, author?, imageUrls }` into the post's `article` field (`lib/articleValidator.ts`):

- **`text`** — the **full article body** as plain text. The guest SSR page renders the whole body (despite the post
  JSON‑LD's `isAccessibleForFree:false` flag) inside `<div
data-test-id="article-content-blocks">` as a flat list of `publishing-text-block` elements.
  `extractArticleBody` isolates that container (up to `</article>`) — excluding the header, sign‑in modal, comments, and
  "more articles" cards — and renders each `<p>` / `<h1‑6>` / `<pre>` / list in document order: paragraphs (blank‑line
  separated), headings on their own line, `- ` bullets, and
  ` ` ``‑fenced code blocks (internal whitespace preserved, entities decoded).
- **`title` / `summary` / `author`** — from the article's `@type:Article` JSON‑LD (where LinkedIn unusually maps `name`
  →title and `headline`→summary), with `og:` tag fallbacks.
- **`imageUrls`** — cover (`og:image` / JSON‑LD) plus inline body images (`media.licdn.com` URLs inside
  `article-content-blocks`), de‑duplicated.

Non‑fatal: no article link, a network error, or a parse miss simply leaves `article` undefined. The data is **not
displayed**; it seeds a future AI‑comment feature. The Apify cron path does not populate
`article`.

### Hiding & deleting a post (`posts.setPostHidden` / `posts.deletePost`, mutations)

Authors manage their own shared posts from My Posts; **admins may act on any post** (moderation). Both mutations
authorize via the pure `canModifyPost(user, post)` helper (`post.authorId === user._id ||
user.isAdmin`).

- **Hide / unhide** (`setPostHidden`) flips the `hidden` flag. Hidden posts leave the public feed (`getFeed` keys on
  `hidden === false`) but stay in the author's My Posts (so they can unhide). Un‑hiding a soft‑deleted post is rejected.
- **Delete** (`deletePost`) is a **soft delete**: it stamps `deletedAt` and sets `hidden: true`. The post disappears
  from the feed **and** from My Posts (`getMyPosts` filters `deletedAt === undefined`), but the row is intentionally
  **kept**. Idempotent.

**Invariant — neither operation changes the weekly post count.** The rolling 7‑day count (`countPostsSince`, and the
atomic check in `upsertPost`) counts **every** `posts` row in the window regardless of `hidden`/`deletedAt`, so keeping
the row means hiding or deleting a post never frees up a posting slot. A hard delete is the only thing that would break
this, which is why delete is soft. On account deletion the privacy cascade still purges these rows by `authorId` (they
are not exempt).

### Apify sync + queue pipeline

The daily cron calls `jobs/syncPosts.syncAllPosts`, which is **just a router**: it does nothing unless
`appSettings.apifySyncEnabled` is true, in which case it delegates to
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

> Because `getActiveSubscribers` returns only `active` users, the Apify path's `hidden` is
> effectively always `false` on the cron. `submitPost` sets `hidden` via `postCreatedHidden`: carded
> members (trialing/active) post visibly (Plan 2B), while a no-card member (`none`/`past_due`) — e.g. a
> new member’s onboarding first post — is created hidden and revealed when they add a card.

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

| Function                                    | Kind              | Purpose                                                                                                             |
|---------------------------------------------|-------------------|---------------------------------------------------------------------------------------------------------------------|
| `posts.submitPost`                          | action (public)   | Manual submission (above).                                                                                          |
| `posts.getMyPosts`                          | query (public)    | Author's posts incl. hidden, **excl. soft‑deleted**, sorted by `publishedAt` desc (bounded to the 500 most‑recent). |
| `posts.setPostHidden`                       | mutation (public) | Hide/unhide a post (author or admin via `canModifyPost`). Doesn't change the weekly count.                          |
| `posts.deletePost`                          | mutation (public) | Soft‑delete a post (author or admin). Row kept → weekly count unchanged. Idempotent.                                |
| `posts.getWeeklyUsage`                      | query (public)    | `{ postsThisWeek, postsPerWeek }` over the same rolling 7‑day window submitPost enforces.                           |
| `posts.countRecentPosts`                    | internalQuery     | Count posts since a timestamp (shared by enforcement + usage pill).                                                 |
| `jobs/syncPosts.upsertPost`                 | internalMutation  | Insert/update gatekeeper with atomic weekly‑limit + optional queueing.                                              |
| `jobs/syncPosts.syncAllPosts`               | internalAction    | Cron router → Apify (if enabled).                                                                                   |
| `jobs/syncPostsApify.syncUserPostsViaApify` | internalAction    | Scrape one user's recent posts via Apify REST.                                                                      |
| `jobs/syncPostsApify.syncAllPostsViaApify`  | internalAction    | Fan‑out over active subscribers; records sync status.                                                               |
| `jobs/processQueue.processPostQueue`        | internalMutation  | Drain overflow queue when capacity opens.                                                                           |

---

## 11. Feed & Engagement

### Feed resolution (`feed.getFeed`, query)

Args: `paginationOpts` (Convex cursor pagination), `sessionToken`, `filterIndustries?`,
`filterCountries?`. Returns a `PaginationResult` — `{ page: enriched[], isDone, continueCursor }`
(posts include a **token‑stripped** author projection). The client consumes it via
`usePaginatedQuery` in `FeedPage.tsx`.

The viewer's tier sets the filter via `buildFeedFilter`:

- **starter:** no filters.
- **growth:** auto‑filter to the viewer's **own** `industry` + `country`.
- **pro / contact:** filter by the **caller‑supplied** `filterIndustries` / `filterCountries`
  (applied only when non‑empty).

```mermaid
flowchart TD
  G["getFeed(paginationOpts, sessionToken, filters)"] --> AU{"valid session?"}
  AU -->|no| EMPTY["return empty page { page: [], isDone: true, continueCursor: '' }"]
  AU -->|yes| BASE["paginate posts by_feed_rank(inFeed=true) desc — one page"]
  BASE --> AUTHF["fetch this page's authors (≤ numItems)"]
  AUTHF --> F2["post visibility: visibilityIndustries/Countries must include viewer's"]
  F2 --> F3["viewer industry filter (growth/pro)"]
  F3 --> F4["viewer country filter (pro)"]
  F4 --> F5["drop posts whose author is pending deletion"]
  F5 --> ENR["enrich page with author (strip tokens)"]
  ENR --> RET["return { ...result, page: enriched } — cursor preserved"]
```

> `getFeed` walks the `by_feed_rank` index with `.paginate()`: `inFeed === true` pre-encodes the
> hidden / interaction-limit / soft-delete filters, and descending `feedRank` (featured → author
> tier → recency, see [`lib/feedRank.ts`](../convex/lib/feedRank.ts)) **is** the sort — so each call
> reads only one page and applies just the viewer-/author-dependent filters in memory. The denormalized
> fields are kept in sync by every post writer (`computeFeedFields`). Heavy viewer filters can yield
> short pages; the client's **Load more** (`usePaginatedQuery`) requests the next page. Design + rollout:
> [feed-cursor-pagination-plan.md](./feed-cursor-pagination-plan.md).

**Feed eligibility and the trial (Plan 2B).** The pure `isAuthorFeedEligible(author, now)` helper (`feed.ts`)
excludes authors with `deletionScheduledAt` set, and drops a **canceled** author once their paid period ends:
`subscriptionStatus === 'canceled'` stays eligible only while `now < subscriptionEndsAt` (the paid‑through instant
stamped by `cancelUserSubscription`); a missing/elapsed `subscriptionEndsAt` → not eligible. This is the sole feed
effect of a cancellation — the member keeps full engage access (see Card gate below). Everyone else (trialing / active)
is eligible. Trialing authors are **not** excluded: because trialing users must have a card on file (the trial is a real
Stripe subscription for the chosen tier — see §8), their posts belong in the feed as a reciprocity incentive. The gate
is applied at query time in both `getFeed` and `search` (which already load the page's authors), so no cron or post
mutation is needed. `submitPost` sets `hidden` via
`postCreatedHidden(user)` — visible for carded members, hidden for no-card members (`none`/`past_due`, e.g. a new
member's onboarding first post). Existing hidden posts from before Plan 2B are not backfilled (pre-launch, no prod
data). The `syncUserSubscription` webhook un-hides the author's posts when they **gain a card**
(`unhideHidden: canEngage(status)`) — so a trial start (subscribe), not just an `active` transition, reveals it.

**Card gate on engagement.** `commentOnPost` and `reactToPost` call `assertCanEngage(user)` (from
`convex/lib/access.ts`) immediately after resolving the caller — `submitPost` does NOT: a no-card member may submit (the
post is created hidden via `postCreatedHidden`), only reactions/comments are card-gated. Engagement is granted for
`subscriptionStatus ∈ {trialing, active, canceled}` — **cancellation never revokes access**; only `none` (never
subscribed) and `past_due` (failed payment) receive a `PAYMENT_REQUIRED` error. Admins (`isAdmin`) always bypass the
gate. The frontend mirror `useCardGate()` (`app/src/hooks/useCardGate.ts`) uses the same status set and must stay in
sync. The in-app UI for this gate (disabled buttons, progress bar, CTA) is **Plan 2C, deferred to after the app/ UI
revamp**.

### Sort priority (effective order)

1. **Featured** posts first (newest first).
2. Then by **author tier rank** desc (contact → pro → growth → starter).
3. Then by **`publishedAt`** desc (newest first).

### Interactions (comment / react)

Both are **actions**, but they **no longer call LinkedIn** — LinkedIn exposes no member API to react/comment on another
member's post. Engagement is a **client‑side handoff**: the client opens the post on LinkedIn. For comments it first
writes the AI draft to the clipboard, confirming with a toast (`ui/toast.tsx`) **only once the copy succeeds**; the
button **spinner** + toast then stay on screen for a ~1.5s beat (`HANDOFF_DELAY_MS`) — the app keeps focus so they're
visible — **after which**
`openLinkedIn` (`lib/handoff.ts`) opens the post (`buildPostUrl` → stored `sourceUrl`, else a reconstructed
`/feed/update/<urn>/` permalink) in a new tab, falling back to same-tab if the browser blocks the deferred popup. The
user performs the real action there. The action then **counts it optimistically** (per the product decision to count on
tap): gate, rate‑limit, increment the local count (which may flip `interactionLimitReached`), and append a per‑user row
to **`userInteractions`** (best‑effort — a logging failure never fails the action) for the DSR export (§13B).
**Reactions are deduped**: `incrementLikeCount` sets `userPostState.reactedAt` on the first reaction and no-ops on
repeats (no count, billing, or log) — a member holds at most one reaction per post. The AI **comment draft** is saved to
`userPostState.commentDraft` on generate and reloaded into `CommentBox` on open (reuse or regenerate). Counts propagate
to all viewers in real time via Convex reactivity. The interaction‑limit flip decision is the pure helper
`lib/interactionLimit.ts`
`shouldFlipInteractionLimit(likeCount, commentCount, interactionsPerPost, alreadyReached)`.

| Action                                             | Validation                                                                 | Rate limit | Effect (no LinkedIn call)                      |
|----------------------------------------------------|----------------------------------------------------------------------------|------------|------------------------------------------------|
| `commentOnPost(postId, commentText, sessionToken)` | text ≤ 3000 chars                                                          | 20/hour    | count comment + append `userInteractions` row  |
| `reactToPost(postId, reactionType, sessionToken)`  | `reactionType ∈ {LIKE,PRAISE,EMPATHY,INTEREST,APPRECIATION,ENTERTAINMENT}` | 30/hour    | count reaction + append `userInteractions` row |

> The feed's reaction control is a **single button** that *displays* the AI‑suggested reaction
> (`posts.suggestedReaction`, default `LIKE`) + count as a visual cue (reaction name in its tooltip)
> — see [§11A](#11a-ai-reaction--comment-assistance). There is **no in‑app reaction picker**: the deep
> link can't carry a chosen reaction type, so clicking just opens the post on LinkedIn and records the
> suggested type as a best guess. `reactionType` still uses LinkedIn's enum values (Like/Celebrate/
> Love/Insightful/Support/Funny), so a future API integration needs no remap.

```mermaid
sequenceDiagram
  participant A as App (PostCard/CommentBox)
  participant LI as LinkedIn (new tab)
  participant I as interactions.* (action)
  participant RL as rateLimit
  participant DB as Convex DB

  A->>LI: window.open(post permalink) + copy draft to clipboard (comment)
  A->>I: commentOnPost / reactToPost (postId, …, sessionToken)
  I->>I: requireAuthAction + assertCanEngage (card gate)
  I->>RL: checkAndIncrement(userId, action, maxPerHour)
  RL-->>I: ok (or throw 'Rate limit exceeded')
  I->>DB: getPost + increment count → maybe set interactionLimitReached
  I->>DB: recordInteraction (best-effort)
  I-->>A: { success: true }  (reactive feed updates everywhere)
  Note over A,LI: user performs the real reaction/comment on LinkedIn
```

### Rate limiting (`lib/rateLimit.ts`)

A **fixed window** keyed on `(userId, action)`: `WINDOW_MS = 3,600,000` (1h). On each call it reads the current window
row; if `windowStart` is older than the window it resets, otherwise it increments and throws once `count` reaches the
limit (`maxPerWindow`). (The header comment says "sliding window" but the implementation is fixed‑window.)
`checkRateLimit` now accepts an optional `windowMs` + `windowLabel`
(defaults to 1h / "hour") so callers can specify non-hourly windows. Limits: `submitPost` 10/h,
`commentOnPost` 20/h, `reactToPost` 30/h, `generateComment` 30/h, `profile_refresh` 2/day. The `profile_refresh` budget
is **shared** by the manual Refresh button and the auto-scrape on identifier change; the latter uses the non-throwing
`tryConsumeRateLimit` so an exhausted budget never blocks saving the identifier. **Admins (`user.isAdmin`) bypass the
rate limit on `commentOnPost`, `reactToPost`, `generateComment`, and `profile_refresh`** — those call sites
unconditionally skip the check for admins. **`submitPost` is the exception:** its rate‑limit, weekly‑limit, and
ownership bypass apply **only under the dev‑gated admin override** (`ALLOW_ADMIN_SHARE_ANY_POST` — see
[§10 — Manual post submission](#manual-post-submission-postssubmitpost-action)). In production that var is unset, so an
admin submits posts under exactly the same limits as everyone else.

---

## 11A. AI Reaction & Comment Assistance

OpenRouter (OpenAI-compatible) powers two assists: (1) predicting each submitted post's most-likely reaction, and (2)
drafting comments on demand. The model is Google's open **Gemma**
(`google/gemma-4-26b-a4b-it`), served via OpenRouter's privacy-constrained provider routing. All calls go through one
seam —
`convex/ai/openrouter.ts` `callOpenRouter(messages, { action })` — which mirrors `linkedin/client.ts`
(auth + log-real-error→throw-sanitized). The prompts are **multimodal**: the post's images (`posts.imageUrls`, the
image-typed media captured at submit) + the linked article's images are attached as vision input, and the **full article
body** (`posts.article.text`) is sent as text — so the model must be **vision-capable** (`OPENROUTER_MODEL` must point
at a multimodal model). Non-image media (documents/links)
are listed as text context, not attached.

> **Compliance — AI inference runs via OpenRouter with zero data retention (dynamic provider routing).**
> `OPENROUTER_API_KEY` enables the AI features (unset ⇒ reactions no-op to `LIKE`, Generate reports "AI
> unavailable"). The seam (`convex/ai/openrouter.ts`) constrains routing **in code** to providers that honour
> **zero data retention** (`zdr: true`) and **no data collection / no training** (`data_collection: "deny"`) —
> not env-overridable — and OpenRouter picks the cheapest qualifying provider (`:floor`). The model is Google's
> open **Gemma** (`google/gemma-4-26b-a4b-it`). **OpenRouter** (US) is the named sub-processor; the **downstream
> inference provider (e.g. DeepInfra) and its region are selected per request, not pinned** — so region is not
> guaranteed and the controller relies on OpenRouter's DPA flowing down to its providers. Documented in
> `docs/compliance/`: ROPA **Activity 13** (`DATA-INVENTORY.md`), the **OpenRouter** rows in `SUBPROCESSORS.md`,
> **item 10** in `GAP-ASSESSMENT.md`, and the public `/privacy` disclosure. **Human/legal before go-live:**
> execute OpenRouter's DPA, confirm ZDR/no-training flows down to its providers, and assess the transfer
> position given the non-pinned region (add region constraints if needed).

### Reaction prediction (async, best-effort)

`posts.submitPost`, after the upsert, schedules `internal.ai.reactions.predictReaction` — submit returns immediately;
OpenRouter latency/cost/failure never touch it. The prediction reads the post, builds the reaction prompt (content +
article), calls OpenRouter, coerces the reply with `parseReaction` (whole-word match against the 6-enum allow-list,
**default `LIKE`**), and patches `posts.suggestedReaction`. Any failure is swallowed (logged) — the post keeps the
default `LIKE`. Only manual submits predict (that's where `article` context exists); synced/legacy posts default to
`LIKE`.

```mermaid
sequenceDiagram
  participant U as User
  participant SP as posts.submitPost (action)
  participant DB as Convex DB
  participant PR as ai.reactions.predictReaction (scheduled)
  participant DS as OpenRouter
  U->>SP: submit URL
  SP->>DB: upsertPost → postId (suggestedReaction absent ⇒ LIKE)
  SP->>PR: scheduler.runAfter(0, { postId })
  SP-->>U: { postId } (returns immediately)
  PR->>DB: getPost
  PR->>DS: buildReactionPrompt → keyword
  DS-->>PR: e.g. "PRAISE"
  PR->>DB: patch suggestedReaction (parseReaction, default LIKE)
  Note over DB,U: PostCard picker pre-selects it live via Convex reactivity
```

The feed's reaction control (`PostCard`) is a **picker** pre-selecting `suggestedReaction ?? 'LIKE'`; the viewer
confirms or changes before `reactToPost` sends the chosen reaction (§11).

### Comment drafting (on-demand)

`api.ai.comments.generateComment({ sessionToken, postId, language? })` → `{ comment }`. It auth-checks, rate-limits
(30/h, admins exempt), loads the post + the author's public name/headline (`internal.users.getPublicAuthor`), resolves
the language, builds the comment prompt (≤2 paragraphs, concise, no hashtags/@-mentions; article + media URLs included),
calls OpenRouter, and returns the draft. **Nothing is persisted** — comments are generated fresh per user per click
(identical reused text would trip LinkedIn spam detection). `CommentBox` prefills the textarea (Generate / Regenerate)
for the user to edit, then posts via the unchanged `commentOnPost`.

### Comment language

All **ISO 639-1** codes (`convex/lib/languages.ts`, codes-only + `Intl.DisplayNames`, mirroring
`profileOptions.ts`) plus an **`auto`** sentinel ("match the post"). Stored as `users.commentLanguage`
(`v.string()`, validated in the handler — same pattern as `country`/`industry`). The default chain is **per-comment
select → saved `commentLanguage` → `auto`**, all via the pure `resolveCommentLanguage`
(shared by the action and both selects). Settings has a default picker (`setCommentLanguage`); the comment box picker
overrides per-comment without writing back.

### Files

`convex/ai/{openrouter,prompts,reactions,comments}.ts`, `convex/lib/{reactions,languages}.ts`,
`posts.submitPost` (schedule hook), `interactions.reactToPost` (enum fix), `users.{setCommentLanguage,
getPublicAuthor}`, `getMe` (exposes `commentLanguage` via `toSafeMe`); frontend `PostCard` (picker),
`CommentBox` (draft + language), `SettingsPage` ("AI Comments"), i18n `reactions.*` / `comment.*`.

---

## 11B. Search & Command Palette

A ⌘K / Ctrl-K **command palette** searches posts and people and offers quick navigation actions. It replaces the former
non-functional top-bar search placeholder.

### Backend (`convex/search.ts`, `search` query)

- Two full-text **search indexes** on `convex/schema.ts`: `posts.search_content` (`searchField: 'content'`,
  `filterFields: ['inFeed']`) and `users.search_name` (`searchField: 'name'`).
- The `search` query takes `{ sessionToken, queryText }` and returns `{ posts, people }`. It **requires a valid
  session** (returns empty on missing/invalid token or a query under 2 chars).
- **Feed-parity visibility (security-critical):** post results reuse the exact same rules as `feed.getFeed` — the
  `search_content` index is pinned to `inFeed === true`, then per-viewer `visibilityIndustries` / `visibilityCountries`
  allow-lists and `isAuthorFeedEligible(author)` are applied. Search can never surface a post the feed would hide.
- **Safe projections:** posts expose only `{ _id, content, sourceUrl, author }` (author via `toFeedAuthor`); people via
  the pure allow-list `toSearchPerson` → `{ _id, name, headline, profilePictureUrl, linkedinPublicIdentifier }` — never
  tokens, email, admin/ban state, or other PII. `toSearchPerson` is unit-tested (`convex/search.test.ts`).

### Frontend (`app/src/components/shell/CommandPalette.tsx`)

- Reuses the `cmdk` wrapper in `app/src/components/ui/command.tsx` (`CommandDialog` + `Command` root). `AppShell` owns
  the open state and a global ⌘K/Ctrl-K keydown listener (`preventDefault` so it doesn't collide with browser find); the
  `TopBar` search button opens it via `onOpenSearch`.
- Input is debounced ~180ms; the Convex query runs reactively via `useQuery(..., 'skip')` and only fires at ≥2 chars.
  Idle (no query) shows **Quick actions** (nav items + toggle theme + sign out); typing shows **People** / **Posts**
  groups, or a localized "No results". `shouldFilter={false}` — results are already filtered server-side, so cmdk's
  substring filter must not re-hide full-text matches. Selecting a person/post opens their LinkedIn permalink in a new
  tab (the compliant embed → permalink handoff).
- Palette strings live under `shell.*` in `app/src/i18n/locales/{en,pt,es}.json`.

> Search indexes cannot be exercised under the project's no-`convex-test` convention — the `search` query is verified by
> a manual runtime smoke test; only the pure `toSearchPerson` projection is unit-tested.

---

## 12. Admin & Moderation

Admin is gated by the **`users.isAdmin`** boolean, which is **only settable by direct database edit** — no application
code writes it. Every admin function calls `assertAdmin(user)` after
`requireAuth`, throwing `'Forbidden: admin access required'` otherwise.

### Admin functions (`convex/admin.ts`)

| Function                                                                 | Kind     | Purpose                                                                                                                                                                 |
|--------------------------------------------------------------------------|----------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `checkIsAdmin`                                                           | query    | `true/false` (soft‑fails to `false`) — drives the client route guard.                                                                                                   |
| `getSettings`                                                            | query    | App settings (3 Apify flags + post‑sync & profile‑scrape last‑run status).                                                                                              |
| `toggleApifySync(enabled)`                                               | mutation | Master switch for the Apify post‑sync cron.                                                                                                                             |
| `toggleApifyEnabled(enabled)`                                            | mutation | Master Apify kill-switch.                                                                                                                                               |
| `toggleApifyProfileScrape(enabled)`                                      | mutation | Toggle the LinkedIn profile scrape.                                                                                                                                     |
| `syncAllPosts`                                                           | mutation | **Manual trigger** → schedule a post sync for all active subscribers. Throws if post sync is disabled. See [Manual Apify sync triggers](#manual-apify-sync-triggers).   |
| `syncUserPosts(userId)`                                                  | mutation | **Manual trigger** → schedule a post sync for one user. Throws if disabled or the user has no LinkedIn URL.                                                             |
| `syncAllProfiles`                                                        | mutation | **Manual trigger** → schedule a profile scrape for all users with a LinkedIn URL. Throws if profile scrape is disabled.                                                 |
| `syncUserProfile(userId)`                                                | mutation | **Manual trigger** → schedule a profile scrape for one user. Throws if disabled or the user has no LinkedIn URL.                                                        |
| `listUsers`                                                              | query    | Up to 1000 users (newest first), **without** tokens/Stripe IDs; includes the public `linkedinPublicIdentifier` slug so the Users tab can gate the per‑row sync actions. |
| `setUserTier(userId, tier)`                                              | mutation | Change tier (any of the 4) from the Users tab; promoting to `contact` auto‑seeds a per‑user `planLimits` override from contact defaults.                                |
| `setUserSubscriptionStatus(userId, status)`                              | mutation | Admin override of `subscriptionStatus` (any of the 5) from the Users tab. Manual override; a later Stripe webhook can overwrite it.                                     |
| `listContactUsersWithLimits`                                             | query    | Every contact‑tier user (`by_tier`) with **effective** limits (override ?? contact default) + `hasOverride`. Powers the read‑only Plan Limits tab.                      |
| `listPlanLimits`                                                         | query    | All `planLimits` rows, enriched with `userName` for overrides. Also prefills the Users‑tab contact‑limits modal.                                                        |
| `updateTierDefault(tier, …)`                                             | mutation | Edit a tier's **default** row (filters out per‑user overrides). Backend‑only (no UI).                                                                                   |
| `setContactUserLimit(userId, …)`                                         | mutation | Upsert a contact per‑user override (validates ≥ 1; target must be contact tier). Edited from the Users tab.                                                             |
| `removeContactUserLimit(userId)`                                         | mutation | Delete a contact override (revert to tier default).                                                                                                                     |
| `banUser(userId, reason?)`                                               | mutation | Set ban fields. **Cannot self‑ban** (`assertNotSelfBan`) — guarantees ≥ 1 admin remains; banning _other_ admins is allowed.                                             |
| `unbanUser(userId)`                                                      | mutation | Clear all ban fields.                                                                                                                                                   |
| `getSettingsInternal` / `updateSyncStatus` / `updateProfileScrapeStatus` | internal | Used by the Apify jobs — read flags; record post‑sync / profile‑scrape last‑run + error.                                                                                |

`validateLimitArgs` enforces `interactionsPerPost ≥ 1` and `postsPerWeek ≥ 1`. `effectiveContactLimits`
(pure, unit‑tested) resolves a contact user's display limits as `override ?? contact default ?? hardcoded`.

### Manual Apify sync triggers

Four admin‑only mutations let an admin run a sync on demand instead of waiting for the daily cron. Each **respects the
same toggles the crons honor**: it schedules the (slow, paid) job and returns immediately, but only when its feature
flag (+ the master kill‑switch) is on — otherwise it throws
`"<feature> is disabled — enable it in Settings first."` The UI also gates each control, but the **server check is
authoritative** (a stale client or a direct API call still can't run a disabled integration). All four triggers share a
single `assertApifyTriggerEnabled` precondition (auth + admin assertion + flag check) so the server gate is defined once
in `admin.ts`.

| Trigger                   | Schedules                                           | Surface (admin panel)                               |
|---------------------------|-----------------------------------------------------|-----------------------------------------------------|
| `syncAllPosts`            | `jobs/syncPosts.syncAllPosts` (post‑sync router)    | "Sync all now" on the **Apify Post Sync** card      |
| `syncUserPosts(userId)`   | `jobs/syncPostsApify.syncUserPostsViaApify`         | "Sync posts" in the **Users**‑tab row menu          |
| `syncAllProfiles`         | `jobs/scrapeProfileApify.scrapeAllProfilesViaApify` | "Sync all now" on the **Apify Profile Scrape** card |
| `syncUserProfile(userId)` | `jobs/scrapeProfileApify.scrapeUserProfile`         | "Sync profile" in the **Users**‑tab row menu        |

The per‑user triggers additionally require the target to have a `linkedinPublicIdentifier`
(otherwise the menu item is disabled and the server throws). Outcome is observable via each card's
`Last sync` / `Last profile sync` line (and the user's data updating reactively) — there is no per‑item progress view.
Because these are flag‑gated, they do **not** by themselves "switch Apify on" — only the toggles do, and doing so in
production triggers the compliance hard gate (see [§13B](#13b-privacy--compliance)).

### Ban model — **reactive, not a forced logout**

`banUser` **only patches the user row** (`isBanned/bannedAt/bannedBy/bannedReason`). It does **not**
delete sessions. Enforcement is:

1. **Server:** the next `requireAuth`/`requireAuthAction` calls `assertNotBanned` → throws
   `'Account suspended'` (blocks all protected mutations/actions).
2. **Client:** Convex's reactive `getMe` query (which uses `resolveSession`, not `requireAuth`, so it still returns the
   user with `isBanned: true`) pushes the flag to any open tab → `RequireAuth`
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

## 12A. Feedback

Authenticated users submit free-text feedback (≤4000 chars) tagged with a single category via a floating button
(bottom-right of every authenticated page). Admins read and reply by email from the **Feedback** tab in the admin panel.
Each feedback item can receive **multiple admin replies** stored as a thread in the `feedbackResponses` table.

**Data:**

- `feedback` table — `userId?` (submitter; cleared on account deletion), `category` (one of
  `feature_request | bug | comment | criticism | praise | question | suggestion | other`),
  `message`, `status` (`new | responded | archived`), `createdAt`. The legacy single-reply fields `responseText`,
  `respondedAt`, `respondedBy` are retained as **optional/deprecated**
  (no longer written; superseded by `feedbackResponses`). Indexes: `by_user`, `by_status`.

- `feedbackResponses` table — append-only reply log; each row is one admin reply.
  `feedbackId` (FK → `feedback`), `responderId` (FK → `users`, the admin who replied),
  `text` (reply text), `createdAt` (ms). Index: `by_feedback [feedbackId, createdAt]`
  (chronological per item). A `backfillFeedbackResponses` internal mutation migrates any existing single-reply rows from
  the legacy fields — run once from the Convex dashboard after deploying.

**Backend** (`convex/feedback/`):

- `feedback.ts` — `submitFeedback` (user; validates, throttles **10/hour**, admins exempt),
  `listFeedback` (admin; newest-first, enriched with submitter name/email and full reply thread from
  `feedbackResponses`), `respondToFeedback` (admin; inserts a new
  `feedbackResponses` row, patches `status=responded`, writes a `feedback.responded` audit log, schedules the email if
  `sendEmail=true`), `archiveFeedback` / `reopenFeedback`, and the internal `getReplyData` + `sendFeedbackReply` action
  (keyed by `responseId`).
  `backfillFeedbackResponses` (internalMutation — one-time operator migration).
- `emails.ts` — `feedbackReplyEmail` builder (HTML-escapes user/admin text).
- Replies use `lib/email.ts:sendEmail` with `Reply-To` = `FEEDBACK_REPLY_TO` so users reply to a human inbox. The admin
  chooses **per reply** whether to send an email (`sendEmail`
  boolean arg to `respondToFeedback`).

**Frontend** (`app/src/components/`): `FeedbackButton` + `FeedbackModal` (user, i18n en/pt/es); `FeedbackTab` +
`RespondFeedbackModal` (admin, English). Respond is disabled when the submitter has no email on file.

**Privacy:** `feedback` rows are **anonymized, not deleted**, on account erasure (`cascadeDeleteUser` clears `userId`;
content retained). `feedbackResponses` rows are retained attached to the anonymized feedback after account deletion.
Both are included in the DSR export bundle (`gatherUserData` collects `feedbackResponses` for each of the user's
feedback items).

```mermaid
flowchart TD
  U[User clicks floating Feedback button] --> M[FeedbackModal: pick category + message ≤4000]
  M -->|submitFeedback| V{Valid & under 10/hour?}
  V -->|no| E[Error shown in modal]
  V -->|yes| DB[(feedback row · status=new)]
  A[Admin opens Feedback tab] --> L[listFeedback]
  L --> R[RespondFeedbackModal]
  R -->|respondToFeedback| P[insert feedbackResponses row · patch status=responded · audit log]
  P -->|sendEmail=true| S[schedule sendFeedbackReply by responseId]
  S -->|sendEmail · Reply-To=FEEDBACK_REPLY_TO| MAIL[(User receives email)]
  DEL[Account deletion cascade] -.anonymize.-> DB2[feedback.userId = undefined · content kept]
  DB2 -.responses retained.-> FR[(feedbackResponses rows kept)]
```

---

## 12B. Message of the Day (MOTD)

Admins author markdown announcements shown to authenticated users at the very top of the app. Default presentation is a
**dismissible top banner**; flagging a MOTD **important** escalates it to a **blocking modal** that closes only via an
OK button. Bodies are **per-locale markdown** (`en`
required as the fallback; others optional and extensible with no schema migration), with optional **start/expiry
scheduling**. Dismissal is **session-scoped** and re-shows on the next login.

**Data:** `motds` table (see [§5](#5-data-model)). The active MOTD is the newest `enabled` row whose
`[startAt, expiresAt)` window covers "now" — `selectActiveMotd` (pure, unit-tested).

**Backend** (`convex/motd/motd.ts`):

- `getActiveMotd` (viewer query) — `resolveSession`; returns `{ _id, bodies, important }` for the active MOTD or `null`
  (non-throwing). Reads `enabled=true` newest-first via `by_enabled_and_created`, then `selectActiveMotd`.
- `listMotds` (admin) — all MOTDs newest-first, bounded `take(200)`.
- `createMotd` / `updateMotd` / `deleteMotd` / `toggleMotdEnabled` (admin) — `requireAuth` +
  `assertAdmin`. Writes go through the pure `validateMotdInput` (trims bodies, drops empty locales, requires `en`, caps
  each body at 5000 chars, requires `expiresAt > startAt`). No audit log — admin content, not a personal-data action.

**Frontend** (`app/src/components/`):

- `MarkdownView` — shared safe renderer (`react-markdown` + `remark-gfm`, no raw HTML; links open in a new tab;
  dangerous URL protocols stripped).
- `Motd` — subscribes to `getActiveMotd`, resolves the body for the active language (`bodies[lang] ?? bodies.en`),
  renders the banner or (when `important`) the blocking `Modal`
  (`dismissOnBackdrop={false}`, `dismissOnEscape={false}`, OK button). Mounted in `RequireAuth`
  above `AppShell`. New i18n keys: `motd.dismiss`, `motd.ok` (en/pt/es).
- `MotdTab` — admin authoring (list + create/edit form with per-locale textareas, important/enabled toggles, optional
  `datetime-local` start/expiry, live `MarkdownView` preview). Added as the **MOTD** tab in `AdminPage` (admin chrome is
  English-only, like the other admin tabs).

**Dismissal & re-login mechanic:** dismissal is stored in `sessionStorage` under `motdDismissed` as
`{ token, motdId }`. The MOTD is hidden only when both the stored token equals the current
`sessionToken` **and** the stored `motdId` equals the active MOTD's id. A page reload keeps the same token (stays
dismissed); a re-login rotates the token via `AuthSuccessPage` (stored token no longer matches → re-shows); a newly
published MOTD has a new id → re-shows even mid-session.

```mermaid
flowchart TD
  A[Admin: MOTD tab] -->|createMotd / updateMotd / toggleMotdEnabled| DB[(motds table)]
  V[Authenticated user loads app] --> Q[getActiveMotd]
  Q --> SEL{selectActiveMotd: newest enabled in date window?}
  SEL -->|none| NONE[Render nothing]
  SEL -->|found| D{sessionStorage motdDismissed matches token + motdId?}
  D -->|yes| NONE
  D -->|no| I{important?}
  I -->|no| BANNER[Top banner · ✕ dismiss]
  I -->|yes| MODAL[Blocking modal · OK dismiss]
  BANNER -->|dismiss| W[Write motdDismissed = token + motdId]
  MODAL -->|dismiss| W
  RELOGIN[Re-login rotates sessionToken] -.stored token no longer matches.-> SEL
```

---

## 13. Scheduled Jobs (Crons)

`convex/crons.ts` is the **only** file Convex reads for scheduled work. The two post‑sync jobs run at fixed wall‑clock
times in UTC (`crons.cron`); the session/OAuth cleanup, account‑deletion, and retention jobs run on fixed intervals from
deploy time (`crons.interval`).

| Cron name                      | Schedule            | Target                                     | Effect                                                                                                                                                                                                                                                                     |
|--------------------------------|---------------------|--------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `sync LinkedIn posts`          | daily **03:00 UTC** | `jobs/syncPosts.syncAllPosts`              | Apify sync **iff** `apifySyncEnabled` (else no‑op).                                                                                                                                                                                                                        |
| `process post queue`           | daily **04:00 UTC** | `jobs/processQueue.processPostQueue`       | Promote queued posts when authors regain weekly capacity.                                                                                                                                                                                                                  |
| `cleanup expired sessions`     | every **6h**        | `sessions.deleteExpiredSessions`           | Purge expired sessions (≤ 200/run).                                                                                                                                                                                                                                        |
| `cleanup expired oauth states` | every **1h**        | `sessions.deleteExpiredOAuthStates`        | Purge expired CSRF nonces (≤ 200/run).                                                                                                                                                                                                                                     |
| `process account deletions`    | every **24h**       | `privacy/deletion.processAccountDeletions` | Hard-delete accounts past their 30-day deletion grace window (cascade + Stripe cancel + completion email). Reads due accounts via `by_deletion_and_last_login`; processes **one account per run** in bounded cascade passes, self-rescheduling until the due-set is empty. |
| `enforce data retention`       | every **24h**       | `privacy/retention.enforceDataRetention`   | Null expired LinkedIn tokens; expire/purge old export files + audit logs (>24mo); flag dormant accounts (24mo, non-subscribers) for deletion. Indexed reads; batched, self-rescheduling on the token/audit sweeps.                                                         |

---

## 13A. Profile Enrichment (LinkedIn Profile Scrape)

A dedicated Apify actor (`APIFY_TASK_ID_PROFILE_SCRAPE`) enriches a user with `country` **and
`headline`** (fill-when-empty), `location`, and `primaryLocale`. Industry is **not** scraped (absent from the payload) —
it's user-edited in Settings. The scrape is **triggered**, not cron-scheduled:

- on `users.setDerivedPublicIdentifier` — when a name‑verified post's author URL first **auto‑derives** the vanity
  (set‑once), the scrape fires if it is **enabled** and the shared 2/day budget allows it (charged on the same
  `profile_refresh` counter as the button — and the flag is checked _before_ the budget, so a disabled scrape never
  charges it), and
- on the user-pressed **"Refresh from LinkedIn"** button (`refreshProfileFromLinkedIn`, ≤ 2/day), and
- on the **post sync** (`syncUserPostsViaApify` — subscription activation + hourly cron) **when the user has no
  `country` yet**, which bounds the (paid) scrape to ~once per user even though posts sync repeatedly.
- on an **admin manual trigger** — `admin.syncUserProfile(userId)` for one user, or
  `admin.syncAllProfiles`, which fans out via `jobs/scrapeProfileApify.scrapeAllProfilesViaApify`
  over every user with a `linkedinPublicIdentifier`. Both are flag‑gated; see
  [§12](#12-admin--moderation).

These triggers all schedule the internal action `jobs/scrapeProfileApify.scrapeUserProfile`, which bails if the Apify
env vars (`APIFY_API_TOKEN`/`APIFY_TASK_ID_PROFILE_SCRAPE`) are unset, or unless
`apifyEnabled && apifyProfileScrapeEnabled` (gate helpers in `lib/apify.ts`). It calls the Apify actor, parses
`location.countryCode` → `country`, `location.linkedinText` → `location`,
`primaryLocale.language` → `primaryLocale`, and the dataset `headline` → `headline`
(fill-when-empty), and writes via `users.applyScrapedProfile` (country and headline only if the user has none;
location/locale always refresh). Results propagate to Settings via the reactive `getMe`, which also seeds the UI
language once.

The **headline** has two sources: the **dev-only** Apify scrape (fill-when-empty) and the **user-editable Settings
field** (`users.updateProfile`, always wins). In production the Settings field is the only live source — the Apify
scrape is a local-dev testing tool (the
`appSettings.apifyProfileScrapeEnabled` flag is a dev/prod switch). The UI shows `headline ??
industry`.

```mermaid
flowchart TD
  T1["setDerivedPublicIdentifier (vanity auto-derived from verified post)"] --> CHG{"changed & scrape enabled & within 2/day budget?"}
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
  API --> PARSE["parseProfileScrapeResult -> {country?, location?, primaryLocale?, headline?}"]
  PARSE --> APPLY["applyScrapedProfile: country + headline fill-when-empty; location/locale refresh"]
  APPLY --> REACT["reactive getMe -> Settings updates + i18n seed"]
```

---

## 13B. Privacy & Compliance

> Implements the design spec `docs/superpowers/specs/2026-06-15-privacy-compliance-design.md`.
> **Phase 1 (Foundations)** is in place; later phases (DSR export/deletion, consent & retention,
> data minimization & retention, and legal/transparency artifacts) extend this section.

### Foundations (Phase 1)

- **Email capture.** `linkedin/auth.upsertUser` now stores `email`/`emailVerified` from the OIDC userinfo (previously
  fetched and discarded) and forwards the address to Stripe (`billing.ts`
  `getOrCreateCustomer`). Email is stored under legitimate interest / legal obligation — a contact channel for
  data‑subject rights and breach notification — **not** marketing consent.
- **Login + policy stamping.** `upsertUser` sets `lastLoginAt` on every login and stamps new users with the current
  `POLICY_VERSION` (`lib/policy.ts`) in `acknowledgedPolicyVersion`, so newly created accounts are never immediately
  re‑prompted to re‑accept the policy.
- **New tables** (see [§5](#5-data-model)): `consentRecords` (append‑only consent log),
  `dataExportRequests` (asynchronous Subject‑Access‑Request jobs), `auditLogs` (accountability —
  `lib/audit.ts` exposes `writeAuditLog` for in‑mutation use and the `logAudit` internal mutation for actions).
- **Transactional email.** `lib/email.ts` wraps Resend via `sendEmail` and **no‑ops when
  `RESEND_API_KEY`/`EMAIL_FROM` are unset**, so privacy flows never fail merely because email is not configured.
  See [§16](#16-environment-variables).
- **Apify stays disabled at launch.** The LinkedIn scrape (post sync + profile enrichment) remains **off in production**
  (kill‑switches in `appSettings`; `APIFY_*` env vars unset). It is therefore **not** disclosed as a processing
  activity. **Hard gate:** the day Apify is switched on in production, the privacy‑policy disclosure, the legal basis,
  and a sub‑processor entry must be added in the same change.

### Data-Subject Rights (Phase 2a)

Backend for self-service **access/portability** and **erasure**. Both resolve identity with
`resolveSession` (NOT `requireAuth`) so a **banned user can still exercise their rights**.

**Data export (right of access / portability)** — `convex/privacy/export.ts`:

- `requestDataExport` (mutation, rate-limited 1/day) inserts a `dataExportRequests` row and schedules
  `generateExport`.
- `generateExport` (action) gathers the user's own rows (`gatherUserData`), assembles a JSON bundle via the pure
  `buildExportBundle` — which **strips token secrets** and **redacts other actors** from audit entries — stores it in
  Convex file storage, marks the row `ready` with a **7-day** `expiresAt`, and emails the user (`exportReadyEmail`).
- `getExportStatus` / `getExportDownloadUrl` return the status and a short-lived **owner-only** download URL
  (`ctx.storage.getUrl`); expired links return null.

**Account deletion (right to erasure)** — `convex/privacy/deletion.ts`:

- `requestAccountDeletion` (mutation, idempotent) sets `deletionRequestedAt` + `deletionScheduledAt`
  (+30 days) + `deletionReason='user_request'`, **revokes all sessions**, audits, and schedules
  `onDeletionRequested` (cancels the user's Stripe subscriptions immediately via the Stripe SDK — stop billing during
  grace — and sends `deletionScheduledEmail`).
- The shared feed **excludes pending-deletion authors** via the pure `isAuthorFeedEligible` helper (`feed.ts`) — their
  posts disappear immediately and **reappear automatically on cancel**, with no post mutation.
- `cancelAccountDeletion` clears the deletion fields (the user must re-subscribe for paid features).
- `processAccountDeletions` (daily cron) erases accounts past their grace window, **one account per invocation**. The
  pure `cascadeDeleteUser` deletes up to a bounded batch of rows **per table per pass** — every owned row (posts,
  postQueue, subscriptions, sessions, rateLimits, featuredPostUsage, planLimits, consentRecords, dataExportRequests +
  their storage files) — and **pseudonymizes
  `auditLogs`** (nulls `targetUserId`/`actorId`, keeps action/metadata). The `users` row is deleted **last**, so a
  half-drained account stays "due" and the cron re-selects it until every table is clear — keeping each pass within one
  transaction's budget even for an author with an unbounded number of posts. On the final pass it writes an
  `account.deleted` system audit entry, then emails
  `deletionCompletedEmail`. **Billing invoices are retained inside Stripe** for tax/accounting law.
- A schema-derived completeness test asserts the cascade covers every user-referencing table, so a future table cannot
  silently orphan personal data.

```mermaid
flowchart TD
  R["User: Delete my account"] --> REQ["requestAccountDeletion (resolveSession — banned OK)"]
  REQ --> S1["set deletionRequestedAt, deletionScheduledAt=+30d, reason=user_request"]
  REQ --> S2["revoke ALL sessions"]
  REQ --> SCH["schedule onDeletionRequested"]
  SCH --> ST["cancel Stripe subs (SDK) + deletion-scheduled email"]
  S1 --> FEED["feed excludes author via isAuthorFeedEligible (no post mutation)"]
  S1 --> GRACE{"within 30 days?"}
  GRACE -->|"re-auth (Phase 2b screen)"| CANCELSCR["cancelAccountDeletion"]
  CANCELSCR --> RESTORE["clear fields → feed auto-restores"]
  GRACE -->|"elapsed"| CRON["processAccountDeletions cron"]
  CRON --> CASCADE["cascadeDeleteUser (bounded passes, re-run until drained): delete owned rows + export files; pseudonymize auditLogs; delete user last"]
  CASCADE --> DONE["deletion-completed email; Stripe retains invoices"]
```

### Consent & Retention (Phase 3a)

Backend for **granular consent** recording, **re-consent** prompting, and automated **data retention/dormancy**
enforcement. The Phase 3b frontend — `ConsentToggles`, `PolicyUpdateScreen`,
`CookieNotice`, and the `/cookies` landing page — is documented in [§14](#14-frontend--authenticated-app-app)
and [§15](#15-frontend--landing-site-landing).

**Consent recording** — `convex/privacy/consent.ts`:

- `consentRecords` is **append-only** — individual purpose changes are each a new row, never an update, preserving a
  full audit trail.
- `recordConsent` (mutation, `resolveSession`) inserts a new `consentRecords` row for a given
  `purpose` + `granted` value, then writes an audit log entry.
- `getConsents` (query, `resolveSession`) returns the **latest record per purpose** for the current user via the pure
  helper `latestConsentByPurpose` (groups by purpose, keeps the most recent `_creationTime`).
- Purposes at launch: `marketing` and `analytics` — both **off by default** (no row = no consent; the pure helper
  returns `false` for absent purposes).

**One-time new-user consent prompt** — `convex/privacy/consent.ts`:

- `completeConsentPrompt` (mutation, `resolveSession`) is called once when a new user completes the first-login
  `ConsentPromptScreen`. It records both `marketing` and `analytics` consent choices (each as an append-only
  `consentRecords` row), stamps `users.consentPromptedAt` with the current timestamp, and writes a
  `consent.prompt_completed` audit log entry. An unset
  `consentPromptedAt` field is the signal that causes `RequireAuth` to show `ConsentPromptScreen`
  on the next login — see [§14](#14-frontend--authenticated-app-app).

**Re-consent / policy acknowledgement**:

- `acknowledgePolicy` (mutation, `resolveSession`) stamps `users.acknowledgedPolicyVersion` with the current
  `POLICY_VERSION` constant (from `lib/policy.ts`) and writes an audit log entry. This allows the backend to detect
  users who have not yet acknowledged an updated policy.
- `getMe` already exposes `acknowledgedPolicyVersion` (and `consentPromptedAt`) so the Phase 3b frontend can prompt
  re-acceptance or the one-time consent prompt without a separate query.

**Data retention & dormancy** — `convex/privacy/retention.ts`:

The `enforceDataRetention` cron (daily — see [§13](#13-scheduled-jobs-crons)) runs four sequential batched sweeps using
pure predicate helpers for testability. The token-expiry and dormancy sweeps read through indexes (`by_token_expiry`,
`by_deletion_and_last_login`) rather than scanning the whole `users` table, and each processed row leaves its index
range (token fields incl. `tokenExpiresAt` cleared; dormant rows gain `deletionScheduledAt`). The cron
**self-reschedules** (`runAfter(0)`) whenever the token or audit sweep fills its batch, so a large backlog drains across
runs; rescheduling keys only off those two strictly-draining sweeps to guarantee termination (the export and dormancy
sweeps make bounded progress per run):

| Sweep                 | Predicate                                                                                                     | Action                                                                                                           |
|-----------------------|---------------------------------------------------------------------------------------------------------------|------------------------------------------------------------------------------------------------------------------|
| LinkedIn token expiry | `isTokenExpired(user)` — `tokenExpiresAt` in the past                                                         | Nulls `linkedinAccessToken`, `linkedinRefreshToken`, `tokenExpiresAt`, `tokenScope` on the `users` row.          |
| Export file expiry    | `isExportExpired(req)` — status `ready` + `expiresAt` in the past                                             | Deletes the file from Convex storage, sets status → `expired`.                                                   |
| Audit log purge       | `isAuditExpired(log)` — older than ~24 months                                                                 | Deletes the `auditLogs` row entirely.                                                                            |
| Dormancy              | `isDormant(user)` — `lastLoginAt` (or `_creationTime`) >24 months ago **and** no active/trialing subscription | Sets `deletionScheduledAt` (+30 days from now) + `deletionReason='dormancy'` and sends a dormancy-warning email. |

The dormancy path **reuses the Phase 2a deletion cascade**: once `deletionScheduledAt` is set,
`processAccountDeletions` (the existing daily cron) handles the hard delete after the 30-day grace window. A dormant
user who re-logs in sees `CancelDeletionScreen` (same interstitial as a voluntary deletion request) and can cancel via
`cancelAccountDeletion` — no new UI needed.

```mermaid
flowchart TD
  CRON["enforceDataRetention (daily cron)"] --> TOK["Sweep 1: isTokenExpired?"]
  TOK -->|yes| NULLTOK["null LinkedIn token fields"]
  TOK -->|no| EXP
  NULLTOK --> EXP["Sweep 2: isExportExpired?"]
  EXP -->|yes| DELFILE["storage.delete + status=expired"]
  EXP -->|no| AUD
  DELFILE --> AUD["Sweep 3: isAuditExpired? (>24mo)"]
  AUD -->|yes| DELLOG["delete auditLogs row"]
  AUD -->|no| DORM
  DELLOG --> DORM["Sweep 4: isDormant? (>24mo inactive, no sub)"]
  DORM -->|yes| FLAG["set deletionScheduledAt=+30d, reason=dormancy + warning email"]
  DORM -->|no| END["done"]
  FLAG --> GRACE{"within 30d grace?"}
  GRACE -->|"re-login → CancelDeletionScreen"| CANCEL["cancelAccountDeletion → clear fields"]
  GRACE -->|"elapsed"| PDA["processAccountDeletions cron → cascadeDeleteUser"]
```

---

## 14A. Design System

The app (`app/`) uses a "warm premium" branded theme — the landing site's identity (gold, cream, ink-navy) expressed as
a calm working surface, in light (default) and dark.

- **Tokens:** semantic CSS variables in `app/src/index.css` (`:root` = light, `.dark` = dark), mapped to shadcn names
  via `@theme inline`. Components consume tokens only — no hardcoded palette colors.
- **Two-gold rule:** `--primary` (bright gold `#c9963e`) for fills/borders/focus/underlines;
  `--gold-text` (`#8a6418` light / `#e8c474` dark) for text, links, and small icons (bright gold fails WCAG on white).
  Note: gold used as text *on* the gold tint (active nav, Featured pill)
  uses the slightly darker `#7a5816` in light mode to pass WCAG AA.
- **Typography:** DM Sans (`--font-sans`, body/UI) + Cormorant Garamond (`--font-display`, page titles), both
  self-hosted via `@fontsource` (no Google CDN; `font-display: swap`). Numeric data uses `tabular-nums`.
- **Theme:** `app/src/lib/theme.ts` + `app/src/components/ThemeProvider.tsx` resolve light/dark/system. The choice is
  persisted to the cross-site `theme` cookie (source of truth)
  **and** mirrored in `localStorage` for speed/back-compat. Cookie read/write is handled by
  `app/src/lib/cookies.ts`. See [§14B](#14b-cross-site-theme--language-persistence) for the cross-site persistence
  architecture.
- **Primitives:** `app/src/components/ui/` (Button, Input, Badge, Avatar, Table) are shadcn-style (cva + `cn`);
  `app/src/components/PageHeader.tsx` provides the serif H1 + gold underline used by every screen.

---

## 14B. Cross-site Theme & Language Persistence

The authenticated app (`app/`) and the landing site (`landing/`) share user preferences via **cookies scoped to the
registrable parent domain** (`.linkintothessi.com` in production). This allows a user who toggled dark mode on the
landing to arrive in the app already in dark mode — and vice versa — without any server round-trip.

### Cookie specification

| Cookie  | Values                        | Domain scope                                                                                              | Path | SameSite | Max-Age |
|---------|-------------------------------|-----------------------------------------------------------------------------------------------------------|------|----------|---------|
| `theme` | `light` \| `dark` \| `system` | `VITE_COOKIE_DOMAIN` / `NEXT_PUBLIC_COOKIE_DOMAIN` (`.linkintothessi.com` prod; unset = host-only in dev) | `/`  | `Lax`    | ~1 year |
| `lang`  | `en` \| `pt` \| `es`          | same                                                                                                      | `/`  | `Lax`    | ~1 year |

**Dev behaviour:** when the domain env var is unset, the cookie is written without a `Domain`
attribute (host-only). Because dev runs `localhost:3000` (landing) vs `localhost:5174` (app), cookies are **not** shared
across origins in dev — cross-site sync is prod-only. Each site honours its own cookie in isolation.

### Source files

| Site    | File                                 | Responsibility                                                                                                                                                                        |
|---------|--------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| App     | `app/src/lib/cookies.ts`             | SSR-safe cookie read (`document.cookie` parse) + `serializeCookie` + `getCookie`/`setCookie`. Reads `VITE_COOKIE_DOMAIN`.                                                             |
| App     | `app/src/lib/theme.ts`               | `getStoredTheme`/`setStoredTheme` — reads cookie first, falls back to `localStorage` mirror; `applyTheme` sets `.dark` on `<html>`, `color-scheme` meta, `<meta name="theme-color">`. |
| App     | `app/src/i18n/index.ts`              | `cookie` detector added to i18next-browser-languagedetector detection order (before `localStorage`).                                                                                  |
| Landing | `landing/lib/cookies.ts`             | Same SSR-safe cookie I/O for Next.js. Reads `NEXT_PUBLIC_COOKIE_DOMAIN`.                                                                                                              |
| Landing | `landing/lib/theme.ts`               | `resolveTheme` / `applyTheme` + cookie get/set.                                                                                                                                       |
| Landing | `landing/app/layout.tsx`             | Inline no-flash `<script>` reads the `theme` cookie and applies `.dark` before React hydrates; sets `suppressHydrationWarning` on `<html>`.                                           |
| Landing | `landing/components/ThemeToggle.tsx` | `'use client'` 3-state toggle (system → light → dark → system); updates cookie + DOM immediately.                                                                                     |
| Landing | `landing/components/Nav.tsx`         | Mounts `<ThemeToggle>` in the nav bar.                                                                                                                                                |

### Theme resolution flow

```mermaid
flowchart TD
  A["Page load / toggle"] --> B{"theme cookie\npresent?"}
  B -->|yes| C["use cookie value\n(light | dark | system)"]
  B -->|no| D["check localStorage mirror\n(key 'theme')"]
  D -->|found| C
  D -->|not found| E["system default\n(prefers-color-scheme)"]
  C --> F{"resolved =\nsystem?"}
  E --> F
  F -->|yes| G["read prefers-color-scheme\nmedia query"]
  F -->|no| H["use resolved value\n(light or dark)"]
  G --> H
  H --> I["applyTheme:\ntoggle .dark on html\nset color-scheme\nset meta[theme-color]"]
  I --> J["write cookie + localStorage mirror"]
```

### Palette unification (landing → app)

The landing's Tailwind v4 migration (Plan 1 Phase B) replaced the previous dark-navy-only palette with a full light/dark
split that mirrors the app's design-system tokens:

| Landing token                   | Light     | Dark                         |
|---------------------------------|-----------|------------------------------|
| `--ink` (page bg)               | `#f2eee6` | `#0e1320`                    |
| `--cream` (body text)           | `#1c1813` | `#f5f0e8`                    |
| `--gold` (accent fill)          | `#c9963e` | `#d8a94e`                    |
| `--gold-text` (text on bg)      | `#8a6418` | `#e8c474`                    |
| `--lnblue`                      | `#0077b5` | `#0077b5` (constant — brand) |
| `--on-gold` (text on gold fill) | `#1c1813` | `#1c1813` (constant)         |

`@custom-variant dark (.dark)` in `landing/app/globals.css` flips every token block when `.dark`
is on the root element. `@theme inline` (not plain `@theme`) ensures opacity utilities like
`text-cream/50` stay reactive to the `.dark` override in dark mode.

---

## 14. Frontend — Authenticated App (`app/`)

React 19 + Vite 6 SPA. Dev server runs on **port 5174**. Convex reactivity via `convex/react`.

### Bootstrap (`main.tsx`)

Imports `./i18n` (side‑effect init) → `./index.css` → mounts
`<StrictMode><ConvexProvider client={new ConvexReactClient(VITE_CONVEX_URL)}><BrowserRouter><App/>`.
`index.html` ships a strict **CSP** meta tag allowing `frame-src https://www.linkedin.com` (post embeds) and
`connect-src` to `*.convex.cloud` (wss) + `*.stripe.com`.

### Routing & session handling (`App.tsx`)

Declarative `react-router-dom` routes. The session token lives in **`sessionStorage`** (key
`sessionToken`) — there's no React context/store; each page reads it directly.

| Path            | Page              |                               Guarded                               |
|-----------------|-------------------|:-------------------------------------------------------------------:|
| `/auth/success` | `AuthSuccessPage` | – (reads `#session=` hash → stores token + plan/interval → `/feed`) |
| `/feed`         | `FeedPage`        |                                 ✓                                  |
| `/my-posts`     | `MyPostsPage`     |                                 ✓                                  |
| `/settings`     | `SettingsPage`    |                                 ✓                                  |
| `/billing`      | `BillingPage`     |                                 ✓                                  |
| `/admin`        | `AdminPage`       |       ✓ (server‑gated via `checkIsAdmin`; not linked in nav)       |
| `/privacy-data` | `PrivacyDataPage` |                                 ✓                                  |
| `*`             | → `/feed`         |                                  –                                  |

`RequireAuth` calls `getMe`; the interception order is:

1. **loading** (`getMe` undefined) → `<LoadingSpinner>`
2. **`me === null`** → if the user explicitly signed out (`isSignedOut()` / persistent `localStorage.signedOut`) →
   redirect to the **landing site** (`VITE_LANDING_URL`, §7) so sign‑out sticks; otherwise hard‑redirect to
   `${VITE_CONVEX_SITE}/auth/linkedin` (auto‑OAuth; LinkedIn's SSO makes it a one‑hop login).
3. **`isBanned`** → `<BannedScreen>`
4. **`me.deletionScheduledAt` set** (account pending deletion, within grace window) → `<CancelDeletionScreen>`
5. **`me.acknowledgedPolicyVersion !== POLICY_VERSION`** (policy updated since last login) → `<PolicyUpdateScreen>`
6. **`!me.consentPromptedAt`** (new user who has not yet completed the one-time consent prompt) →
   `<ConsentPromptScreen>`
7. **`!me.firstPostPromptedAt`** (every new member, before billing — the submitted first post is created hidden for a
   no-card member and the screen funnels them to `/billing`; the post is revealed when they add a card) →
   `<FirstPostPromptScreen>`
8. **user ok** → `<AppShell>` (sidebar + top bar) + the requested page

```mermaid
flowchart TD
  L["index.html → main.tsx"] --> I["i18n init + ConvexProvider + Router"]
  I --> RT{"route guarded?"}
  RT -->|no e.g. /auth/success| LAND["read #session + plan + interval → store → /feed"]
  RT -->|yes| RA["RequireAuth: getMe(sessionToken)"]
  RA -->|undefined loading| SP["LoadingSpinner"]
  RA -->|null| OAUTH["window.location = VITE_CONVEX_SITE/auth/linkedin"]
  RA -->|isBanned| BAN["BannedScreen"]
  RA -->|deletionScheduledAt set| CDEL["CancelDeletionScreen"]
  RA -->|"acknowledgedPolicyVersion ≠ POLICY_VERSION"| RECON["PolicyUpdateScreen → acknowledgePolicy → reload"]
  RA -->|"!consentPromptedAt"| CONSENT["ConsentPromptScreen → completeConsentPrompt → reload"]
  RA -->|"!firstPostPromptedAt"| FIRSTPOST["FirstPostPromptScreen → submitPost (hidden if no card) → /billing · or dismiss → reload"]
  RA -->|user ok| SHELL["AppShell (Sidebar + TopBar) + page → page issues Convex queries"]
```

### Pages

- **AuthSuccessPage** — reads `#session`, `plan`, and `interval` from the URL hash (the OAuth callback appends them as
  hash parameters, e.g. `#session=UUID&plan=growth&interval=annual`); stores the session token in `sessionStorage` (key
  `sessionToken`); stores `plan` and `interval`
  in `sessionStorage` (keys `chosenPlan` / `chosenInterval`) when present; clears the persistent
  `signedOut` marker (§7); and navigates to `/feed`. No Convex calls.
- **FeedPage** — `getFeed`; a `PostComposer` (calls `submitPost`); a list of `PostCard`s, each rendering the post as a
  **LinkedIn embed** (Option B — see `PostCard` below; raw post text is not shown); reactions via `reactToPost`
  (hard‑coded `LIKE`); inline `CommentBox` toggled per card. Uses `useCardGate()` and passes the resulting `gated`
  boolean to every `<PostCard>`. The
  `react()` call is wrapped in try/catch: a `PAYMENT_REQUIRED` error surfaces an inline gate hint (previously the call
  failed silently).
- **MyPostsPage** — `getMe` + `getWeeklyUsage` + `getMyPosts` + `submitPost`. Usage pill ("N of M posts this week")
  turns **amber** at the cap and disables the composer (`atLimit`). Renders each post via the shared `LinkedInEmbed`
  with an app footer (stats, relative time, "View on LinkedIn").
- **SettingsPage** — `getMe` + `updateProfile` + `refreshProfileFromLinkedIn` + `setCommentLanguage` (the standalone
  LinkedIn‑identity section was **removed** — the auto‑derived vanity is internal‑only now, seeding Apify; the "Refresh
  from LinkedIn" button remains gated on it). Industry and country are **searchable, virtualized comboboxes**
  (`VirtualizedCombobox`, built on the shadcn `command`/`popover`
  primitives + `@tanstack/react-virtual`; country names via `Intl.DisplayNames`); a read-only **Location** row appears
  when `me.location` is present (populated by the profile scrape); a **"Refresh from LinkedIn"** button re-scrapes the
  profile (disabled without a public identifier; shows the server error inline when the scrape flag is off). Pro/contact
  see a **stubbed** "who can see your posts" card ("Coming in next task").
- **BillingPage** — `getMe` + `getSubscriptionInfo` + `createCheckoutSession` + `createPortalSession`
    + `api.users.getTrialProgress` (see §11 — query returns `{ made, received, combined, threshold,
  reached, status, trialEndsAt }`). Layout varies by subscription state:

  The **three-tier plan grid + Enterprise card is shown in every state** — no-card users are pushed toward Growth, not
  limited to it. Every plan card's CTA routes through `createCheckoutSession`, which applies the same card-required
  7-day trial to any valid price (the trial is plan-agnostic at the backend), so there is no separate
  "start trial" gate. Each plan card lists that tier's `features` as a ✓ bullet list (copy mirrored from the landing
  Pricing section's i18n, `billing.plans.<id>.features` in `app/src/i18n/locales/*`). The monthly/annual toggle applies
  in all states.

    - **No-card** (`none`/`canceled`/`past_due`): the plan grid is shown under a lead — **"Select a plan below — Growth
      is the best bang for your buck."** + a "every plan starts with a free 7-day trial · cancel anytime" note. The
      **Growth** card carries a **"Recommended"** badge and a highlighted border. No card is marked "current". The red
      **"Your subscription has ended"** banner is shown only for genuinely ended subscriptions (`canceled` or a trial
      that ran out) — brand-new users (`none`) never see it.
    - **Trialing** (`trialing`): the trial banner shows an **X / 50 interactions** progress meter (`progress.combined` /
      `progress.threshold`, with a simple bar), the "or 7 days" secondary count-down (`trialEndsAt`), and a **"View your
      SSI on LinkedIn" ↗** link-out (`https://linkedin.com/sales/ssi`, new tab). When the user acts on the **Starter**
      card, an inline "what you'll miss" block lists Growth advantages (industry-filtered feed, 50 vs 25
      interactions/post, 2 vs 1 posts/week).
    - **Active**: the current tier's card shows a "Current plan" badge; "Manage Subscription" → Stripe portal.
    - **Enterprise** card (all states) and the footer "Need more?" line both deep-link to
      `mailto:contact@linkintothessi.com`.
- **AdminPage** — `checkIsAdmin` (redirects non‑admins; server is the real gate). Four tabs:
  **Settings** (three Apify toggles: master kill-switch, post sync, and profile scrape + last‑sync status), **Plan
  Limits** (`PlanLimitsTab` — **read‑only**: tier defaults + every contact user's effective limits, with an "override"
  tag), **Users** (`UsersTab` — per‑user row actions:
  **Change tier**, **Change status**, **Edit limits** (contact tier only), and **Ban/Unban**), **Feedback**
  (`FeedbackTab` — newest-first list of all user-submitted feedback; status filter pills New/Responded/Archived/All;
  per‑row actions **Respond…** (opens `RespondFeedbackModal` — sends an email reply via
  `api.feedback.feedback.respondToFeedback`; Respond button and textarea are disabled with a warning when the submitter
  has no email on file), **Archive**
  (`archiveFeedback`), **Reopen** (`reopenFeedback`)).
- **PrivacyDataPage** (`/privacy-data`, guarded) — data‑subject rights self‑service UI (Phase 2b
    - 3b). Three sections: (1) **Consent preferences** (`ConsentToggles` — see below) — marketing and analytics toggles,
      OFF by default, reading `api.privacy.consent.getConsents` and writing
      `api.privacy.consent.recordConsent` on toggle change. (2) **Data export**: "Request export" button calls
      `api.privacy.export.requestDataExport`; polls status via
      `api.privacy.export.getExportStatus`; shows a download link via
      `api.privacy.export.getExportDownloadUrl` once ready. (3) **Delete account**: a type‑`DELETE`
      confirm `Modal` wrapping `api.privacy.deletion.requestAccountDeletion`; on success replaces the section with a
      "scheduled for {date}" info panel. Cross‑reference: §13B (backend mutations/actions these calls hit).

### Reusable components

`AppShell` (authenticated shell: persistent sidebar on desktop, modal drawer on mobile) composed of:
`Sidebar` (feed/my‑posts/settings/billing/ **privacy** links; **no admin link**), `TopBar` (search, theme toggle,
language menu, user menu trigger), `UserMenu` (profile & settings + sign‑out via
`performSignOut`), `LanguageMenu` (Radix dropdown replacing the old native `<select>`),
`PostComposer` (dark/light themes, `atLimit`), `CommentBox` (calls `commentOnPost`; accepts
`gated?: boolean` — disables submit/generate when gated; replaces a raw `PAYMENT_REQUIRED` error with a friendly
message + a `<Link to="/billing">` prompt), `Modal`,
`BannedScreen`, `BanUserDialog`, `UsersTab` (filter/search + per‑row modals + `banUser`/`unbanUser`),
`FeedbackTab` (status filter pills + per‑row `RowActionsMenu` + `RespondFeedbackModal`),
`RespondFeedbackModal` (shows original message read-only + reply textarea; Respond disabled when submitter has no email
on file; calls `respondToFeedback`),
`ChangeTierModal` / `ChangeStatusModal` (admin `setUserTier` / `setUserSubscriptionStatus`),
`ContactLimitsModal` (per‑user contact `setContactUserLimit`/`removeContactUserLimit`, prefilled from
`listPlanLimits`), `PlanLimitsTab` (**read‑only**: tier defaults + contact users via
`listContactUsersWithLimits`), `RowActionsMenu`, `LoadingSpinner`,
`CancelDeletionScreen` (grace‑window full‑screen interstitial shown by `RequireAuth` when
`me.deletionScheduledAt` is set; "Keep my account" button calls
`api.privacy.deletion.cancelAccountDeletion` then `window.location.reload()`; also offers a Sign out link — mirrors the
`BannedScreen` layout),
`ConsentToggles` (Phase 3b — rendered inside `PrivacyDataPage`; a pair of labelled toggles for
`marketing` and `analytics` consent purposes, both **OFF by default**; reads
`api.privacy.consent.getConsents` on mount, calls `api.privacy.consent.recordConsent` on each toggle change;
cross-reference: §13B for the append-only backend),
`PolicyUpdateScreen` (Phase 3b — full‑screen interstitial injected by `RequireAuth` when
`me.acknowledgedPolicyVersion !== POLICY_VERSION`; "I acknowledge" button calls
`api.privacy.consent.acknowledgePolicy` then `window.location.reload()`; ensures every existing user re-accepts after a
policy update before reaching the app — see the `RequireAuth` interception order above and §13B),
`ConsentPromptScreen` (first-login full-screen prompt shown by `RequireAuth` when
`me.consentPromptedAt` is unset; presents **Communication & analytics preferences** — marketing and analytics toggles,
both **OFF by default** — and a "Save & continue" button that calls
`api.privacy.consent.completeConsentPrompt({ sessionToken, marketing, analytics })` then
`window.location.reload()`; new users whose `acknowledgedPolicyVersion` is pre-stamped at signup but `consentPromptedAt`
is unset hit this prompt on first login — see the `RequireAuth`
interception order above and §13B),
`FirstPostPromptScreen` (first-login full-screen **skippable** onboarding step shown by `RequireAuth` when
`me.firstPostPromptedAt` is unset — shown to every new member immediately after the consent gate; presents the shared
`PostComposer` under a
"Share your best recent post" heading, plus an "I'll do this later" link. Submitting a post calls
`api.posts.submitPost` — which stamps `firstPostPromptedAt` server-side via `users.markFirstPostPrompted` and creates
the post hidden for a no-card member (`postCreatedHidden`). A card-less member is then funneled to `/billing` (their
post is revealed once they add a card); everyone else reloads to the feed. The skip link calls
`api.users.dismissFirstPostPrompt` then reloads. Never blocks entry: a member without a post URL handy can skip. See the
`RequireAuth` interception order above), plus the two LinkedIn‑embed components:

- **`LinkedInEmbed`** — the **single shared** embed component used by **both** the Feed (`PostCard`)
  and **My Posts**. Renders a LinkedIn post in an iframe that is intentionally taller (`iframeHeight` 480) than its
  `overflow:hidden` container (`containerHeight` 420) so LinkedIn's native action bar is clipped, then overlays an
  optional opaque `footer` (the app's own controls)
  over that strip. `iframe` is sandboxed (`allow-scripts allow-same-origin`) and lazy‑loaded. Its exported
  `buildEmbedUrl(urn)` **preserves the stored URN namespace** (`urn:li:activity|share|ugcPost`)
  with raw (un‑encoded) colons as LinkedIn requires; only bare/legacy ids fall back to wrapping as
  `activity`.
- **`PostCard`** — the Feed's post renderer (**Option B layout**): an app‑owned header (Featured badge via
  `feed.featured` + author avatar/name/headline) **above** a `LinkedInEmbed`, whose
  `footer` is the app's in‑app **Like/Comment bar** (`type="button"` actions calling `onReact` /
  `onComment`) overlaying the clipped native bar, plus a **View on LinkedIn ↗** link. That link is rendered **only when
  `post.sourceUrl` is present** and points **directly at `sourceUrl`** (the exact URL the user submitted) — there is no
  URN reconstruction, because LinkedIn's `ugcPost`/`activity`/
  `share` IDs differ for the same post and a reconstructed `/feed/update/<urn>/` link can resolve wrongly.
  (`MyPostsPage` keeps a `buildLinkedInUrl` with a reconstruction fallback for cron‑synced posts.) **`PostCard` does not
  render `post.content` or `mediaUrls`** — the post body comes entirely from the embed. Accepts a `gated?: boolean` prop
  (from `FeedPage` via `useCardGate()`): when gated, the Like and Comment buttons are `disabled` with a `title` tooltip
  pointing to the Billing page; "View on LinkedIn ↗" is rendered as a disabled `<button>` rather than an `<a>` (anchors
  cannot be disabled).

> As of `1fcc123`, `MyPostsPage` uses this shared `LinkedInEmbed` directly (its old local
> `buildEmbedUrl` that force‑normalized to `activity` was removed, eliminating the previous
> duplicate). `MyPostsPage` keeps only `buildLinkedInUrl` (prefers the stored `sourceUrl`, falls back
> to a `/feed/update/<urn>/` link) and `timeAgo` for its embed footer's "View on LinkedIn ↗" link.

### Trial UI (Plan 2C)

The trial UI layer sits on top of the authenticated app and enforces a soft **card-gate** — it does not replace backend
enforcement (`assertCanEngage`), it mirrors it in the UI.

#### `useCardGate()` hook (`app/src/hooks/useCardGate.ts`)

Shared hook consumed by `FeedPage`, `Sidebar`, and `BillingPage`. Reads `api.users.getMe` (same
`sessionToken` pattern as every other page) and derives:

```
gated  ⇔  me loaded  AND  !me.isAdmin  AND  status ∉ { trialing, active }
```

Admins are never gated. Returns `{ gated, isTrialing, status, isAdmin, me }`.

#### Card-gate on the feed

`FeedPage` calls `useCardGate()` and passes `gated` to every `<PostCard>`. When `gated`:

- The **Like** and **Comment** buttons in `PostCard` are `disabled` with a tooltip pointing to the Billing page
  (`feed.cardGate` i18n key: "Add a payment method on the Billing page to start engaging.").
- The **View on LinkedIn ↗** control is rendered as a `disabled` `<button>` instead of an `<a>`
  (anchors cannot carry the `disabled` attribute).
- `CommentBox` disables its submit and generate buttons; a `PAYMENT_REQUIRED` response from the backend replaces the raw
  error text with the gate message + a `<Link to="/billing">`.
- The `react()` call in `FeedPage` (previously un-caught) is wrapped in try/catch; a
  `PAYMENT_REQUIRED` error now surfaces an inline gate hint rather than failing silently.

#### Pulsing Billing nav + SSI link-out (`Sidebar`)

`Sidebar` calls `useCardGate()`. When `gated`, the **Billing** nav item receives `animate-pulse
text-primary` (gold pulse via Tailwind v4 tokens) to draw attention. A persistent **"View your SSI on LinkedIn ↗"** link
(`https://linkedin.com/sales/ssi`, new tab) is rendered in the sidebar footer above `<UserMenu>` using `text-gold-text`
styling; it is always visible regardless of gate state. SSI is a link-out only — no score is fetched or displayed.

#### BillingPage — trial progress, chosen-tier CTA, downgrade prompt

See the **BillingPage** bullet in the Pages section above for the full state-dependent layout. Backend query:
`api.users.getTrialProgress` (defined in `convex/users.ts`; mirrors `getMe`'s session-resolution pattern; returns `{ made, received, combined, threshold, reached, status,
trialEndsAt }`). Cross-reference: §8 (subscription state machine) and §9 (plan limits).

---

### i18n (`i18n/index.ts`)

`i18next` + `react-i18next` + browser language detector. Resources `en`/`pt`/`es`, fallback `en`. **Detection order:**
`cookie` (`lang`) → `localStorage` → `?lang=` querystring → `navigator`. The
`lang` cookie is the cross-site source of truth (see [§14B](#14b-cross-site-theme--language-persistence));
`localStorage` is a same-origin mirror. The `LanguageMenu` (Radix dropdown in `TopBar`) persists the choice to both
cookie and `localStorage`. On the first authenticated load, if neither the cookie nor `localStorage` `i18nextLng` key is
present, the UI language is seeded once from
`me.primaryLocale` (the scraped LinkedIn language); the `LanguageMenu` switcher still overrides it thereafter.

**Namespaces added in Phase 2b:** `privacy.*` — covers all labels, headings, status messages, and confirmation copy used
by `PrivacyDataPage` and `CancelDeletionScreen`; present in `en`, `pt`, and
`es` translation files.

**Keys added in Phase 3b:** `privacy.consent.*` (toggle labels, descriptions, and status copy for
`ConsentToggles`) and `privacy.policyUpdate.*` (heading, body, and button copy for
`PolicyUpdateScreen`); all three locales (`en`/`pt`/`es`).

**Keys added with new-user consent prompt:** `privacy.consentPrompt.*` (heading, body, toggle labels, and "Save &
continue" button copy for `ConsentPromptScreen`); all three locales (`en`/`pt`/`es`).

**Keys added with Plan 2C trial UI:** `nav.viewSsi` (sidebar SSI link-out label);
`feed.cardGate` (gate tooltip and CommentBox billing prompt); `billing.trialProgress`
(X / N interactions meter, uses `{{combined}}` and `{{threshold}}` interpolation),
`billing.ssiLink` (SSI link-out label in the trial banner), `billing.whatYouLlMiss` (inline loss-framing block shown on
the Starter card while trialing), `billing.trialBanner` (updated to mention the 50-interaction milestone alongside the
7-day window); all three locales (`en`/`pt`/`es`).

---

## 15. Frontend — Landing Site (`landing/`)

Standalone **Next.js 15 (App Router)**, React 19, **Tailwind CSS 4** (CSS-first, migrated from v3 in Plan 1 Phase B).
Pure marketing — **no API/Convex calls**; all content (pricing, FAQ, stats) is hard‑coded in module constants.

### Locale routing (Plan 2 — i18n)

All pages are **locale-routed** under `app/[lang]/` where `lang ∈ { en, pt, es }` (default `en`).
`pt` is **Brazilian Portuguese**; `es` is **neutral Latin-American Spanish**.

#### Middleware (`landing/middleware.ts`)

`middleware.ts` intercepts every request whose pathname does not start with a known locale prefix (plus static/API
exclusions). It selects the target locale in priority order:

```mermaid
flowchart TD
  REQ["Incoming request\n(no /en|pt|es prefix)"] --> CK{"lang cookie\npresent?"}
  CK -->|yes| USE["use cookie value"]
  CK -->|no| AL{"Accept-Language\nmatches en/pt/es?"}
  AL -->|yes| USE
  AL -->|no| DEF["default: en"]
  USE --> REDIR["307 redirect to\n/<lang>/original-path"]
  DEF --> REDIR
```

The `Accept-Language` matcher is hand-rolled (no `negotiator`/`@formatjs/intl-localematcher` deps)
— it checks the first token of each `Accept-Language` entry against the three supported locales, in header priority
order. Paths starting with `/api/`, `/_next/`, and static file extensions are excluded from interception (Next's
built-in exclusion list is replicated in the matcher config).

#### Root layout (`app/[lang]/layout.tsx`)

`app/[lang]/layout.tsx` is the **single** root layout — there is no `app/layout.tsx`. It:

- Awaits `params` (`const { lang } = await params` — Next 15 `params` is a `Promise`).
- Renders `<html lang={lang}>` with `suppressHydrationWarning` (theme no-flash script).
- Applies the dark/light theme no-flash inline `<script>` (reads the `theme` cookie before React hydrates — identical to
  the Plan 1 pattern; see §14B).
- Renders `<CookieNotice>` (banner).
- Calls `generateStaticParams` exporting `[{ lang: 'en' }, { lang: 'pt' }, { lang: 'es' }]` so all three locales are
  **statically pre-rendered** at build time.

#### Dictionary (`landing/i18n/`)

UI strings live in `i18n/dictionaries/{en,pt,es}.json` (~208 keys in groups: `meta`, `nav`,
`hero`, `painBeat`, `howItWorks`, `ssiExplainer`, `proof`, `features`, `tiers`, `pricing`, `faq`,
`finalCta`, `footer`, `cookieNotice`, `themeToggle`, `languageSelector`). The server utility
`i18n/getDictionary.ts` imports the correct JSON at request time and returns a typed `Dictionary`
(type derived from `en.json`). `i18n/config.ts` exports the `locales` array and `Locale` type.

Server components (`app/[lang]/page.tsx`, `app/[lang]/pricing/page.tsx`, legal pages) call
`getDictionary(lang)` and pass the relevant dict slice as props to child components.

#### Client components and `LanguageSelector`

The six client components — `Nav`, `Pricing`, `FAQ`, `CookieNotice`, `ThemeToggle`, and
`LanguageSelector` — receive their dict slice (and `lang`) as props; they do not call
`getDictionary` directly (server-only utility).

`LanguageSelector` (`landing/components/LanguageSelector.tsx`) is mounted in `Nav`. When the user picks a locale it:

1. Writes the **shared `lang` cookie** (same cookie name, domain, and SameSite attributes as the app's i18n cookie
   detector — see §14B) via `landing/lib/cookies.ts`.
2. Navigates to the same path under the chosen locale prefix (e.g. `/en/pricing` →
   `/pt/pricing`) using `router.push`.

Because the cookie domain is `.linkintothessi.com` in production, the chosen language immediately carries over to the
authenticated app on next load (the app reads the `lang` cookie via its i18next cookie detector — §14B). In dev the
cookie is host-only so sync is prod-only.

#### SEO: `hreflang` + per-locale metadata

Each `page.tsx` exports `generateMetadata(params)` returning per-locale `title`, `description`, and OpenGraph fields
sourced from `dict.meta`. It also injects `alternates.languages` with the three `hreflang` alternate URLs (`/en/…`,
`/pt/…`, `/es/…`) plus `x-default` pointing to `/en/…`.

### Routes

All routes now include the locale prefix. The canonical forms are:

| Route             | Purpose                                                                                                                     |
|-------------------|-----------------------------------------------------------------------------------------------------------------------------|
| `/<lang>`         | Home — composes `Nav → Hero → PainBeat → HowItWorks → SSIExplainer → Proof → Features → Pricing → FAQ → FinalCTA → Footer`. |
| `/<lang>/pricing` | Standalone pricing (`Nav` + `Pricing`).                                                                                     |
| `/<lang>/privacy` | Privacy Policy — **required for LinkedIn app review**.                                                                      |
| `/<lang>/terms`   | Terms of Service — **required for LinkedIn app review**.                                                                    |
| `/<lang>/cookies` | Cookie & Storage Policy (`CookiesPage`) — documents essential-only storage (no tracking cookies); linked from `Footer`.     |

A bare `/` (or any path without a locale prefix) is 307-redirected by middleware to the detected locale (see middleware
section above). Static generation covers all 5 route types × 3 locales = 15 pages, plus `ƒ Middleware`.

`app/[lang]/layout.tsx` renders `<CookieNotice>` (see below) and contains the no-flash theme script. **Notable section
content** (encodes the business rules):
`PainBeat` frames the core problem (algorithm invisibility). `HowItWorks` describes the three-step engagement flow
(connect → engage → get found) plus the network-effect line. `SSIExplainer` covers the four 25-point pillars with real
LinkedIn-attributed statistics (45% more opportunities, 5× profile views, +51% recruiter contact for SSI > 70). `Proof`
is an honest pre-launch block: a founder note, a link to check the user's own SSI on `linkedin.com/sales/ssi`, and an
early-access line (no fabricated counts or testimonials). `Features` markets exactly three shipped capabilities
(industry feed, AI-assisted comment/reaction, post targeting), outcome-framed and tier-labelled, with no "coming soon"
items. `Pricing` is a `'use client'` component with an annual/monthly toggle (annual default, annual = monthly × 10
giving 2 months free); three tiers — Starter $5/$50, Growth $15/$150 (Recommended, elevated), Pro $50/$500 — plus an
Enterprise contact-us line; trial copy reads "no charge until 50 interactions or 7 days, whichever comes first; card
required, cancel anytime" (the card-capture and milestone-gate mechanics are implemented in Plan 2). Each tier's **"
Start free" CTA** links directly to OAuth and appends
`?plan=<starter|growth|pro>&interval=<monthly|annual>` so the chosen tier is carried through the OAuth flow and
pre-selected in `BillingPage`'s no-card CTA (see §7 and §14). `FAQ` is objection-led (safety first) with honest
trial-scope and SSI answers; no "no credit card required" or "3-day free trial" claims. `Footer` links to
`/<lang>/privacy`, `/<lang>/terms`, `/<lang>/cookies`, and `mailto:contact@linkintothessi.com`.

### Legal pages — pt/es drafts

The legal pages (`/privacy`, `/terms`, `/cookies`) now have per-locale content modules:

```
app/[lang]/privacy/content/{en,pt,es}.tsx
app/[lang]/terms/content/{en,pt,es}.tsx
app/[lang]/cookies/content/{en,pt,es}.tsx
```

Each `page.tsx` imports the content module matching `lang` and renders it. The pt and es modules are **Brazilian
Portuguese / Latin-American Spanish translations** of the English source — they preserve the hand-styled JSX markup and
all `[PLACEHOLDER]` tokens (`NEANDERTECH SERVICOS DE TECNOLOGIA LTDA`,
`AV SETE DE SETEMBRO, 2775, REBOUÇAS - 80230-010 - Curitiba, Paraná - Brazil`, `contact@linkintothessi.com`,
`Henriko Alberton`,
`Brazil`, policy version strings) **verbatim**. A draft banner (translated) is shown in all locales. All three locales
remain **drafts pending legal review** — translation does not constitute legal sign-off.

### CookieNotice (Phase 3b)

`CookieNotice` is a **client component** rendered in `landing/app/layout.tsx`. It displays a dismissible first-visit
banner informing visitors that the site uses only essential storage (no tracking). Dismissal is persisted in **
`localStorage`** (key `cookieNoticeDismissed`). The component uses **`useSyncExternalStore`** with a no-op server
snapshot so it hydrates safely without an SSR/client mismatch — the notice is invisible on the server render and appears
only after hydration confirms the key is absent. The banner is **not** shown to returning visitors (key already set) and
disappears without page reload on dismiss.

### Why the legal pages exist

LinkedIn requires a publicly reachable **privacy policy** and **terms of service** before approving an app that reads a
user's posts and publishes comments/reactions on their behalf. `/privacy` states tokens are stored securely server‑side
and never exposed; `/terms` records the user's grant of permission to act on their behalf and the
monthly‑billing/cancellation policy.

As of Phase 4, `/privacy` and `/terms` have been rewritten as full **GDPR / LGPD / US-state**
drafts (covering lawful basis, data-subject rights, international transfers, and CCPA/CPRA disclosures). Both pages are
**DRAFTs pending legal review** — bracketed placeholders (`NEANDERTECH SERVICOS DE TECNOLOGIA LTDA`,
`AV SETE DE SETEMBRO, 2775, REBOUÇAS - 80230-010 - Curitiba, Paraná - Brazil`, etc.) must be filled and a lawyer must
sign off before they are regulator-ready. `/cookies` documents the essential-storage-only cookie policy (Phase 3b).
See [`docs/compliance/README.md`](compliance/README.md) for the consolidated legal to-do list.

### CTAs → app

Every conversion CTA (Nav "Start free", Hero, Pricing, FinalCTA) is a plain `<a>` whose `href` is the shared **
`SIGN_IN_URL`** (`landing/lib/links.ts`) — i.e.
`${NEXT_PUBLIC_CONVEX_SITE}/auth/linkedin`, sending visitors **straight into LinkedIn OAuth** (it falls back to
`NEXT_PUBLIC_APP_URL` if the Convex site URL is unset). Going directly to OAuth (rather than the app root) is what lets
a previously‑signed‑out visitor — whom the app bounces back to this site (§7) — actually log in instead of ping‑ponging.
Internal nav (logo, footer, section anchors,
`/pricing`) uses Next `<Link>`.

### Styling

**Tailwind v4 CSS-first** — `landing/app/globals.css` uses `@tailwindcss/postcss`, `@theme inline`,
`:root` (light) and `.dark` (dark) token blocks, plus `@custom-variant dark (.dark)`. The palette (`--ink`, `--cream`,
`--gold`, `--gold-text`, `--lnblue`, `--on-gold`, `--on-lnblue`, decorative
`--ring-line`, `--ring-gold`, `--glow-*`) is unified with the app's design system (see §14A/§14B). No
`tailwind.config.ts` remains (deleted in the v3→v4 migration). Cormorant Garamond (display) + DM Sans (body),
glassmorphic scrolled nav, radial glows, decorative `circle-ring` elements. The hero is a headline + CTA over the
decorative rings (no SSI gauge, no slot-machine animation). No mobile hamburger menu. `ThemeToggle` (3-state
system/light/dark) is mounted in `Nav`.

---

## 16. Environment Variables

Canonical inventory (built by grepping every `process.env.*` / `import.meta.env.*` site). `.env*`
files are git‑ignored; the `.env*.example` files document the required set.

### Convex backend — set in the **Convex dashboard** (Settings → Environment Variables)

| Variable                         |                Required                 | Consumed in                                         | Purpose                                                                                                                                                                                               |
|----------------------------------|:---------------------------------------:|-----------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `LINKEDIN_CLIENT_ID`             |                   ✓                    | `linkedin/oauth.ts`                                 | OAuth client id (authorize URL + token exchange).                                                                                                                                                     |
| `LINKEDIN_CLIENT_SECRET`         |                   ✓                    | `linkedin/oauth.ts`                                 | OAuth client secret (server‑side token exchange).                                                                                                                                                     |
| `LINKEDIN_REDIRECT_URI`          |                   ✓                    | `linkedin/oauth.ts`                                 | Must be `https://<deployment>.convex.site/auth/linkedin/callback` (Convex, **not** the app).                                                                                                          |
| `APP_URL`                        |   – (default `http://localhost:5173`)   | `http.ts`, `billing.ts`, `billingNode.ts`           | Browser redirect base: OAuth success/error + Stripe success/cancel/portal URLs.                                                                                                                       |
| `STRIPE_STARTER_PRICE_ID`        |              ✓ (billing)               | `lib/stripePrices.ts`                               | Monthly price id → `starter` tier; checkout allowlist + price→tier map.                                                                                                                               |
| `STRIPE_GROWTH_PRICE_ID`         |              ✓ (billing)               | `lib/stripePrices.ts`                               | Monthly price id → `growth` tier.                                                                                                                                                                     |
| `STRIPE_PRO_PRICE_ID`            |              ✓ (billing)               | `lib/stripePrices.ts`                               | Monthly price id → `pro` tier.                                                                                                                                                                        |
| `STRIPE_STARTER_ANNUAL_PRICE_ID` |              ✓ (billing)               | `lib/stripePrices.ts`                               | Annual price id → `starter` tier ($50/yr). Create in Stripe Dashboard alongside the monthly price.                                                                                                    |
| `STRIPE_GROWTH_ANNUAL_PRICE_ID`  |              ✓ (billing)               | `lib/stripePrices.ts`                               | Annual price id → `growth` tier ($150/yr).                                                                                                                                                            |
| `STRIPE_PRO_ANNUAL_PRICE_ID`     |              ✓ (billing)               | `lib/stripePrices.ts`                               | Annual price id → `pro` tier ($500/yr).                                                                                                                                                               |
| `STRIPE_SECRET_KEY`              |              ✓ (billing)               | `billingNode.ts` + _(read by `@convex-dev/stripe`)_ | Stripe API secret — used directly in `billingNode.ts` for checkout + trial-end; also consumed by the Stripe component for customer/webhook ops.                                                       |
| `STRIPE_WEBHOOK_SECRET`          |              ✓ (billing)               | _(read by `@convex-dev/stripe`)_                    | Verifies webhook signatures at `/stripe/webhook`.                                                                                                                                                     |
| `APIFY_API_TOKEN`                |                ✓ (sync)                | `jobs/syncPostsApify.ts`                            | Bearer token for Apify REST. If unset, sync no‑ops.                                                                                                                                                   |
| `APIFY_TASK_ID`                  |                ✓ (sync)                | `jobs/syncPostsApify.ts`                            | Apify actor (`harvestapi~linkedin-profile-posts`).                                                                                                                                                    |
| `APIFY_TASK_ID_PROFILE_SCRAPE`   |           ✓ (profile scrape)           | `jobs/scrapeProfileApify.ts`                        | LinkedIn **profile** scraper actor (country/location/primary-locale enrichment).                                                                                                                      |
| `RESEND_API_KEY`                 |        – (email no‑ops if unset)        | `lib/email.ts`                                      | Resend API key for transactional email (DSR confirmations + breach notices).                                                                                                                          |
| `EMAIL_FROM`                     |        – (email no‑ops if unset)        | `lib/email.ts`                                      | From‑address for transactional email (e.g. `noreply@linkintothessi.com`).                                                                                                                             |
| `CONVEX_DEPLOYMENT`              |                ✓ (CLI)                 | Convex CLI                                          | Selects the deployment for `convex dev`/`deploy`.                                                                                                                                                     |
| `ALLOW_ADMIN_SHARE_ANY_POST`     | – (**dev/testing only**, unset in prod) | `posts.ts` (`submitPost`)                           | When `'true'`, lets an admin bypass post‑ownership verification + posting throttles in `submitPost`. Set **only** on the local/dev deployment (`npx convex env set ALLOW_ADMIN_SHARE_ANY_POST true`). |
| `FEEDBACK_REPLY_TO`              |              – (optional)               | `convex/feedback/feedback.ts`                       | `Reply-To` address on feedback reply emails so users can reply to a human. Unset ⇒ no header (email still sends).                                                                                     |
| `OPENROUTER_API_KEY`             |  ✓ (AI features; AI no‑ops if unset)   | `convex/ai/openrouter.ts`                           | OpenRouter bearer token for AI reaction prediction + comment drafting. Unset ⇒ reactions default to `LIKE`, comment drafting reports "AI unavailable".                                                |
| `OPENROUTER_MODEL`               | – (default `google/gemma-4-26b-a4b-it`) | `convex/ai/openrouter.ts`                           | Optional model slug override. Provider routing (ZDR + no-data-collection, cheapest qualifying provider) is enforced in code, not via env.                                                             |
| `OPENROUTER_SITE_URL` / `…_NAME` |              – (optional)               | `convex/ai/openrouter.ts`                           | Optional attribution (HTTP‑Referer / X‑Title) for OpenRouter's public rankings. Unset ⇒ not sent.                                                                                                     |

### Frontend build-time env — set in **Cloudflare** (each Worker's build settings)

Both frontends inline these at **build time** (Vite/Next bake them into the output), so they live in the Cloudflare
Workers Builds env, not at runtime. `<prod>` = the production Convex deployment slug.

**Landing Worker (`NEXT_PUBLIC_*`):**

| Var                         | Value                            |
|-----------------------------|----------------------------------|
| `NEXT_PUBLIC_APP_URL`       | `https://app.linkintothessi.com` |
| `NEXT_PUBLIC_CONVEX_SITE`   | `https://<prod>.convex.site`     |
| `NEXT_PUBLIC_COOKIE_DOMAIN` | `.linkintothessi.com`            |

**App Worker (`VITE_*`):**

| Var                                             | Value                         |
|-------------------------------------------------|-------------------------------|
| `VITE_CONVEX_URL`                               | `https://<prod>.convex.cloud` |
| `VITE_CONVEX_SITE`                              | `https://<prod>.convex.site`  |
| `VITE_LANDING_URL`                              | `https://linkintothessi.com`  |
| `VITE_COOKIE_DOMAIN`                            | `.linkintothessi.com`         |
| `VITE_STRIPE_*_PRICE_ID` (+ `_ANNUAL_PRICE_ID`) | the 6 Stripe price ids        |

### App (`app/`) — Vite, `VITE_` prefix (embedded in the browser bundle)

| Variable                              |                    Required                     | Consumed in       | Purpose                                                                                                                |
|---------------------------------------|:-----------------------------------------------:|-------------------|------------------------------------------------------------------------------------------------------------------------|
| `VITE_CONVEX_URL`                     |                       ✓                        | `main.tsx`        | `.convex.cloud` URL for `ConvexReactClient` (data transport).                                                          |
| `VITE_CONVEX_SITE`                    |                       ✓                        | `App.tsx`         | `.convex.site` base for the `/auth/linkedin` sign‑in redirect.                                                         |
| `VITE_LANDING_URL`                    |       – (default `http://localhost:3000`)       | `lib/session.ts`  | Marketing/landing site URL; **sign‑out redirects here** (separate Next.js origin).                                     |
| `VITE_COOKIE_DOMAIN`                  | – (unset in dev; `.linkintothessi.com` in prod) | `lib/cookies.ts`  | Cookie `Domain` attribute for cross-site `theme`/`lang` cookies. Unset = host-only cookie (no cross-site sync in dev). |
| `VITE_STRIPE_STARTER_PRICE_ID`        |                 ✓ (billing UI)                 | `BillingPage.tsx` | Monthly price id for Starter checkout.                                                                                 |
| `VITE_STRIPE_GROWTH_PRICE_ID`         |                 ✓ (billing UI)                 | `BillingPage.tsx` | Monthly price id for Growth checkout.                                                                                  |
| `VITE_STRIPE_PRO_PRICE_ID`            |                 ✓ (billing UI)                 | `BillingPage.tsx` | Monthly price id for Pro checkout (missing → button disabled).                                                         |
| `VITE_STRIPE_STARTER_ANNUAL_PRICE_ID` |                 ✓ (billing UI)                 | `BillingPage.tsx` | Annual price id for Starter ($50/yr). Must match `STRIPE_STARTER_ANNUAL_PRICE_ID` in Convex.                           |
| `VITE_STRIPE_GROWTH_ANNUAL_PRICE_ID`  |                 ✓ (billing UI)                 | `BillingPage.tsx` | Annual price id for Growth ($150/yr). Must match `STRIPE_GROWTH_ANNUAL_PRICE_ID` in Convex.                            |
| `VITE_STRIPE_PRO_ANNUAL_PRICE_ID`     |                 ✓ (billing UI)                 | `BillingPage.tsx` | Annual price id for Pro ($500/yr). Must match `STRIPE_PRO_ANNUAL_PRICE_ID` in Convex.                                  |

### Landing (`landing/`) — Next.js, `NEXT_PUBLIC_` prefix

| Variable                    |                       Required                       | Consumed in      | Purpose                                                                                                                |
|-----------------------------|:----------------------------------------------------:|------------------|------------------------------------------------------------------------------------------------------------------------|
| `NEXT_PUBLIC_APP_URL`       |         – (default `http://localhost:5173`)          | `lib/links.ts`   | App base URL; **fallback** for CTA links when `NEXT_PUBLIC_CONVEX_SITE` is unset.                                      |
| `NEXT_PUBLIC_CONVEX_SITE`   | – (CTAs fall back to `NEXT_PUBLIC_APP_URL` if unset) | `lib/links.ts`   | Convex `.site` base; CTAs link to `${NEXT_PUBLIC_CONVEX_SITE}/auth/linkedin` to start OAuth directly.                  |
| `NEXT_PUBLIC_COOKIE_DOMAIN` |   – (unset in dev; `.linkintothessi.com` in prod)    | `lib/cookies.ts` | Cookie `Domain` attribute for cross-site `theme`/`lang` cookies. Unset = host-only cookie (no cross-site sync in dev). |

> **Port caveat:** the Vite dev server actually runs on **5174** (`app/vite.config.ts`), but every
> default fallback / `.env.example` assumes **5173**. Align `LINKEDIN_REDIRECT_URI`/`APP_URL` with the
> port you actually run locally.

---

## 17. Security Posture

The codebase follows a consistent, defensible security model:

- **Secrets & internal fields never reach clients.** `toSafeMe` (`users.getMe`) strips tokens **and**
  `stripeCustomerId`/`bannedBy`/`bannedAt`/raw `isAdmin`. The feed sends authors through an **allow‑list** projection
  (`toFeedAuthor` — only `_id`/name/headline/picture/industry/country/tier), so other users' `isAdmin`, Stripe id,
  `linkedinId`, ban state, etc. are never exposed.
  `users.getWithTokens` is an `internalQuery` (server‑only). The OAuth client secret lives only in Convex env and is
  used only in server‑side token exchange.
- **Clients never pass a `userId`.** Identity is always resolved server‑side from an **opaque UUID session token** via
  `lib/auth.ts`. The only thing a client can do is present a valid token.
- **CSRF protection** on OAuth: a single‑use `state` nonce (10‑min TTL) stored before redirect and **deleted before**
  the expiry check on callback (replay‑safe).
- **Sessions:** random UUID, 30‑day TTL, stored in **`sessionStorage`** (cleared on tab close). The token is delivered
  to the SPA in the OAuth redirect's **URL fragment** (`#session=…`, never a query string), and `AuthSuccessPage` scrubs
  it from history after reading — so it can't leak via server/proxy access logs or the `Referer` header. `logout`
  invalidates one session,
  `forceLogoutAll` invalidates all; expired sessions are purged by cron.
- **Generic client‑facing errors.** Every LinkedIn/OAuth/Stripe/Apify failure logs the real error server‑side
  (`console.error`) and returns a sanitized message — no stack traces or upstream bodies leak to clients.
- **SSRF guard on outbound fetches.** `submitPost` fetches a user‑supplied URL, so
  `parseLinkedInPostUrl` rejects any non‑`https` scheme or non‑`linkedin.com` host **before** the fetch, and the URN
  scraped from the returned page is format‑validated before any downstream use. The follow‑up **article‑enrichment
  fetch** runs the URL extracted from the page HTML through the same host allowlist (`isAllowedLinkedInUrl`, which
  shares `ALLOWED_LINKEDIN_HOST` with
  `parseLinkedInPostUrl`) **before** fetching, so a malicious/derived link cannot redirect the server‑side fetch
  off‑LinkedIn.
- **Payments fail safe.** The Stripe webhook signature is verified by `@convex-dev/stripe` before any handler runs;
  checkout/portal require auth and an allow‑listed price id; `toSubscriptionStatus`
  maps any non‑access status (`incomplete`/`unpaid`/`paused`/unknown) to a **non‑active** state so a half‑finished or
  lapsed subscription never grants access; `getTierFromPriceId` fails to `starter`.
- **Rate limiting** (fixed window per `userId+action`): submitPost 10/h, comment 20/h, react 30/h, profile scrape 2/day
  (shared by manual Refresh + auto‑scrape on identifier change). **Admins are exempt** from every rate limit.
- **Privilege escalation guarded:** `isAdmin` is **DB‑edit only** — excluded from every write path (`upsertUser`, etc.).
  Admin endpoints re‑check `assertAdmin` on the server‑resolved user, never on a client‑supplied id. `banUser` cannot
  self‑ban (always leaves ≥ 1 admin).
- **Input validation:** the LinkedIn vanity is **auto‑derived** (LinkedIn‑authoritative, never user‑typed) — post
  ownership is verified by matching the post's author name to the member's OIDC `name` (§11), not a user‑set field;
  `commentOnPost`
  caps text at 3000 chars; `reactToPost` constrains the reaction enum; `commentOnPost`/`reactToPost`
  reject `hidden`/interaction‑limit‑reached posts; `banUser` caps the reason at 500 chars; checkout validates the price
  id against an allowlist before any work.
- **CSP + security headers (served at the Cloudflare HTTP layer).** The **app** generates `dist/_headers`
  at build (`app/scripts/gen-headers.mjs`): `script-src` is locked to the **SHA-256 hash** of the one pre-paint inline
  theme script (no `'unsafe-inline'`), plus `frame-src https://www.linkedin.com` and a
  `connect-src` allowlist (Convex `.cloud`/`.site` + Stripe). The **landing** sets its CSP via
  `next.config.js` `headers()` with `script-src 'self' 'unsafe-inline'` (it renders only static copy, so the pages stay
  prerendered/cached; the strict hashed CSP is reserved for the app, which renders untrusted data). Both retain
  `style-src 'unsafe-inline'` (Radix + inline styles), and both add
  `frame-ancestors 'none'`, `Strict-Transport-Security` (HSTS, 2y + preload), `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: strict-origin-when-cross-origin`, and `Permissions-Policy`. The old `<meta>` CSP was removed from
  `app/index.html` (a `<meta>` CSP cannot set `frame-ancestors`/HSTS — that needs HTTP headers).

> **Open security‑relevant gaps / hardening backlog:** no LinkedIn token‑refresh flow (tokens
> silently expire ~60 days); the ban is reactive (a banned user's in‑flight reads still resolve until
> the next protected call / reactive push); `linkedinPublicIdentifier` is now
> **auto‑derived** (set‑once) from a name‑verified post's author URL — LinkedIn‑authoritative, never
> user‑typed, so it can't be spoofed via a settings field; LinkedIn actions still use the user's own
> token. See [§19](#19-known-discrepancies-dead-code--roadmap).

### Compliance Documentation

The `docs/compliance/` folder contains six **DRAFT** documents (pending legal review) that accompany the technical
controls described in [§13B](#13b-privacy--compliance):

| File                                                    | Contents                                                                     |
|---------------------------------------------------------|------------------------------------------------------------------------------|
| [`DATA-INVENTORY.md`](compliance/DATA-INVENTORY.md)     | Record of Processing Activities (ROPA) — GDPR Art. 30                        |
| [`SUBPROCESSORS.md`](compliance/SUBPROCESSORS.md)       | Sub-processor list (Convex, Stripe, LinkedIn, Resend; Apify hard-gate noted) |
| [`RETENTION-POLICY.md`](compliance/RETENTION-POLICY.md) | Retention windows per data category and automated-enforcement references     |
| [`GAP-ASSESSMENT.md`](compliance/GAP-ASSESSMENT.md)     | Multi-framework gap assessment (GDPR / UK GDPR / LGPD / CCPA-CPRA)           |
| [`BREACH-RUNBOOK.md`](compliance/BREACH-RUNBOOK.md)     | Personal data breach incident-response runbook (72-hour notification)        |
| [`DPA-TEMPLATE.md`](compliance/DPA-TEMPLATE.md)         | Data Processing Agreement template (GDPR Art. 28 / LGPD Art. 37)             |

See [`docs/compliance/README.md`](compliance/README.md) for the index and the consolidated human / legal to-do list
(bracketed placeholders, lawyer sign-off, sub-processor DPA signing, DPO/rep assessment, and the Apify hard gate).

---

## 18. Configuration, Tooling & Testing

### Monorepo & scripts (root `package.json`)

pnpm workspaces (`pnpm-workspace.yaml`): `landing`, `app`, `convex`. Root scripts orchestrate via
`pnpm --filter`:

| Script                                         | Does                                                                                |
|------------------------------------------------|-------------------------------------------------------------------------------------|
| `dev:landing` / `dev:app` / `dev:convex`       | Run each workspace's dev server (`dev:convex` first runs `convex ai-files update`). |
| `build:landing` / `build:app` / `build:convex` | `next build` / `tsc && vite build` / `convex deploy`.                               |
| `lint` / `lint:fix`                            | `eslint . --max-warnings 0` (zero warnings tolerated) / `--fix`.                    |
| `format` / `format:check`                      | Prettier write / check.                                                             |

### Lint / format / TS

- **ESLint 9** flat config across all workspaces; `@typescript-eslint/no-explicit-any` is a **warn**
  (and `--max-warnings 0` makes any `any` fail CI), off in tests; React rules for `app/`+`landing/`;
  `no-console` off in `convex/`. Ignores `_generated`, `convex-mocks`, config files, agent dirs.
- **Prettier:** no semicolons, single quotes, `arrowParens: avoid`, no trailing commas, 120 cols,
  `singleAttributePerLine`, `prettier-plugin-tailwindcss`.
- **TS base** (`tsconfig.base.json`): `strict`, `ES2020`, `moduleResolution: bundler`. App builds gate on `tsc`; Vite
  runs an in‑dev type‑check overlay (`vite-plugin-checker`).

### Testing (Vitest everywhere)

- **Convex:** `convex/vitest.config.ts` aliases `convex/server` →
  `convex-mocks/_test/__mocks__/convex_server_generics.ts`, so backend handlers are testable as **plain functions** (the
  mock returns function definitions unchanged; `cronJobs`/`httpRouter` are no‑ops; a `components` Proxy yields
  `undefined`). Run: `pnpm --filter convex test`. Coverage spans schema, auth, oauth, feed, posts, processQueue, admin,
  parsePostUrl/Content, verifyPostOwnership.
- **App:** Vitest config inline in `vite.config.ts` (`jsdom`, `setupFiles` import
  `@testing-library/jest-dom` + `../i18n`). Component tests for PostCard, PostComposer, LinkedInEmbed, Modal,
  BannedScreen, BanUserDialog, UsersTab, PlanLimitsTab, AdminPage, MyPostsPage, SettingsPage, i18n. Run:
  `pnpm --filter app test`.
- **All:** `pnpm -r test`.
- **CI/deploy:** no `.github/` workflows — deploys run via **Cloudflare Workers Builds** (Git push-to-`master`:
  landing = `opennextjs-cloudflare build`/`deploy`, app = `vite build` + `wrangler deploy`); Convex via
  `npx convex deploy`. New deploy config: `app/wrangler.jsonc`, `landing/wrangler.jsonc`, `landing/open-next.config.ts`,
  `app/scripts/gen-headers.mjs`; root scripts `deploy:app`/`deploy:landing`/`preview:landing`.

---

## 19. Known Discrepancies, Dead Code & Roadmap

### README ↔ code mismatches (trust the code)

- **Tables:** README says 5; there are **10**.
- **Post sync:** README says "hourly LinkedIn‑API cron"; reality is **daily, Apify‑only, admin‑gated**
  (no direct LinkedIn‑API ingestion path).
- **OAuth redirect:** README shows `?userId=…`; code uses `?session=…` (a session token).
- **Token refresh:** README claims a 60‑day refresh flow "implemented"/"attempted within 7 days of expiry"; **no refresh
  logic exists**.
- **Next.js:** README says 14; `landing/` is **15**.
- **Dev port:** README/`.env.example` assume 5173; Vite is configured for **5174**.
- README's project tree references files that don't exist (`jobs/syncConnections.ts`,
  `pages/LoginPage.tsx`).

### Dead / vestigial code

- **`featuredPostUsage`** table — defined and tested but has **no read/write call sites**.
- `linkedin/types.ts` legacy `LinkedInProfile`/`LinkedInConnectionElement`/`LinkedInConnectionsResponse`
  are unused remnants of the abandoned `r_network` connections feature.
- `landing/tailwind.config.ts` was **deleted** in the Tailwind v3→v4 migration (Plan 1 Phase B); its `slotRoll` keyframe
  and the `fadeUp`/`shimmer` keyframes had zero usages and were not ported.

### Stubs / planned

- **Post‑visibility controls** (who sees your posts) — Settings card is a "Coming soon" placeholder (the underlying
  `visibilityIndustries`/`visibilityCountries` fields **are** enforced in the feed, but there's no UI to set them).
- **AI comment generator** — `CommentBox` advertises "AI suggestions coming soon"; no integration.
- **Featured posts quota** — `featuredPostUsage` table exists but is unwired.
- **LinkedIn token refresh** — needed before tokens hit their ~60‑day expiry.
- **Placeholder constants** — `BannedScreen.SUPPORT_EMAIL = 'contact@email.com'` (TODO);
  `STRIPE_WEBHOOK_SECRET=whsec_your_secret` in the committed `.env.local`.

### Roadmap (from README + specs in `docs/`)

AI comment generator (Pro+), LinkedIn MDP/Partner access (unlock mutual‑connections + home‑feed APIs), SSI‑trend
analytics dashboard, proactive token‑refresh cron.

---

## 20. Glossary

- **SSI** — LinkedIn Social Selling Index, 0–100, four 25‑point pillars. The product's north‑star metric.
- **URN** — LinkedIn's resource identifier (e.g. `urn:li:activity:…`, `urn:li:ugcPost:…`,
  `urn:li:share:…`). Used as the post dedupe key; namespaces are **not interchangeable**, which is why `sourceUrl` is
  preserved.
- **Public identifier / vanity name** — the `linkedin.com/in/<name>` slug; **auto‑derived (set‑once)** from a
  name‑verified post's `author.url` and used to seed the Apify profile/post scrape. Post‑ownership verification is
  **name‑based** (the post's JSON‑LD author name vs the member's OIDC `name`), not vanity‑based.
- **Apify** — third‑party scraping platform; the `harvestapi~linkedin-profile-posts` actor fetches a user's recent
  posts.
- **MDP / Partner access** — LinkedIn Marketing/Member Data Partner program; required for the connections and home‑feed
  APIs the product does **not** currently use.
- **Tier rank** — denormalized numeric tier on a post (4 contact … 1 starter) for feed sorting without a join.
- **Member API call** — an authenticated request to `api.linkedin.com` made as the user (Bearer = the user's token). All
  member‑API calls route through the single `linkedin/client.ts`
  `callMemberApi` seam; the OAuth token exchange (client‑secret flow) is separate.

---

## 21. Maintaining This Document

This document is **canonical** and must not be allowed to drift. The rule in `CLAUDE.md` requires that **any code change
or push updates the relevant section (s) here in the same change**. Practical checklist when you touch the codebase:

| If you change…                                                                                                                                                                                                              | Update section(s)                                                                           |
|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------|
| `convex/schema.ts` (tables/fields/indexes)                                                                                                                                                                                  | [§5 Data Model](#5-data-model) (+ ER diagram)                                               |
| Auth/session/OAuth (`http.ts`, `linkedin/*`, `sessions.ts`, `lib/auth.ts`)                                                                                                                                                  | [§7](#7-authentication--identity) (+ flow) and [§17](#17-security-posture)                  |
| Billing/Stripe (`billing.ts`, `stripe.ts`, `http.ts` webhooks, tiers)                                                                                                                                                       | [§8](#8-subscriptions--billing) (+ flow), [§1 tiers](#1-product-overview--business-model)   |
| Plan limits (`lib/planLimits.ts`, `seedPlanLimits.ts`, `admin.ts`)                                                                                                                                                          | [§9](#9-plan-limits-system)                                                                 |
| Posts/sync/queue (`posts.ts`, `jobs/*`, `linkedin/parse*`, `crons.ts`)                                                                                                                                                      | [§10](#10-posts--content-pipeline) (+ flows), [§13](#13-scheduled-jobs-crons)               |
| Feed/interactions/rate limits (`feed.ts`, `interactions.ts`, `lib/rateLimit.ts`)                                                                                                                                            | [§11](#11-feed--engagement) (+ flows)                                                       |
| Search / command palette (`convex/search.ts`, `schema.ts` search indexes, `app/src/components/shell/CommandPalette.tsx`, `TopBar.tsx`, `AppShell.tsx`)                                                                      | [§11B Search & Command Palette](#11b-search--command-palette)                               |
| Admin/moderation (`admin.ts`, ban UI)                                                                                                                                                                                       | [§12](#12-admin--moderation)                                                                |
| Feedback (`convex/feedback/`, `app/src/components/Feedback*`, `app/src/components/RespondFeedbackModal.tsx`, admin Feedback tab)                                                                                            | [§12A](#12a-feedback)                                                                       |
| MOTD (`convex/motd/`, `app/src/components/Motd*`, `app/src/components/MarkdownView*`, admin MOTD tab)                                                                                                                       | [§12B](#12b-message-of-the-day-motd)                                                        |
| App UI (`app/src/**`)                                                                                                                                                                                                       | [§14](#14-frontend--authenticated-app-app)                                                  |
| Design tokens / theme / primitives (`app/src/index.css`, `app/src/lib/theme.ts`, `app/src/components/ThemeProvider.tsx`, `app/src/components/ui/`, `app/src/components/PageHeader.tsx`)                                     | [§14A Design System](#14a-design-system)                                                    |
| Cross-site theme/lang cookies (`app/src/lib/cookies.ts`, `app/src/lib/theme.ts`, `app/src/i18n/index.ts`, `landing/lib/cookies.ts`, `landing/lib/theme.ts`, `landing/app/layout.tsx`, `landing/components/ThemeToggle.tsx`) | [§14B Cross-site Theme & Language Persistence](#14b-cross-site-theme--language-persistence) |
| Landing (`landing/**`)                                                                                                                                                                                                      | [§15](#15-frontend--landing-site-landing)                                                   |
| Any `process.env` / `import.meta.env` usage                                                                                                                                                                                 | [§16 Environment Variables](#16-environment-variables)                                      |
| Tooling/tests/deploy                                                                                                                                                                                                        | [§18](#18-configuration-tooling--testing)                                                   |
| Resolving a stale item / removing dead code                                                                                                                                                                                 | [§19](#19-known-discrepancies-dead-code--roadmap)                                           |

When you add a **new subsystem**, add a new numbered section and a Table‑of‑Contents entry, and add a flow chart
(Mermaid) if it introduces a multi‑step flow.

---

_Last updated: 2026‑06‑21. Updated to reflect locale-routed i18n + pt/es legal drafts (Plan 2):
§15 restructured — added "Locale routing" subsection (middleware flow, root layout, dictionary pattern,
LanguageSelector, hreflang/per-locale metadata, updated route table with locale prefix, legal content modules with pt/es
drafts); also updated route table and footer link paths. Prior: Updated to reflect cross-site theme + lang persistence
(Plan 1 Phase A+B):
§14B added (cross-site cookie persistence, Mermaid flow, palette unification); §14A updated (cookie-primary theme); §15
updated (Tailwind v4, light/dark, ThemeToggle); §16 updated (VITE\_COOKIE\_DOMAIN, NEXT\_PUBLIC\_COOKIE\_DOMAIN);
§2/§3/§4 updated (landing now Tailwind 4); §19 updated (tailwind.config.ts deleted); i18n cookie detector noted. Prior
history: Generated from a full read of the codebase at branch
`feat/initial-setup` (HEAD `f9e48dc`). Reflects the LinkedIn iframe + content‑capture feature (commits `d1b40a2` →
`1fcc123`): Feed/My Posts render posts via the single shared `LinkedInEmbed`
(Option B layout, no raw post text), `submitPost` persists parsed content + structured `mediaUrls`, and `buildEmbedUrl`
preserves the URN namespace. Also reflects the Profile Enrichment feature (Task 14): Apify-driven LinkedIn profile
scrape populating `location`, `primaryLocale`, and
`country` on the `users` table; user-editable `industry`/`country` dropdowns in Settings; admin toggles for the master
Apify kill-switch and profile scrape; and i18n seeding from
`me.primaryLocale` on first authenticated load. Also reflects **Privacy & Compliance Phase 1 (Foundations)**: email
capture from LinkedIn OIDC (stored + forwarded to Stripe), `lastLoginAt` and
`acknowledgedPolicyVersion` on `users`, the new `consentRecords`/`dataExportRequests`/`auditLogs`
tables, the `lib/policy.ts`/`lib/audit.ts`/`lib/email.ts` modules, and the `RESEND_API_KEY`/
`EMAIL_FROM` env vars — see [§13B](#13b-privacy--compliance). Also reflects **Privacy & Compliance Phase 2a (Backend
DSR)**: self-service data export (`convex/privacy/export.ts` — rate-limited
`requestDataExport` mutation + `generateExport` action, 7-day signed download URL) and the 30-day account-deletion
lifecycle (`convex/privacy/deletion.ts` — `requestAccountDeletion` / `cancelAccountDeletion` /
`processAccountDeletions` daily cron; feed exclusion via `isAuthorFeedEligible`; `cascadeDeleteUser`
with auditLog pseudonymization; Stripe subscription cancellation during grace period). The
`process account deletions` cron is documented in [§13](#13-scheduled-jobs-crons). Also reflects **Privacy & Compliance
Phase 2b (Frontend DSR)**: the new guarded `/privacy-data` route (`PrivacyDataPage` — export request/status/download +
delete-with-confirm modal calling
`api.privacy._`), `CancelDeletionScreen`(grace-window interstitial wired into`RequireAuth`), the updated `RequireAuth`
interception order (loading → null → isBanned → deletionScheduledAt → app), the **"Privacy"** link added to`Sidebar`,
and the new `privacy._`i18n namespace (en/pt/es)
— see [§14](#14-frontend--authenticated-app-app). Also reflects **Privacy & Compliance Phase 3a (Consent +
Retention/Dormancy + Re-consent Backend)**: append-only`consentRecords`table with`recordConsent`/
`getConsents`(latest-per-purpose via`latestConsentByPurpose`); `marketing`and`analytics`purposes off by default;
`acknowledgePolicy`stamping`users.acknowledgedPolicyVersion`
for Phase 3b re-consent prompts (`getMe`exposes the field); and the new`enforce data retention`
daily cron (`convex/privacy/retention.ts`) sweeping expired LinkedIn tokens, expiring/purging old export files, purging
audit logs >24 months, and flagging dormant accounts (24 months inactive, non-subscriber) with
`deletionScheduledAt='dormancy'`+ warning email — reusing the Phase 2a`processAccountDeletions`
cascade and`CancelDeletionScreen`for the grace window. See
[§13](#13-scheduled-jobs-crons) and [§13B](#13b-privacy--compliance). Also reflects **Privacy & Compliance Phase 3b (
Consent UI + Re-consent + Cookies Frontend)**:`ConsentToggles`(marketing + analytics toggles, off by default, inside
`PrivacyDataPage`) and `PolicyUpdateScreen`(full-screen`RequireAuth`
interstitial when`acknowledgedPolicyVersion !== POLICY_VERSION`, calls
`acknowledgePolicy`) in the authenticated app — see [§14](#14-frontend--authenticated-app-app);
`CookiesPage` (`/cookies`route, essential-storage-only policy) and`CookieNotice`(dismissible first-visit banner,
`localStorage`-persisted, SSR-safe via `useSyncExternalStore`) in the landing site, with `Footer`updated to link
`/cookies`— see [§15](#15-frontend--landing-site-landing); new i18n keys`privacy.consent._`and`privacy.policyUpdate._`in
all three locales (en/pt/es). Also reflects **Privacy & Compliance Phase 4 (Legal / Transparency Docs)**: six DRAFT
compliance documents created under`docs/compliance/` (`DATA-INVENTORY.md`ROPA,`SUBPROCESSORS.md`,
`RETENTION-POLICY.md`, `GAP-ASSESSMENT.md`, `BREACH-RUNBOOK.md`, `DPA-TEMPLATE.md`) with an index and consolidated
human/legal to-do list in `docs/compliance/README.md`; `/privacy`and`/terms`
landing pages rewritten as full GDPR/LGPD/US-state DRAFT notices (pending legal review); §17 updated with compliance
documentation table; §15 updated to reflect the rewritten legal pages. Also reflects **new-user consent prompt**
(`ConsentPromptScreen`+`completeConsentPrompt`+`users.consentPromptedAt`):
one-time first-login full-screen prompt for Communication & analytics preferences (marketing + analytics toggles, OFF by
default); `RequireAuth` interception order extended with step 6 (`!consentPromptedAt → ConsentPromptScreen`);
`consentPromptedAt`field added to the`users`table (§5);`completeConsentPrompt`mutation documented in §13B; new
`privacy.consentPrompt._` i18n keys in all three locales.\*
