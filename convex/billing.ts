// convex/billing.ts
// Portal session and customer-ID mutation. Checkout moved to billingNode.ts.

import { action, internalMutation } from './_generated/server'
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
