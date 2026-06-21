'use node'
import Stripe from 'stripe'
import { action, internalAction } from './_generated/server'
import { v } from 'convex/values'
import { components, internal } from './_generated/api'
import { StripeSubscriptions } from '@convex-dev/stripe'
import { requireAuthAction } from './lib/auth'
import { ALLOWED_PRICE_IDS } from './lib/stripePrices'

const stripeComponent = new StripeSubscriptions(components.stripe, {})

function stripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('STRIPE_SECRET_KEY is not configured')
  return new Stripe(key)
}

const TRIAL_PERIOD_DAYS = 7

// Card-required 7-day trial checkout. The component's createCheckoutSession can't set a
// trial / card-collection / promo codes, so we call the Stripe SDK directly here. The
// component still owns the customer record and webhook sync.
export const createCheckoutSession = action({
  args: { priceId: v.string(), sessionToken: v.string() },
  handler: async (ctx, { priceId, sessionToken }) => {
    if (!ALLOWED_PRICE_IDS.has(priceId)) throw new Error('Invalid price ID')

    const user = await requireAuthAction(ctx, sessionToken)
    if (!user) throw new Error('User not found')

    const customer = await stripeComponent.getOrCreateCustomer(ctx, {
      userId: user._id,
      email: user.email,
      name: user.name
    })

    const appUrl = process.env.APP_URL ?? 'http://localhost:5173'

    const session = await stripe().checkout.sessions.create({
      mode: 'subscription',
      customer: customer.customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        trial_period_days: TRIAL_PERIOD_DAYS,
        metadata: { convexUserId: user._id }
      },
      payment_method_collection: 'always', // card required even during the trial
      allow_promotion_codes: true, // manual free-month campaign codes (Henriko-managed)
      success_url: `${appUrl}/billing?success=true`,
      cancel_url: `${appUrl}/billing`
    })

    if (!user.stripeCustomerId) {
      await ctx.runMutation(internal.billing.setStripeCustomerId, {
        userId: user._id,
        stripeCustomerId: customer.customerId
      })
    }

    return { url: session.url }
  }
})

// Ends the Stripe trial now → billing starts immediately. Plan 2B schedules this when a
// trialing user reaches 50 combined interactions before the 7-day trial elapses.
export const endTrialEarly = internalAction({
  args: { stripeSubscriptionId: v.string() },
  handler: async (_ctx, { stripeSubscriptionId }) => {
    await stripe().subscriptions.update(stripeSubscriptionId, { trial_end: 'now' })
  }
})
