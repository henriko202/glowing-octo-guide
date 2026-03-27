import { internalQuery, mutation, query } from './_generated/server'
import { v } from 'convex/values'
import { components } from './_generated/api'
import type { UserDoc } from './convexTypes'

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
//
// Auth note: this app uses custom LinkedIn OAuth, not Convex's built-in JWT
// auth (Clerk / Auth0). ctx.auth.getUserIdentity() is therefore unavailable.
// Instead the client passes the Convex _id stored in sessionStorage after the
// OAuth callback redirect.
//
// TODO: When integrating Clerk/Auth0, replace userId arg with getUserIdentity()
// for a server-enforced identity guarantee.
export const getMe = query({
  args: { userId: v.optional(v.id('users')) },
  handler: async (ctx, { userId }) => {
    if (!userId) return null
    const user = (await ctx.db.get(userId)) as UserDoc | null
    if (!user) return null
    // IMPORTANT: Strip tokens and isAdmin before returning to client
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { linkedinAccessToken, linkedinRefreshToken, tokenExpiresAt, isAdmin, ...safeUser } = user
    // Only include isAdmin if the user IS an admin (needed for frontend route guard)
    return isAdmin ? { ...safeUser, isAdmin: true as const } : safeUser
  }
})

// Public: returns subscription info for billing page display.
// Sources:
//   - component's subscriptions table (auto-synced on every Stripe webhook) for active subs
//   - user document for trialing / no-subscription state
export const getSubscriptionInfo = query({
  args: { userId: v.optional(v.id('users')) },
  handler: async (ctx, { userId }) => {
    if (!userId) return null
    const user = (await ctx.db.get(userId)) as UserDoc | null
    if (!user) return null

    // Query the component's live subscription data (always up-to-date via webhooks)
    const componentSubs = await ctx.runQuery(components.stripe.public.listSubscriptionsByUserId, { userId })

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
    userId: v.id('users'),
    publicIdentifier: v.string()
  },
  handler: async (ctx, { userId, publicIdentifier }) => {
    // Store lowercase for consistent comparison (LinkedIn vanityNames are case-insensitive)
    await ctx.db.patch(userId, { linkedinPublicIdentifier: publicIdentifier.trim().toLowerCase() })
  }
})
