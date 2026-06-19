// convex/ai/reactions.ts
// Async, best-effort reaction prediction. Scheduled by posts.submitPost after the upsert,
// so OpenRouter latency / cost / failure never touch the submit path. fetch() → no "use node".
import { internalAction, internalMutation } from '../_generated/server'
import { internal } from '../_generated/api'
import { v } from 'convex/values'
import { parseReaction, reactionValidator } from '../lib/reactions'
import { buildReactionPrompt } from './prompts'
import { callOpenRouter } from './openrouter'

/** Best-effort: any failure (incl. missing API key) is swallowed; the post keeps its default LIKE. */
export const predictReaction = internalAction({
  args: { postId: v.id('posts') },
  handler: async (ctx, { postId }) => {
    const post = await ctx.runQuery(internal.interactions.getPost, { postId })
    if (!post) return
    try {
      const raw = await callOpenRouter(
        buildReactionPrompt({ content: post.content, imageUrls: post.imageUrls, article: post.article }),
        {
          action: 'predict reaction'
        }
      )
      await ctx.runMutation(internal.ai.reactions.setSuggestedReaction, { postId, reaction: parseReaction(raw) })
    } catch (e) {
      console.error('predictReaction failed (post keeps default LIKE):', e)
    }
  }
})

export const setSuggestedReaction = internalMutation({
  args: { postId: v.id('posts'), reaction: reactionValidator },
  handler: async (ctx, { postId, reaction }) => {
    await ctx.db.patch(postId, { suggestedReaction: reaction })
  }
})
