'use node'
import Stripe from 'stripe'
import { action, internalAction } from './_generated/server'
import { ConvexError, v } from 'convex/values'
import { components, internal } from './_generated/api'
import { StripeSubscriptions } from '@convex-dev/stripe'
import { requireAuthAction } from './lib/auth'
import { ALLOWED_PRICE_IDS, starterPriceIdFor } from './lib/stripePrices'
import { findLiveSubscription, trialEligible } from './lib/trialMilestone'
import { checkoutSubmitMessage, resolveBillingLocale, stripeCheckoutLocale } from './lib/checkoutCopy'
import { scrubError } from './lib/scrubError'

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
  args: { priceId: v.string(), sessionToken: v.string(), locale: v.optional(v.string()) },
  handler: async (ctx, { priceId, sessionToken, locale }) => {
    if (!ALLOWED_PRICE_IDS.has(priceId)) throw new ConvexError('Invalid price ID')

    const user = await requireAuthAction(ctx, sessionToken)
    if (!user) throw new ConvexError('User not found')

    // One live subscription per user. A card holder who wants another plan switches in the
    // Customer Portal — the client branches on this prefix and opens it (lib/access.ts
    // convention). The blocked path is a door, never an accusation.
    const subscriptions = await ctx.runQuery(internal.billing.listUserSubscriptions, { userId: user._id })
    if (findLiveSubscription(subscriptions)) {
      // Counted, so the guard's hit rate is visible in `pnpm watch:errors` (R01).
      console.warn('[billing] checkout refused: live subscription', scrubError({ userId: user._id }))
      throw new ConvexError('ALREADY_SUBSCRIBED: You already have a plan. Manage it from the billing portal.')
    }

    // One trial per user, forever. A returning subscriber checks out without a trial and is told
    // so under the pay button, before the card — never discovered on the statement.
    const trial = trialEligible(subscriptions.length)
    const billingLocale = resolveBillingLocale(locale ?? user.language, user.primaryLocale)

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
        ...(trial ? { trial_period_days: TRIAL_PERIOD_DAYS } : {}),
        metadata: { convexUserId: user._id }
      },
      payment_method_collection: 'always', // card required even during the trial
      allow_promotion_codes: true, // manual free-month campaign codes (Henriko-managed)
      locale: stripeCheckoutLocale(billingLocale),
      // The rule the member is agreeing to, two centimetres from the pay button.
      custom_text: { submit: { message: checkoutSubmitMessage(billingLocale, { trial }) } },
      success_url: `${appUrl}/billing?success=true`,
      cancel_url: `${appUrl}/billing`
    })

    if (!user.stripeCustomerId) {
      await ctx.runMutation(internal.billing.setStripeCustomerId, {
        userId: user._id,
        stripeCustomerId: customer.customerId
      })
    }

    // The member's UI language lives only in a browser cookie; billing emails are sent from the
    // backend long after this request, so record it here.
    if (user.language !== billingLocale) {
      await ctx.runMutation(internal.users.setLanguage, { userId: user._id, language: billingLocale })
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

/**
 * Voids a subscription created while the member already had a live one (the two-tab race the
 * checkout guard cannot see). The NEWER subscription is the one cancelled, so the member keeps the
 * plan they already had. Never silent: it raises an in-app notice and sends an email.
 */
export const cancelDuplicateSubscription = internalAction({
  args: { userId: v.id('users'), stripeSubscriptionId: v.string(), tier: v.string() },
  handler: async (ctx, { userId, stripeSubscriptionId, tier }) => {
    try {
      await stripe().subscriptions.cancel(stripeSubscriptionId, { prorate: false, invoice_now: false })
    } catch (err) {
      // Already canceled (a Stripe webhook retry re-ran the guard) or a transient Stripe failure.
      // Either way this run must not notify: the first run did, or the duplicate is still live.
      console.error('[billing] could not void duplicate subscription', stripeSubscriptionId, scrubError(err))
      return
    }
    console.error('[billing] voided duplicate subscription', scrubError({ stripeSubscriptionId }))
    await ctx.runMutation(internal.users.setBillingNotice, { userId, notice: 'duplicate_canceled' })
    await ctx.scheduler.runAfter(0, internal.notifications.sendDuplicateCanceled, { userId, tier })
  }
})

// ── Cancel / downgrade / resume (backlog/R09) ──────────────────────────────────────────────────
// Stripe's hosted portal owns the confirmation UI; we only deep-link into the right flow. The
// @convex-dev/stripe component's createCustomerPortalSession cannot set flow_data, so this uses
// the SDK directly (same pattern as createCheckoutSession). Sync lands via the existing webhook.
export const createCancelFlowSession = action({
  args: { sessionToken: v.string(), flow: v.union(v.literal('cancel'), v.literal('downgrade')) },
  handler: async (ctx, { sessionToken, flow }): Promise<{ url: string }> => {
    const user = await requireAuthAction(ctx, sessionToken)
    const subscriptions = await ctx.runQuery(internal.billing.listUserSubscriptions, { userId: user._id })
    const live = findLiveSubscription(subscriptions)
    if (!live) throw new ConvexError('NO_LIVE_SUBSCRIPTION')

    const customer = await stripeComponent.getOrCreateCustomer(ctx, {
      userId: user._id,
      email: user.email,
      name: user.name
    })
    const appUrl = process.env.APP_URL ?? 'http://localhost:5173'

    let flowData: Stripe.BillingPortal.SessionCreateParams.FlowData
    if (flow === 'cancel') {
      flowData = {
        type: 'subscription_cancel',
        subscription_cancel: { subscription: live.stripeSubscriptionId },
        after_completion: { type: 'redirect', redirect: { return_url: `${appUrl}/billing?canceled=true` } }
      }
    } else {
      if (live.tier === 'starter') throw new ConvexError('ALREADY_STARTER')
      const sub = await stripe().subscriptions.retrieve(live.stripeSubscriptionId)
      const item = sub.items.data[0]
      if (!item) throw new ConvexError('Subscription has no item')
      // The retrieved item carries the authoritative interval; our snapshot (optional) is the fallback.
      const stripeInterval = item.price.recurring?.interval
      const interval = stripeInterval === 'month' || stripeInterval === 'year' ? stripeInterval : live.priceInterval
      const price = starterPriceIdFor(process.env, interval)
      if (!price) throw new ConvexError('Starter price not configured')
      flowData = {
        type: 'subscription_update_confirm',
        subscription_update_confirm: {
          subscription: live.stripeSubscriptionId,
          items: [{ id: item.id, price, quantity: 1 }]
        },
        after_completion: { type: 'redirect', redirect: { return_url: `${appUrl}/billing?downgraded=true` } }
      }
    }

    const session = await stripe().billingPortal.sessions.create({
      customer: customer.customerId,
      return_url: `${appUrl}/billing`,
      flow_data: flowData
    })
    return { url: session.url }
  }
})

// Undo a pending period-end cancellation. The webhook's customer.subscription.updated clears
// cancelAtPeriodEnd on our row; the page reacts to that, so nothing is returned. Idempotent: a
// subscription that is already not cancelling (stale tab, double tap) is a silent success.
export const resumeSubscription = action({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }): Promise<null> => {
    const user = await requireAuthAction(ctx, sessionToken)
    const subscriptions = await ctx.runQuery(internal.billing.listUserSubscriptions, { userId: user._id })
    const live = findLiveSubscription(subscriptions)
    if (!live) throw new ConvexError('NO_LIVE_SUBSCRIPTION')
    if (!live.cancelAtPeriodEnd) return null
    await stripe().subscriptions.update(live.stripeSubscriptionId, { cancel_at_period_end: false })
    return null
  }
})
