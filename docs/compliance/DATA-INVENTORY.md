> **DRAFT — requires legal review.**
>
> Last updated: 2026-06-16

# Record of Processing Activities (ROPA)

**Controller:** [LEGAL_ENTITY_NAME]  
**Prepared under:** GDPR Art. 30 (and equivalent obligations under UK GDPR, LGPD, and applicable US state law)  
**Scope:** All personal data processed by Link Into The SSI as data controller

---

## Table of Contents

1. [Controller Identity](#1-controller-identity)
2. [Processing Activities](#2-processing-activities)
   - [Activity 1: Authentication & Account](#activity-1-authentication--account)
   - [Activity 2: Profile Attributes](#activity-2-profile-attributes)
   - [Activity 3: Posts (User-Submitted Content)](#activity-3-posts-user-submitted-content)
   - [Activity 4: Engagement Actions](#activity-4-engagement-actions)
   - [Activity 5: LinkedIn OAuth Tokens](#activity-5-linkedin-oauth-tokens)
   - [Activity 6: Billing & Subscription](#activity-6-billing--subscription)
   - [Activity 7: Consent Records](#activity-7-consent-records)
   - [Activity 8: Audit Log](#activity-8-audit-log)
   - [Activity 9: Data-Export Jobs](#activity-9-data-export-jobs)
   - [Activity 10: Contact & Notification Email](#activity-10-contact--notification-email)
   - [Activity 11: Security & Operational Data](#activity-11-security--operational-data)
3. [Legitimate-Interest Assessment (LIA)](#3-legitimate-interest-assessment-lia)
4. [International Transfers](#4-international-transfers)
5. [Data-Subject Rights](#5-data-subject-rights)
6. [Dormant Integrations](#6-dormant-integrations)
7. [Known Gap](#7-known-gap)

---

## 1. Controller Identity

| Field                             | Value                   |
| --------------------------------- | ----------------------- |
| **Legal entity name**             | [LEGAL_ENTITY_NAME]     |
| **Registered address**            | [BUSINESS_ADDRESS]      |
| **Primary privacy contact**       | [PRIVACY_CONTACT_EMAIL] |
| **DPO / EU or UK representative** | [DPO_OR_REP_CONTACT]    |

> **Human action required:** Fill in the bracketed fields above before publishing. Assess whether a formal DPO appointment or an EU/UK representative (GDPR Art. 27) is legally required given the entity's domicile and the scope of processing.

---

## 2. Processing Activities

---

### Activity 1: Authentication & Account

**Purpose:** Create and maintain user accounts; authenticate users to provide and secure the service.

| Attribute                       | Detail                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Data categories**             | LinkedIn member ID (`linkedinId`), full name (`name`), professional headline (`headline`), profile picture URL (`profilePictureUrl`), email address (`email`), email-verified flag (`emailVerified`); also: `tier`, `subscriptionStatus`, `trialEndsAt`, `linkedinPublicIdentifier`, `isAdmin` (admin-only), `isBanned`/`bannedAt`/`bannedBy`/`bannedReason` (moderation state), `acknowledgedPolicyVersion`, `lastLoginAt`, `deletionRequestedAt`/`deletionScheduledAt`/`deletionReason`, `createdAt` |
| **Data subjects**               | Registered users                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| **Source**                      | LinkedIn OIDC token exchange (at login/registration); user-set fields updated via Settings                                                                                                                                                                                                                                                                                                                                                                                                             |
| **Legal basis**                 | **Performance of a contract** (Art. 6(1)(b)) — account is required to deliver the service                                                                                                                                                                                                                                                                                                                                                                                                              |
| **Recipients / sub-processors** | Convex, Inc. (backend / database hosting)                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| **Retention**                   | Retained for the life of the account. On user-requested deletion: 30-day grace period, then hard deletion by the `processAccountDeletions` cron. On dormancy (inactive ≥ 24 months, non-subscribers): scheduled for deletion by the `enforceDataRetention` cron                                                                                                                                                                                                                                        |
| **International transfers**     | United States — Convex, Inc. (Standard Contractual Clauses; see §4)                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| **Security measures**           | Data held in Convex cloud database (encrypted at rest and in transit); session-token authentication; access-control checks on every query/mutation; `isAdmin` flag settable only directly in the database (not via any application mutation); ban state settable only via admin-specific mutations                                                                                                                                                                                                     |

---

### Activity 2: Profile Attributes

**Purpose:** Enable subscription-tier feed targeting (filter by industry and country); seed UI locale/internationalisation.

| Attribute                       | Detail                                                                                                                                                                                                                                                                                                   |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Data categories**             | Professional industry (`industry`), geographic country code (`country`); additionally `location` (human-readable location string) and `primaryLocale` (language code) — the latter two are populated **only** by the Apify profile scrape, which is **disabled at launch** (see §6 Dormant Integrations) |
| **Data subjects**               | Registered users                                                                                                                                                                                                                                                                                         |
| **Source**                      | LinkedIn OIDC token exchange (industry, country); Apify profile scrape (location, primaryLocale) — **DORMANT**                                                                                                                                                                                           |
| **Legal basis**                 | **Legitimate interest** (Art. 6(1)(f)) for feed targeting (see §3 LIA); **performance of a contract** (Art. 6(1)(b)) for locale/UX personalisation                                                                                                                                                       |
| **Recipients / sub-processors** | Convex, Inc. (hosting). **Apify** would become a recipient only if the profile-scrape integration is enabled — it is currently disabled (see §6)                                                                                                                                                         |
| **Retention**                   | Life of account; deleted in the account-deletion cascade                                                                                                                                                                                                                                                 |
| **International transfers**     | United States — Convex, Inc. (SCCs)                                                                                                                                                                                                                                                                      |
| **Security measures**           | Same as Activity 1; `location`/`primaryLocale` are read-only fields for display only                                                                                                                                                                                                                     |

---

### Activity 3: Posts (User-Submitted Content)

**Purpose:** Populate the shared real-time engagement feed so other subscribers can comment and react on posts, increasing their LinkedIn Social Selling Index (SSI).

| Attribute                       | Detail                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Data categories**             | Post text content (`content`), media attachment URLs (`mediaUrls`), LinkedIn post URN (`linkedinPostUrn`), original post URL (`sourceUrl`), publication timestamp (`publishedAt`), like and comment counts (`likeCount`, `commentCount`), author reference (`authorId`), feed-visibility settings (`visibilityIndustries`, `visibilityCountries`), featured flag (`isFeatured`, `featuredAt`), hidden flag (`hidden`), author tier rank at submission (`authorTierRank`), interaction-limit flag (`interactionLimitReached`). Also: queued posts in `postQueue` carry the same content fields plus `queuedAt` |
| **Data subjects**               | The submitting user (author). Post content may incidentally reference third parties who published the content on LinkedIn (see LIA in §3)                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| **Source**                      | **Manual user submission only** — the user pastes or provides a LinkedIn post URL/content via the in-app form. (Automated Apify post sync is **disabled at launch**; see §6)                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| **Legal basis**                 | **Legitimate interest** (Art. 6(1)(f)) — network-effect feed, assessed in §3 LIA; the submission is also a **voluntary user action**                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| **Recipients / sub-processors** | Convex, Inc. (hosting). Other authenticated users of the platform can view submitted posts in the feed (this is the core product purpose)                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| **Retention**                   | Life of account; deleted in the account-deletion cascade. `postQueue` rows are promoted to `posts` or purged with the author                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| **International transfers**     | United States — Convex, Inc. (SCCs)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| **Security measures**           | Feed queries enforce subscription-tier access controls; `hidden` flag prevents display of ineligible content; post submission authenticated via session token; URL validation and SSRF guards on submitted URLs                                                                                                                                                                                                                                                                                                                                                                                               |

---

### Activity 4: Engagement Actions

**Purpose:** Allow users to comment on and react to other users' posts directly via the LinkedIn API, using the acting user's own credentials, in order to raise their LinkedIn SSI score.

| Attribute                       | Detail                                                                                                                                                                                                                                                                                         |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Data categories**             | The user's comment text (transmitted live to LinkedIn; **not** stored by Link Into The SSI beyond the increment of `commentCount`/`likeCount` on the target post). Reaction type (currently always `LIKE`). The **acting user's `linkedinId`** is used to construct the LinkedIn API actor URN |
| **Data subjects**               | The acting user (who comments/reacts); the post author (whose counts are updated)                                                                                                                                                                                                              |
| **Source**                      | User action within the app                                                                                                                                                                                                                                                                     |
| **Legal basis**                 | **Performance of a contract** (Art. 6(1)(b)); the user explicitly authorised this activity via the LinkedIn OAuth consent screen                                                                                                                                                               |
| **Recipients / sub-processors** | **LinkedIn** (the engagement is published to LinkedIn under the user's own identity — LinkedIn is the target platform, not a processor of Link Into The SSI's data); Convex, Inc. (hosting)                                                                                                    |
| **Retention**                   | No engagement payload is stored. Aggregate counts (`likeCount`, `commentCount`) are stored as part of Activity 3 (Posts). Rate-limit records (`rateLimits`) are retained per cron cleanup (see Activity 11)                                                                                    |
| **International transfers**     | United States — Convex, Inc. (SCCs); LinkedIn Corporation (US — separate terms apply per LinkedIn's own privacy policy)                                                                                                                                                                        |
| **Security measures**           | Per-user rate limits enforced server-side (20 comments/hour, 30 reactions/hour); session-token authentication required; tokens validated server-side before each LinkedIn API call                                                                                                             |

---

### Activity 5: LinkedIn OAuth Tokens

**Purpose:** Authenticate Link Into The SSI to the LinkedIn API on the user's behalf, enabling post reading and publishing engagement actions.

| Attribute                       | Detail                                                                                                                                                                                           |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Data categories**             | LinkedIn OAuth access token (`linkedinAccessToken`), refresh token (`linkedinRefreshToken`), token expiry timestamp (`tokenExpiresAt`)                                                           |
| **Data subjects**               | Registered users                                                                                                                                                                                 |
| **Source**                      | LinkedIn OAuth 2.0 authorization flow                                                                                                                                                            |
| **Legal basis**                 | **Performance of a contract** (Art. 6(1)(b))                                                                                                                                                     |
| **Recipients / sub-processors** | Convex, Inc. (hosting). Tokens are **never transmitted to frontend clients** — they are used exclusively in server-side Convex actions when calling the LinkedIn API                             |
| **Retention**                   | Tokens are nulled (set to `null`) automatically by the `enforceDataRetention` cron once `tokenExpiresAt` has passed. Deleted in the account-deletion cascade                                     |
| **International transfers**     | United States — Convex, Inc. (SCCs)                                                                                                                                                              |
| **Security measures**           | Server-only fields — Convex query/mutation code strips these fields from any client-facing projection; never included in feed or public responses; encrypted at rest by Convex; HTTPS in transit |

---

### Activity 6: Billing & Subscription

**Purpose:** Process subscription payments and fulfil contractual billing obligations; satisfy tax and accounting legal obligations.

| Attribute                       | Detail                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Data categories**             | Stripe customer identifier (`stripeCustomerId`); subscription records (`subscriptions` table: `stripeSubscriptionId`, `tier`, `status`, `currentPeriodEnd`); subscription-status mirror fields on the user record (`subscriptionStatus`, `tier`, `trialEndsAt`). **Card or bank data is never stored by Link Into The SSI** — it is held exclusively by Stripe |
| **Data subjects**               | Paying subscribers                                                                                                                                                                                                                                                                                                                                             |
| **Source**                      | Stripe webhook events; Stripe API responses                                                                                                                                                                                                                                                                                                                    |
| **Legal basis**                 | **Performance of a contract** (Art. 6(1)(b)) for subscription management; **legal obligation** (Art. 6(1)(c)) for tax/accounting retention                                                                                                                                                                                                                     |
| **Recipients / sub-processors** | **Stripe, Inc.** (payment processing; see `SUBPROCESSORS.md`); Convex, Inc. (hosting)                                                                                                                                                                                                                                                                          |
| **Retention**                   | `stripeCustomerId` and subscription records are retained while the account exists. Stripe retains invoice and payment records pursuant to applicable tax law, even after the user's account is deleted from Link Into The SSI                                                                                                                                  |
| **International transfers**     | United States — Stripe, Inc. (SCCs / Stripe DPA); Convex, Inc. (SCCs)                                                                                                                                                                                                                                                                                          |
| **Security measures**           | Stripe handles all card data (PCI-DSS compliant); only the Stripe customer ID and subscription identifiers are stored locally; Stripe webhook signature verification (`stripe.webhooks.constructEvent`) on all incoming events                                                                                                                                 |

---

### Activity 7: Consent Records

**Purpose:** Record and demonstrate that user consent (where relied upon) was freely given, specific, informed, and unambiguous; fulfil the accountability obligation under GDPR Art. 7(1).

| Attribute                       | Detail                                                                                                                                                                                                                |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Data categories**             | `consentRecords` table: user reference (`userId`), consent purpose (`purpose`: `marketing` or `analytics`), granted/withdrawn flag (`granted`), policy version at the time (`policyVersion`), timestamp (`createdAt`) |
| **Data subjects**               | Registered users                                                                                                                                                                                                      |
| **Source**                      | User action via Settings → Privacy & Data consent toggles                                                                                                                                                             |
| **Legal basis**                 | **Legal obligation** (Art. 6(1)(c) — Art. 7(1) requires the controller to demonstrate consent)                                                                                                                        |
| **Recipients / sub-processors** | Convex, Inc. (hosting)                                                                                                                                                                                                |
| **Retention**                   | Retained for the life of the account (consent records must be demonstrable for as long as the account exists). Deleted in the account-deletion cascade                                                                |
| **International transfers**     | United States — Convex, Inc. (SCCs)                                                                                                                                                                                   |
| **Security measures**           | Append-only log (records are never overwritten; the latest record per `(userId, purpose)` is the effective state); access restricted to authenticated users querying their own records                                |

---

### Activity 8: Audit Log

**Purpose:** Maintain an accountability record of DSR actions, consent changes, and admin access to personal data, as required by GDPR Art. 5(2) (accountability principle).

| Attribute                       | Detail                                                                                                                                                                                                                                                                                    |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Data categories**             | `auditLogs` table: actor type (`actor`: user / admin / system), actor user reference (`actorId`), action description (`action`), target user reference (`targetUserId`), optional metadata string (`metadata`), timestamp (`createdAt`)                                                   |
| **Data subjects**               | Registered users (as actors or targets of logged actions)                                                                                                                                                                                                                                 |
| **Source**                      | System-generated on DSR requests, consent changes, admin operations, and account lifecycle events                                                                                                                                                                                         |
| **Legal basis**                 | **Legal obligation** (Art. 6(1)(c) — accountability); **legitimate interest** (Art. 6(1)(f)) — retaining evidence of compliance actions                                                                                                                                                   |
| **Recipients / sub-processors** | Convex, Inc. (hosting)                                                                                                                                                                                                                                                                    |
| **Retention**                   | 24 months from creation, enforced by the `enforceDataRetention` cron. On account deletion: `actorId` and `targetUserId` references are pseudonymized (nulled or replaced with a placeholder); the anonymized record may be retained beyond the 24-month window for ongoing accountability |
| **International transfers**     | United States — Convex, Inc. (SCCs)                                                                                                                                                                                                                                                       |
| **Security measures**           | Write-only from application code perspective (no public read API for raw logs); admin access logged within the same table; pseudonymization on account deletion                                                                                                                           |

---

### Activity 9: Data-Export Jobs

**Purpose:** Fulfil the data subject's right of access (GDPR Art. 15) and right to data portability (Art. 20) through an in-app export mechanism.

| Attribute                       | Detail                                                                                                                                                                                                                                                                                                                                |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Data categories**             | `dataExportRequests` table: user reference (`userId`), job status (`status`: pending / ready / failed / expired), request timestamp (`requestedAt`), Convex file-storage reference (`fileStorageId`), expiry timestamp (`expiresAt`). The **export file** (stored in Convex file storage) contains a copy of the user's personal data |
| **Data subjects**               | Registered users requesting a data export                                                                                                                                                                                                                                                                                             |
| **Source**                      | User-initiated via Settings → Privacy & Data                                                                                                                                                                                                                                                                                          |
| **Legal basis**                 | **Legal obligation** (Art. 6(1)(c) — Arts. 15, 20)                                                                                                                                                                                                                                                                                    |
| **Recipients / sub-processors** | Convex, Inc. (hosting and file storage)                                                                                                                                                                                                                                                                                               |
| **Retention**                   | Export files are purged after 7 days by the `enforceDataRetention` cron (`status` set to `expired`; `fileStorageId` deleted from storage). Job metadata records are retained for the life of the account                                                                                                                              |
| **International transfers**     | United States — Convex, Inc. (SCCs)                                                                                                                                                                                                                                                                                                   |
| **Security measures**           | Download link is scoped to the requesting user's authenticated session; file-storage IDs are not guessable; 7-day auto-expiry limits exposure window                                                                                                                                                                                  |

---

### Activity 10: Contact & Notification Email

**Purpose:** Send transactional notifications required by legal or contractual obligations: DSR confirmation emails, data-export ready notifications, and breach notifications to affected users.

| Attribute                       | Detail                                                                                                                                                                                                                        |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Data categories**             | User email address (`email`, from LinkedIn OIDC); user's name (`name`); the notification content (DSR confirmation, export link, or breach notice)                                                                            |
| **Data subjects**               | Registered users                                                                                                                                                                                                              |
| **Source**                      | Email address sourced from LinkedIn OIDC at registration; notification triggered by DSR lifecycle events or a declared security incident                                                                                      |
| **Legal basis**                 | **Legitimate interest** (Art. 6(1)(f)) for operational transactional communications; **legal obligation** (Art. 6(1)(c)) for breach notification under GDPR Art. 34 and equivalent laws                                       |
| **Recipients / sub-processors** | **Resend, Inc.** (transactional email delivery; see `SUBPROCESSORS.md`); Convex, Inc. (hosting)                                                                                                                               |
| **Retention**                   | Email addresses retained for the life of the account (as part of the user record — see Activity 1). Resend retains delivery logs per their own data-retention policy                                                          |
| **International transfers**     | United States — Resend, Inc. (SCCs); Convex, Inc. (SCCs)                                                                                                                                                                      |
| **Security measures**           | Email used **only** for transactional/compliance communications (not marketing — marketing requires separate consent via Activity 7); Resend API key held server-side only; email address captured under `emailVerified` flag |

---

### Activity 11: Security & Operational Data

**Purpose:** Provide secure stateful authentication sessions; prevent CSRF attacks during the OAuth flow; detect and prevent abuse, bot activity, and platform misuse.

| Attribute                       | Detail                                                                                                                                                                                                                                                                                                                                                                           |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Data categories**             | `sessions` table: session token (hashed, `token`), user reference (`userId`), expiry timestamp (`expiresAt`). `oauthStates` table: ephemeral OAuth state nonce (`state`), expiry timestamp (`expiresAt`). `rateLimits` table: user reference (`userId`), action type (`action`), rate-window start (`windowStart`), action count (`count`)                                       |
| **Data subjects**               | Registered users (sessions, rate limits); unauthenticated visitors initiating the LinkedIn OAuth flow (oauthStates)                                                                                                                                                                                                                                                              |
| **Source**                      | System-generated on authentication events and API calls                                                                                                                                                                                                                                                                                                                          |
| **Legal basis**                 | **Legitimate interest** (Art. 6(1)(f)) — security of processing, CSRF protection, and abuse prevention are overriding interests that outweigh any impact on data subjects                                                                                                                                                                                                        |
| **Recipients / sub-processors** | Convex, Inc. (hosting)                                                                                                                                                                                                                                                                                                                                                           |
| **Retention**                   | Sessions: cron-based cleanup of expired entries. `oauthStates`: 10-minute TTL; deleted immediately after use (replay protection) and cleaned up by cron for abandoned entries. `rateLimits`: cron-based cleanup of stale windows. `featuredPostUsage` (monthly post-feature usage counters, keyed by `userId` and month) is also in this category — cleaned up by natural expiry |
| **International transfers**     | United States — Convex, Inc. (SCCs)                                                                                                                                                                                                                                                                                                                                              |
| **Security measures**           | Session tokens are high-entropy random values; `oauthStates` entries are single-use (deleted on callback) and short-lived (10 minutes); rate-limit enforcement is server-side and per-user; all data encrypted at rest and in transit by Convex                                                                                                                                  |

---

## 3. Legitimate-Interest Assessment (LIA)

This assessment applies to the processing in **Activity 3 (Posts)** and, to a lesser extent, **Activity 2 (Profile Attributes for feed targeting)** and **Activity 4 (Engagement)**, all of which rely on Art. 6(1)(f) legitimate interest as a lawful basis.

### Purpose test

**Purpose:** Operate a shared engagement feed where subscribers submit their LinkedIn posts and engage with other subscribers' posts, with the specific aim of improving each participant's LinkedIn Social Selling Index (SSI). This is the core commercial purpose of the service and the primary value exchange the user contracts for.

The purpose is **specific, explicit, and legitimate.** It directly delivers the product the user signed up for.

### Necessity test

The processing is **necessary** to achieve the purpose:

- Post content (`content`, `mediaUrls`, `linkedinPostUrn`, `publishedAt`) must be stored to render the feed.
- Author identity (`authorId`, and by extension `name`, `headline`, `profilePictureUrl` from Activity 1) must be associated with the post to allow other users to make informed engagement decisions.
- Industry and country (`industry`, `country` from Activity 2) are needed to implement feed targeting for Growth/Pro/Contact tiers — without them, tier-based filtering cannot function.
- Engagement counts (`likeCount`, `commentCount`) must be tracked to enforce plan limits.

There is no less-intrusive way to deliver the feed product. Data is limited to what the user explicitly chose to publish on LinkedIn.

### Balancing test

| Factor                        | Assessment                                                                                                                                                                                                                                                                                        |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Nature of the data**        | Professional content the user **voluntarily published on LinkedIn** — not private or sensitive data. Profile attributes (industry, country) are professional/geographic, not special-category data                                                                                                |
| **Reasonable expectations**   | A user who signs in with LinkedIn and submits posts to a LinkedIn engagement platform reasonably expects those posts to be visible to other platform members. This is the explicitly described purpose of the service                                                                             |
| **Impact on data subjects**   | Low. The user controls what they submit. Posts can be hidden or deleted by the user at any time. Opt-out is simple: stop submitting posts, or delete the account                                                                                                                                  |
| **Third-party data in posts** | Post content published by the user on LinkedIn may incidentally reference or mention third parties. Those third parties chose to engage on LinkedIn (a public professional network). The controller does not independently enrich or profile those third parties; the content is reproduced as-is |
| **Safeguards**                | Visibility controls (Growth/Pro tiers can restrict by industry/country); `hidden` flag for admin moderation; account deletion cascade removes all posts; 30-day soft-delete grace period; interaction limits prevent mass-engagement abuse                                                        |

**Conclusion:** Legitimate interest is not overridden by the interests or rights and freedoms of the data subjects. The processing is proportionate, expected, and adequately safeguarded.

**Opt-out mechanism:** Users can object to this processing at any time by stopping post submissions, hiding existing posts, or deleting their account (Settings → Privacy & Data → Delete Account).

---

## 4. International Transfers

All personal data is processed by sub-processors located in the **United States**. The following transfer mechanisms apply:

| Sub-processor        | Role                                      | Transfer mechanism                               |
| -------------------- | ----------------------------------------- | ------------------------------------------------ |
| **Convex, Inc.**     | Backend / database / file-storage hosting | Standard Contractual Clauses (SCCs)              |
| **Stripe, Inc.**     | Payment processing                        | Standard Contractual Clauses (SCCs) + Stripe DPA |
| **Vercel, Inc.**     | Landing site hosting                      | Standard Contractual Clauses (SCCs)              |
| **Railway Corp.**    | Authenticated app hosting                 | Standard Contractual Clauses (SCCs)              |
| **Cloudflare, Inc.** | DNS / CDN                                 | Standard Contractual Clauses (SCCs)              |
| **Resend, Inc.**     | Transactional email delivery              | Standard Contractual Clauses (SCCs)              |

See `docs/compliance/SUBPROCESSORS.md` for the full sub-processor list including DPA links.

> **Human action required:** Confirm that each sub-processor has executed an appropriate SCC-backed DPA before launch. Assess whether a UK International Data Transfer Agreement (IDTA) or addendum is required for UK-resident users.

---

## 5. Data-Subject Rights

The following rights are available to all data subjects. Self-service mechanisms are provided in **Settings → Privacy & Data** in the authenticated app.

| Right                            | How to exercise                                                                                                                                                                                                |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Access (Art. 15)**             | Request a data export in Settings → Privacy & Data → Export My Data. The export is generated and available for download within the app (7-day link)                                                            |
| **Portability (Art. 20)**        | Same as access — the export is provided in a machine-readable format                                                                                                                                           |
| **Erasure (Art. 17)**            | Settings → Privacy & Data → Delete Account. A 30-day grace period applies; hard deletion is performed by the `processAccountDeletions` cron. Stripe billing records required by tax law are retained by Stripe |
| **Rectification (Art. 16)**      | Profile fields can be updated via Settings; LinkedIn OIDC attributes (name, headline, picture) are refreshed on next login                                                                                     |
| **Restriction (Art. 18)**        | Contact [PRIVACY_CONTACT_EMAIL]                                                                                                                                                                                |
| **Objection (Art. 21)**          | For processing based on legitimate interest: withdraw via Settings → Privacy & Data consent toggles; or delete the account                                                                                     |
| **Withdraw consent (Art. 7(3))** | Settings → Privacy & Data → Consent toggles (marketing, analytics). Withdrawal does not affect the lawfulness of processing before withdrawal                                                                  |
| **Lodge a complaint**            | Any data subject may lodge a complaint with the competent supervisory authority in their country of residence                                                                                                  |

All self-service actions are recorded in the audit log (Activity 8). For requests that cannot be fulfilled self-service, contact [PRIVACY_CONTACT_EMAIL].

---

## 6. Dormant Integrations

### Apify — LinkedIn Post Sync & Profile Scrape

**Status: DISABLED IN PRODUCTION**

The codebase contains two Apify-powered integrations:

- **LinkedIn post sync** (`convex/jobs/syncPostsApify.ts`) — would automatically synchronise a user's recent LinkedIn posts via the Apify REST API, without requiring manual submission.
- **LinkedIn profile scrape** (`convex/jobs/scrapeProfileApify.ts`) — would enrich `location` and `primaryLocale` fields on the user record by scraping the user's LinkedIn public profile.

Both integrations are **completely disabled at launch** through multiple independent controls:

1. **Kill-switch flags in `appSettings`:** `apifyEnabled` defaults to `false` when absent (treated as disabled); `apifyProfileScrapeEnabled` defaults to `false` when absent. Both flags would need to be explicitly set to `true` in the database to enable either path.
2. **Environment variables unset:** The `APIFY_*` environment variables required to call the Apify API are not configured in the production environment.
3. **No active cron triggers:** The Apify-powered paths in the cron jobs are gated behind the kill-switch checks and will not execute while the flags are off.

Because both integrations are disabled, **Apify is not a current sub-processor** and is not listed in `docs/compliance/SUBPROCESSORS.md`.

**HARD GATE:** If either Apify integration is ever enabled, **all of the following must be updated in the same code change, before enabling:**

1. This ROPA (DATA-INVENTORY.md) — add Apify as a sub-processor in Activities 2 and 3; update data sources, retention, and transfer sections.
2. The privacy policy (`landing/app/privacy/page.tsx`) — disclose automated profile enrichment and post synchronisation.
3. `docs/compliance/SUBPROCESSORS.md` — add Apify with DPA details.
4. A signed **Data Processing Agreement** with Apify must be in place.
5. A revised **Legitimate-Interest Assessment** (or consent collection) for automated profile scraping must be completed and approved.

---

## 7. Known Gap

### Automated scraping and LinkedIn's User Agreement

If either Apify integration is enabled in the future, the automated fetching of data from LinkedIn (posts and/or public profile pages) may conflict with **LinkedIn's User Agreement**, which restricts automated data collection ("scraping") without express written permission from LinkedIn.

This is a **platform/contract risk** and is **separate from data-protection law** — GDPR/LGPD compliance of the data processing itself does not resolve potential breach of LinkedIn's terms of service.

> **Human action required:** Before enabling any Apify integration, obtain legal advice on (a) LinkedIn's current User Agreement provisions on automated data access, and (b) whether a LinkedIn Partner API arrangement or formal data-access agreement is required. Do not enable the Apify integrations without this assessment.

---

_This document covers all personal-data fields present in `convex/schema.ts` as of the date above. A field-to-activity mapping is maintained below for reference._

### Field-to-Activity Mapping (schema self-check)

| Table                | Field(s)                                                                                                                                                                                                                                         | Activity                                                           |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| `users`              | `linkedinId`, `name`, `headline`, `profilePictureUrl`, `email`, `emailVerified`                                                                                                                                                                  | Activity 1                                                         |
| `users`              | `tier`, `subscriptionStatus`, `trialEndsAt`, `linkedinPublicIdentifier`                                                                                                                                                                          | Activity 1                                                         |
| `users`              | `isAdmin`, `isBanned`, `bannedAt`, `bannedBy`, `bannedReason`                                                                                                                                                                                    | Activity 1                                                         |
| `users`              | `acknowledgedPolicyVersion`, `lastLoginAt`, `deletionRequestedAt`, `deletionScheduledAt`, `deletionReason`, `createdAt`                                                                                                                          | Activity 1                                                         |
| `users`              | `industry`, `country`                                                                                                                                                                                                                            | Activity 2                                                         |
| `users`              | `location`, `primaryLocale`                                                                                                                                                                                                                      | Activity 2 (dormant — see §6)                                      |
| `users`              | `stripeCustomerId`                                                                                                                                                                                                                               | Activity 6                                                         |
| `users`              | `linkedinAccessToken`, `linkedinRefreshToken`, `tokenExpiresAt`                                                                                                                                                                                  | Activity 5                                                         |
| `posts`              | `linkedinPostUrn`, `content`, `mediaUrls`, `publishedAt`, `likeCount`, `commentCount`, `authorId`, `visibilityIndustries`, `visibilityCountries`, `isFeatured`, `featuredAt`, `hidden`, `authorTierRank`, `interactionLimitReached`, `sourceUrl` | Activity 3                                                         |
| `postQueue`          | `linkedinPostUrn`, `content`, `mediaUrls`, `publishedAt`, `likeCount`, `commentCount`, `authorId`, `hidden`, `sourceUrl`, `queuedAt`                                                                                                             | Activity 3                                                         |
| `subscriptions`      | `userId`, `stripeSubscriptionId`, `tier`, `status`, `currentPeriodEnd`                                                                                                                                                                           | Activity 6                                                         |
| `featuredPostUsage`  | `userId`, `month`, `usedCount`                                                                                                                                                                                                                   | Activity 11                                                        |
| `appSettings`        | `apifySyncEnabled`, `apifyEnabled`, `apifyProfileScrapeEnabled`, `lastApifySyncAt`, `lastApifySyncError`                                                                                                                                         | §6 Dormant (operational config, not personal data)                 |
| `sessions`           | `token`, `userId`, `expiresAt`                                                                                                                                                                                                                   | Activity 11                                                        |
| `rateLimits`         | `userId`, `action`, `windowStart`, `count`                                                                                                                                                                                                       | Activity 11                                                        |
| `oauthStates`        | `state`, `expiresAt`                                                                                                                                                                                                                             | Activity 11                                                        |
| `planLimits`         | `tier`, `userId`, `interactionsPerPost`, `postsPerWeek`                                                                                                                                                                                          | Activity 11 (plan-config; `userId` on contact-tier overrides only) |
| `consentRecords`     | `userId`, `purpose`, `granted`, `policyVersion`, `createdAt`                                                                                                                                                                                     | Activity 7                                                         |
| `dataExportRequests` | `userId`, `status`, `requestedAt`, `fileStorageId`, `expiresAt`                                                                                                                                                                                  | Activity 9                                                         |
| `auditLogs`          | `actor`, `actorId`, `action`, `targetUserId`, `metadata`, `createdAt`                                                                                                                                                                            | Activity 8                                                         |
