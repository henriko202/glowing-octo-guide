// convex/billing.ts
// Uses @convex-dev/stripe component for checkout sessions and customer portal.

import {
  actionGeneric as action,
  internalMutationGeneric as internalMutation,
  makeFunctionReference
} from 'convex/server'
import { v } from 'convex/values'
import { components, internal } from './_generated/api.js'
import { StripeSubscriptions } from '@convex-dev/stripe'
import type { ActionCtx, MutationCtx, UserDoc } from './convexTypes.js'

const stripeClient = new StripeSubscriptions(components.stripe, {})

const getUserWithTokens = makeFunctionReference<'query'>('users:getWithTokens')

export const createCheckoutSession = action({
  args: { priceId: v.string(), userId: v.id('users') },
  handler: async (ctx, { priceId, userId }: { priceId: string; userId: string }) => {
    const actionCtx = ctx as unknown as ActionCtx
    const user = await actionCtx.runQuery<UserDoc | null>(getUserWithTokens, { userId })
    if (!user) throw new Error('User not found')

    // Get or create Stripe customer via the component
    const customer = await stripeClient.getOrCreateCustomer(ctx, {
      userId: user._id as string,
      email: undefined,
      name: user.name as string
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
        convexUserId: user._id as string
      }
    })

    // Store stripeCustomerId on our users table so webhook handlers can find the user.
    // MUST happen before checkout completes — the webhook needs this to link subscription → user.
    if (!user.stripeCustomerId) {
      await actionCtx.runMutation(internal.billing.setStripeCustomerId, {
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
  handler: async (ctx, { userId }: { userId: string }) => {
    const actionCtx = ctx as unknown as ActionCtx
    const user = await actionCtx.runQuery<UserDoc | null>(getUserWithTokens, { userId })
    if (!user) throw new Error('User not found')
    if (!user.stripeCustomerId) throw new Error('No Stripe customer found')

    const appUrl = process.env.APP_URL ?? 'http://localhost:5173'

    const portal = await stripeClient.createCustomerPortalSession(ctx, {
      customerId: user.stripeCustomerId as string,
      returnUrl: `${appUrl}/billing`
    })

    return { url: portal.url }
  }
})

// Store Stripe customer ID on user record
export const setStripeCustomerId = internalMutation({
  args: { userId: v.id('users'), stripeCustomerId: v.string() },
  handler: async (ctx, { userId, stripeCustomerId }: { userId: string; stripeCustomerId: string }) => {
    const db = (ctx as unknown as MutationCtx).db
    await db.patch(userId, { stripeCustomerId })
  }
})
