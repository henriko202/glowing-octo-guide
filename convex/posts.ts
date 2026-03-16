// convex/posts.ts
import { query } from "./_generated/server";
import { v } from "convex/values";
import type { QueryCtx } from "./convexTypes";

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
