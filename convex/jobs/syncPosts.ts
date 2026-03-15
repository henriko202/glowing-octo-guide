// convex/jobs/syncPosts.ts
import { internalMutationGeneric as internalMutation, internalActionGeneric as internalAction, cronJobs } from "convex/server";
import { v } from "convex/values";
import { makeFunctionReference } from "convex/server";
import { fetchUserPosts } from "../linkedin/posts.js";
import type { MutationCtx, ActionCtx, UserDoc } from "../convexTypes.js";

// References to other internal functions (avoids _generated/ dependency)
const getUserWithTokens = makeFunctionReference<"query">("users:getWithTokens");
const getActiveSubscribers = makeFunctionReference<"query">("users:getActiveSubscribers");

interface UpsertPostArgs {
  linkedinPostUrn: string;
  authorId: string;
  content: string;
  publishedAt: number;
  likeCount: number;
  commentCount: number;
  mediaUrls: string[];
  isFeatured: boolean;
  visibilityIndustries: string[];
  visibilityCountries: string[];
  hidden: boolean;
}

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
  handler: async (ctx, args: UpsertPostArgs) => {
    const db = (ctx as unknown as MutationCtx).db;
    const existing = await db
      .query("posts")
      .withIndex("by_urn", (q) => q.eq("linkedinPostUrn", args.linkedinPostUrn))
      .first();
    if (existing) {
      // Only update mutable fields on re-sync
      await db.patch(existing._id, {
        likeCount: args.likeCount,
        commentCount: args.commentCount,
        hidden: args.hidden,
      });
    } else {
      await db.insert("posts", {
        ...args,
        featuredAt: undefined,
      });
    }
  },
});

// Sync posts for one user
export const syncUserPosts = internalAction({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }: { userId: string }) => {
    const actionCtx = ctx as unknown as ActionCtx;
    const user = await actionCtx.runQuery<UserDoc | null>(getUserWithTokens, { userId });
    if (!user?.linkedinAccessToken) {
      console.warn(`No LinkedIn token for user ${userId}, skipping sync`);
      return;
    }

    if (user.tokenExpiresAt && (user.tokenExpiresAt as number) - Date.now() < 7 * 86400000) {
      console.warn(`Token for user ${userId} expires within 7 days — re-auth needed`);
    }

    const posts = await fetchUserPosts(user.linkedinAccessToken as string, user.linkedinId as string);
    const upsertPostFn = makeFunctionReference<"mutation">("jobs/syncPosts:upsertPost");

    for (const post of posts) {
      await actionCtx.runMutation(upsertPostFn, {
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
    const actionCtx = ctx as unknown as ActionCtx;
    const users = await actionCtx.runQuery<UserDoc[]>(getActiveSubscribers, {});
    await Promise.allSettled(
      users.map((u) => {
        const syncFn = makeFunctionReference<"action">("jobs/syncPosts:syncUserPosts");
        return actionCtx.runAction(syncFn, { userId: u._id });
      })
    );
  },
});

// Register cron jobs
export const crons = cronJobs();
crons.hourly(
  "sync LinkedIn posts",
  { minuteUTC: 0 },
  makeFunctionReference<"action">("jobs/syncPosts:syncAllPosts"),
  {}
);
