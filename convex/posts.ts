// convex/posts.ts
import { query, action } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { QueryCtx, ActionCtx, UserDoc } from "./convexTypes";
import { parseLinkedInPostUrl } from "./linkedin/parsePostUrl";
import { verifyPostOwnership } from "./linkedin/verifyPostOwnership";

export const getMyPosts = query({
  args: {
    userId: v.optional(v.id("users")),
  },
  handler: async (ctx, { userId }) => {
    if (!userId) return [];
    const queryCtx = ctx as unknown as QueryCtx;
    const posts = await queryCtx.db
      .query("posts")
      .withIndex("by_author", (q) => q.eq("authorId", userId))
      .collect();
    // Returns all posts by this user including hidden ones — hidden means hidden from
    // other users' feeds, not from the author's own My Posts page.
    // Sort by publishedAt descending — the by_author index orders by _creationTime,
    // not publishedAt, so we sort in-memory to get correct chronological order.
    return posts.sort((a, b) => b.publishedAt - a.publishedAt);
  },
});

export const submitPost = action({
  args: {
    userId: v.id("users"),
    postUrl: v.string(),
  },
  handler: async (ctx, { userId, postUrl }) => {
    const actionCtx = ctx as unknown as ActionCtx;

    // 1. Parse URL
    const parsed = parseLinkedInPostUrl(postUrl);
    if (!parsed) {
      throw new Error(
        "Unrecognized LinkedIn post URL. Use a /posts/\u2026 or /feed/update/\u2026 URL."
      );
    }

    // 2. Load user with token
    const user = (await actionCtx.runQuery(
      internal.users.getWithTokens,
      { userId }
    )) as UserDoc | null;
    if (!user?.linkedinAccessToken) {
      throw new Error("No LinkedIn access token. Please sign in again.");
    }

    const token = user.linkedinAccessToken as string;
    const urn = `urn:li:ugcPost:${parsed.activityId}`;

    // 3. Verify ownership (Step A → Step B fallback)
    // verifyPostOwnership throws if ownership cannot be confirmed
    const ownership = await verifyPostOwnership(
      token,
      urn,
      user.linkedinId as string,
      parsed.vanityName
    );

    // 4. Upsert the post — returns the post _id
    const postId = await actionCtx.runMutation(
      internal.jobs.syncPosts.upsertPost,
      {
        linkedinPostUrn: urn,
        authorId: userId,
        content: ownership.content,
        publishedAt: ownership.publishedAt,
        likeCount: 0,
        commentCount: 0,
        mediaUrls: [],
        isFeatured: false,
        visibilityIndustries: [],
        visibilityCountries: [],
        hidden: (user.subscriptionStatus as string) === "trialing",
        // Preserve the original submitted URL so we can link back correctly —
        // reconstructing from URN loses information (activity ID ≠ ugcPost ID).
        sourceUrl: postUrl,
      }
    );

    return { postId };
  },
});
