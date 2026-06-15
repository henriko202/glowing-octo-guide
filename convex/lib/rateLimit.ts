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
 * Consumes one unit of a per-user rate budget. Returns true if the call is allowed
 * (and increments the counter), false if the limit is already reached.
 *
 * Non-throwing — for callers that must NOT fail their surrounding transaction when the
 * budget is exhausted (e.g. a best-effort side-effect). Throwing callers use checkRateLimit.
 * Backward-compatible default window is 1 hour.
 */
export async function tryConsumeRateLimit(
  ctx: MutationCtx,
  userId: Id<'users'>,
  action: string,
  maxPerWindow: number,
  windowMs: number = WINDOW_MS
): Promise<boolean> {
  const now = Date.now()

  const existing = await ctx.db
    .query('rateLimits')
    .withIndex('by_user_and_action', q => q.eq('userId', userId).eq('action', action))
    .unique()

  if (!existing || now - existing.windowStart > windowMs) {
    if (existing) {
      await ctx.db.patch(existing._id, { windowStart: now, count: 1 })
    } else {
      await ctx.db.insert('rateLimits', { userId, action, windowStart: now, count: 1 })
    }
    return true
  }

  if (existing.count >= maxPerWindow) {
    return false
  }

  await ctx.db.patch(existing._id, { count: existing.count + 1 })
  return true
}

/**
 * Checks and increments a per-user rate limit counter.
 * For use directly in mutations (which have MutationCtx).
 * Throws "Rate limit exceeded" if the user has exceeded maxPerWindow in the given window.
 *
 * Backward-compatible: existing 4-arg callers continue to work (defaults to 1-hour window).
 */
export async function checkRateLimit(
  ctx: MutationCtx,
  userId: Id<'users'>,
  action: string,
  maxPerWindow: number,
  windowMs: number = WINDOW_MS,
  windowLabel: string = 'hour'
): Promise<void> {
  const allowed = await tryConsumeRateLimit(ctx, userId, action, maxPerWindow, windowMs)
  if (!allowed) {
    throw new Error(
      `Rate limit exceeded. You can perform this action at most ${maxPerWindow} times per ${windowLabel}.`
    )
  }
}

/**
 * Internal mutation wrapper so actions can call the rate limiter via ctx.runMutation.
 * Actions cannot use ctx.db directly, so they delegate here.
 */
export const checkAndIncrement = internalMutation({
  args: {
    userId: v.id('users'),
    action: v.string(),
    maxPerHour: v.number(),
    windowMs: v.optional(v.number()),
    windowLabel: v.optional(v.string())
  },
  handler: async (ctx, { userId, action, maxPerHour, windowMs, windowLabel }) => {
    await checkRateLimit(ctx, userId, action, maxPerHour, windowMs, windowLabel)
  }
})
