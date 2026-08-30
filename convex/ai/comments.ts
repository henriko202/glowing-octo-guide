// convex/ai/comments.ts
// On-demand AI comment drafting. The draft is saved per (user, post) on userPostState so the comment
// box can reload it for reuse/regeneration (see interactions.getCommentDraft). Per-post scope keeps
// this clear of the old spam-detection worry (which was about reusing one comment across many posts).
// fetch() → no "use node".
import { action } from '../_generated/server'
import { ConvexError, v } from 'convex/values'
import { internal } from '../_generated/api'
import type { Doc } from '../_generated/dataModel'
import { requireAuthAction } from '../lib/auth'
import { assertCanEngage } from '../lib/access'
import { resolveCommentLanguage } from '../lib/languages'
import { buildCommentPrompt } from './prompts'
import { callOpenRouter } from './openrouter'

export const generateComment = action({
  args: { sessionToken: v.string(), postId: v.id('posts'), language: v.optional(v.string()) },
  handler: async (ctx, { sessionToken, postId, language }): Promise<{ comment: string }> => {
    const user = (await requireAuthAction(ctx, sessionToken)) as Doc<'users'>

    // Card-on-file gate: AI drafting needs an active subscription (trial/paid), same as submitting the
    // comment (interactions.commentOnPost). Enforced here — not just in the UI card-gate — so the
    // OpenRouter spend can't be reached without a subscription. All tiers pass; admins bypass. Runs
    // before the rate limiter so a blocked user never consumes quota.
    assertCanEngage(user)

    // Rate limit: 30 comment drafts/hour (admins exempt) — same budget shape as reactToPost.
    if (!user.isAdmin) {
      await ctx.runMutation(internal.lib.rateLimit.checkAndIncrement, {
        userId: user._id,
        action: 'generateComment',
        maxPerHour: 30
      })
    }

    const post = await ctx.runQuery(internal.interactions.getPost, { postId })
    if (!post) throw new ConvexError('Post not found')
    const author = await ctx.runQuery(internal.users.getPublicAuthor, { userId: post.authorId })

    const lang = resolveCommentLanguage(language ?? user.commentLanguage)
    const text = await callOpenRouter(buildCommentPrompt({ ...post, author }, lang), { action: 'generate comment' })
    const draft = text.trim()
    // Persist so the comment box can reload it (reuse or regenerate) when reopened.
    await ctx.runMutation(internal.interactions.saveCommentDraft, { userId: user._id, postId, draft })
    return { comment: draft }
  }
})
