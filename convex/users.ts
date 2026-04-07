import { internalQuery, mutation, query } from './_generated/server'
import { v } from 'convex/values'
import { components, internal } from './_generated/api'
import type { UserDoc } from './convexTypes'
import { requireAuth } from './lib/auth'

// Internal: returns full user record including tokens (NEVER expose to client)
export const getWithTokens = internalQuery({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }) => {
    return ctx.db.get(userId)
  }
})

// Internal: returns all users with active subscriptions (excludes trialing)
export const getActiveSubscribers = internalQuery({
  args: {},
  handler: async ctx => {
    return ctx.db
      .query('users')
      .filter(q => q.eq(q.field('subscriptionStatus'), 'active'))
      .collect()
  }
})

// Public: returns safe user profile — strips ALL token fields.
// Auth: resolves the session token server-side; never accepts a userId from the client.
export const getMe = query({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, { sessionToken }) => {
    if (!sessionToken) return null
    let user: UserDoc
    try {
      user = (await requireAuth(ctx, sessionToken)) as UserDoc
    } catch {
      return null
    }
    // IMPORTANT: Strip tokens and isAdmin before returning to client
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { linkedinAccessToken, linkedinRefreshToken, tokenExpiresAt, isAdmin, ...safeUser } = user
    // Only include isAdmin if the user IS an admin (needed for frontend route guard)
    return isAdmin ? { ...safeUser, isAdmin: true as const } : safeUser
  }
})

// Public: returns subscription info for billing page display.
// Auth: resolves the session token server-side.
export const getSubscriptionInfo = query({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, { sessionToken }) => {
    if (!sessionToken) return null
    let user: UserDoc
    try {
      user = (await requireAuth(ctx, sessionToken)) as UserDoc
    } catch {
      return null
    }

    // Query the component's live subscription data (always up-to-date via webhooks)
    const componentSubs = await ctx.runQuery(components.stripe.public.listSubscriptionsByUserId, { userId: user._id })

    // Pick the most recent subscription that isn't fully canceled
    const activeSub =
      (componentSubs as Array<{ status: string; stripeSubscriptionId: string; cancelAtPeriodEnd?: boolean }>).filter(
        s => s.status !== 'canceled'
      )[0] ?? null

    if (activeSub) {
      // Resolve tier from our own subscriptions table (component doesn't store tier names)
      const ourSub = await ctx.db
        .query('subscriptions')
        .withIndex('by_stripe_id', q => q.eq('stripeSubscriptionId', activeSub.stripeSubscriptionId))
        .first()

      return {
        tier: ourSub?.tier ?? user.tier ?? null,
        status: activeSub.status,
        cancelAtPeriodEnd: activeSub.cancelAtPeriodEnd ?? false,
        stripeSubscriptionId: activeSub.stripeSubscriptionId
      }
    }

    // No active subscription: trialing, canceled, or never subscribed — tier is empty
    return {
      tier: null,
      status: user.subscriptionStatus ?? 'trialing',
      cancelAtPeriodEnd: false,
      stripeSubscriptionId: null
    }
  }
})

// Public: stores the user's LinkedIn public profile identifier (vanityName).
// Called from Settings page when the user enters their LinkedIn profile URL.
// Used for post ownership verification without requiring LinkedIn Partner API access.
export const setPublicIdentifier = mutation({
  args: {
    sessionToken: v.string(),
    publicIdentifier: v.string()
  },
  handler: async (ctx, { sessionToken, publicIdentifier }) => {
    const user = await requireAuth(ctx, sessionToken)
    // Validate LinkedIn vanity name format: alphanumeric, hyphens, underscores, 3-100 chars
    const trimmed = publicIdentifier.trim().toLowerCase()
    if (!/^[a-zA-Z0-9\-_]{3,100}$/.test(trimmed)) {
      throw new Error('Invalid LinkedIn profile identifier format')
    }
    // Store lowercase for consistent comparison (LinkedIn vanityNames are case-insensitive)
    await ctx.db.patch(user._id, { linkedinPublicIdentifier: trimmed })
  }
})

// Public: invalidates the session token server-side on sign out.
export const logout = mutation({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    await ctx.runMutation(internal.sessions.deleteByToken, { token: sessionToken })
  }
})

// Public: invalidates ALL sessions for the authenticated user (emergency use —
// e.g., if user suspects their account is compromised on another device).
export const forceLogoutAll = mutation({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    const user = await requireAuth(ctx, sessionToken)
    await ctx.runMutation(internal.sessions.deleteAllForUser, { userId: user._id })
  }
})
