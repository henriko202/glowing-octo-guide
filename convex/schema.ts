import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

export default defineSchema({
  users: defineTable({
    linkedinId: v.string(),
    name: v.string(),
    headline: v.optional(v.string()),
    profilePictureUrl: v.optional(v.string()),
    industry: v.optional(v.string()),
    country: v.optional(v.string()),
    // Scraped LinkedIn profile location, e.g. "Curitiba, Paraná, Brazil". Read-only display
    // (set only by the profile scrape). Distinct from `country` (geographic ISO alpha-2 code).
    location: v.optional(v.string()),
    // Scraped LinkedIn primary-locale language code (e.g. "en"). Drives the UI i18n seed only.
    primaryLocale: v.optional(v.string()),
    tier: v.optional(v.union(v.literal('starter'), v.literal('growth'), v.literal('pro'), v.literal('contact'))),
    subscriptionStatus: v.union(
      v.literal('trialing'),
      v.literal('active'),
      v.literal('canceled'),
      v.literal('past_due'),
      v.literal('none')
    ),
    trialEndsAt: v.optional(v.number()),
    stripeCustomerId: v.optional(v.string()),
    linkedinAccessToken: v.optional(v.string()),
    linkedinRefreshToken: v.optional(v.string()),
    tokenExpiresAt: v.optional(v.number()),
    // The user's LinkedIn public profile identifier (vanityName / publicIdentifier).
    // Set once by the user in Settings. Used for post ownership verification without
    // requiring LinkedIn Partner API access.
    linkedinPublicIdentifier: v.optional(v.string()),
    // Admin flag — MUST only be set directly in the database.
    // All application code (upsertUser, setPublicIdentifier, etc.) must ignore this field.
    isAdmin: v.optional(v.boolean()),
    // Ban state — set/cleared only by the admin banUser/unbanUser mutations.
    // bannedReason is user-visible (shown on the banned screen).
    isBanned: v.optional(v.boolean()),
    bannedAt: v.optional(v.number()),
    bannedBy: v.optional(v.id('users')),
    bannedReason: v.optional(v.string()),
    // ─── Privacy & compliance ────────────────────────────────────────────────
    // Contact channel captured from the LinkedIn OIDC `email` claim (previously discarded).
    // Used for DSR confirmations and breach notification. Stored under legitimate interest /
    // legal obligation, NOT marketing consent.
    email: v.optional(v.string()),
    emailVerified: v.optional(v.boolean()),
    // Account-deletion lifecycle (self-service erasure + dormancy). Presence of
    // `deletionScheduledAt` means the account is pending hard-deletion by the cron.
    deletionRequestedAt: v.optional(v.number()),
    deletionScheduledAt: v.optional(v.number()),
    deletionReason: v.optional(v.union(v.literal('user_request'), v.literal('dormancy'))),
    // Set on each login (in upsertUser); powers the dormancy retention check.
    lastLoginAt: v.optional(v.number()),
    // The privacy-policy version this user last acknowledged (drives the re-consent prompt).
    acknowledgedPolicyVersion: v.optional(v.string()),
    // When the user completed the one-time consent prompt (marketing/analytics). Unset ⇒ prompt on login.
    consentPromptedAt: v.optional(v.number()),
    // When the user was shown the one-time "confirm your LinkedIn profile URL" onboarding prompt.
    // Unset AND no linkedinPublicIdentifier ⇒ show the prompt on login (see App RequireAuth).
    publicIdentifierPromptedAt: v.optional(v.number()),
    createdAt: v.number()
  })
    .index('by_linkedin_id', ['linkedinId'])
    .index('by_stripe_customer', ['stripeCustomerId'])
    .index('by_tier', ['tier'])
    // Active-subscriber fan-out (Apify post sync). Replaces a full-table .filter() scan.
    .index('by_subscription_status', ['subscriptionStatus'])
    // Data-retention cron: target users whose LinkedIn token has expired directly,
    // instead of scanning every user that still holds a token.
    .index('by_token_expiry', ['tokenExpiresAt'])
    // Serves BOTH privacy crons from one compound index:
    //  • processAccountDeletions: range on the leading field — deletionScheduledAt in (0, now].
    //  • dormancy sweep: eq(deletionScheduledAt, undefined) + range on lastLoginAt.
    // Because flagging a dormant user SETS deletionScheduledAt, that row immediately leaves
    // the dormancy range — so the retention cron can self-reschedule without re-reading it.
    .index('by_deletion_and_last_login', ['deletionScheduledAt', 'lastLoginAt']),

  posts: defineTable({
    linkedinPostUrn: v.string(),
    authorId: v.id('users'),
    content: v.string(),
    publishedAt: v.number(),
    likeCount: v.number(),
    commentCount: v.number(),
    mediaUrls: v.array(v.string()),
    isFeatured: v.boolean(),
    featuredAt: v.optional(v.number()),
    visibilityIndustries: v.array(v.string()),
    visibilityCountries: v.array(v.string()),
    hidden: v.boolean(),
    // Numeric rank of the author's subscription tier at post-write time.
    // 4=contact, 3=pro, 2=growth, 1=starter. Used to filter/sort by tier without
    // a join. Optional so existing posts without this field remain valid.
    authorTierRank: v.optional(v.number()),
    // Set to true when likeCount + commentCount >= the author's interactionsPerPost
    // plan limit. Optional so existing posts without this field remain valid.
    interactionLimitReached: v.optional(v.boolean()),
    // Original URL submitted by the user — stored so we can link back correctly
    // without reconstructing URNs (activity IDs ≠ ugcPost IDs across LinkedIn namespaces).
    // Absent for cron-synced posts (those use urnToLinkedInUrl fallback).
    sourceUrl: v.optional(v.string()),
    // Soft-delete marker. When set, the post is excluded from the feed AND the
    // author's My Posts view, but the row is intentionally KEPT so it still counts
    // toward the rolling weekly post limit (deleting must not free up a slot).
    deletedAt: v.optional(v.number()),
    // ─── Feed cursor-pagination (denormalized, maintained by lib/feedRank.ts) ────
    // Single descending sort key encoding featured→tier→recency; see computeFeedFields.
    // Optional during the widen→backfill rollout — old posts are stamped by the
    // backfill migration before getFeed switches to the by_feed_rank index.
    feedRank: v.optional(v.number()),
    // True iff the post passes the non-viewer-specific feed filters
    // (hidden === false && !interactionLimitReached && deletedAt === undefined).
    inFeed: v.optional(v.boolean())
  })
    .index('by_author', ['authorId'])
    .index('by_urn', ['linkedinPostUrn'])
    .index('by_featured', ['isFeatured', 'featuredAt'])
    .index('by_published', ['hidden', 'publishedAt'])
    .index('by_author_and_publishedAt', ['authorId', 'publishedAt'])
    .index('by_feed', ['hidden', 'isFeatured', 'featuredAt'])
    // Cursor-pagination index for getFeed: walk inFeed=true posts in feedRank desc order.
    .index('by_feed_rank', ['inFeed', 'feedRank']),

  subscriptions: defineTable({
    userId: v.id('users'),
    stripeSubscriptionId: v.string(),
    tier: v.union(v.literal('starter'), v.literal('growth'), v.literal('pro'), v.literal('contact')),
    status: v.string(),
    currentPeriodEnd: v.optional(v.number())
  })
    .index('by_user', ['userId'])
    .index('by_stripe_id', ['stripeSubscriptionId']),

  featuredPostUsage: defineTable({
    userId: v.id('users'),
    month: v.string(),
    usedCount: v.number()
  }).index('by_user_month', ['userId', 'month']),

  appSettings: defineTable({
    apifySyncEnabled: v.boolean(),
    // Master Apify kill-switch. Absent ⇒ treated as enabled (true). When false, ALL Apify
    // integration halts (post sync AND profile scrape).
    apifyEnabled: v.optional(v.boolean()),
    // Gates the LinkedIn profile scrape. Absent ⇒ disabled (false) — opt-in (paid actor).
    apifyProfileScrapeEnabled: v.optional(v.boolean()),
    lastApifySyncAt: v.optional(v.number()),
    lastApifySyncError: v.optional(v.string())
  }),

  sessions: defineTable({
    token: v.string(),
    userId: v.id('users'),
    expiresAt: v.number()
  })
    .index('by_token', ['token'])
    .index('by_userId', ['userId']),

  rateLimits: defineTable({
    userId: v.id('users'),
    action: v.string(),
    windowStart: v.number(),
    count: v.number()
  }).index('by_user_and_action', ['userId', 'action']),

  // Ephemeral OAuth state storage for CSRF protection.
  // Each entry lives for 10 minutes — enough time to complete the LinkedIn OAuth flow.
  // Validated on callback; deleted immediately after use (replay protection).
  oauthStates: defineTable({
    state: v.string(),
    expiresAt: v.number()
  }).index('by_state', ['state']),

  // Subscription-tier limits for post interactions and weekly post volume.
  // The contact tier supports optional per-user overrides via userId.
  planLimits: defineTable({
    tier: v.union(v.literal('starter'), v.literal('growth'), v.literal('pro'), v.literal('contact')),
    userId: v.optional(v.id('users')), // Only set for contact-tier per-user overrides
    interactionsPerPost: v.number(),
    postsPerWeek: v.number()
  })
    .index('by_tier', ['tier'])
    .index('by_user', ['userId']),

  // Overflow queue for posts that could not be inserted because the author was at
  // their weekly post limit. A daily cron promotes queued posts to the posts table
  // when capacity opens (i.e. old posts fall outside the 7-day window).
  postQueue: defineTable({
    linkedinPostUrn: v.string(),
    authorId: v.id('users'),
    content: v.string(),
    publishedAt: v.number(),
    likeCount: v.number(),
    commentCount: v.number(),
    mediaUrls: v.array(v.string()),
    hidden: v.boolean(),
    sourceUrl: v.optional(v.string()),
    queuedAt: v.number()
  })
    .index('by_author', ['authorId'])
    .index('by_urn', ['linkedinPostUrn']),

  // Append-only consent/withdrawal log. Current effective consent for a purpose is the
  // latest record for (userId, purpose). 'location_enrichment' is reserved for future use
  // (the Apify profile scrape is disabled at launch).
  consentRecords: defineTable({
    userId: v.id('users'),
    purpose: v.union(v.literal('marketing'), v.literal('analytics')),
    granted: v.boolean(),
    policyVersion: v.string(),
    createdAt: v.number()
  })
    .index('by_user', ['userId'])
    .index('by_user_and_purpose', ['userId', 'purpose']),

  // Tracks asynchronous data-export jobs. The generated bundle is held in Convex file
  // storage; the link expires (fileStorageId/expiresAt) and is purged by the retention cron.
  dataExportRequests: defineTable({
    userId: v.id('users'),
    status: v.union(v.literal('pending'), v.literal('ready'), v.literal('failed'), v.literal('expired')),
    requestedAt: v.number(),
    fileStorageId: v.optional(v.id('_storage')),
    expiresAt: v.optional(v.number())
  }).index('by_user', ['userId']),

  // Accountability log (GDPR Art. 5(2)) for DSR actions, consent changes, and admin access
  // to personal data. A pseudonymized subset is retained past account deletion.
  auditLogs: defineTable({
    actor: v.union(v.literal('user'), v.literal('admin'), v.literal('system')),
    actorId: v.optional(v.id('users')),
    action: v.string(),
    targetUserId: v.optional(v.id('users')),
    metadata: v.optional(v.string()),
    createdAt: v.number()
  })
    .index('by_target', ['targetUserId'])
    .index('by_created', ['createdAt']),

  // User-submitted product feedback. Authenticated submitters; admins reply by email
  // (status → 'responded'). On account deletion the row is ANONYMIZED, not deleted:
  // userId is cleared (→ undefined) while the content is retained. See convex/privacy/deletion.ts.
  feedback: defineTable({
    userId: v.optional(v.id('users')), // submitter; set on submit, CLEARED on account deletion (anonymize)
    category: v.union(
      v.literal('feature_request'),
      v.literal('bug'),
      v.literal('comment'),
      v.literal('criticism'),
      v.literal('praise'),
      v.literal('question'),
      v.literal('suggestion'),
      v.literal('other')
    ),
    message: v.string(),
    status: v.union(v.literal('new'), v.literal('responded'), v.literal('archived')),
    createdAt: v.number(),
    // DEPRECATED — superseded by feedbackResponses table (Task 10).
    // Retained as v.optional to avoid a schema-narrowing migration on existing rows.
    // Stop writing these fields; read feedbackResponses instead.
    responseText: v.optional(v.string()),
    respondedAt: v.optional(v.number()),
    respondedBy: v.optional(v.id('users'))
  })
    .index('by_user', ['userId']) // export + locate rows to anonymize on deletion
    .index('by_status', ['status', 'createdAt']), // reserved for future server-side status triage

  // Append-only reply log for feedback items. Replaces the single-reply fields on the
  // feedback row (responseText/respondedAt/respondedBy). Each admin reply is a separate row.
  // Index order: feedbackId first (equality), createdAt second (range / chronological).
  feedbackResponses: defineTable({
    feedbackId: v.id('feedback'),
    responderId: v.id('users'),
    text: v.string(),
    createdAt: v.number()
  }).index('by_feedback', ['feedbackId', 'createdAt']),

  // Admin-authored Message of the Day. Exactly one is shown at a time (the newest enabled
  // row whose [startAt, expiresAt) window covers "now" — see convex/motd/motd.ts:selectActiveMotd).
  // `bodies` is a locale->markdown map; `en` is required (enforced in validation) and is the
  // fallback for locales without their own body. A record (not a fixed object) so new locales
  // need no schema migration. Admin content — not personal data, hard-deleted on removal.
  motds: defineTable({
    bodies: v.record(v.string(), v.string()),
    important: v.boolean(), // false -> banner, true -> blocking modal
    enabled: v.boolean(),
    startAt: v.optional(v.number()), // optional scheduled start (ms epoch)
    expiresAt: v.optional(v.number()), // optional "limited date" (ms epoch)
    createdBy: v.id('users'),
    createdAt: v.number(),
    updatedAt: v.number()
  }).index('by_enabled_and_created', ['enabled', 'createdAt'])
})
