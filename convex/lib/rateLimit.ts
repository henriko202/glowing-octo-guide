// convex/lib/rateLimit.ts
// Per-user sliding-window rate limiter backed by the rateLimits table.
//
// Usage from a mutation:
//   import { checkRateLimit } from './lib/rateLimit'
//   await checkRateLimit(ctx, userId, 'submitPost', 10)
//
// Usage from an action:
//   await ctx.runMutation(internal.lib.rateLimit.checkAndIncrement, {
//     userId, action: 'submitPost', maxPerHour: 10
//   })

import type { MutationCtx } from '../_generated/server'
import { internalMutation } from '../_generated/server'
import { v } from 'convex/values'
import type { Id } from '../_generated/dataModel'

const WINDOW_MS = 60 * 60 * 1000 // 1 hour

/**
 * Checks and increments a per-user rate limit counter.
 * For use directly in mutations (which have MutationCtx).
 * Throws "Rate limit exceeded" if the user has exceeded maxPerHour in the past hour.
 */
export async function checkRateLimit(
  ctx: MutationCtx,
  userId: Id<'users'>,
  action: string,
  maxPerHour: number
): Promise<void> {
  const now = Date.now()

  const existing = await ctx.db
    .query('rateLimits')
    .withIndex('by_user_and_action', q => q.eq('userId', userId).eq('action', action))
    .unique()

  if (!existing || now - existing.windowStart > WINDOW_MS) {
    if (existing) {
      await ctx.db.patch(existing._id, { windowStart: now, count: 1 })
    } else {
      await ctx.db.insert('rateLimits', { userId, action, windowStart: now, count: 1 })
    }
    return
  }

  if (existing.count >= maxPerHour) {
    throw new Error(`Rate limit exceeded. You can perform this action at most ${maxPerHour} times per hour.`)
  }

  await ctx.db.patch(existing._id, { count: existing.count + 1 })
}

/**
 * Internal mutation wrapper so actions can call the rate limiter via ctx.runMutation.
 * Actions cannot use ctx.db directly, so they delegate here.
 */
export const checkAndIncrement = internalMutation({
  args: {
    userId: v.id('users'),
    action: v.string(),
    maxPerHour: v.number()
  },
  handler: async (ctx, { userId, action, maxPerHour }) => {
    await checkRateLimit(ctx, userId, action, maxPerHour)
  }
})
