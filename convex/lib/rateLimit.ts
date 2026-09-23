// convex/lib/rateLimit.ts
// Per-user, per-action rate limiting backed by the @convex-dev/rate-limiter component. This replaces
// the former hand-rolled `rateLimits` table, whose read-modify-write admitted double-spends under
// concurrency (two taps in the same window could both read count=N-1 and both write N). The component
// does the check + consume atomically in its own isolated tables.
//
// The three entry points below are unchanged, so no caller had to move:
//   - checkRateLimit(ctx, userId, action, max, windowMs?, windowLabel?)  → throws when exhausted
//   - tryConsumeRateLimit(ctx, userId, action, max, windowMs?)           → returns a boolean
//   - internal.lib.rateLimit.checkAndIncrement                           → mutation actions call via ctx.runMutation
//
// No named limits are pre-registered: every caller passes its own window, so each call supplies an
// inline `config` (rate = max, period = windowMs). "fixed window" matches the old semantics — a hard
// N-per-window cap. See docs/PLATFORM.md §12 (Rate limiting).

import { RateLimiter } from '@convex-dev/rate-limiter'
import { components } from '../_generated/api'
import type { MutationCtx } from '../_generated/server'
import { internalMutation } from '../_generated/server'
import { ConvexError, v } from 'convex/values'
import type { Id } from '../_generated/dataModel'

const WINDOW_MS = 60 * 60 * 1000 // 1 hour — backward-compatible default window

const rateLimiter = new RateLimiter(components.rateLimiter)

// Every action name that consumes a per-user budget. Single source of truth for resetUserRateLimits
// (erasure): a name used at a call site but missing here would strand that user's counter in the
// component's tables on account deletion. Keep in sync when adding a rate-limited action.
export const RATE_LIMIT_ACTIONS = [
  'submitFeedback',
  'dataExport',
  'profile_refresh',
  'submitPost',
  'generateComment',
  'commentOnPost',
  'reactToPost',
  'createCheckoutSession',
  'purchaseFeaturedPost',
  'createPortalSession',
  'createCancelFlowSession',
  'createPlanSwitchSession',
  'undoScheduledDowngrade',
  'resumeSubscription',
  'requestAccountDeletion',
  'cancelAccountDeletion'
] as const

// The component reads + writes via ctx.runQuery/runMutation, both of which MutationCtx and ActionCtx
// provide — so mutation callers and the action wrapper share one helper.
type RunMutationCtx = { runQuery: MutationCtx['runQuery']; runMutation: MutationCtx['runMutation'] }

async function consume(
  ctx: RunMutationCtx,
  userId: Id<'users'>,
  action: string,
  maxPerWindow: number,
  windowMs: number
): Promise<boolean> {
  const { ok } = await rateLimiter.limit(ctx, action, {
    key: userId,
    config: { kind: 'fixed window', rate: maxPerWindow, period: windowMs }
  })
  return ok
}

/**
 * Consumes one unit of a per-user rate budget. Returns true if the call is allowed, false if the
 * limit is already reached. Non-throwing — for callers that must NOT fail their surrounding
 * transaction when the budget is exhausted. Throwing callers use checkRateLimit. Default window: 1h.
 */
export async function tryConsumeRateLimit(
  ctx: RunMutationCtx,
  userId: Id<'users'>,
  action: string,
  maxPerWindow: number,
  windowMs: number = WINDOW_MS
): Promise<boolean> {
  return consume(ctx, userId, action, maxPerWindow, windowMs)
}

/**
 * Checks and consumes a per-user rate limit. Throws "Rate limit exceeded" (same message as before)
 * once the user has exceeded maxPerWindow in the given window. Default window: 1h.
 */
export async function checkRateLimit(
  ctx: RunMutationCtx,
  userId: Id<'users'>,
  action: string,
  maxPerWindow: number,
  windowMs: number = WINDOW_MS,
  windowLabel: string = 'hour'
): Promise<void> {
  const allowed = await consume(ctx, userId, action, maxPerWindow, windowMs)
  if (!allowed) {
    throw new ConvexError(
      `Rate limit exceeded. You can perform this action at most ${maxPerWindow} times per ${windowLabel}.`
    )
  }
}

/**
 * Clears every per-user counter for `userId`. Used by the erasure cascade — the component keeps its
 * state in isolated tables the app-level cascade can't reach with ctx.db.delete, so erasure resets
 * each named limit instead. reset on an empty key is a no-op, so calling it once on completion is safe.
 */
export async function resetUserRateLimits(ctx: RunMutationCtx, userId: Id<'users'>): Promise<void> {
  for (const action of RATE_LIMIT_ACTIONS) {
    await rateLimiter.reset(ctx, action, { key: userId })
  }
}

/**
 * Internal mutation wrapper so actions (which can't use ctx.db) can consume a limit via ctx.runMutation.
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

// The per-client dimension below keys on a bucket of the client's x-forwarded-for value, never the value itself:
// the component keeps one row per key until a manual reset, so an IP key would be a permanent record of every
// visitor's address. Each of the 4096 buckets covers ~1M IPv4 addresses, so a row identifies no one and the rows
// per limit are capped. ponytail: a flood from one IP also throttles the ~1/4096 of callers sharing its bucket;
// raise CLIENT_BUCKETS if that ever bites.
export const CLIENT_BUCKETS = 4096

export function clientBucket(clientKey: string): string {
  let hash = 0x811c9dc5 // 32-bit FNV-1a
  for (let i = 0; i < clientKey.length; i++) hash = Math.imul(hash ^ clientKey.charCodeAt(i), 0x01000193)
  return `bucket:${(hash >>> 0) % CLIENT_BUCKETS}`
}

// Anonymous (no user key) limiter for the OAuth start route and the landing event beacon, whose
// callers have no identity yet. `key` is supplied by the caller: the global backstop uses the fixed
// 'global' key, while the per-client dimension uses clientBucket() of a best-effort client value
// (untrusted x-forwarded-for) — see enforceOAuthStartBudget / enforceLandingEventBudget.
export async function checkAnonymousRateLimit(
  ctx: RunMutationCtx,
  action: string,
  key: string,
  maxPerWindow: number,
  windowMs: number = WINDOW_MS,
  message = 'Too many sign-in attempts. Please try again shortly.'
): Promise<void> {
  const { ok } = await rateLimiter.limit(ctx, action, {
    key,
    config: { kind: 'fixed window', rate: maxPerWindow, period: windowMs }
  })
  if (!ok) throw new ConvexError(message)
}

// Two-dimensional budget for the OAuth start route (both 1-hour fixed windows). The per-client
// limit blunts a single-source flood but is best-effort: clientKey comes from x-forwarded-for,
// which a caller can omit or forge. The global backstop is what actually bounds oauthStates growth.
export const OAUTH_START_PER_CLIENT_PER_HOUR = 60
export const OAUTH_START_GLOBAL_PER_HOUR = 1800

/** Plain-function core (directly unit-testable) for the checkOAuthStartBudget mutation below. */
export async function enforceOAuthStartBudget(ctx: RunMutationCtx, clientKey?: string): Promise<void> {
  if (clientKey) {
    await checkAnonymousRateLimit(ctx, 'oauthStartClient', clientBucket(clientKey), OAUTH_START_PER_CLIENT_PER_HOUR)
  }
  await checkAnonymousRateLimit(ctx, 'oauthStart', 'global', OAUTH_START_GLOBAL_PER_HOUR)
}

export const checkOAuthStartBudget = internalMutation({
  args: { clientKey: v.optional(v.string()) },
  handler: async (ctx, { clientKey }) => {
    await enforceOAuthStartBudget(ctx, clientKey)
  }
})

// Two-dimensional budget for the landing's cookieless event beacon (both 1-hour fixed windows). The
// beacon is unauthenticated and carries no client identity, so the per-client dimension uses the
// same best-effort x-forwarded-for value as OAuth and the global backstop is what actually bounds
// landingMetrics growth. Not in RATE_LIMIT_ACTIONS: that list is for per-user erasure only.
export const LANDING_EVENT_PER_CLIENT_PER_HOUR = 240
export const LANDING_EVENT_GLOBAL_PER_HOUR = 6000

/** Plain-function core (directly unit-testable) for the checkLandingEventBudget mutation below. */
export async function enforceLandingEventBudget(ctx: RunMutationCtx, clientKey?: string): Promise<void> {
  if (clientKey) {
    await checkAnonymousRateLimit(
      ctx,
      'landingEventClient',
      clientBucket(clientKey),
      LANDING_EVENT_PER_CLIENT_PER_HOUR,
      WINDOW_MS,
      'Too many landing events. Please try again shortly.'
    )
  }
  await checkAnonymousRateLimit(
    ctx,
    'landingEvent',
    'global',
    LANDING_EVENT_GLOBAL_PER_HOUR,
    WINDOW_MS,
    'Too many landing events. Please try again shortly.'
  )
}

export const checkLandingEventBudget = internalMutation({
  args: { clientKey: v.optional(v.string()) },
  handler: async (ctx, { clientKey }) => {
    await enforceLandingEventBudget(ctx, clientKey)
  }
})
