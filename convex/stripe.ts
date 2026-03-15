// convex/stripe.ts
// Uses @convex-dev/stripe component for all Stripe interactions.
// Manual stripe.ts code (webhook handler, updateSubscription, cancelSubscription, markPastDue)
// has been replaced by the component's built-in handling + callback hooks.

import { internalMutation } from "convex/server";
import { v } from "convex/values";

// These internal mutations are called from webhook callbacks registered in http.ts
// to keep our users table in sync with Stripe subscription state.

function getTierFromPriceId(priceId: string): "starter" | "growth" | "pro" {
  const map: Record<string, "starter" | "growth" | "pro"> = {
    [process.env.STRIPE_STARTER_PRICE_ID ?? ""]: "starter",
    [process.env.STRIPE_GROWTH_PRICE_ID ?? ""]: "growth",
    [process.env.STRIPE_PRO_PRICE_ID ?? ""]: "pro",
  };
  return map[priceId] ?? "starter";
}

/** Sync user tier and subscription status after Stripe subscription changes */
export const syncUserSubscription = internalMutation({
  args: {
    stripeCustomerId: v.string(),
    stripeSubscriptionId: v.string(),
    tier: v.union(v.literal("starter"), v.literal("growth"), v.literal("pro")),
    status: v.string(),
    currentPeriodEnd: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_stripe_customer", (q) => q.eq("stripeCustomerId", args.stripeCustomerId))
      .first();
    if (!user) {
      console.warn(`syncUserSubscription: no user for Stripe customer ${args.stripeCustomerId}`);
      return;
    }

    await ctx.db.patch(user._id, {
      tier: args.tier,
      subscriptionStatus: args.status as any,
      trialEndsAt: undefined,
    });

    // Un-hide posts when subscription becomes active
    if (args.status === "active") {
      const posts = await ctx.db
        .query("posts")
        .withIndex("by_author", (q) => q.eq("authorId", user._id))
        .filter((q) => q.eq(q.field("hidden"), true))
        .collect();
      await Promise.all(posts.map((p) => ctx.db.patch(p._id, { hidden: false })));
    }

    // Upsert our own subscriptions table
    const existing = await ctx.db
      .query("subscriptions")
      .withIndex("by_stripe_id", (q) => q.eq("stripeSubscriptionId", args.stripeSubscriptionId))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        tier: args.tier,
        status: args.status,
        currentPeriodEnd: args.currentPeriodEnd,
      });
    } else {
      await ctx.db.insert("subscriptions", {
        userId: user._id,
        stripeSubscriptionId: args.stripeSubscriptionId,
        tier: args.tier,
        status: args.status,
        currentPeriodEnd: args.currentPeriodEnd,
      });
    }
  },
});

/** Downgrade user to starter on subscription cancellation */
export const cancelUserSubscription = internalMutation({
  args: { stripeSubscriptionId: v.string() },
  handler: async (ctx, { stripeSubscriptionId }) => {
    const sub = await ctx.db
      .query("subscriptions")
      .withIndex("by_stripe_id", (q) => q.eq("stripeSubscriptionId", stripeSubscriptionId))
      .first();
    if (!sub) return;
    await ctx.db.patch(sub._id, { status: "canceled" });
    await ctx.db.patch(sub.userId, { tier: "starter", subscriptionStatus: "canceled" });
  },
});

/** Mark user as past_due WITHOUT changing tier */
export const markPastDue = internalMutation({
  args: {
    stripeCustomerId: v.string(),
    stripeSubscriptionId: v.string(),
  },
  handler: async (ctx, { stripeCustomerId, stripeSubscriptionId }) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_stripe_customer", (q) => q.eq("stripeCustomerId", stripeCustomerId))
      .first();
    if (!user) return;
    await ctx.db.patch(user._id, { subscriptionStatus: "past_due" });
    const sub = await ctx.db
      .query("subscriptions")
      .withIndex("by_stripe_id", (q) => q.eq("stripeSubscriptionId", stripeSubscriptionId))
      .first();
    if (sub) await ctx.db.patch(sub._id, { status: "past_due" });
  },
});

export { getTierFromPriceId };
