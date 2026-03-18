# Link Into The SSI — Architecture Design

**Date:** 2026-03-15
**Status:** Approved

---

## Context

"Link Into The SSI" is a LinkedIn growth accelerator SaaS. The core idea: users join the platform, authorize the app to
read their own LinkedIn posts, and in return get access to a feed of posts from all other subscribers. They engage with
those posts (comment, react) directly from the app using their LinkedIn identity — increasing their LinkedIn Social
Selling Index (SSI) through consistent, relevant engagement.

The feed is powered entirely by the app's subscriber base (not the user's full LinkedIn network), creating a
network-effect growth loop: more users → richer feed → more value → more users.

---

## Architecture Overview

### Monorepo Structure

```
/
├── landing/          # Next.js — marketing site, SEO, pricing
├── app/              # React + Vite — authenticated SaaS dashboard
└── convex/           # Convex backend — shared by both apps
```

### Deployment

| Service   | Platform   | Notes                                     |
| --------- | ---------- | ----------------------------------------- |
| landing/  | Vercel     | Next.js, edge-optimized, SSR for SEO      |
| app/      | Railway    | React/Vite, Dockerized static + server    |
| Backend   | Convex.dev | Fully managed, real-time, serverless      |
| DNS / CDN | Cloudflare | Proxy in front of both Vercel and Railway |

**Domain pattern:**

- `linkintothessi.com` → Vercel (landing)
- `app.linkintothessi.com` → Railway (SaaS app)
- Both behind Cloudflare for DDoS protection and caching

---

## Subscription Tiers

| Feature                                   |  Starter ($5/mo)  |    Growth ($15/mo)    | Pro ($50/mo) |  Contact   |
| ----------------------------------------- | :---------------: | :-------------------: | :----------: | :--------: |
| Access feed                               |         ✓         |           ✓           |      ✓       |     ✓      |
| 3-day free trial                          |         ✓         |           —           |      —       |     —      |
| Posts visible to others (during trial)    |         ✗         |           —           |      —       |     —      |
| Posts visible to others (after subscribe) |         ✓         |           ✓           |      ✓       |     ✓      |
| Feed filtered by industry + country       | ✗ (chronological) | ✓ (auto from profile) |  ✓ (custom)  |     ✓      |
| Filter who sees your own posts            |         ✗         |           ✗           |      ✓       |     ✓      |
| Featured posts / month                    |         0         |           1           |      3       |   Custom   |
| AI comment generator                      |    ✗ (future)     |      ✓ (future)       |  ✓ (future)  | ✓ (future) |

**Growth filter notes:** Filters are locked to the user's LinkedIn profile industry and country. Not user-configurable.
**Pro filter notes:** User can configure both what they see AND which industries/countries can see their posts.

---

## Convex Data Model

### `users`

```
linkedinId          string (unique index)
name                string
headline            string
profilePictureUrl   string
industry            string          # from LinkedIn profile
country             string          # from LinkedIn profile
tier                "starter" | "growth" | "pro" | "contact"
subscriptionStatus  "trialing" | "active" | "canceled" | "past_due"
trialEndsAt         number (timestamp, Starter only)
stripeCustomerId    string
linkedinAccessToken  string (server-side only, never in client queries)
linkedinRefreshToken string (server-side only)
tokenExpiresAt      number (timestamp)
createdAt           number (timestamp)
```

### `posts`

```
linkedinPostUrn     string (unique index)  # LinkedIn's URN, e.g. urn:li:ugcPost:123
authorId            Id<"users">
content             string
publishedAt         number (timestamp)
likeCount           number
commentCount        number
mediaUrls           string[]
isFeatured          boolean
featuredAt          number | null          # timestamp when featured, for sort priority
visibilityIndustries string[]              # Pro: empty = visible to all
visibilityCountries  string[]              # Pro: empty = visible to all
hidden              boolean                # true for trial-period posts
```

### `subscriptions`

```
userId              Id<"users">
stripeSubscriptionId string
tier                string
status              string
currentPeriodEnd    number (timestamp)
```

### `featuredPostUsage`

```
userId              Id<"users">
month               string         # e.g. "2026-03"
usedCount           number         # max 3 for Pro
```

---

## Key Flows

### A. LinkedIn OAuth (Sign In)

1. User clicks "Sign in with LinkedIn" → Convex HTTP action generates OAuth URL with scopes:
   `r_liteprofile r_emailaddress r_member_social w_member_social`
2. LinkedIn redirects to callback URL with `code` parameter
3. Convex HTTP action exchanges `code` → `access_token` + `refresh_token`
4. Convex creates or updates `users` record; tokens stored **server-side only**
5. App receives a Convex session identity (never the LinkedIn token)

### B. Post Sync (Convex Scheduled Job — hourly)

1. For each user with `subscriptionStatus = "active"` (not trialing):
   - Call `GET /v2/ugcPosts?q=authors&authors=urn:li:person:{id}` using stored token
   - Upsert posts into Convex `posts` table (deduplicate by `linkedinPostUrn`)
   - Store with `hidden = false`
2. For trial users:
   - Fetch posts but store with `hidden = true`
   - When user subscribes, a Stripe webhook triggers un-hiding their posts
3. Token refresh: if `tokenExpiresAt` is within 7 days, attempt refresh using `refresh_token`
   - LinkedIn tokens expire after 60 days; refresh tokens last longer
   - If refresh fails, mark user as needing re-authentication

### C. Feed Query (Convex real-time query)

Feed is filtered and sorted server-side based on the requesting user's tier:

```
Starter:
  SELECT posts WHERE hidden = false
  ORDER BY isFeatured DESC, featuredAt DESC, publishedAt DESC

Growth:
  SELECT posts WHERE hidden = false
    AND (author.industry = currentUser.industry OR visibilityIndustries = [])
    AND (author.country = currentUser.country OR visibilityCountries = [])
  ORDER BY isFeatured DESC, featuredAt DESC, publishedAt DESC

Pro:
  SELECT posts WHERE hidden = false
    AND (currentUser.industry IN post.visibilityIndustries OR visibilityIndustries = [])
    AND (currentUser.country IN post.visibilityCountries OR visibilityCountries = [])
  ORDER BY isFeatured DESC, featuredAt DESC, publishedAt DESC
```

**Sort priority (all tiers):**

1. Featured posts first (Pro tier `isFeatured = true`)
2. Within featured: most recently featured
3. Non-featured: LinkedIn mutual connections first\*
4. Then same industry + same country
5. Then all others, chronologically

_\*Mutual connections sort: LinkedIn's connections API requires MDP partner access and is NOT available at standard API
tier. At launch, sort falls back to same industry + country. Mutual connection boosting can be added after LinkedIn MDP
partnership._

### D. Comment / React

1. User submits comment/reaction → Convex mutation called from app
2. Convex server function calls LinkedIn API using **the current user's** stored token:
   - Comment: `POST /v2/socialActions/{postUrn}/comments`
   - Reaction: `POST /v2/socialActions/{postUrn}/likes`
3. On success: update `posts.commentCount` or `likeCount` in Convex
4. Convex's reactive queries push the update to all clients viewing that post in real-time

### E. Stripe Payment Flow

1. User selects plan → app calls Convex mutation → Convex creates Stripe Checkout session
2. User completes payment on Stripe-hosted page
3. Stripe webhook hits Convex HTTP action endpoint:
   - `customer.subscription.created` → set tier + status on user
   - `customer.subscription.updated` → update tier/status
   - `customer.subscription.deleted` → downgrade to free/canceled
   - `invoice.payment_failed` → set `past_due`
4. Trial expiry: Convex daily cron checks `trialEndsAt`; if expired and no active subscription, marks user as `canceled`

### F. Featured Posts (Pro)

1. Pro user marks one of their posts as "featured" in the app
2. Convex mutation checks `featuredPostUsage` for current month — if `usedCount >= 3`, reject
3. Sets `posts.isFeatured = true`, `featuredAt = now()`
4. Feed query returns featured posts first for all tiers

---

## LinkedIn API: Known Limitations & Risks

| Capability                     | Available? | Notes                                     |
| ------------------------------ | ---------- | ----------------------------------------- |
| Read own posts                 | ✓          | `r_member_social` scope                   |
| Post comments as user          | ✓          | `w_member_social` scope                   |
| Post reactions as user         | ✓          | `w_member_social` scope                   |
| Read user's connection list    | ✗          | Requires LinkedIn MDP partner access      |
| Read connections' posts (feed) | ✗          | Requires LinkedIn MDP partner access      |
| Token lifetime                 | 60 days    | Must implement refresh flow               |
| Rate limits                    | Yes        | Implement exponential backoff on sync job |

**Critical dependency:** The entire product works within standard LinkedIn OAuth scopes. The only missing capability is
mutual-connections sorting, which is a v2 feature after MDP partnership.

---

## App Pages (React SaaS)

| Route        | Description                                         |
| ------------ | --------------------------------------------------- |
| `/`          | Redirect to `/feed` if logged in, else to login     |
| `/login`     | LinkedIn OAuth entry point                          |
| `/feed`      | Main dashboard — filtered post feed                 |
| `/post/:urn` | Single post view with full comment thread           |
| `/settings`  | Profile settings, filter configuration (tier-gated) |
| `/billing`   | Subscription management, tier upgrade               |

---

## Landing Page (Next.js)

| Page                 | Notes                                        |
| -------------------- | -------------------------------------------- |
| `/`                  | Hero, value prop, social proof               |
| `/pricing`           | Tier comparison table, Stripe Checkout links |
| `/blog`              | Optional — SEO content about LinkedIn SSI    |
| `/privacy`, `/terms` | Legal (required for LinkedIn app approval)   |

---

## Open Questions / Future Work

- **AI comment generator**: Placeholder in comment box UI. Integrate Claude/OpenAI in a later sprint. Gated at Pro+
  tier.
- **LinkedIn MDP**: Apply for partner status to unlock mutual-connections API and potentially the home feed endpoint.
- **Analytics dashboard**: Show user's SSI trend over time (requires SSI API, which is MDP-only).
