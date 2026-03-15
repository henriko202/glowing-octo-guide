import { internalQueryGeneric as internalQuery, queryGeneric as query } from "convex/server";
import { v } from "convex/values";

// Internal: returns full user record including tokens (NEVER expose to client)
export const getWithTokens = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx: any, { userId }: { userId: any }) => ctx.db.get(userId),
});

// Internal: returns all users with active or trialing subscriptions
export const getActiveSubscribers = internalQuery({
  args: {},
  handler: async (ctx: any) => {
    return ctx.db
      .query("users")
      .filter((q: any) =>
        q.or(
          q.eq(q.field("subscriptionStatus"), "active"),
          q.eq(q.field("subscriptionStatus"), "trialing")
        )
      )
      .collect();
  },
});

// Public: returns safe user profile — strips ALL token fields
export const getMe = query({
  args: {},
  handler: async (ctx: any) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const user = await ctx.db
      .query("users")
      .withIndex("by_linkedin_id", (q: any) => q.eq("linkedinId", identity.subject))
      .first();
    if (!user) return null;
    // IMPORTANT: Strip tokens before returning to client
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { linkedinAccessToken, linkedinRefreshToken, tokenExpiresAt, ...safeUser } = user;
    return safeUser;
  },
});
