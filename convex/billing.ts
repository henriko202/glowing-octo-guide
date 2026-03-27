// convex/billing.ts
// Uses @convex-dev/stripe component for checkout sessions and customer portal.

import { action, internalMutation } from './_generated/server'
import { v } from 'convex/values'
import { components, internal } from './_generated/api'
import { StripeSubscriptions } from '@convex-dev/stripe'

const stripeClient = new StripeSubscriptions(components.stripe, {})

export const createCheckoutSession = action({
  args: { priceId: v.string(), userId: v.id('users') },
  handler: async (ctx, { priceId, userId }) => {
    const user = await ctx.runQuery(internal.users.getWithTokens, { userId })
    if (!user) throw new Error('User not found')

    // Get or create Stripe customer via the component
    const customer = await stripeClient.getOrCreateCustomer(ctx, {
      userId: user._id,
      email: undefined,
      name: user.name
    })

    const appUrl = process.env.APP_URL ?? 'http://localhost:5173'

    // Create checkout session via the component
    const session = await stripeClient.createCheckoutSession(ctx, {
      priceId,
      customerId: customer.customerId,
      mode: 'subscription',
      quantity: 1,
      successUrl: `${appUrl}/billing?success=true`,
      cancelUrl: `${appUrl}/billing`,
      subscriptionMetadata: {
        convexUserId: user._id
      }
    })

    // Store stripeCustomerId on our users table so webhook handlers can find the user.
    // MUST happen before checkout completes — the webhook needs this to link subscription → user.
    if (!user.stripeCustomerId) {
      await ctx.runMutation(internal.billing.setStripeCustomerId, {
        userId: user._id,
        stripeCustomerId: customer.customerId
      })
    }

    return { url: session.url }
  }
})

// Customer portal session — lets users manage their subscription
export const createPortalSession = action({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }) => {
    const user = await ctx.runQuery(internal.users.getWithTokens, { userId })
    if (!user) throw new Error('User not found')
    if (!user.stripeCustomerId) throw new Error('No Stripe customer found')

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
