// convex/ai/comments.ts
// On-demand AI comment drafting. Returns transient text the user edits before posting —
// never persisted (identical reused comments would trip LinkedIn spam detection). fetch() → no "use node".
import { action } from '../_generated/server'
import { v } from 'convex/values'
import { internal } from '../_generated/api'
import type { Doc } from '../_generated/dataModel'
import { requireAuthAction } from '../lib/auth'
import { resolveCommentLanguage } from '../lib/languages'
import { buildCommentPrompt } from './prompts'
import { callOpenRouter } from './openrouter'

export const generateComment = action({
  args: { sessionToken: v.string(), postId: v.id('posts'), language: v.optional(v.string()) },
  handler: async (ctx, { sessionToken, postId, language }): Promise<{ comment: string }> => {
    const user = (await requireAuthAction(ctx, sessionToken)) as Doc<'users'>

    // Rate limit: 30 comment drafts/hour (admins exempt) — same budget shape as reactToPost.
    if (!user.isAdmin) {
      await ctx.runMutation(internal.lib.rateLimit.checkAndIncrement, {
        userId: user._id,
        action: 'generateComment',
        maxPerHour: 30
      })
    }

    const post = await ctx.runQuery(internal.interactions.getPost, { postId })
    if (!post) throw new Error('Post not found')
    const author = await ctx.runQuery(internal.users.getPublicAuthor, { userId: post.authorId })

    const lang = resolveCommentLanguage(language ?? user.commentLanguage)
    const text = await callOpenRouter(buildCommentPrompt({ ...post, author }, lang), { action: 'generate comment' })
    return { comment: text.trim() }
  }
})
