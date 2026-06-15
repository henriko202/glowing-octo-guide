import { internalMutation, internalQuery, mutation, query } from './_generated/server'
import { v } from 'convex/values'
import { components, internal } from './_generated/api'
import type { UserDoc } from './convexTypes'
import { requireAuth, resolveSession } from './lib/auth'
import { isValidCountry, isValidIndustry } from './lib/profileOptions'
import { isApifyProfileScrapeEnabled, type ApifyFlags } from './lib/apify'
import { checkRateLimit, tryConsumeRateLimit } from './lib/rateLimit'

// Internal: returns full user record including tokens (NEVER expose to client)
export const getWithTokens = internalQuery({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }) => {
    return ctx.db.get(userId)
  }
})

// Internal: returns all users with active subscriptions (excludes trialing)
export const getActiveSubscribers = internalQuery({
  args: {},
  handler: async ctx => {
    return ctx.db
      .query('users')
      .filter(q => q.eq(q.field('subscriptionStatus'), 'active'))
      .collect()
  }
})

// Pure: turns a full user doc into the safe client payload.
// Strips tokens + the raw isAdmin flag; re-adds isAdmin:true only for admins
// (needed by the frontend route guard); passes the ban signal through so the
// client can render the banned screen.
export function toSafeMe(user: UserDoc) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { linkedinAccessToken, linkedinRefreshToken, tokenExpiresAt, isAdmin, ...safeUser } = user
  return isAdmin ? { ...safeUser, isAdmin: true as const } : safeUser
}

/** Narrow db surface for applyScrapedProfileHandler — only needs get + patch. */
interface ScrapedProfileDb {
  get(id: string): Promise<{ country?: string } | null>
  patch(id: string, fields: Record<string, unknown>): Promise<void>
}

export interface ApplyScrapedProfileArgs {
  userId: string
  country?: string
  location?: string
  primaryLocale?: string
}

/**
 * Applies scraped profile fields. `country` is filled ONLY when the user has none
 * (protects manual edits); `location` + `primaryLocale` always refresh when provided.
 */
export async function applyScrapedProfileHandler(db: ScrapedProfileDb, args: ApplyScrapedProfileArgs): Promise<void> {
  const existing = await db.get(args.userId)
  const patch: Record<string, unknown> = {}
  if (args.location !== undefined) patch.location = args.location
  if (args.primaryLocale !== undefined) patch.primaryLocale = args.primaryLocale
  if (args.country !== undefined && !existing?.country) patch.country = args.country.toUpperCase()
  if (Object.keys(patch).length > 0) await db.patch(args.userId, patch)
}

interface PatchOnlyDb {
  patch(id: string, fields: Record<string, unknown>): Promise<void>
}

export interface UpdateProfileArgs {
  industry?: string
  country?: string
}

/** Validates + patches ONLY industry/country. Empty string clears the field. */
export async function updateProfileHandler(db: PatchOnlyDb, userId: string, args: UpdateProfileArgs): Promise<void> {
  const patch: Record<string, unknown> = {}
  if (args.industry !== undefined) {
    if (args.industry !== '' && !isValidIndustry(args.industry)) throw new Error('Invalid industry')
    patch.industry = args.industry === '' ? undefined : args.industry
  }
  if (args.country !== undefined) {
    const normalized = args.country.toUpperCase()
    if (args.country !== '' && !isValidCountry(normalized)) throw new Error('Invalid country')
    patch.country = args.country === '' ? undefined : normalized
  }
  if (Object.keys(patch).length > 0) await db.patch(userId, patch)
}

/** Guard for the refresh mutation. Throws a user-facing message; never leaks the flag. */
export function assertCanRefresh(user: { linkedinPublicIdentifier?: string }, settings: ApifyFlags): void {
  if (!user.linkedinPublicIdentifier) throw new Error('Set your LinkedIn profile URL first.')
  if (!isApifyProfileScrapeEnabled(settings)) throw new Error('Profile refresh is currently unavailable.')
}

// Public: returns safe user profile — strips ALL token fields.
// Auth: resolves the session token server-side; never accepts a userId from the client.
// NOTE: resolves via resolveSession (not requireAuth) so a banned user gets an
// isBanned signal instead of null — otherwise the client would loop back to LinkedIn.
export const getMe = query({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, { sessionToken }) => {
    const user = (await resolveSession(ctx, sessionToken)) as UserDoc | null
    if (!user) return null
    return toSafeMe(user)
  }
})

// Public: returns subscription info for billing page display.
// Auth: resolves the session token server-side.
export const getSubscriptionInfo = query({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, { sessionToken }) => {
    if (!sessionToken) return null
    let user: UserDoc
    try {
      user = (await requireAuth(ctx, sessionToken)) as UserDoc
    } catch {
      return null
    }

    // Query the component's live subscription data (always up-to-date via webhooks)
    const componentSubs = await ctx.runQuery(components.stripe.public.listSubscriptionsByUserId, { userId: user._id })

    // Pick the most recent subscription that isn't fully canceled
    const activeSub =
      (componentSubs as Array<{ status: string; stripeSubscriptionId: string; cancelAtPeriodEnd?: boolean }>).filter(
        s => s.status !== 'canceled'
      )[0] ?? null

    if (activeSub) {
      // Resolve tier from our own subscriptions table (component doesn't store tier names)
      const ourSub = await ctx.db
        .query('subscriptions')
        .withIndex('by_stripe_id', q => q.eq('stripeSubscriptionId', activeSub.stripeSubscriptionId))
        .first()

      return {
        tier: ourSub?.tier ?? user.tier ?? null,
        status: activeSub.status,
        cancelAtPeriodEnd: activeSub.cancelAtPeriodEnd ?? false,
        stripeSubscriptionId: activeSub.stripeSubscriptionId
      }
    }

    // No active subscription: trialing, canceled, or never subscribed — tier is empty
    return {
      tier: null,
      status: user.subscriptionStatus ?? 'trialing',
      cancelAtPeriodEnd: false,
      stripeSubscriptionId: null
    }
  }
})

// Public: stores the user's LinkedIn public profile identifier (vanityName).
// Called from Settings page when the user enters their LinkedIn profile URL.
// Used for post ownership verification without requiring LinkedIn Partner API access.
export const setPublicIdentifier = mutation({
  args: {
    sessionToken: v.string(),
    publicIdentifier: v.string()
  },
  handler: async (ctx, { sessionToken, publicIdentifier }) => {
    const user = await requireAuth(ctx, sessionToken)
    // Validate LinkedIn vanity name format: alphanumeric, hyphens, underscores, 3-100 chars
    const trimmed = publicIdentifier.trim().toLowerCase()
    if (!/^[a-zA-Z0-9\-_]{3,100}$/.test(trimmed)) {
      throw new Error('Invalid LinkedIn profile identifier format')
    }
    const changed = user.linkedinPublicIdentifier !== trimmed
    // Store lowercase for consistent comparison (LinkedIn vanityNames are case-insensitive)
    await ctx.db.patch(user._id, { linkedinPublicIdentifier: trimmed })
    // Auto-scrape only when the identifier actually changed, and only within the shared
    // profile-scrape budget (the same 2/day counter the Refresh button uses) — so repeatedly
    // changing the URL can't run unlimited paid scrapes. Use the non-throwing budget check so an
    // exhausted budget never blocks saving the identifier; the user can still scrape later via Refresh.
    // The action itself also bails if the profile-scrape flag is off.
    if (changed) {
      const allowed = await tryConsumeRateLimit(ctx, user._id, 'profile_refresh', 2, 24 * 60 * 60 * 1000)
      if (allowed) {
        await ctx.scheduler.runAfter(0, internal.jobs.scrapeProfileApify.scrapeUserProfile, { userId: user._id })
      }
    }
  }
})

// Public: invalidates the session token server-side on sign out.
export const logout = mutation({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    await ctx.runMutation(internal.sessions.deleteByToken, { token: sessionToken })
  }
})

// Public: invalidates ALL sessions for the authenticated user (emergency use —
// e.g., if user suspects their account is compromised on another device).
export const forceLogoutAll = mutation({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    const user = await requireAuth(ctx, sessionToken)
    await ctx.runMutation(internal.sessions.deleteAllForUser, { userId: user._id })
  }
})

// Internal: write scraped profile fields. Called by the profile-scrape action.
export const applyScrapedProfile = internalMutation({
  args: {
    userId: v.id('users'),
    country: v.optional(v.string()),
    location: v.optional(v.string()),
    primaryLocale: v.optional(v.string())
  },
  handler: async (ctx, args) =>
    applyScrapedProfileHandler(ctx.db as unknown as ScrapedProfileDb, args as ApplyScrapedProfileArgs)
})

// Public: user edits their own industry/country (canonical values only).
export const updateProfile = mutation({
  args: {
    sessionToken: v.string(),
    industry: v.optional(v.string()),
    country: v.optional(v.string())
  },
  handler: async (ctx, { sessionToken, industry, country }) => {
    const user = await requireAuth(ctx, sessionToken)
    await updateProfileHandler(
      ctx.db as unknown as { patch: (id: string, f: Record<string, unknown>) => Promise<void> },
      user._id,
      { industry, country }
    )
  }
})

// Public: user-triggered re-scrape of their LinkedIn profile (rate-limited to 2/day).
export const refreshProfileFromLinkedIn = mutation({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    const user = await requireAuth(ctx, sessionToken)
    const settings = await ctx.db.query('appSettings').first()
    assertCanRefresh(user, settings as ApifyFlags)
    await checkRateLimit(ctx, user._id, 'profile_refresh', 2, 24 * 60 * 60 * 1000, 'day')
    await ctx.scheduler.runAfter(0, internal.jobs.scrapeProfileApify.scrapeUserProfile, { userId: user._id })
  }
})
