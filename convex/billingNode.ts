'use node'
import Stripe from 'stripe'
import { action, internalAction, type ActionCtx } from './_generated/server'
import type { Doc } from './_generated/dataModel'
import { ConvexError, v } from 'convex/values'
import { components, internal } from './_generated/api'
import { StripeSubscriptions } from '@convex-dev/stripe'
import { requireAuthAction } from './lib/auth'
import { ALLOWED_PRICE_IDS, FEATURED_POST_PRICE_ID, getTierFromPriceId, starterPriceIdFor } from './lib/stripePrices'
import { findLiveSubscription, trialDaysFor, trialEligible } from './lib/trialMilestone'
import { checkoutSubmitMessage, resolveBillingLocale, stripeCheckoutLocale } from './lib/checkoutCopy'
import { scrubError } from './lib/scrubError'
import { assertCanEngage } from './lib/access'

const stripeComponent = new StripeSubscriptions(components.stripe, {})

function stripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('STRIPE_SECRET_KEY is not configured')
  return new Stripe(key)
}

// Card-required trial checkout (7 days, 14 for an invited member — lib/trialMilestone.trialDaysFor).
// The component's createCheckoutSession can't set a trial / card-collection / promo codes, so we
// call the Stripe SDK directly here. The component still owns the customer record and webhook sync.
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
    const trialDays = trialDaysFor(user)
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
        ...(trial ? { trial_period_days: trialDays } : {}),
        metadata: { convexUserId: user._id }
      },
      payment_method_collection: 'always', // card required even during the trial
      allow_promotion_codes: true, // manual free-month campaign codes (Henriko-managed)
      locale: stripeCheckoutLocale(billingLocale),
      // The rule the member is agreeing to, two centimetres from the pay button.
      custom_text: { submit: { message: checkoutSubmitMessage(billingLocale, { trial, days: trialDays }) } },
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

// ── Featured post add-on (backlog/revenue/R17) ───────────────────────────────────────────────────
// One-time $5 Checkout that features ONE post with a bigger interaction cap. Same Stripe customer
// as the subscription, so the saved card is offered; fulfilled by the checkout.session.completed
// webhook (http.ts → posts.applyPurchasedFeature). The server allows any eligible post at any
// time — the UI decides where to offer it (upgrade first, add-on second).
export const purchaseFeaturedPost = action({
  args: { sessionToken: v.string(), postId: v.id('posts') },
  handler: async (ctx, { sessionToken, postId }): Promise<{ url: string | null }> => {
    const user = await requireAuthAction(ctx, sessionToken)
    if (!user) throw new ConvexError('User not found')
    assertCanEngage(user) // PAYMENT_REQUIRED: for no card / past due; trialing members pass
    if (!FEATURED_POST_PRICE_ID) throw new ConvexError('FEATURED_PRICE_UNSET')
    await ctx.runQuery(internal.posts.assertFeaturedPurchasable, { postId, userId: user._id })

    const customer = await stripeComponent.getOrCreateCustomer(ctx, {
      userId: user._id,
      email: user.email,
      name: user.name
    })
    const appUrl = process.env.APP_URL ?? 'http://localhost:5173'
    const billingLocale = resolveBillingLocale(user.language, user.primaryLocale)

    const session = await stripe().checkout.sessions.create({
      mode: 'payment',
      customer: customer.customerId,
      line_items: [{ price: FEATURED_POST_PRICE_ID, quantity: 1 }],
      // Card only, and not just the Dashboard's enabled set: a delayed-notification method (boleto,
      // OXXO, SEPA debit, Konbini — all plausible for this pt-BR/es-LatAm audience) completes
      // `unpaid`, which lib/featuredPurchase.isFeaturedPostCheckout drops, and settles later as
      // `checkout.session.async_payment_succeeded`, which nothing handles — the member would be
      // charged and never fulfilled. This fails closed. Enabling one of them means adding that
      // webhook handler FIRST, plus a pending-payment UI: the confirming state on My Posts assumes
      // seconds, not days.
      payment_method_types: ['card'],
      // Three strings, nothing personal: the webhook keys on `kind` and fulfils by `postId`;
      // convexUserId is for support lookups in the Stripe Dashboard (the author comes from the
      // post at fulfilment, never from here).
      metadata: { kind: 'featured_post', convexUserId: user._id, postId },
      locale: stripeCheckoutLocale(billingLocale),
      success_url: `${appUrl}/my-posts?featured=paid&post=${postId}`,
      cancel_url: `${appUrl}/my-posts`
    })
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

// ── Customer Portal deep links (backlog/R09 cancel + downgrade, R08/R20 plan switch) ───────────
// Stripe's hosted portal owns the confirmation UI; we only deep-link into the right flow. The
// @convex-dev/stripe component's createCustomerPortalSession cannot set flow_data, so this uses
// the SDK directly (same pattern as createCheckoutSession). Sync lands via the existing webhook.
type FlowData = Stripe.BillingPortal.SessionCreateParams.FlowData

// Every flow shares the same frame: the member's live subscription, their portal customer, and the
// session itself. `buildFlow` gets the live row plus the app origin for its after-completion URL.
async function portalFlowSession(
  ctx: ActionCtx,
  sessionToken: string,
  buildFlow: (live: Doc<'subscriptions'>, appUrl: string) => Promise<FlowData>
): Promise<{ url: string }> {
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

  const session = await stripe().billingPortal.sessions.create({
    customer: customer.customerId,
    return_url: `${appUrl}/billing`,
    flow_data: await buildFlow(live, appUrl)
  })
  return { url: session.url }
}

// subscription_update_confirm swaps a subscription ITEM, so it needs Stripe's copy of the row.
async function singleItem(stripeSubscriptionId: string): Promise<Stripe.SubscriptionItem> {
  const sub = await stripe().subscriptions.retrieve(stripeSubscriptionId)
  const item = sub.items.data[0]
  if (!item) throw new ConvexError('Subscription has no item')
  return item
}

export const createCancelFlowSession = action({
  args: { sessionToken: v.string(), flow: v.union(v.literal('cancel'), v.literal('downgrade')) },
  handler: (ctx, { sessionToken, flow }): Promise<{ url: string }> =>
    portalFlowSession(ctx, sessionToken, async (live, appUrl) => {
      if (flow === 'cancel') {
        return {
          type: 'subscription_cancel',
          subscription_cancel: { subscription: live.stripeSubscriptionId },
          after_completion: { type: 'redirect', redirect: { return_url: `${appUrl}/billing?canceled=true` } }
        }
      }
      if (live.tier === 'starter') throw new ConvexError('ALREADY_STARTER')
      const item = await singleItem(live.stripeSubscriptionId)
      // The retrieved item carries the authoritative interval; our snapshot (optional) is the fallback.
      const stripeInterval = item.price.recurring?.interval
      const interval = stripeInterval === 'month' || stripeInterval === 'year' ? stripeInterval : live.priceInterval
      const price = starterPriceIdFor(process.env, interval)
      if (!price) throw new ConvexError('Starter price not configured')
      return {
        type: 'subscription_update_confirm',
        subscription_update_confirm: {
          subscription: live.stripeSubscriptionId,
          items: [{ id: item.id, price, quantity: 1 }]
        },
        // BillingPage lands this like the plan switch: "Switching you to Starter…", then
        // cancel_alternative_completed { from } once the webhook has moved the tier.
        after_completion: { type: 'redirect', redirect: { return_url: `${appUrl}/billing?downgraded=${live.tier}` } }
      }
    })
})

// A card holder's "Switch to <plan>" (the plan grid, and the post-cap email's landing): the same
// confirm flow as the downgrade, aimed at the price the member was looking at, so they land on
// Stripe's confirmation for THAT plan — never on the portal home, four clicks away from it. The
// price id is client-chosen, so it is checked against our own list first, as checkout does.
export const createPlanSwitchSession = action({
  args: { sessionToken: v.string(), priceId: v.string() },
  handler: (ctx, { sessionToken, priceId }): Promise<{ url: string }> => {
    if (!ALLOWED_PRICE_IDS.has(priceId)) throw new ConvexError('Invalid price ID')
    return portalFlowSession(ctx, sessionToken, async (live, appUrl) => {
      const item = await singleItem(live.stripeSubscriptionId)
      // Nothing to confirm. A trialing member sees a Switch button for their own plan (no "current"
      // badge during a trial), so name it; the client falls back to the portal home.
      if (item.price.id === priceId) throw new ConvexError('ALREADY_ON_PLAN')
      return {
        type: 'subscription_update_confirm',
        subscription_update_confirm: {
          subscription: live.stripeSubscriptionId,
          items: [{ id: item.id, price: priceId, quantity: 1 }]
        },
        // BillingPage reads the tier back: "Switching you to X…" until the webhook moves `me.tier`,
        // then "You're on X now." and plan_switch_completed, once (the downgrade above lands the same way).
        after_completion: {
          type: 'redirect',
          redirect: { return_url: `${appUrl}/billing?switched=${getTierFromPriceId(priceId)}` }
        }
      }
    })
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
