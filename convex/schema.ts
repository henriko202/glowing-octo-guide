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
    .index('by_stripe_customer', ['stripeCustomerId']),

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
    // Original URL submitted by the user — stored so we can link back correctly
    // without reconstructing URNs (activity IDs ≠ ugcPost IDs across LinkedIn namespaces).
    // Absent for cron-synced posts (those use urnToLinkedInUrl fallback).
    sourceUrl: v.optional(v.string())
  })
    .index('by_author', ['authorId'])
    .index('by_urn', ['linkedinPostUrn'])
    .index('by_featured', ['isFeatured', 'featuredAt'])
    .index('by_published', ['hidden', 'publishedAt'])
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
  })
})
