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

// These internal mutations are called from webhook callbacks registered in http.ts
// to keep our users table in sync with Stripe subscription state.

function getTierFromPriceId(priceId: string): 'starter' | 'growth' | 'pro' {
  // Build the map skipping unset env vars, so a missing var can't collapse into an
  // empty-string key that a blank priceId would match. Unknown/blank → 'starter' (safe default).
  const map: Record<string, 'starter' | 'growth' | 'pro'> = {}
  if (process.env.STRIPE_STARTER_PRICE_ID) map[process.env.STRIPE_STARTER_PRICE_ID] = 'starter'
  if (process.env.STRIPE_GROWTH_PRICE_ID) map[process.env.STRIPE_GROWTH_PRICE_ID] = 'growth'
  if (process.env.STRIPE_PRO_PRICE_ID) map[process.env.STRIPE_PRO_PRICE_ID] = 'pro'
  if (!priceId || !(priceId in map)) {
    console.error(`getTierFromPriceId: unknown/blank priceId "${priceId}" — defaulting to starter`)
    return 'starter'
  }
  return map[priceId]
}

/** Sync user tier and subscription status after Stripe subscription changes */
export const syncUserSubscription = internalMutation({
  args: {
    stripeCustomerId: v.string(),
    stripeSubscriptionId: v.string(),
    tier: v.union(v.literal('starter'), v.literal('growth'), v.literal('pro')),
    status: v.string(),
    currentPeriodEnd: v.optional(v.number())
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

    const status = toSubscriptionStatus(args.status)
    await ctx.db.patch(user._id, {
      tier: args.tier,
      subscriptionStatus: status,
      trialEndsAt: undefined
    })

    // Re-stamp authorTierRank + feed fields on all this user's posts, un-hiding them when
    // the subscription becomes active. Shared with the cancel + admin tier-change paths.
    const becameActive = status === 'active'
    await restampUserPostsTierRank(ctx, user._id, tierToRank(args.tier), { unhideHidden: becameActive })

    // Trigger immediate post fetch when subscription becomes active
    if (becameActive) {
      await ctx.scheduler.runAfter(0, internal.jobs.syncPostsApify.syncUserPostsViaApify, {
        userId: user._id
      })
    }

    // Upsert our own subscriptions table
    const existing = await ctx.db
      .query('subscriptions')
      .withIndex('by_stripe_id', q => q.eq('stripeSubscriptionId', args.stripeSubscriptionId))
      .first()
    if (existing) {
      await ctx.db.patch(existing._id, {
        tier: args.tier,
        status: args.status,
        currentPeriodEnd: args.currentPeriodEnd
      })
    } else {
      await ctx.db.insert('subscriptions', {
        userId: user._id,
        stripeSubscriptionId: args.stripeSubscriptionId,
        tier: args.tier,
        status: args.status,
        currentPeriodEnd: args.currentPeriodEnd
      })
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
    await ctx.db.patch(sub.userId, { tier: 'starter', subscriptionStatus: 'canceled' })

    // Downgrade authorTierRank (→ feedRank) on all posts by this user to starter.
    await restampUserPostsTierRank(ctx, sub.userId, tierToRank('starter'))
  }
})

/** Mark user as past_due WITHOUT changing tier */
export const markPastDue = internalMutation({
  args: {
    stripeCustomerId: v.string(),
    stripeSubscriptionId: v.string()
  },
  handler: async (ctx, { stripeCustomerId, stripeSubscriptionId }) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_stripe_customer', q => q.eq('stripeCustomerId', stripeCustomerId))
      .first()
    if (!user) return
    await ctx.db.patch(user._id, { subscriptionStatus: 'past_due' })
    const sub = await ctx.db
      .query('subscriptions')
      .withIndex('by_stripe_id', q => q.eq('stripeSubscriptionId', stripeSubscriptionId))
      .first()
    if (sub) await ctx.db.patch(sub._id, { status: 'past_due' })
  }
})

export { getTierFromPriceId }
