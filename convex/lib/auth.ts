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
import { sessionExpiryFrom, shouldRenewSession } from '../sessions'

/**
 * Resolves a session token to a user document WITHOUT enforcing ban state.
 * Returns null when the token is missing, expired, or invalid.
 * Used by getMe (which must distinguish "banned" from "logged out").
 */
export async function resolveSession(
  ctx: QueryCtx | MutationCtx,
  sessionToken: string | undefined
): Promise<Doc<'users'> | null> {
  if (!sessionToken) return null

  const db = (ctx as QueryCtx).db
  const now = Date.now()
  const session = await db
    .query('sessions')
    .withIndex('by_token', q => q.eq('token', sessionToken))
    .unique()

  if (!session || session.expiresAt < now) return null

  // Sliding expiry: in a write-capable (mutation) ctx, extend the window once it's past halfway. Query
  // ctx is read-only and skips this — active users trigger mutations/actions regularly, which renew it.
  if ('patch' in db && shouldRenewSession(session.expiresAt, now)) {
    await (ctx as MutationCtx).db.patch(session._id, { expiresAt: sessionExpiryFrom(now) })
  }

  const user = await db.get(session.userId)
  return user ?? null
}

/**
 * Throws if the user is banned. Pure guard — the single definition of "what a
 * ban blocks". Called by requireAuth/requireAuthAction so every protected
 * endpoint is covered automatically.
 */
export function assertNotBanned(user: { isBanned?: boolean }): void {
  if (user.isBanned) throw new Error('Account suspended')
}

/**
 * Resolves a session token to an authenticated, non-banned user document.
 * For use in queries and mutations (which have ctx.db access).
 * Throws "Unauthorized" if the token is missing/expired/invalid, or
 * "Account suspended" if the user is banned.
 */
export async function requireAuth(
  ctx: QueryCtx | MutationCtx,
  sessionToken: string | undefined
): Promise<Doc<'users'>> {
  const user = await resolveSession(ctx, sessionToken)
  if (!user) throw new Error('Unauthorized')
  assertNotBanned(user)
  return user
}

/**
 * Resolves a session token to an authenticated, non-banned user document (with tokens).
 * For use in actions (which must use ctx.runQuery instead of ctx.db).
 * Throws "Unauthorized" if the token is missing/expired/invalid, or
 * "Account suspended" if the user is banned.
 */
export async function requireAuthAction(ctx: ActionCtx, sessionToken: string | undefined): Promise<Doc<'users'>> {
  if (!sessionToken) throw new Error('Unauthorized')

  const now = Date.now()
  const session = await ctx.runQuery(internal.sessions.getByToken, { token: sessionToken })
  if (!session || session.expiresAt < now) {
    throw new Error('Unauthorized')
  }

  // Sliding expiry: actions can't write, so renew via an internal mutation — but only once past the
  // halfway mark, to avoid a mutation round-trip on every action.
  if (shouldRenewSession(session.expiresAt, now)) {
    await ctx.runMutation(internal.sessions.slide, { token: sessionToken })
  }

  const user = await ctx.runQuery(internal.users.getWithTokens, { userId: session.userId })
  if (!user) throw new Error('Unauthorized')
  assertNotBanned(user)

  return user
}
