// convex/billing.ts
// Uses @convex-dev/stripe component for checkout session creation.
// After running `npx convex dev`, replace makeFunctionReference with:
//   import { components } from "./_generated/api";
//   import { StripeSubscriptions } from "@convex-dev/stripe";
//   const stripe = new StripeSubscriptions(components.stripe, {});

import { actionGeneric as action, internalMutationGeneric as internalMutation } from 'convex/server'
import { makeFunctionReference } from 'convex/server'
import { v } from 'convex/values'
import type { ActionCtx, MutationCtx, UserDoc } from './convexTypes.js'

const getUserWithTokens = makeFunctionReference<'query'>('users:getWithTokens')

export const createCheckoutSession = action({
  args: { priceId: v.string(), userId: v.id('users') },
  handler: async (ctx, { priceId, userId }: { priceId: string; userId: string }) => {
    const actionCtx = ctx as unknown as ActionCtx
    // Note: ctx.auth.getUserIdentity() only works with Convex JWT auth (Clerk/Auth0).
    // We use custom LinkedIn OAuth, so userId is passed explicitly from sessionStorage.
    const user = await actionCtx.runQuery<UserDoc | null>(getUserWithTokens, { userId })
    if (!user) throw new Error('User not found')

    // Dynamic import of stripe for checkout session creation
    // TODO: After `npx convex dev` runs, replace with:
    //   const stripe = new StripeSubscriptions(components.stripe, {});
    //   const session = await stripe.createCheckoutSession(ctx, { priceId, userId: user._id, ... });
    const Stripe = (await import('stripe')).default
    // The Stripe SDK apiVersion type is a string literal union of known versions.
    // Cast through unknown so we are not constrained to the SDK's bundled version list.
    const stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2026-02-25.clover'
    })

    let customerId = user.stripeCustomerId as string | undefined
    if (!customerId) {
      const customer = await stripeClient.customers.create({
        name: user.name as string,
        metadata: { convexUserId: user._id as string }
      })
      customerId = customer.id
      const setCustomerFn = makeFunctionReference<'mutation'>('billing:setStripeCustomerId')
      await actionCtx.runMutation(setCustomerFn, { userId: user._id, stripeCustomerId: customerId })
    }

    const appUrl = process.env.APP_URL ?? 'http://localhost:5173'
    const session = await stripeClient.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/billing?success=true`,
      cancel_url: `${appUrl}/billing`
    })

    return { url: session.url! }
  }
})

export const setStripeCustomerId = internalMutation({
  args: { userId: v.id('users'), stripeCustomerId: v.string() },
  handler: async (ctx, { userId, stripeCustomerId }: { userId: string; stripeCustomerId: string }) => {
    const db = (ctx as unknown as MutationCtx).db
    await db.patch(userId, { stripeCustomerId })
  }
})
