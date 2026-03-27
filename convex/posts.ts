// convex/posts.ts
import { action, query } from './_generated/server'
import { v } from 'convex/values'
import { internal } from './_generated/api'
import type { UserDoc } from './convexTypes'
import { parseLinkedInPostUrl } from './linkedin/parsePostUrl'
import { verifyPostOwnership } from './linkedin/verifyPostOwnership'

export const getMyPosts = query({
  args: {
    userId: v.optional(v.id('users'))
  },
  handler: async (ctx, { userId }) => {
    if (!userId) return []
    const posts = await ctx.db
      .query('posts')
      .withIndex('by_author', q => q.eq('authorId', userId))
      .collect()
    // Returns all posts by this user including hidden ones — hidden means hidden from
    // other users' feeds, not from the author's own My Posts page.
    // Sort by publishedAt descending — the by_author index orders by _creationTime,
    // not publishedAt, so we sort in-memory to get correct chronological order.
    return posts.sort((a, b) => b.publishedAt - a.publishedAt)
  }
})

export const submitPost = action({
  args: {
    userId: v.id('users'),
    postUrl: v.string()
  },
  handler: async (ctx, { userId, postUrl }): Promise<{ postId: string }> => {
    // 1. Parse URL
    const parsed = parseLinkedInPostUrl(postUrl)
    if (!parsed) {
      throw new Error('Unrecognized LinkedIn post URL. Use a /posts/… or /feed/update/… URL.')
    }

    // 2. Load user with token
    const user = (await ctx.runQuery(internal.users.getWithTokens, { userId })) as UserDoc | null
    if (!user?.linkedinAccessToken) {
      throw new Error('No LinkedIn access token. Please sign in again.')
    }

    const token = user.linkedinAccessToken
    const urn = `urn:li:ugcPost:${parsed.activityId}`

    // 3. Verify ownership (Step A → Step B fallback)
    // Step A: UGC API (works when r_member_social is approved)
    // Step B: local comparison against stored publicIdentifier (no API call needed)
    const storedIdentifier = user.linkedinPublicIdentifier ?? null
    const ownership = await verifyPostOwnership(token, urn, user.linkedinId, parsed.vanityName, storedIdentifier)

    // 4. Upsert the post — returns the post _id
    const postId = await ctx.runMutation(internal.jobs.syncPosts.upsertPost, {
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
      hidden: user.subscriptionStatus === 'trialing',
      // Preserve the original submitted URL so we can link back correctly —
      // reconstructing from URN loses information (activity ID ≠ ugcPost ID).
      sourceUrl: postUrl
    })

    return { postId }
  }
})
