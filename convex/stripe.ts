// convex/stripe.ts
import { internalMutation, httpAction, makeFunctionReference } from "convex/server";
import { v } from "convex/values";

// Map Stripe price IDs to tiers — filled from env vars at runtime
function getTierFromPriceId(priceId: string): "starter" | "growth" | "pro" {
  const map: Record<string, "starter" | "growth" | "pro"> = {
    [process.env.STRIPE_STARTER_PRICE_ID ?? ""]: "starter",
    [process.env.STRIPE_GROWTH_PRICE_ID ?? ""]: "growth",
    [process.env.STRIPE_PRO_PRICE_ID ?? ""]: "pro",
  };
  return map[priceId] ?? "starter";
}

// Called when a subscription is created or updated
export const updateSubscription = internalMutation({
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
    if (!user) throw new Error(`No user for Stripe customer ${args.stripeCustomerId}`);

    await ctx.db.patch(user._id, {
      tier: args.tier,
      subscriptionStatus: args.status as any,
      trialEndsAt: undefined,
    });

    // If newly active, un-hide the user's posts
    if (args.status === "active") {
      const posts = await ctx.db
        .query("posts")
        .withIndex("by_author", (q) => q.eq("authorId", user._id))
        .filter((q) => q.eq(q.field("hidden"), true))
        .collect();
      await Promise.all(posts.map((p) => ctx.db.patch(p._id, { hidden: false })));
    }

    // Upsert subscription record
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

// Called when a subscription is deleted/canceled
export const cancelSubscription = internalMutation({
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

// HTTP action for Stripe webhook — registered in http.ts
export const stripeWebhookHandler = httpAction(async (ctx, req) => {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

  if (!sig) {
    return new Response("Missing stripe-signature header", { status: 400 });
  }

  let event: any;
  try {
    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-04-10" });
    event = await stripe.webhooks.constructEventAsync(body, sig, webhookSecret);
  } catch (err: any) {
    return new Response(`Webhook verification failed: ${err.message}`, { status: 400 });
  }

  const updateSubFn = makeFunctionReference<"internalMutation">("stripe:updateSubscription");
  const cancelSubFn = makeFunctionReference<"internalMutation">("stripe:cancelSubscription");

  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const sub = event.data.object;
      const priceId = sub.items?.data?.[0]?.price?.id ?? "";
      const tier = getTierFromPriceId(priceId);
      await ctx.runMutation(updateSubFn, {
        stripeCustomerId: sub.customer as string,
        stripeSubscriptionId: sub.id as string,
        tier,
        status: sub.status as string,
        currentPeriodEnd: (sub.current_period_end as number) * 1000,
      });
      break;
    }
    case "customer.subscription.deleted": {
      const sub = event.data.object;
      await ctx.runMutation(cancelSubFn, { stripeSubscriptionId: sub.id as string });
      break;
    }
    case "invoice.payment_failed": {
      const invoice = event.data.object;
      if (invoice.subscription) {
        await ctx.runMutation(updateSubFn, {
          stripeCustomerId: invoice.customer as string,
          stripeSubscriptionId: invoice.subscription as string,
          tier: "starter",
          status: "past_due",
          currentPeriodEnd: Date.now(),
        });
      }
      break;
    }
  }

  return new Response("ok", { status: 200 });
});
