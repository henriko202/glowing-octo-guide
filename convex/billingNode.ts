'use node'
import Stripe from 'stripe'
import { action, type ActionCtx, env, internalAction } from './_generated/server'
import type { Doc } from './_generated/dataModel'
import { ConvexError, v } from 'convex/values'
import { components, internal } from './_generated/api'
import { StripeSubscriptions } from '@convex-dev/stripe'
import { requireAuthAction } from './lib/auth'
import {
  ALLOWED_PRICE_IDS,
  FEATURED_POST_PRICE_ID,
  getTierFromPriceId,
  intervalForPriceId,
  promotionCodesAllowed,
  starterPriceIdFor
} from './lib/stripePrices'
import { buildDowngradePhases, isSpentSchedule, planChangeDirection } from './lib/downgrade'
import { PORTAL_TIER_KEY, type PortalConfigKey, portalConfigKeyFor, portalHomeKeyFor } from './lib/portalConfig'
import { findLiveSubscription, isCancelPending, trialDaysFor, trialEligible } from './lib/trialMilestone'
import { checkoutSubmitMessage, resolveBillingLocale, stripeCheckoutLocale } from './lib/checkoutCopy'
import { scrubError } from './lib/scrubError'
import { assertCanEngage } from './lib/access'

const stripeComponent = new StripeSubscriptions(components.stripe, {})

function stripe(): Stripe {
  const key = env.STRIPE_SECRET_KEY
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
    await ctx.runMutation(internal.lib.rateLimit.checkAndIncrement, {
      userId: user._id,
      action: 'createCheckoutSession',
      maxPerHour: 10
    })

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

    const appUrl = env.APP_URL ?? 'http://localhost:5173'

    const session = await stripe().checkout.sessions.create({
      mode: 'subscription',
      customer: customer.customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        ...(trial ? { trial_period_days: trialDays } : {}),
        metadata: { convexUserId: user._id }
      },
      payment_method_collection: 'always', // card required even during the trial
      // Henriko's manual free-month campaign codes. MONTHLY PRICES ONLY: a Stripe coupon is not
      // price-scoped (`applies_to` lists products, and both intervals live on one product), so a
      // 100%-off code applied to an annual Checkout would zero the whole year. See
      // lib/stripePrices.promotionCodesAllowed for the proof and the reasoning.
      allow_promotion_codes: promotionCodesAllowed(env, priceId),
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

    // Backstop: the app persists UI-language changes through users.setLanguage, but billing emails
    // are sent from the backend long after this request, so record the checkout language here too.
    if (user.language !== billingLocale) {
      await ctx.runMutation(internal.users.setLanguageFromCheckout, { userId: user._id, language: billingLocale })
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
    await ctx.runMutation(internal.lib.rateLimit.checkAndIncrement, {
      userId: user._id,
      action: 'purchaseFeaturedPost',
      maxPerHour: 10
    })
    assertCanEngage(user) // PAYMENT_REQUIRED: for no card / past due; trialing members pass
    if (!FEATURED_POST_PRICE_ID) throw new ConvexError('FEATURED_PRICE_UNSET')
    await ctx.runQuery(internal.posts.assertFeaturedPurchasable, { postId, userId: user._id })

    const customer = await stripeComponent.getOrCreateCustomer(ctx, {
      userId: user._id,
      email: user.email,
      name: user.name
    })
    const appUrl = env.APP_URL ?? 'http://localhost:5173'
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
// Re-checked against Stripe, not just our row: a cancel that lands before its webhook would still be
// converted, and Stripe then bills the period the cancel truncates as PENDING prorations, charged at
// the next invoice rather than now (2026-09-10). A clean conversion invoices the full period at once.
export const endTrialEarly = internalAction({
  args: { stripeSubscriptionId: v.string() },
  handler: async (_ctx, { stripeSubscriptionId }) => {
    const sub = await stripe().subscriptions.retrieve(stripeSubscriptionId)
    if (sub.status !== 'trialing' || isCancelPending(sub)) return
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
    await ctx.scheduler.runAfter(0, internal.billingNotices.sendDuplicateCanceled, { userId, tier })
  }
})

// ── Plan changes: the portal for upgrades, our own schedule for downgrades ─────────────────────
// Stripe's hosted portal owns the confirmation UI for an upgrade or an interval switch, and we only
// deep-link into the right flow (the @convex-dev/stripe component's createCustomerPortalSession
// cannot set flow_data, so this uses the SDK directly, as createCheckoutSession does).
//
// A cross-tier DOWNGRADE cannot go through it. The portal runs proration_behavior 'always_invoice'
// (D7) and defers a switch only between prices sharing a PRODUCT — and Starter/Growth/Pro are three
// products, which no rearrangement fixes (Stripe refuses a portal product carrying two prices of one
// interval; proven 2026-09-09). A portal downgrade therefore credits the unused period in cash,
// against the no-refund line in the Terms (B07). So we write our own subscription schedule instead:
// the item price swaps at current_period_end with proration_behavior 'none'. Sync lands via the
// existing customer.subscription.updated webhook either way.
type FlowData = Stripe.BillingPortal.SessionCreateParams.FlowData

const appOrigin = (): string => env.APP_URL ?? 'http://localhost:5173'

/** The member and their live subscription row — where every billing action starts. */
async function liveSubscriptionFor(
  ctx: ActionCtx,
  sessionToken: string
): Promise<{ user: Doc<'users'>; live: Doc<'subscriptions'> }> {
  const user = await requireAuthAction(ctx, sessionToken)
  const subscriptions = await ctx.runQuery(internal.billing.listUserSubscriptions, { userId: user._id })
  const live = findLiveSubscription(subscriptions)
  if (!live) throw new ConvexError('NO_LIVE_SUBSCRIPTION')
  return { user, live }
}

/**
 * The portal configuration for a member — looked up by the `metadata` stamp
 * scripts/stripe-provision.mjs writes, deliberately not by env var: five more ids would have to
 * reach all four env copies (§8) and drift in any one of them would silently re-open the gap.
 * One extra GET on a click-rate operation is the cheaper price.
 */
async function portalConfigurationId(configKey: string): Promise<string> {
  const { data } = await stripe().billingPortal.configurations.list({ active: true, limit: 100 })
  const match = data.find(c => c.metadata?.[PORTAL_TIER_KEY] === configKey)
  // Never fall back to the account default. On a provisioned account it carries
  // `subscription_update: { enabled: false }`, so falling back would silently strip plan switching
  // from a member who has every right to upgrade; on an unprovisioned one it is whatever the
  // Dashboard holds — which is how the credited cross-tier downgrade got out (B07). A missing
  // configuration is a provisioning error — run scripts/stripe-provision.mjs — so say so loudly
  // rather than guess which of those two the account is.
  if (!match) throw new ConvexError('PORTAL_NOT_CONFIGURED')
  return match.id
}

/**
 * Mints a portal session. The flow is already decided by the caller; omitting it opens the portal
 * home ("Manage subscription"). The configuration comes from the callers, which know why they chose
 * a key (lib/portalConfig): a trialing member and a member with no live subscription row both get
 * the no-plan-switching trial config, because a plan change while a promotion-code coupon is still
 * unconsumed is how a free month becomes a free year.
 */
async function portalSession(
  ctx: ActionCtx,
  user: Doc<'users'>,
  configKey: PortalConfigKey,
  flow?: FlowData
): Promise<{ url: string }> {
  const customer = await stripeComponent.getOrCreateCustomer(ctx, {
    userId: user._id,
    email: user.email,
    name: user.name
  })
  const session = await stripe().billingPortal.sessions.create({
    customer: customer.customerId,
    configuration: await portalConfigurationId(configKey),
    return_url: `${appOrigin()}/billing`,
    ...(flow ? { flow_data: flow } : {})
  })
  return { url: session.url }
}

/**
 * "Manage subscription" — the portal home. Moved out of `billing.ts` on 2026-09-09: the Convex
 * Stripe component's `createCustomerPortalSession` mints a session against the account's DEFAULT
 * configuration and offers no way to name another, so that button was the last route to a credited
 * cross-tier downgrade (B07). Same contract as the action it replaces: a Stripe customer is enough,
 * no live subscription required, so a churned member can still reach their invoices.
 */
export const createPortalSession = action({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }): Promise<{ url: string }> => {
    const user = await requireAuthAction(ctx, sessionToken)
    if (!user) throw new ConvexError('User not found')
    await ctx.runMutation(internal.lib.rateLimit.checkAndIncrement, {
      userId: user._id,
      action: 'createPortalSession',
      maxPerHour: 20
    })
    if (!user.stripeCustomerId) throw new ConvexError('No Stripe customer found')
    // The configuration follows the subscription's STATUS as well as the tier — and a missing live
    // row gets the trial config too, because the checkout webhook has not necessarily landed yet
    // while a promotion-code coupon is unconsumed (see lib/portalConfig.portalHomeKeyFor).
    const subscriptions = await ctx.runQuery(internal.billing.listUserSubscriptions, { userId: user._id })
    return portalSession(ctx, user, portalHomeKeyFor(user.tier, findLiveSubscription(subscriptions)?.status))
  }
})

/**
 * Stripe's copy of the subscription plus its single item. Both halves are needed on every path — the
 * item to name a price in a portal flow, the subscription to read `status`, `cancel_at_period_end`
 * and `schedule` — so it is one retrieve, not two.
 */
async function retrieveWithItem(
  stripeSubscriptionId: string
): Promise<{ sub: Stripe.Subscription; item: Stripe.SubscriptionItem }> {
  const sub = await stripe().subscriptions.retrieve(stripeSubscriptionId)
  const item = sub.items.data[0]
  if (!item) throw new ConvexError('Subscription has no item')
  return { sub, item }
}

/** The id of the schedule attached to a subscription, if any — the "downgrade pending" signal. */
function scheduleIdOf(sub: Stripe.Subscription): string | undefined {
  return typeof sub.schedule === 'string' ? sub.schedule : (sub.schedule?.id ?? undefined)
}

/**
 * Moves the member to `targetPriceId` at current_period_end with NO proration, and mirrors the
 * pending swap onto our row.
 *
 * Idempotent by construction: a subscription carries at most ONE schedule, so a double tap — or a
 * re-target to a different cheaper plan — rewrites the same one instead of racing a second.
 */
async function scheduleDowngrade(
  ctx: ActionCtx,
  sub: Stripe.Subscription,
  targetPriceId: string,
  targetTier: 'starter' | 'growth'
): Promise<{ url: null }> {
  // Phase 1's duration needs the TARGET price's interval; the grid can send a monthly member to an
  // annual price, so it cannot come off the subscription we just retrieved.
  const interval = intervalForPriceId(env, targetPriceId)
  if (!interval) throw new ConvexError('Unknown price interval')

  const existingId = scheduleIdOf(sub)
  // from_subscription answers with one phase matching the period already paid for; the phases
  // themselves are set by the update below, which is the documented two-call pattern.
  const schedule = existingId
    ? await stripe().subscriptionSchedules.retrieve(existingId)
    : await stripe().subscriptionSchedules.create({ from_subscription: sub.id })

  // ponytail: a portal-scheduled interval switch (same product) is overwritten by this update; read
  // the existing phase 1 first if that ever matters.
  const updated = await stripe().subscriptionSchedules.update(schedule.id, {
    phases: buildDowngradePhases(schedule, targetPriceId, interval),
    // The current phase is rewritten wholesale above (Stripe removes what an update omits), so say
    // out loud that rewriting it settles no money.
    proration_behavior: 'none',
    // Once the cheaper phase has run, hand the subscription back untouched. Our webhook normally
    // releases it the moment the swap lands; this is the backstop.
    end_behavior: 'release'
  })

  // Stripe's own answer, never our arithmetic: the instant phase 1 begins.
  const startsAt = updated.phases[1]?.start_date
  await ctx.runMutation(internal.billing.setPendingDowngrade, {
    stripeSubscriptionId: sub.id,
    pendingTier: targetTier,
    pendingAt: startsAt ? startsAt * 1000 : undefined
  })
  return { url: null }
}

/**
 * Hands a scheduled subscription back to Stripe untouched — same price, same period — and clears our
 * mirror. Silent when nothing is attached (that is the idempotent undo), and forgiving when Stripe
 * refuses: `release` is valid only for a not_started/active schedule, and every other status means
 * the work is already done.
 */
async function releaseScheduleOn(ctx: ActionCtx, sub: Stripe.Subscription): Promise<void> {
  const scheduleId = scheduleIdOf(sub)
  if (scheduleId) {
    try {
      await stripe().subscriptionSchedules.release(scheduleId)
    } catch (err) {
      console.error('[billing] could not release subscription schedule', scrubError(err))
    }
  }
  await ctx.runMutation(internal.billing.setPendingDowngrade, { stripeSubscriptionId: sub.id })
}

/**
 * Releases the schedule once its swap has applied — scheduled by syncUserSubscription, so the
 * subscription returns to the plain state every other flow assumes instead of carrying a spent
 * schedule for a whole cheaper period.
 */
export const releaseSubscriptionSchedule = internalAction({
  args: { stripeSubscriptionId: v.string() },
  handler: async (ctx, { stripeSubscriptionId }) => {
    const sub = await stripe().subscriptions.retrieve(stripeSubscriptionId)
    await releaseScheduleOn(ctx, sub)
  }
})

/**
 * Detaches the discounts still attached to a subscription after its price changed — scheduled by
 * syncUserSubscription when lib/discountGuard decides the change would otherwise hand a free-month
 * promotion code a new, dearer invoice. Idempotent: nothing attached is a silent no-op, and a
 * consumed `once` coupon has already removed itself. Stripe currently allows one discount per
 * subscription, so one delete clears it; a future multi-discount payload would need a loop, and the
 * guard's unit tests are where that ceiling is pinned. A transient Stripe failure retries on a
 * bounded schedule: the deeper defences (monthly-only Checkout, a `once` coupon, the trial portal
 * lock) do not depend on this action, but a plan change during a trial leaves days of runway.
 */
export const detachSubscriptionDiscounts = internalAction({
  args: { stripeSubscriptionId: v.string(), attempt: v.optional(v.number()) },
  handler: async (ctx, { stripeSubscriptionId, attempt = 0 }) => {
    const sub = await stripe().subscriptions.retrieve(stripeSubscriptionId)
    if (!sub.discounts?.length) return
    try {
      await stripe().subscriptions.deleteDiscount(stripeSubscriptionId)
      console.log('[billing] detached discount after a price change', scrubError({ stripeSubscriptionId }))
    } catch (err) {
      console.error('[billing] could not detach subscription discount', scrubError(err))
      if (attempt < 2) {
        await ctx.scheduler.runAfter(60_000, internal.billingNode.detachSubscriptionDiscounts, {
          stripeSubscriptionId,
          attempt: attempt + 1
        })
      }
    }
  }
})

export const createCancelFlowSession = action({
  args: { sessionToken: v.string(), flow: v.union(v.literal('cancel'), v.literal('downgrade')) },
  handler: async (ctx, { sessionToken, flow }): Promise<{ url: string | null }> => {
    const { user, live } = await liveSubscriptionFor(ctx, sessionToken)
    await ctx.runMutation(internal.lib.rateLimit.checkAndIncrement, {
      userId: user._id,
      action: 'createCancelFlowSession',
      maxPerHour: 10
    })
    const { sub, item } = await retrieveWithItem(live.stripeSubscriptionId)

    if (flow === 'cancel') {
      // A pending downgrade and a pending cancellation both want the period end. The cancellation
      // wins: release the schedule so the portal acts on a plain subscription. A member who then
      // abandons the portal has lost the downgrade and can schedule it again.
      await releaseScheduleOn(ctx, sub)
      return portalSession(ctx, user, portalConfigKeyFor(live.tier, sub.status), {
        type: 'subscription_cancel',
        subscription_cancel: { subscription: sub.id },
        after_completion: { type: 'redirect', redirect: { return_url: `${appOrigin()}/billing?canceled=true` } }
      })
    }

    if (live.tier === 'starter') throw new ConvexError('ALREADY_STARTER')
    // A trial runs on the plan it started on (product rule, 2026-09-09). The member converts early,
    // cancels, or lets it run out — a tier change is not one of the moves, so this is refused rather
    // than scheduled. CancelInterstitial hides the alternative for a trialing member; this is the
    // server's half of the same rule.
    if (sub.status === 'trialing') throw new ConvexError('TRIAL_NO_SWITCH')
    if (isCancelPending(sub)) throw new ConvexError('CANCEL_PENDING')

    // The retrieved item carries the authoritative interval; our snapshot (optional) is the fallback.
    const stripeInterval = item.price.recurring?.interval
    const interval = stripeInterval === 'month' || stripeInterval === 'year' ? stripeInterval : live.priceInterval
    const price = starterPriceIdFor(env, interval)
    if (!price) throw new ConvexError('Starter price not configured')

    // `active` and `past_due` both schedule. past_due used to take an immediate portal switch on the
    // grounds that Stripe's dunning owned the unpaid invoice, but its portal configuration no longer
    // lists a cheaper tier (lib/portalConfig), and an immediate switch there is the credited path we
    // are closing. Scheduling settles no money either way, which is what makes it safe for both.
    return scheduleDowngrade(ctx, sub, price, 'starter')
  }
})

// A card holder's "Switch to <plan>" (the plan grid, and the post-cap email's landing). An upgrade or
// an interval switch lands on Stripe's confirmation for THAT price — never the portal home, four
// clicks away. A cheaper tier is scheduled instead, and returns no URL at all. The price id is
// client-chosen, so it is checked against our own list first, as checkout does.
export const createPlanSwitchSession = action({
  args: { sessionToken: v.string(), priceId: v.string() },
  handler: async (ctx, { sessionToken, priceId }): Promise<{ url: string | null }> => {
    if (!ALLOWED_PRICE_IDS.has(priceId)) throw new ConvexError('Invalid price ID')
    const { user, live } = await liveSubscriptionFor(ctx, sessionToken)
    await ctx.runMutation(internal.lib.rateLimit.checkAndIncrement, {
      userId: user._id,
      action: 'createPlanSwitchSession',
      maxPerHour: 10
    })
    const { sub, item } = await retrieveWithItem(live.stripeSubscriptionId)
    // Nothing to confirm. Unreachable from the grid — the member's own plan carries the "current"
    // badge, trialing included — but a stale tab can still send it; the client falls back to the
    // portal home.
    if (item.price.id === priceId) throw new ConvexError('ALREADY_ON_PLAN')
    // A trial runs on the plan it started on (product rule, 2026-09-09) — no tier change and no
    // interval change until it converts. The plan grid hides its Switch buttons during a trial; this
    // is the server's half, and it is why `trial_update_behavior: 'continue_trial'` in the portal
    // configuration is now only a backstop for the portal home rather than a live path.
    if (sub.status === 'trialing') throw new ConvexError('TRIAL_NO_SWITCH')

    const targetTier = getTierFromPriceId(priceId)
    // Rank, never price amount: the decoy ladder makes amounts a liar (lib/downgrade).
    const direction = planChangeDirection(live.tier, targetTier)

    // `targetTier !== 'pro'` keeps pendingTier's union honest. It is unreachable in practice — only a
    // `contact` row would rank Pro as cheaper, and the sync never writes contact to a row — so the
    // fall-through to the portal is a type guard, not a member-facing path.
    if (direction === 'down' && targetTier !== 'pro') {
      if (isCancelPending(sub)) throw new ConvexError('CANCEL_PENDING')
      return scheduleDowngrade(ctx, sub, priceId, targetTier)
    }
    // The portal writes the same subscription our schedule owns, so an upgrade taken while one is
    // attached would race it. Ask for the undo first; BillingPage says exactly that — but only while
    // the downgrade is genuinely pending. A SPENT schedule (swap applied, release refused) is handed
    // back here instead: refusing it would lock the member out of every upgrade for a whole period,
    // behind an undo button the page does not render. See isSpentSchedule.
    const scheduleId = scheduleIdOf(sub)
    if (scheduleId) {
      if (!isSpentSchedule(scheduleId, live.pendingTier)) throw new ConvexError('PENDING_DOWNGRADE')
      await releaseScheduleOn(ctx, sub)
    }

    return portalSession(ctx, user, portalConfigKeyFor(live.tier, sub.status), {
      type: 'subscription_update_confirm',
      subscription_update_confirm: { subscription: sub.id, items: [{ id: item.id, price: priceId, quantity: 1 }] },
      // BillingPage reads the tier back: "Switching you to X…" until the webhook moves `me.tier`,
      // then "You're on X now." and plan_switch_completed, once. Never appended to a scheduled
      // downgrade, which is why that path can never reach the 20-second wait or its Sentry report.
      after_completion: {
        type: 'redirect',
        redirect: { return_url: `${appOrigin()}/billing?switched=${targetTier}` }
      }
    })
  }
})

/**
 * Undo a scheduled downgrade: the subscription keeps the plan it is on, at the price it is on.
 * Idempotent, like resumeSubscription — a subscription with no schedule (stale tab, double tap) is a
 * silent success that clears the mirror and calls no Stripe write.
 */
export const undoScheduledDowngrade = action({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }): Promise<null> => {
    const { user, live } = await liveSubscriptionFor(ctx, sessionToken)
    await ctx.runMutation(internal.lib.rateLimit.checkAndIncrement, {
      userId: user._id,
      action: 'undoScheduledDowngrade',
      maxPerHour: 20
    })
    const sub = await stripe().subscriptions.retrieve(live.stripeSubscriptionId)
    await releaseScheduleOn(ctx, sub)
    return null
  }
})

// Undo a pending period-end cancellation. The webhook's customer.subscription.updated clears
// cancelAtPeriodEnd on our row; the page reacts to that, so nothing is returned. Idempotent: a
// subscription that is already not cancelling (stale tab, double tap) is a silent success.
// Undoes whichever field carries the cancel: the flag, or the portal's `cancel_at` (see
// isCancelPending), which `cancel_at_period_end: false` does not clear and `''` unsets.
export const resumeSubscription = action({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }): Promise<null> => {
    const { user, live } = await liveSubscriptionFor(ctx, sessionToken)
    await ctx.runMutation(internal.lib.rateLimit.checkAndIncrement, {
      userId: user._id,
      action: 'resumeSubscription',
      maxPerHour: 10
    })
    if (!live.cancelAtPeriodEnd) return null
    const sub = await stripe().subscriptions.retrieve(live.stripeSubscriptionId)
    if (!isCancelPending(sub)) return null
    await stripe().subscriptions.update(
      sub.id,
      sub.cancel_at_period_end ? { cancel_at_period_end: false } : { cancel_at: '' }
    )
    return null
  }
})
