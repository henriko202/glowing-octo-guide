// convex/linkedin/auth.ts
import { internalMutationGeneric as internalMutation } from 'convex/server'
import { v } from 'convex/values'
import type { UpsertDb } from '../convexTypes.js'

const TRIAL_DURATION_MS = 3 * 24 * 60 * 60 * 1000

export interface UpsertUserArgs {
  linkedinId: string
  name: string
  headline?: string
  profilePictureUrl?: string
  accessToken: string
  refreshToken?: string // LinkedIn standard OAuth may omit refresh_token
  tokenExpiresAt: number
  linkedinPublicIdentifier?: string // vanityName from /rest/identityMe — null-safe
}

// Plain handler function — used by the registered mutation and testable in isolation
export async function upsertUserHandler(db: UpsertDb, args: UpsertUserArgs): Promise<string> {
  const existing = await db
    .query('users')
    .withIndex('by_linkedin_id', q => q.eq('linkedinId', args.linkedinId))
    .first()

  if (existing) {
    const patch: Record<string, unknown> = {
      // SECURITY: isAdmin is intentionally excluded — it can only be set directly in the DB
      name: args.name,
      headline: args.headline,
      profilePictureUrl: args.profilePictureUrl,
      linkedinAccessToken: args.accessToken,
      linkedinRefreshToken: args.refreshToken,
      tokenExpiresAt: args.tokenExpiresAt
    }
    // Only update publicIdentifier if we have a fresh value — preserves manually-set values
    if (args.linkedinPublicIdentifier) {
      patch.linkedinPublicIdentifier = args.linkedinPublicIdentifier
    }
    await db.patch(existing._id, patch)
    return existing._id
  }

  const trialEndsAt = Date.now() + TRIAL_DURATION_MS
  return await db.insert('users', {
    // SECURITY: isAdmin is intentionally excluded — only settable via direct DB edit
    linkedinId: args.linkedinId,
    name: args.name,
    headline: args.headline,
    profilePictureUrl: args.profilePictureUrl,
    linkedinPublicIdentifier: args.linkedinPublicIdentifier,
    tier: 'starter' as const,
    subscriptionStatus: 'trialing' as const,
    trialEndsAt,
    linkedinAccessToken: args.accessToken,
    linkedinRefreshToken: args.refreshToken,
    tokenExpiresAt: args.tokenExpiresAt,
    createdAt: Date.now()
  })
}

// Registered Convex internal mutation — delegates to the plain handler
export const upsertUser = internalMutation({
  args: {
    linkedinId: v.string(),
    name: v.string(),
    headline: v.optional(v.string()),
    profilePictureUrl: v.optional(v.string()),
    accessToken: v.string(),
    refreshToken: v.optional(v.string()), // optional — LinkedIn may not return it
    tokenExpiresAt: v.number(),
    linkedinPublicIdentifier: v.optional(v.string())
  },
  handler: async (ctx, args) => upsertUserHandler(ctx.db as unknown as UpsertDb, args as UpsertUserArgs)
})
