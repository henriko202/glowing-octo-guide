// convex/ai/industry.ts
// Async, best-effort industry guess for a member with no industry yet. Scheduled by posts.submitPost
// after the member shares their OWN post (ownership-verified); the model reads that post's text and
// picks one LinkedIn industry code. It feeds the Growth feed filter. fetch() → no "use node".
import { internalAction } from '../_generated/server'
import { internal } from '../_generated/api'
import { v } from 'convex/values'
import { parseIndustryCode } from '../lib/profileOptions'
import { buildIndustryPrompt } from './prompts'
import { callOpenRouter } from './openrouter'

/** Best-effort: a failure or a NONE reply leaves the industry empty (the member can set it in Settings). */
export const guessIndustry = internalAction({
  args: { userId: v.id('users'), postId: v.id('posts') },
  handler: async (ctx, { userId, postId }) => {
    const post = await ctx.runQuery(internal.interactions.getPost, { postId })
    if (!post?.content) return
    try {
      const raw = await callOpenRouter(buildIndustryPrompt(post.content), { action: 'guess industry' })
      const industry = parseIndustryCode(raw)
      if (industry) await ctx.runMutation(internal.users.fillGuessedIndustry, { userId, industry })
    } catch (e) {
      console.error('guessIndustry failed (industry stays empty):', e)
    }
  }
})
