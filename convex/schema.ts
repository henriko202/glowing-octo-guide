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
    .index('by_tier', ['tier']),

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
    sourceUrl: v.optional(v.string())
  })
    .index('by_author', ['authorId'])
    .index('by_urn', ['linkedinPostUrn'])
    .index('by_featured', ['isFeatured', 'featuredAt'])
    .index('by_published', ['hidden', 'publishedAt'])
    .index('by_author_and_publishedAt', ['authorId', 'publishedAt'])
    .index('by_feed', ['hidden', 'isFeatured', 'featuredAt']),

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
    .index('by_created', ['createdAt'])
})
