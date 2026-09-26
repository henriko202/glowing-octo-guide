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
    withIndex(
      name: string,
      fn: (q: UpsertIndexQuery) => UpsertIndexQuery
    ): { first(): Promise<{ _id: string; isBanned?: boolean } | null> }
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
  /** backlog/R19 — the inviter's code from ?ref=; honoured on insert only, after verification. */
  referredByCode?: string
}

// Plain handler function — used by the registered mutation and testable in isolation. `isNew` tells the
// sign-in funnel (convex/authMetrics.ts) a first sign-in from a returning one.
export async function upsertUserHandler(
  db: UpsertDb,
  args: UpsertUserArgs
): Promise<{ userId: string; isNew: boolean }> {
  const existing = await db
    .query('users')
    .withIndex('by_linkedin_id', q => q.eq('linkedinId', args.linkedinId))
    .first()

  if (existing) {
    const patch: Record<string, unknown> = {
      // SECURITY: isAdmin is intentionally excluded — it can only be set directly in the DB
      name: args.name,
      profilePictureUrl: args.profilePictureUrl,
      linkedinAccessToken: args.accessToken,
      linkedinRefreshToken: args.refreshToken,
      tokenExpiresAt: args.tokenExpiresAt,
      email: args.email,
      lastLoginAt: Date.now()
    }
    // OIDC login never carries a headline (args.headline is always undefined here), and
    // patching undefined would UNSET a headline the user set manually or that was scraped.
    // Only touch it when a headline is actually provided. Same guard idiom as refreshToken below.
    if (args.headline !== undefined) patch.headline = args.headline
    await db.patch(existing._id, patch)
    return { userId: existing._id, isNew: false }
  }

  // backlog/R19 — attribution is insert-only: an existing member who opens a friend's link is not
  // "invited", and a code that matches no member (typo, deleted inviter) is dropped, never stored.
  let referredByCode: string | undefined
  if (args.referredByCode) {
    const inviter = await db
      .query('users')
      .withIndex('by_invite_code', q => q.eq('inviteCode', args.referredByCode))
      .first()
    // A banned member's link mints nothing: the longer trial and the "invited you" line on Billing
    // would otherwise keep working for an account moderation has already closed.
    if (inviter && !inviter.isBanned) referredByCode = args.referredByCode
  }

  const userId = await db.insert('users', {
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
    referredByCode,
    lastLoginAt: Date.now(),
    acknowledgedPolicyVersion: POLICY_VERSION,
    createdAt: Date.now()
  })
  return { userId, isNew: true }
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
    email: v.optional(v.string()),
    referredByCode: v.optional(v.string())
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
