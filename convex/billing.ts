// convex/billing.ts
// Portal session and customer-ID mutation. Checkout moved to billingNode.ts.

import { action, internalMutation, internalQuery } from './_generated/server'
import { ConvexError, v } from 'convex/values'
import { components } from './_generated/api'
import { StripeSubscriptions } from '@convex-dev/stripe'
import { requireAuthAction } from './lib/auth'

const stripeClient = new StripeSubscriptions(components.stripe, {})

// Customer portal session — lets users manage their subscription
export const createPortalSession = action({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    const user = await requireAuthAction(ctx, sessionToken)
    if (!user) throw new ConvexError('User not found')
    if (!user.stripeCustomerId) throw new ConvexError('No Stripe customer found')

    const appUrl = process.env.APP_URL ?? 'http://localhost:5173'

    const portal = await stripeClient.createCustomerPortalSession(ctx, {
      customerId: user.stripeCustomerId,
      returnUrl: `${appUrl}/billing`
    })

    return { url: portal.url }
  }
})

// Store Stripe customer ID on user record
export const setStripeCustomerId = internalMutation({
  args: { userId: v.id('users'), stripeCustomerId: v.string() },
  handler: async (ctx, { userId, stripeCustomerId }) => {
    await ctx.db.patch(userId, { stripeCustomerId })
  }
})

/**
 * Every subscription row this user has ever had, oldest first. Read by createCheckoutSession
 * (the duplicate + repeat-trial guard). Bounded: a user accumulates at most one row per
 * subscription they have ever held.
 */
export const listUserSubscriptions = internalQuery({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }) =>
    ctx.db
      .query('subscriptions')
      .withIndex('by_user', q => q.eq('userId', userId))
      .collect()
})

/**
 * Everything a billing mailer needs about a member, in one read: who they are, what language to
 * write in, how far into the trial they are, and the price Stripe is about to charge.
 */
export const getBillingContext = internalQuery({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }) => {
    const user = await ctx.db.get(userId)
    if (!user) return null
    const subscriptions = await ctx.db
      .query('subscriptions')
      .withIndex('by_user', q => q.eq('userId', userId))
      .collect()
    return {
      email: user.email,
      language: user.language,
      primaryLocale: user.primaryLocale,
      tier: user.tier,
      subscriptionStatus: user.subscriptionStatus,
      trialEndsAt: user.trialEndsAt,
      made: user.trialInteractionsMade ?? 0,
      received: user.trialInteractionsReceived ?? 0,
      subscriptions
    }
  }
})

/** Resolves a Stripe subscription id back to our user, for webhook-driven notices. */
export const getUserBySubscriptionId = internalQuery({
  args: { stripeSubscriptionId: v.string() },
  handler: async (ctx, { stripeSubscriptionId }) => {
    const sub = await ctx.db
      .query('subscriptions')
      .withIndex('by_stripe_id', q => q.eq('stripeSubscriptionId', stripeSubscriptionId))
      .first()
    return sub ? { userId: sub.userId, status: sub.status } : null
  }
})
