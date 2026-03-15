// convex/billing.ts
// Uses @convex-dev/stripe component for checkout session creation.
// After running `npx convex dev`, replace makeFunctionReference with:
//   import { components } from "./_generated/api";
//   import { StripeSubscriptions } from "@convex-dev/stripe";
//   const stripe = new StripeSubscriptions(components.stripe, {});

import { action, internalMutation } from "convex/server";
import { makeFunctionReference } from "convex/server";
import { v } from "convex/values";

const getUserWithTokens = makeFunctionReference<"internalQuery">("users:getWithTokens");

export const createCheckoutSession = action({
  args: { priceId: v.string() },
  handler: async (ctx, { priceId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.runQuery(getUserWithTokens, { userId: identity.subject as any });
    if (!user) throw new Error("User not found");

    // Dynamic import of stripe for checkout session creation
    // TODO: After `npx convex dev` runs, replace with:
    //   const stripe = new StripeSubscriptions(components.stripe, {});
    //   const session = await stripe.createCheckoutSession(ctx, { priceId, userId: user._id, ... });
    const Stripe = (await import("stripe")).default;
    const stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-04-10" });

    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripeClient.customers.create({
        name: user.name,
        metadata: { convexUserId: user._id as string },
      });
      customerId = customer.id;
      const setCustomerFn = makeFunctionReference<"internalMutation">("billing:setStripeCustomerId");
      await ctx.runMutation(setCustomerFn, { userId: user._id, stripeCustomerId: customerId });
    }

    const appUrl = process.env.APP_URL ?? "http://localhost:5173";
    const session = await stripeClient.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/billing?success=true`,
      cancel_url: `${appUrl}/billing`,
    });

    return { url: session.url! };
  },
});

export const setStripeCustomerId = internalMutation({
  args: { userId: v.id("users"), stripeCustomerId: v.string() },
  handler: async (ctx, { userId, stripeCustomerId }) => {
    await ctx.db.patch(userId, { stripeCustomerId });
  },
});
