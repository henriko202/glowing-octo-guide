// convex/jobs/syncPosts.ts
import { internalMutationGeneric as internalMutation, internalActionGeneric as internalAction } from "convex/server";
import { v } from "convex/values";
import { internal } from "../_generated/api.js";
import { fetchUserPosts } from "../linkedin/posts.js";
import type { MutationCtx, ActionCtx, UserDoc } from "../convexTypes.js";

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

// Sync posts for one user — called by syncAllPosts (and can be triggered manually)
export const syncUserPosts = internalAction({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }: { userId: string }) => {
    const actionCtx = ctx as unknown as ActionCtx;
    const user = await actionCtx.runQuery<UserDoc | null>(
      internal.users.getWithTokens,
      { userId }
    );
    if (!user?.linkedinAccessToken) {
      console.warn(`No LinkedIn token for user ${userId}, skipping sync`);
      return;
    }

    if (user.tokenExpiresAt && (user.tokenExpiresAt as number) - Date.now() < 7 * 86400000) {
      console.warn(`Token for user ${userId} expires within 7 days — re-auth needed`);
    }

    const posts = await fetchUserPosts(
      user.linkedinAccessToken as string,
      user.linkedinId as string
    );

    if (posts === null) {
      // r_member_social scope not granted — LinkedIn MDP approval required
      console.warn(`r_member_social scope not available for user ${userId} — skipping post sync`);
      return;
    }

    for (const post of posts) {
      await actionCtx.runMutation(internal.jobs.syncPosts.upsertPost, {
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

// Fan-out action — queries all active subscribers and dispatches per-user syncs
export const syncAllPosts = internalAction({
  args: {},
  handler: async (ctx) => {
    const actionCtx = ctx as unknown as ActionCtx;
    const users = await actionCtx.runQuery<UserDoc[]>(
      internal.users.getActiveSubscribers,
      {}
    );
    await Promise.allSettled(
      users.map((u) =>
        actionCtx.runAction(internal.jobs.syncPosts.syncUserPosts, { userId: u._id })
      )
    );
  },
});
