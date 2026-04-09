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
    tier: v.union(
      v.literal('starter'),
      v.literal('growth'),
      v.literal('pro'),
      v.literal('contact')
    ),
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
    .index('by_urn', ['linkedinPostUrn'])
})
