import { internalQueryGeneric as internalQuery, queryGeneric as query } from "convex/server";
import { v } from "convex/values";
import type { QueryCtx, UserDoc } from "./convexTypes.js";

// Internal: returns full user record including tokens (NEVER expose to client)
export const getWithTokens = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }: { userId: string }) => {
    const db = (ctx as unknown as QueryCtx).db;
    return db.get(userId);
  },
});

// Internal: returns all users with active or trialing subscriptions
export const getActiveSubscribers = internalQuery({
  args: {},
  handler: async (ctx) => {
    const db = (ctx as unknown as QueryCtx).db;
    return db
      .query("users")
      .filter((q) =>
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
  handler: async (ctx) => {
    const queryCtx = ctx as unknown as QueryCtx;
    const identity = await queryCtx.auth.getUserIdentity();
    if (!identity) return null;
    const user = await queryCtx.db
      .query("users")
      .withIndex("by_linkedin_id", (q) => q.eq("linkedinId", identity.subject))
      .first() as UserDoc | null;
    if (!user) return null;
    // IMPORTANT: Strip tokens before returning to client
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { linkedinAccessToken, linkedinRefreshToken, tokenExpiresAt, ...safeUser } = user;
    return safeUser;
  },
});
