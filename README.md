# Link Into The SSI

A LinkedIn growth accelerator SaaS. Users authorize the app to read their LinkedIn posts, then get access to a real-time
feed of posts from all other subscribers. They engage (comment, react) directly from the app using their LinkedIn
identity — growing their LinkedIn Social Selling Index (SSI) through consistent, relevant engagement.

**Network effect:** More users → richer feed → more engagement → higher SSI → more users.

---

## Architecture

```
/
├── landing/    # Next.js — marketing site, SEO, pricing
├── app/        # React + Vite — authenticated SaaS dashboard
└── convex/     # Convex backend — shared by both apps
```

| Service   | Platform   | URL                             |
| --------- | ---------- | ------------------------------- |
| landing/  | Vercel     | `linkintothessi.com`            |
| app/      | Railway    | `app.linkintothessi.com`        |
| Backend   | Convex.dev | Managed serverless              |
| DNS / CDN | Cloudflare | In front of both Vercel/Railway |

---

## Tech Stack

- **Frontend (app):** React 19, Vite, TypeScript, Tailwind CSS, react-i18next (en/pt/es)
- **Landing:** Next.js 14, TypeScript, Tailwind CSS
- **Backend:** [Convex](https://convex.dev) — real-time, serverless, TypeScript-native
- **Auth:** LinkedIn 3-legged OAuth (`r_liteprofile`, `r_member_social`, `w_member_social`, `r_network`)
- **Payments:** Stripe via [@convex-dev/stripe](https://www.convex.dev/components/stripe)
- **Testing:** Vitest + React Testing Library

---

## Prerequisites

- Node.js 20+
- pnpm 9+
- A [Convex](https://dashboard.convex.dev) account
- A [LinkedIn Developer App](https://www.linkedin.com/developers/apps) with OAuth 2.0 enabled
- A [Stripe](https://dashboard.stripe.com) account

---

## Local Development

### 1. Install dependencies

```bash
pnpm install
```

### 2. Set up Convex

```bash
cd convex
npx convex dev --once   # creates convex.json and _generated/
```

Set environment variables in the [Convex dashboard](https://dashboard.convex.dev) (Settings → Environment Variables):

```
LINKEDIN_CLIENT_ID=<your LinkedIn app client ID>
LINKEDIN_CLIENT_SECRET=<your LinkedIn app client secret>
LINKEDIN_REDIRECT_URI=https://<your-deployment>.convex.site/auth/linkedin/callback
# ↑ Must point to Convex (.convex.site), NOT the React app.
#   LinkedIn sends the code to Convex, which exchanges it server-side (keeps client secret safe).
#   After upsert, Convex redirects the user to APP_URL/auth/success?userId=...
APP_URL=http://localhost:5173
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_STARTER_PRICE_ID=price_...
STRIPE_GROWTH_PRICE_ID=price_...
STRIPE_PRO_PRICE_ID=price_...
```

### 3. Configure the app

```bash
cp app/.env.example app/.env.local
```

Edit `app/.env.local`:

```
VITE_CONVEX_URL=https://<your-deployment>.convex.cloud
VITE_STRIPE_STARTER_PRICE_ID=price_...
VITE_STRIPE_GROWTH_PRICE_ID=price_...
VITE_STRIPE_PRO_PRICE_ID=price_...
```

### 4. Configure the landing page

```bash
cp landing/.env.example landing/.env.local
```

Edit `landing/.env.local`:

```
NEXT_PUBLIC_APP_URL=http://localhost:5173
```

### 5. Start all services

```bash
# Terminal 1 — Convex backend
pnpm dev:convex

# Terminal 2 — React app
pnpm dev:app

# Terminal 3 — Next.js landing (optional for local dev)
pnpm dev:landing
```

The app runs at `http://localhost:5173`, landing at `http://localhost:3000`.

---

## Subscription Tiers

| Feature                             | Starter ($5/mo) | Growth ($15/mo) | Pro ($50/mo) | Contact |
| ----------------------------------- | :-------------: | :-------------: | :----------: | :-----: |
| Access feed                         |        ✓        |        ✓        |      ✓       |    ✓    |
| 3-day free trial                    |        ✓        |        —        |      —       |    —    |
| Feed filtered by industry + country |        ✗        |    ✓ (auto)     |  ✓ (custom)  |    ✓    |
| Filter who sees your posts          |        ✗        |        ✗        |      ✓       |    ✓    |
| Featured posts / month              |        0        |        1        |      3       | Custom  |
| AI comment generator                |   ✗ (future)    |   ✓ (future)    |  ✓ (future)  |    ✓    |

---

## Key Flows

### LinkedIn OAuth

1. User clicks "Sign in with LinkedIn" → Convex HTTP action redirects to LinkedIn
2. LinkedIn returns `code` → Convex exchanges for tokens + fetches profile
3. User record created/updated in Convex (tokens stored server-side only — never exposed to clients)

### Post Sync (hourly cron)

- Active subscribers: posts fetched and stored with `hidden = false`
- Trial users: posts stored with `hidden = true`
- When trial user subscribes, Stripe webhook triggers un-hiding of their posts
- Token refresh attempted automatically when within 7 days of expiry

### Feed Query (real-time)

Sort priority across all tiers:

1. Featured posts first (Pro)
2. Mutual LinkedIn connections (cached weekly from `r_network` scope)
3. Same industry + same country
4. Chronological

Tier gating:

- **Starter:** all visible posts, chronological
- **Growth:** filtered to user's LinkedIn industry + country (auto-detected)
- **Pro:** user-configurable industry/country filters for both viewing and visibility

### Comment / React

User submits → Convex action calls LinkedIn API using the **user's own** stored token → count updated in Convex →
real-time push to all clients viewing that post.

---

## Project Structure

```
convex/
├── schema.ts                  # Database schema (5 tables)
├── convex.config.ts           # Registers @convex-dev/stripe component
├── http.ts                    # LinkedIn OAuth HTTP endpoints
├── users.ts                   # Public + internal user queries
├── feed.ts                    # Tier-gated feed query
├── interactions.ts            # Comment + reaction actions
├── billing.ts                 # Stripe Checkout session creation
├── stripe.ts                  # Stripe webhook mutation handlers
├── convexTypes.ts             # Structural ctx/db types (pre-codegen)
├── linkedin/
│   ├── types.ts               # LinkedIn API response interfaces
│   ├── oauth.ts               # OAuth URL builder + token exchange
│   ├── posts.ts               # Post fetcher + parser
│   └── auth.ts                # User upsert mutation
└── jobs/
    ├── syncPosts.ts           # Hourly post sync cron
    └── syncConnections.ts     # Weekly connections cache cron

app/src/
├── i18n/
│   ├── index.ts               # i18next init (?lang= → browser language)
│   └── locales/               # en.json, pt.json, es.json
├── pages/
│   ├── LoginPage.tsx
│   ├── FeedPage.tsx
│   ├── SettingsPage.tsx
│   ├── BillingPage.tsx
│   └── AuthSuccessPage.tsx
├── components/
│   ├── PostCard.tsx
│   └── CommentBox.tsx
├── convex.ts                  # API shim until npx convex dev generates _generated/
└── main.tsx

landing/
├── app/
│   ├── page.tsx               # Homepage
│   ├── pricing/page.tsx
│   ├── privacy/page.tsx
│   └── terms/page.tsx
└── components/
    ├── Nav.tsx
    ├── Hero.tsx               # Slot-machine headline animation
    ├── HowItWorks.tsx
    ├── Features.tsx
    ├── Pricing.tsx
    └── FinalCTA.tsx
```

---

## Testing

```bash
# Convex backend
pnpm --filter convex test

# React app
pnpm --filter app test

# Run all tests
pnpm -r test
```

---

## Internationalisation

The app supports English, Portuguese, and Spanish. Language is detected in order:

1. `?lang=en` / `?lang=pt` / `?lang=es` URL query parameter
2. Browser language (`navigator.language`)
3. Fallback: English

---

## Deployment

### Convex

```bash
cd convex && npx convex deploy
```

### App (Railway)

The `app/` directory includes a `Dockerfile` and `nginx.conf` for Railway deployment. Set the same environment variables
as local dev (using production values).

### Landing (Vercel)

Connect the repo to Vercel, set the root directory to `landing/`, and add
`NEXT_PUBLIC_APP_URL=https://app.linkintothessi.com`.

---

## LinkedIn API Notes

| Capability                     | Available? | Notes                                                          |
| ------------------------------ | ---------- | -------------------------------------------------------------- |
| Read own posts                 | ✓          | `r_member_social` scope                                        |
| Post comments as user          | ✓          | `w_member_social` scope                                        |
| Post reactions as user         | ✓          | `w_member_social` scope                                        |
| Read 1st-degree connections    | ✓          | `r_network` scope (degrades to 403 gracefully if not approved) |
| Read connections' posts (feed) | ✗          | Requires LinkedIn MDP partner access                           |
| Token lifetime                 | 60 days    | Refresh flow implemented                                       |

The app requires LinkedIn app approval for `r_member_social` and `w_member_social` scopes before going live. The
`privacy` and `terms` pages at `/privacy` and `/terms` are required by LinkedIn for app review.

---

## Open Questions / Roadmap

- **AI comment generator** — Placeholder in `CommentBox`. Wire to Claude API in a future sprint (Pro+ tier).
- **LinkedIn MDP** — Apply for partner status to unlock mutual-connections API and potentially the home feed endpoint.
- **Analytics dashboard** — Show user's SSI trend over time (requires SSI API, MDP-only).
- **Token refresh cron** — LinkedIn tokens expire after 60 days. Implement proactive refresh job.
