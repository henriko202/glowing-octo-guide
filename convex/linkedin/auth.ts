// convex/linkedin/auth.ts
import { internalMutationGeneric as internalMutation } from 'convex/server'
import { v } from 'convex/values'
import { POLICY_VERSION } from '../lib/policy.js'

// Narrow db surface for upsertUserHandler — defined locally (not from generated types) so the
// handler stays unit-testable with a plain in-memory mock. Mirrors only the ctx.db calls it makes.
interface UpsertIndexQuery {
  eq(field: string, value: unknown): UpsertIndexQuery
}
interface UpsertDb {
  query(table: string): {
    withIndex(name: string, fn: (q: UpsertIndexQuery) => UpsertIndexQuery): { first(): Promise<{ _id: string } | null> }
  }
  patch(id: string, fields: Record<string, unknown>): Promise<void>
  insert(table: string, doc: Record<string, unknown>): Promise<string>
}

export interface UpsertUserArgs {
  linkedinId: string
  name: string
  headline?: string
  profilePictureUrl?: string
  accessToken: string
  refreshToken?: string // LinkedIn standard OAuth may omit refresh_token
  tokenExpiresAt: number
  email?: string
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
      tokenExpiresAt: args.tokenExpiresAt,
      email: args.email,
      lastLoginAt: Date.now()
    }
    await db.patch(existing._id, patch)
    return existing._id
  }

  return await db.insert('users', {
    // SECURITY: isAdmin is intentionally excluded — only settable via direct DB edit
    linkedinId: args.linkedinId,
    name: args.name,
    headline: args.headline,
    profilePictureUrl: args.profilePictureUrl,
    tier: 'starter' as const,
    subscriptionStatus: 'none' as const,
    linkedinAccessToken: args.accessToken,
    linkedinRefreshToken: args.refreshToken,
    tokenExpiresAt: args.tokenExpiresAt,
    email: args.email,
    lastLoginAt: Date.now(),
    acknowledgedPolicyVersion: POLICY_VERSION,
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
    email: v.optional(v.string())
  },
  handler: async (ctx, args) => upsertUserHandler(ctx.db as unknown as UpsertDb, args as UpsertUserArgs)
})

/** Narrow db surface for updateTokensHandler — only ever patches by known id. */
interface UpdateTokensDb {
  patch(id: string, fields: Record<string, unknown>): Promise<void>
}

export interface UpdateTokensArgs {
  userId: string
  accessToken: string
  refreshToken?: string
  tokenExpiresAt: number
}

// Plain handler — used by the registered mutation and testable in isolation. Called by the
// refresh cron (linkedin/tokenRefresh.ts) after a successful refreshAccessToken call.
export async function updateTokensHandler(db: UpdateTokensDb, args: UpdateTokensArgs): Promise<void> {
  const patch: Record<string, unknown> = {
    // SECURITY: isAdmin (and every other identity/profile field) is intentionally excluded, same
    // discipline as upsertUserHandler — this mutation only ever touches the three token fields.
    linkedinAccessToken: args.accessToken,
    tokenExpiresAt: args.tokenExpiresAt
  }
  // LinkedIn's refresh response omits refresh_token when the provider doesn't rotate it — in that
  // case the key is left out of the patch entirely so the existing stored value survives, rather
  // than being overwritten with undefined.
  if (args.refreshToken !== undefined) patch.linkedinRefreshToken = args.refreshToken
  await db.patch(args.userId, patch)
}

// Registered Convex internal mutation — delegates to the plain handler
export const updateTokens = internalMutation({
  args: {
    userId: v.id('users'),
    accessToken: v.string(),
    refreshToken: v.optional(v.string()),
    tokenExpiresAt: v.number()
  },
  handler: async (ctx, args) => updateTokensHandler(ctx.db as unknown as UpdateTokensDb, args)
})
