// convex/interactions.ts
import { action, internalMutation, internalQuery } from './_generated/server'
import { v } from 'convex/values'
import { internal } from './_generated/api'

// Internal query to get a post by ID
export const getPost = internalQuery({
  args: { postId: v.id('posts') },
  handler: async (ctx, { postId }) => {
    return ctx.db.get(postId)
  }
})

// Internal mutation to increment comment count
export const incrementCommentCount = internalMutation({
  args: { postId: v.id('posts') },
  handler: async (ctx, { postId }) => {
    const post = await ctx.db.get(postId)
    if (post) await ctx.db.patch(postId, { commentCount: post.commentCount + 1 })
  }
})

// Internal mutation to increment like count
export const incrementLikeCount = internalMutation({
  args: { postId: v.id('posts') },
  handler: async (ctx, { postId }) => {
    const post = await ctx.db.get(postId)
    if (post) await ctx.db.patch(postId, { likeCount: post.likeCount + 1 })
  }
})

// Public action: post a comment on a LinkedIn post using the current user's token
export const commentOnPost = action({
  args: {
    postId: v.id('posts'),
    commentText: v.string()
  },
  handler: async (ctx, { postId, commentText }) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Not authenticated')

    const user = await ctx.runQuery(internal.users.getWithTokens, { userId: identity.subject as any })
    if (!user?.linkedinAccessToken) throw new Error('No LinkedIn token')

    const post = await ctx.runQuery(internal.interactions.getPost, { postId })
    if (!post) throw new Error('Post not found')

    const res = await fetch(
      `https://api.linkedin.com/v2/socialActions/${encodeURIComponent(post.linkedinPostUrn)}/comments`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${user.linkedinAccessToken}`,
          'Content-Type': 'application/json',
          'X-Restli-Protocol-Version': '2.0.0'
        },
        body: JSON.stringify({
          actor: `urn:li:person:${user.linkedinId}`,
          message: { text: commentText }
        })
      }
    )
    if (!res.ok) {
      const err = await res.text()
      throw new Error(`LinkedIn comment failed: ${res.status} ${err}`)
    }

    await ctx.runMutation(internal.interactions.incrementCommentCount, { postId })
    return { success: true }
  }
})

// Public action: react to a LinkedIn post using the current user's token
export const reactToPost = action({
  args: {
    postId: v.id('posts'),
    reactionType: v.union(
      v.literal('LIKE'),
      v.literal('CELEBRATE'),
      v.literal('SUPPORT'),
      v.literal('FUNNY'),
      v.literal('LOVE'),
      v.literal('INSIGHTFUL')
    )
  },
  handler: async (ctx, { postId, reactionType }) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Not authenticated')

    const user = await ctx.runQuery(internal.users.getWithTokens, { userId: identity.subject as any })
    if (!user?.linkedinAccessToken) throw new Error('No LinkedIn token')

    const post = await ctx.runQuery(internal.interactions.getPost, { postId })
    if (!post) throw new Error('Post not found')

    const res = await fetch(`https://api.linkedin.com/v2/reactions/${encodeURIComponent(post.linkedinPostUrn)}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${user.linkedinAccessToken}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0'
      },
      body: JSON.stringify({
        actor: `urn:li:person:${user.linkedinId}`,
        reactionType
      })
    })
    if (!res.ok) {
      const err = await res.text()
      throw new Error(`LinkedIn reaction failed: ${res.status} ${err}`)
    }

    await ctx.runMutation(internal.interactions.incrementLikeCount, { postId })
    return { success: true }
  }
})
