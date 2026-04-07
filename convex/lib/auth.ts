// convex/lib/auth.ts
// Shared authentication helpers. Every protected Convex function calls one of
// these helpers instead of accepting a userId argument from the client.
//
// Security model: The OAuth callback issues a cryptographically random session
// token (UUID) that is stored in the sessions table. Clients store this token
// and present it on every request. The server resolves token → user server-side.
// Clients never supply their own userId — they can only prove identity by holding
// a valid session token.

import type { ActionCtx, MutationCtx, QueryCtx } from '../_generated/server'
import { internal } from '../_generated/api'
import type { Doc } from '../_generated/dataModel'

/**
 * Resolves a session token to an authenticated user document.
 * For use in queries and mutations (which have ctx.db access).
 * Throws "Unauthorized" if the token is missing, expired, or invalid.
 */
export async function requireAuth(
  ctx: QueryCtx | MutationCtx,
  sessionToken: string | undefined
): Promise<Doc<'users'>> {
  if (!sessionToken) throw new Error('Unauthorized')

  const session = await (ctx as QueryCtx).db
    .query('sessions')
    .withIndex('by_token', q => q.eq('token', sessionToken))
    .unique()

  if (!session || session.expiresAt < Date.now()) {
    throw new Error('Unauthorized')
  }

  const user = await (ctx as QueryCtx).db.get(session.userId)
  if (!user) throw new Error('Unauthorized')

  return user
}

/**
 * Resolves a session token to an authenticated user document (with tokens).
 * For use in actions (which must use ctx.runQuery instead of ctx.db).
 * Throws "Unauthorized" if the token is missing, expired, or invalid.
 */
export async function requireAuthAction(ctx: ActionCtx, sessionToken: string | undefined): Promise<Doc<'users'>> {
  if (!sessionToken) throw new Error('Unauthorized')

  const session = await ctx.runQuery(internal.sessions.getByToken, { token: sessionToken })
  if (!session || session.expiresAt < Date.now()) {
    throw new Error('Unauthorized')
  }

  const user = await ctx.runQuery(internal.users.getWithTokens, { userId: session.userId })
  if (!user) throw new Error('Unauthorized')

  return user
}
