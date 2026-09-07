// convex/stripe.ts
// Uses @convex-dev/stripe component for all Stripe interactions.
// Manual stripe.ts code (webhook handler, updateSubscription, cancelSubscription, markPastDue)
// has been replaced by the component's built-in handling + callback hooks.

import { internalMutation } from './_generated/server'
import { v } from 'convex/values'
import { internal } from './_generated/api'
import type { Doc } from './_generated/dataModel'
import { tierToRank } from './lib/planLimits'
import { restampUserPostsTierRank } from './lib/feedRank'
import { canEngage } from './lib/access'
import { isApifyPostSyncEnabled, type ApifyFlags } from './lib/apify'
import { findDuplicateSubscription, findLiveSubscription, isStaleEvent, isTrialConversion } from './lib/trialMilestone'

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
      return null
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
      return null
    }
    // Stripe does not deliver events in order. An event older than the last one applied to this row
    // would rewind status (a late `trialing` update after the trial converted makes the next `active`
    // event look like a second conversion and email the member twice), so the row, the user doc and
    // the emails are all left alone. Only the duplicate decision below still runs, on the rows as
    // they are, so a retried two-tab `created` can still void its duplicate.
    const stale = isStaleEvent(existing?.lastEventAt, args.eventCreated)
    // trialing → active on this row = the trial converted (backlog/R14). Decided before the patch.
    const converted = !stale && isTrialConversion(existing?.status, args.status)
    if (stale) {
      console.warn(`syncUserSubscription: ignoring out-of-order ${args.status} event for ${args.stripeSubscriptionId}`)
    } else {
      const fields = {
        tier: args.tier,
        status: args.status,
        currentPeriodEnd: args.currentPeriodEnd,
        priceAmount: args.priceAmount,
        priceCurrency: args.priceCurrency,
        priceInterval: args.priceInterval,
        cancelAtPeriodEnd: args.cancelAtPeriodEnd,
        stripeCreated: args.stripeCreated ?? existing?.stripeCreated,
        lastEventAt: args.eventCreated ?? existing?.lastEventAt
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
    }

    // Every row this member holds, including the write above. Two live rows is the two-tab
    // checkout race (see http.ts): the newest by Stripe `created` is the duplicate to void, and the
    // member keeps following the other row. Decided HERE, inside the transaction, so two concurrent
    // syncs cannot each take the other for the duplicate and void both.
    const rows = await ctx.db
      .query('subscriptions')
      .withIndex('by_user', q => q.eq('userId', user._id))
      .collect()
    const duplicate = findDuplicateSubscription(rows)
    const defining = findLiveSubscription(duplicate ? rows.filter(r => r._id !== duplicate._id) : rows)
    const result =
      duplicate && defining
        ? { userId: user._id, stripeSubscriptionId: duplicate.stripeSubscriptionId, keepTier: defining.tier }
        : null
    // A stale event changed nothing above: the newer one already set the member's state.
    if (stale) return result
    // Another row defines the member (this one is the duplicate, or a non-live event for a row they
    // no longer rely on): leave the user doc alone.
    if (defining && defining.stripeSubscriptionId !== args.stripeSubscriptionId) return result

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
      await ctx.scheduler.runAfter(0, internal.notifications.sendTrialConverted, { userId: user._id })
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

    return result
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
    if (sub?.status === 'canceled') {
      console.warn(`markPastDue: ignoring payment failure for canceled ${stripeSubscriptionId}`)
      return
    }
    // A failed payment blocks engaging until it clears (canEngage rejects 'past_due'). Tier unchanged.
    await ctx.db.patch(user._id, { subscriptionStatus: 'past_due' })
    if (sub) await ctx.db.patch(sub._id, { status: 'past_due', lastEventAt: eventCreated ?? sub.lastEventAt })
  }
})
