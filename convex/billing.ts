// convex/billing.ts
// Subscription-row queries and the billing mutations. Checkout and every portal session live in
// billingNode.ts — `createPortalSession` moved there on 2026-09-09 (B07) because the Stripe
// component's `createCustomerPortalSession` always uses the account's DEFAULT portal configuration,
// which lists all six prices, and closing the cross-tier downgrade gap needs a per-tier one
// (lib/portalConfig). That helper was this file's only Stripe call.

import { internalMutation, internalQuery } from './_generated/server'
import { v } from 'convex/values'

// Store Stripe customer ID on user record
export const setStripeCustomerId = internalMutation({
  args: { userId: v.id('users'), stripeCustomerId: v.string() },
  handler: async (ctx, { userId, stripeCustomerId }) => {
    await ctx.db.patch(userId, { stripeCustomerId })
  }
})

/**
 * Mirrors a pending cross-tier downgrade (backlog/B07) onto the subscriptions row. Called with both
 * fields by the schedule write, and with NEITHER to clear them — `ctx.db.patch` unsets a field set
 * to undefined, so one mutation covers set and clear. Silent when the row has not been created yet:
 * the webhook that creates it will carry the schedule and set the mirror on its own.
 */
export const setPendingDowngrade = internalMutation({
  args: {
    stripeSubscriptionId: v.string(),
    pendingTier: v.optional(v.union(v.literal('starter'), v.literal('growth'))),
    pendingAt: v.optional(v.number())
  },
  handler: async (ctx, { stripeSubscriptionId, pendingTier, pendingAt }) => {
    const sub = await ctx.db
      .query('subscriptions')
      .withIndex('by_stripe_id', q => q.eq('stripeSubscriptionId', stripeSubscriptionId))
      .first()
    if (!sub) return
    await ctx.db.patch(sub._id, { pendingTier, pendingAt })
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
    // Trial counters live in their own high-churn table (schema.ts: trialCounters) — see plan 018.
    const counter = await ctx.db
      .query('trialCounters')
      .withIndex('by_user', q => q.eq('userId', userId))
      .unique()
    return {
      email: user.email,
      language: user.language,
      primaryLocale: user.primaryLocale,
      tier: user.tier,
      subscriptionStatus: user.subscriptionStatus,
      trialEndsAt: user.trialEndsAt,
      made: counter?.made ?? 0,
      received: counter?.received ?? 0,
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
