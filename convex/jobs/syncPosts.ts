// convex/jobs/syncPosts.ts
import { internalMutation, internalAction, cronJobs } from "convex/server";
import { v } from "convex/values";
import { makeFunctionReference } from "convex/server";
import { fetchUserPosts } from "../linkedin/posts";

// References to other internal functions (avoids _generated/ dependency)
const getUserWithTokens = makeFunctionReference<"internalQuery">("users:getWithTokens");
const getActiveSubscribers = makeFunctionReference<"internalQuery">("users:getActiveSubscribers");

// Upsert a single post — inserts new, updates like/comment counts on existing
export const upsertPost = internalMutation({
  args: {
    linkedinPostUrn: v.string(),
    authorId: v.id("users"),
    content: v.string(),
    publishedAt: v.number(),
    likeCount: v.number(),
    commentCount: v.number(),
    mediaUrls: v.array(v.string()),
    isFeatured: v.boolean(),
    visibilityIndustries: v.array(v.string()),
    visibilityCountries: v.array(v.string()),
    hidden: v.boolean(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("posts")
      .withIndex("by_urn", (q) => q.eq("linkedinPostUrn", args.linkedinPostUrn))
      .first();
    if (existing) {
      // Only update mutable fields on re-sync
      await ctx.db.patch(existing._id, {
        likeCount: args.likeCount,
        commentCount: args.commentCount,
      });
    } else {
      await ctx.db.insert("posts", {
        ...args,
        featuredAt: undefined,
      });
    }
  },
});

// Sync posts for one user
export const syncUserPosts = internalAction({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const user = await ctx.runQuery(getUserWithTokens, { userId });
    if (!user?.linkedinAccessToken) {
      console.warn(`No LinkedIn token for user ${userId}, skipping sync`);
      return;
    }

    if (user.tokenExpiresAt && user.tokenExpiresAt - Date.now() < 7 * 86400000) {
      console.warn(`Token for user ${userId} expires within 7 days — re-auth needed`);
    }

    const posts = await fetchUserPosts(user.linkedinAccessToken, user.linkedinId);
    const upsertPostFn = makeFunctionReference<"internalMutation">("jobs/syncPosts:upsertPost");

    for (const post of posts) {
      await ctx.runMutation(upsertPostFn, {
        ...post,
        authorId: userId,
        isFeatured: false,
        visibilityIndustries: [],
        visibilityCountries: [],
        hidden: user.subscriptionStatus === "trialing",
      });
    }
  },
});

// Hourly cron: sync posts for all active/trialing subscribers
export const syncAllPosts = internalAction({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.runQuery(getActiveSubscribers, {});
    await Promise.allSettled(
      users.map((u: any) => {
        const syncFn = makeFunctionReference<"internalAction">("jobs/syncPosts:syncUserPosts");
        return ctx.runAction(syncFn, { userId: u._id });
      })
    );
  },
});

// Register cron jobs
export const crons = cronJobs();
crons.hourly(
  "sync LinkedIn posts",
  { minuteUTC: 0 },
  makeFunctionReference<"internalAction">("jobs/syncPosts:syncAllPosts"),
  {}
);
