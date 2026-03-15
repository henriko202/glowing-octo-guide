// convex/stripe.ts
// Uses @convex-dev/stripe component for all Stripe interactions.
// Manual stripe.ts code (webhook handler, updateSubscription, cancelSubscription, markPastDue)
// has been replaced by the component's built-in handling + callback hooks.

import { internalMutationGeneric as internalMutation } from "convex/server";
import { v } from "convex/values";
import type { MutationCtx, UserDoc, PostDoc, SubscriptionDoc } from "./convexTypes.js";

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
  handler: async (ctx, args: { stripeCustomerId: string; stripeSubscriptionId: string; tier: "starter" | "growth" | "pro"; status: string; currentPeriodEnd: number }) => {
    const db = (ctx as unknown as MutationCtx).db;
    const user = await db
      .query("users")
      .withIndex("by_stripe_customer", (q) => q.eq("stripeCustomerId", args.stripeCustomerId))
      .first() as UserDoc | null;
    if (!user) {
      console.warn(`syncUserSubscription: no user for Stripe customer ${args.stripeCustomerId}`);
      return;
    }

    await db.patch(user._id, {
      tier: args.tier,
      subscriptionStatus: args.status as UserDoc["subscriptionStatus"],
      trialEndsAt: undefined,
    });

    // Un-hide posts when subscription becomes active
    if (args.status === "active") {
      const posts = await db
        .query("posts")
        .withIndex("by_author", (q) => q.eq("authorId", user._id))
        .filter((q) => q.eq(q.field("hidden"), true))
        .collect() as PostDoc[];
      await Promise.all(posts.map((p) => db.patch(p._id, { hidden: false })));
    }

    // Upsert our own subscriptions table
    const existing = await db
      .query("subscriptions")
      .withIndex("by_stripe_id", (q) => q.eq("stripeSubscriptionId", args.stripeSubscriptionId))
      .first() as SubscriptionDoc | null;
    if (existing) {
      await db.patch(existing._id, {
        tier: args.tier,
        status: args.status,
        currentPeriodEnd: args.currentPeriodEnd,
      });
    } else {
      await db.insert("subscriptions", {
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
  handler: async (ctx, { stripeSubscriptionId }: { stripeSubscriptionId: string }) => {
    const db = (ctx as unknown as MutationCtx).db;
    const sub = await db
      .query("subscriptions")
      .withIndex("by_stripe_id", (q) => q.eq("stripeSubscriptionId", stripeSubscriptionId))
      .first() as SubscriptionDoc | null;
    if (!sub) return;
    await db.patch(sub._id, { status: "canceled" });
    await db.patch(sub.userId, { tier: "starter", subscriptionStatus: "canceled" });
  },
});

/** Mark user as past_due WITHOUT changing tier */
export const markPastDue = internalMutation({
  args: {
    stripeCustomerId: v.string(),
    stripeSubscriptionId: v.string(),
  },
  handler: async (ctx, { stripeCustomerId, stripeSubscriptionId }: { stripeCustomerId: string; stripeSubscriptionId: string }) => {
    const db = (ctx as unknown as MutationCtx).db;
    const user = await db
      .query("users")
      .withIndex("by_stripe_customer", (q) => q.eq("stripeCustomerId", stripeCustomerId))
      .first() as UserDoc | null;
    if (!user) return;
    await db.patch(user._id, { subscriptionStatus: "past_due" });
    const sub = await db
      .query("subscriptions")
      .withIndex("by_stripe_id", (q) => q.eq("stripeSubscriptionId", stripeSubscriptionId))
      .first() as SubscriptionDoc | null;
    if (sub) await db.patch(sub._id, { status: "past_due" });
  },
});

export { getTierFromPriceId };
