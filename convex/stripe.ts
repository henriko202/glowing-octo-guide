// convex/stripe.ts
// Uses @convex-dev/stripe component for all Stripe interactions.
// Manual stripe.ts code (webhook handler, updateSubscription, cancelSubscription, markPastDue)
// has been replaced by the component's built-in handling + callback hooks.

import { internalMutation } from './_generated/server'
import { v } from 'convex/values'
import type Stripe from 'stripe'
import { internal } from './_generated/api'
import type { Doc } from './_generated/dataModel'
import { tierToRank } from './lib/planLimits'
import { restampUserPostsTierRank } from './lib/feedRank'
import { canEngage } from './lib/access'
import { type ApifyFlags, isApifyPostSyncEnabled } from './lib/apify'
import {
  findDuplicateSubscription,
  findLiveSubscription,
  isCancelPending,
  isStaleEvent,
  isStatusRegression,
  isTrialConversion,
  wentLive
} from './lib/trialMilestone'
import { resolvePendingDowngrade } from './lib/downgrade'
import { shouldDetachDiscounts } from './lib/discountGuard'
import { getTierFromPriceId } from './lib/stripePrices'

// `Stripe.Event` is the SDK's discriminated union of every webhook payload. `eventCreatedMs` works
// on any of them; `syncArgs` narrows to the subscription lifecycle events it actually reshapes.
type StripeEvent = Stripe.Event

/** The subscription lifecycle payloads the `customer.subscription.created`/`updated` routes pass in. */
type SubscriptionEvent = Extract<
  StripeEvent,
  { type: 'customer.subscription.created' | 'customer.subscription.updated' }
>

// Stripe's `created` of the EVENT itself (ms): the ordering stamp behind subscriptions.lastEventAt.
export const eventCreatedMs = (event: StripeEvent) =>
  typeof event.created === 'number' ? event.created * 1000 : undefined

/**
 * A `customer.subscription.*` payload reshaped into syncUserSubscription's args — shared by the
 * created and updated routes in http.ts. Lives here rather than there so it can be unit-tested:
 * http.ts registers its routes at module scope and cannot be imported by a test.
 */
export function syncArgs(event: SubscriptionEvent) {
  // API 2025 moved `current_period_end` from the subscription onto its item, but the account's
  // webhook endpoint API version decides which shape the payload carries — read the legacy
  // subscription-level field too, off a narrow view since the SDK type no longer declares it.
  const sub: Stripe.Subscription & { current_period_end?: number | null } = event.data.object
  const price = sub.items?.data?.[0]?.price
  // `current_period_end` moved from the SUBSCRIPTION onto the subscription ITEM in the 2025 API
  // versions. Reading only the subscription silently yields undefined on a modern account, which is
  // how the member's renewal date (BillingPage) and users.subscriptionEndsAt came to be blank while
  // every test still passed. Read both, newest location first.
  const periodEnd = sub.current_period_end ?? sub.items?.data?.[0]?.current_period_end
  // Discounts moved the same way: a modern payload carries `discounts` (a list), an older one a
  // singular `discount`. Only ids are needed — the webhook's job is to know a discount is attached
  // so it can schedule a detach when the price changes (lib/discountGuard).
  const legacyDiscount = (sub as { discount?: string | { id: string } | null }).discount
  const discounts =
    (sub as { discounts?: Array<string | { id: string }> | null }).discounts ?? (legacyDiscount ? [legacyDiscount] : [])
  const discountIds = discounts.map(d => (typeof d === 'string' ? d : d.id)).filter(Boolean)
  return {
    stripeCustomerId: String(sub.customer),
    stripeSubscriptionId: sub.id,
    tier: getTierFromPriceId(price?.id ?? ''),
    status: sub.status,
    currentPeriodEnd: periodEnd ? periodEnd * 1000 : undefined,
    trialEndsAt: sub.trial_end ? sub.trial_end * 1000 : undefined,
    // Price snapshot so a billing email can state the exact amount without a second Stripe call.
    priceAmount: typeof price?.unit_amount === 'number' ? price.unit_amount : undefined,
    priceCurrency: price?.currency ?? undefined,
    priceInterval: price?.recurring?.interval ?? undefined,
    // The discounts still attached at event time, if any — see the guard in syncUserSubscription.
    discountIds,
    // Any scheduled cancel, not just the flag — see isCancelPending.
    cancelAtPeriodEnd: isCancelPending(sub),
    // backlog/B07 — the subscription schedule attached to this subscription, if any. Its PRESENCE is
    // how the sync tells "downgrade still pending" from "applied or released"; the id itself is never
    // stored (Stripe's own advice: discard a schedule id once it is released).
    stripeScheduleId: typeof sub.schedule === 'string' ? sub.schedule : (sub.schedule?.id ?? undefined),
    // Stripe's own creation instant: the duplicate guard voids the newest by this, not by arrival.
    stripeCreated: typeof sub.created === 'number' ? sub.created * 1000 : undefined,
    eventCreated: eventCreatedMs(event)
  }
}

/**
 * The subscription an invoice belongs to, from either API shape: 2025-03-31.basil removed the
 * top-level `invoice.subscription` and moved it under `parent.subscription_details`. The account's
 * webhook endpoint API version decides which shape the payload carries, so read both (newest
 * first). Lives here, next to `syncArgs`, so the field extraction stays testable.
 */
export function invoiceSubscriptionId(invoice: Stripe.Invoice): string | undefined {
  // The legacy top-level field is gone from the SDK's type but can still be in an older payload.
  const legacy = (invoice as { subscription?: string | Stripe.Subscription | null }).subscription
  const current = invoice.parent?.subscription_details?.subscription
  const subscription = legacy ?? current
  if (!subscription) return undefined
  return typeof subscription === 'string' ? subscription : subscription.id
}

// Maps a raw Stripe subscription status onto our access-granting union. FAIL-SAFE:
// any status that does not clearly grant access (incomplete, unpaid, paused, unknown)
// resolves to a non-active state, so a half-finished or lapsed subscription never grants access.
export function toSubscriptionStatus(raw: string): Doc<'users'>['subscriptionStatus'] {
  switch (raw) {
    case 'active':
    case 'trialing':
    case 'past_due':
    case 'canceled':
      return raw
    case 'unpaid':
      return 'past_due'
    case 'incomplete':
    case 'incomplete_expired':
    case 'paused':
      return 'none'
    default:
      console.warn(`Unknown Stripe subscription status "${raw}" — defaulting to "none"`)
      return 'none'
  }
}

// An admin's tier is FIXED — Stripe webhooks never change it ("if a user is admin, tier change is
// never applied"). Everyone else, including 'contact', follows Stripe: a contact member who
// subscribes to a paid plan moves to that tier like anyone else (contact is admin-assigned, not
// Stripe-purchasable, but the member is free to change it). Returns the tier to persist.
export function resolveSyncedTier(
  currentTier: Doc<'users'>['tier'],
  isAdmin: boolean | undefined,
  stripeTier: Doc<'subscriptions'>['tier']
): Doc<'users'>['tier'] {
  return isAdmin ? currentTier : stripeTier
}

// These internal mutations are called from webhook callbacks registered in http.ts
// to keep our users table in sync with Stripe subscription state.

/** Sync user tier and subscription status after Stripe subscription changes */
export const syncUserSubscription = internalMutation({
  args: {
    stripeCustomerId: v.string(),
    stripeSubscriptionId: v.string(),
    tier: v.union(v.literal('starter'), v.literal('growth'), v.literal('pro')),
    status: v.string(),
    currentPeriodEnd: v.optional(v.number()),
    trialEndsAt: v.optional(v.number()),
    // Price snapshot straight off the webhook payload — see schema: subscriptions.priceAmount.
    priceAmount: v.optional(v.number()),
    priceCurrency: v.optional(v.string()),
    priceInterval: v.optional(v.string()),
    cancelAtPeriodEnd: v.optional(v.boolean()),
    // backlog/B07 — presence of an attached subscription schedule. See lib/downgrade.
    stripeScheduleId: v.optional(v.string()),
    // The discounts still attached to the subscription at event time (lib/discountGuard).
    discountIds: v.optional(v.array(v.string())),
    stripeCreated: v.optional(v.number()),
    // Stripe `created` of the EVENT (ms), not of the subscription — see schema: subscriptions.lastEventAt.
    eventCreated: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_stripe_customer', q => q.eq('stripeCustomerId', args.stripeCustomerId))
      .first()
    if (!user) {
      console.warn(`syncUserSubscription: no user for Stripe customer ${args.stripeCustomerId}`)
      return
    }

    // Upsert our own subscriptions row first: the member's state is derived from their rows below.
    const existing = await ctx.db
      .query('subscriptions')
      .withIndex('by_stripe_id', q => q.eq('stripeSubscriptionId', args.stripeSubscriptionId))
      .first()
    // A canceled Stripe subscription never comes back, so a live status for a canceled row is a
    // stale replay (Stripe retries on any non-2xx). Applying it would resurrect a voided duplicate.
    if (existing?.status === 'canceled' && args.status !== 'canceled') {
      console.warn(`syncUserSubscription: ignoring stale ${args.status} event for a canceled subscription`)
      return
    }
    // Stripe does not deliver events in order. An event older than the last one applied to this row
    // would rewind status (a late `trialing` update after the trial converted makes the next `active`
    // event look like a second conversion and email the member twice), and a subscription born
    // `incomplete` can have its `created` land after its own `active` `updated` in the same second, where the
    // stamp cannot order them (isStatusRegression). Either way the row, the user doc and the emails
    // are all left alone: the newer event already set the member's state.
    if (isStaleEvent(existing?.lastEventAt, args.eventCreated) || isStatusRegression(existing?.status, args.status)) {
      console.warn(`syncUserSubscription: ignoring out-of-order ${args.status} event for ${args.stripeSubscriptionId}`)
      return
    }
    // trialing → active on this row = the trial converted (backlog/R14). Decided before the patch.
    const converted = isTrialConversion(existing?.status, args.status)
    // Whether this event makes the row live: the only one that may void a duplicate (below).
    const madeLive = wentLive(existing?.status, args.status)
    // backlog/B07 — decided on the row as it stands BEFORE this patch, because "the tier moved" is
    // precisely the signal that the schedule's swap landed.
    const pending = resolvePendingDowngrade(existing ?? null, {
      tier: args.tier,
      stripeScheduleId: args.stripeScheduleId
    })
    const fields = {
      tier: args.tier,
      status: args.status,
      currentPeriodEnd: args.currentPeriodEnd,
      priceAmount: args.priceAmount,
      priceCurrency: args.priceCurrency,
      priceInterval: args.priceInterval,
      cancelAtPeriodEnd: args.cancelAtPeriodEnd,
      stripeCreated: args.stripeCreated ?? existing?.stripeCreated,
      lastEventAt: args.eventCreated ?? existing?.lastEventAt,
      // 'keep' leaves the mirror alone and 'none' has nothing to leave, so the keys stay OUT of the
      // patch for both — including them as undefined would unset a mirror that is still true.
      ...(pending === 'applied' || pending === 'clear' ? { pendingTier: undefined, pendingAt: undefined } : {})
    }
    if (existing) {
      await ctx.db.patch(existing._id, fields)
    } else {
      await ctx.db.insert('subscriptions', {
        userId: user._id,
        stripeSubscriptionId: args.stripeSubscriptionId,
        ...fields
      })
    }
    // The swap landed. end_behavior 'release' only fires when the cheaper phase ENDS — a whole
    // period away, a year on annual — and until then every other flow reads "has a schedule" as
    // "downgrade pending". Hand it back now; the self-release is the backstop if this never runs.
    if (pending === 'applied') {
      await ctx.scheduler.runAfter(0, internal.billingNode.releaseSubscriptionSchedule, {
        stripeSubscriptionId: args.stripeSubscriptionId
      })
    }
    // A plan or interval change while a discount is still attached would let a free-month
    // promotion code discount the NEW price: a monthly -> annual switch inside the coupon window
    // makes the annual invoice 100% off — a free year (found 2026-09-18). The portal's own refusal
    // during a trial is the first line (lib/portalConfig); this detach is the backstop for every
    // other path, the Dashboard included. Our scheduled downgrade applying is exempt because
    // buildDowngradePhases carries the discount into the cheaper phase on purpose.
    if (
      shouldDetachDiscounts({
        existing: existing ? { tier: existing.tier, priceInterval: existing.priceInterval } : null,
        incoming: { tier: args.tier, priceInterval: args.priceInterval },
        pending,
        hasDiscount: (args.discountIds?.length ?? 0) > 0
      })
    ) {
      await ctx.scheduler.runAfter(0, internal.billingNode.detachSubscriptionDiscounts, {
        stripeSubscriptionId: args.stripeSubscriptionId
      })
    }

    // Every row this member holds, including the write above. Two live rows is the two-tab
    // checkout race (PLATFORM §8): the newest by Stripe `created` is the duplicate to void, and the
    // member keeps following the other row. Decided HERE, inside the transaction, so two concurrent
    // syncs cannot each take the other for the duplicate and void both.
    const rows = await ctx.db
      .query('subscriptions')
      .withIndex('by_user', q => q.eq('userId', user._id))
      .collect()
    const duplicate = findDuplicateSubscription(rows)
    const defining = findLiveSubscription(duplicate ? rows.filter(r => r._id !== duplicate._id) : rows)
    // Voided only by the event that made a row live, and scheduled in this transaction, so the cancel
    // commits with that row: a Stripe retry, or any later event, finds the row live already and can
    // neither lose the cancel nor void and notify twice. The duplicate's row is closed here too, before
    // Stripe's `deleted` lands: a third tab going live in between must find this one gone and be voided
    // itself, not pick this one again.
    if (madeLive && duplicate && defining) {
      await ctx.db.patch(duplicate._id, { status: 'canceled' })
      await ctx.scheduler.runAfter(0, internal.billingNode.cancelDuplicateSubscription, {
        userId: user._id,
        stripeSubscriptionId: duplicate.stripeSubscriptionId,
        tier: defining.tier
      })
    }
    // Another row defines the member (this one is the duplicate, or a non-live event for a row they
    // no longer rely on): leave the user doc alone.
    if (defining && defining.stripeSubscriptionId !== args.stripeSubscriptionId) return

    // Admins' tier is fixed (see resolveSyncedTier); everyone else follows Stripe.
    const effectiveTier = resolveSyncedTier(user.tier, user.isAdmin, args.tier)
    const status = toSubscriptionStatus(args.status)
    await ctx.db.patch(user._id, {
      tier: effectiveTier,
      subscriptionStatus: status,
      trialEndsAt: args.trialEndsAt,
      // Paid-through instant — a canceled author's posts stay in the feed until this passes.
      subscriptionEndsAt: args.currentPeriodEnd
    })

    if (converted) {
      await ctx.scheduler.runAfter(0, internal.billingNotices.sendTrialConverted, { userId: user._id })
    }

    // Re-stamp authorTierRank + feed fields on all this user's posts, and reveal any created hidden
    // while they had no card (e.g. an onboarding first post) as soon as they gain one — trialing
    // counts (Plan 2B: a card on file ⇒ posts visible). Shared with the cancel + admin tier paths.
    const becameActive = status === 'active'
    await restampUserPostsTierRank(ctx, user._id, tierToRank(effectiveTier), { unhideHidden: canEngage(status) })

    // Trigger immediate post fetch when subscription becomes active — ONLY if Apify is enabled.
    // Apify is dormant at launch (compliance gate); this guard prevents re-enabling it via billing.
    if (becameActive) {
      const settings = await ctx.db.query('appSettings').first()
      if (isApifyPostSyncEnabled(settings as ApifyFlags)) {
        await ctx.scheduler.runAfter(0, internal.jobs.syncPostsApify.syncUserPostsViaApify, {
          userId: user._id
        })
      }
    }
  }
})

/** Downgrade user to starter on subscription cancellation */
export const cancelUserSubscription = internalMutation({
  args: { stripeSubscriptionId: v.string() },
  handler: async (ctx, { stripeSubscriptionId }) => {
    const sub = await ctx.db
      .query('subscriptions')
      .withIndex('by_stripe_id', q => q.eq('stripeSubscriptionId', stripeSubscriptionId))
      .first()
    if (!sub) return
    await ctx.db.patch(sub._id, { status: 'canceled' })

    // The member may still hold ANOTHER live subscription: the voided duplicate's own `deleted`
    // event (see syncUserSubscription), or a period-end cancel landing after a re-subscribe. Then
    // their state follows the row they keep and nothing is downgraded.
    const rows = await ctx.db
      .query('subscriptions')
      .withIndex('by_user', q => q.eq('userId', sub.userId))
      .collect()
    const live = findLiveSubscription(rows)

    // Cancellation NEVER revokes access — status goes 'canceled' but canEngage() still allows it
    // (see lib/access.ts). Instead, the author's posts stay in the feed only until their paid period
    // ends (subscriptionEndsAt = the sub's last known current_period_end). Tier drops to starter for
    // everyone except admins, whose tier is fixed (resolveSyncedTier).
    const user = await ctx.db.get(sub.userId)
    const tier = resolveSyncedTier(user?.tier, user?.isAdmin, live?.tier ?? 'starter')
    await ctx.db.patch(sub.userId, {
      tier,
      subscriptionStatus: live ? toSubscriptionStatus(live.status) : 'canceled',
      subscriptionEndsAt: (live ?? sub).currentPeriodEnd
    })

    // Re-stamp authorTierRank (→ feedRank) on all posts by this user to match the resolved tier.
    await restampUserPostsTierRank(ctx, sub.userId, tierToRank(tier))
  }
})

/** Mark user as past_due WITHOUT changing tier */
export const markPastDue = internalMutation({
  args: {
    stripeCustomerId: v.string(),
    stripeSubscriptionId: v.string(),
    eventCreated: v.optional(v.number())
  },
  handler: async (ctx, { stripeCustomerId, stripeSubscriptionId, eventCreated }) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_stripe_customer', q => q.eq('stripeCustomerId', stripeCustomerId))
      .first()
    if (!user) return
    const sub = await ctx.db
      .query('subscriptions')
      .withIndex('by_stripe_id', q => q.eq('stripeSubscriptionId', stripeSubscriptionId))
      .first()
    // Same ordering guard as syncUserSubscription: a retried failure landing after the payment
    // cleared must not block the member again.
    if (isStaleEvent(sub?.lastEventAt, eventCreated)) {
      console.warn(`markPastDue: ignoring out-of-order event for ${stripeSubscriptionId}`)
      return
    }
    // Stripe's dunning end delivers the final failure and the `deleted` in either order, and the
    // `deleted` does not stamp: a failure applied to a voided row would leave the member past_due
    // for good (nothing later ever touches that row). Same invariant as syncUserSubscription.
    // A FIRST payment failing leaves Stripe's subscription `incomplete`, never past_due (one made through the API or
    // the Dashboard; Checkout creates none until the payment succeeds): the member has not subscribed yet, and
    // past_due (live) would refuse their next checkout. With no row yet, the failure can only be such a first one (a
    // renewal's row exists since its `created`), and it may belong to a member another subscription keeps live.
    if (!sub || sub.status === 'canceled' || sub.status === 'incomplete' || sub.status === 'incomplete_expired') {
      console.warn(`markPastDue: ignoring payment failure for ${sub?.status ?? 'unknown'} ${stripeSubscriptionId}`)
      return
    }
    // A failed payment blocks engaging until it clears (canEngage rejects 'past_due'). Tier unchanged.
    await ctx.db.patch(user._id, { subscriptionStatus: 'past_due' })
    await ctx.db.patch(sub._id, { status: 'past_due', lastEventAt: eventCreated ?? sub.lastEventAt })
  }
})
