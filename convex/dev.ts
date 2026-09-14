// convex/dev.ts
// Dev-only user impersonation. Both endpoints are gated by ALLOW_DEV_IMPERSONATION, which is set
// ONLY on the local/dev Convex deployment (MUST be unset in production). With the flag absent every
// call throws before touching the database, so the endpoints are inert in prod.
//
// Security: this deliberately mints a session token without OAuth. The env flag is the whole
// boundary — never set it on a production deployment.

import { env, mutation, query } from './_generated/server'
import { ConvexError, v } from 'convex/values'
import { sessionExpiryFrom } from './sessions'

/** Pure flag check (mirrors isAdminShareOverrideEnabled in posts.ts) so the gate is testable. */
export function isDevImpersonationEnabled(envVars: Record<string, string | undefined>): boolean {
  return envVars.ALLOW_DEV_IMPERSONATION === 'true'
}

/** Bounded read: the switcher filters client-side; 500 easily covers a dev database. */
const USER_LIST_LIMIT = 500

// Public, dev-only: compact user list for the impersonation switcher. Never returns tokens.
export const listUsers = query({
  args: {},
  handler: async ctx => {
    if (!isDevImpersonationEnabled(env)) throw new ConvexError('Dev impersonation is disabled')
    const users = await ctx.db.query('users').take(USER_LIST_LIMIT)
    return users.map(u => ({
      _id: u._id,
      name: u.name,
      email: u.email,
      tier: u.tier,
      subscriptionStatus: u.subscriptionStatus,
      isBanned: u.isBanned === true
    }))
  }
})

// Public, dev-only: mints a fresh 15-day session token for the target user. The client writes it to
// sessionStorage('sessionToken') and reloads — exactly the seed_<key> flow, but for any user.
export const impersonate = mutation({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }) => {
    if (!isDevImpersonationEnabled(env)) throw new ConvexError('Dev impersonation is disabled')
    const user = await ctx.db.get(userId)
    if (!user) throw new ConvexError('User not found')
    const sessionToken = crypto.randomUUID()
    await ctx.db.insert('sessions', { token: sessionToken, userId, expiresAt: sessionExpiryFrom(Date.now()) })
    return { sessionToken, name: user.name }
  }
})
