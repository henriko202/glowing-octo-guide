import { internalMutation, internalQuery, mutation, query } from './_generated/server'
import { v } from 'convex/values'
import { components, internal } from './_generated/api'
import type { Doc } from './_generated/dataModel'
import { requireAuth, resolveSession } from './lib/auth'
import { isValidCountry, isValidIndustry } from './lib/profileOptions'
import { isValidCommentLanguage } from './lib/languages'
import { type ApifyFlags, isApifyProfileScrapeEnabled } from './lib/apify'
import { checkRateLimit, tryConsumeRateLimit } from './lib/rateLimit'
import { TRIAL_INTERACTION_THRESHOLD } from './lib/trialMilestone'

// Internal: returns full user record including tokens (NEVER expose to client)
export const getWithTokens = internalQuery({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }) => {
    return ctx.db.get(userId)
  }
})

// Internal: display-only author fields for the AI comment prompt (no tokens or other PII
// beyond the public profile name/headline). Used by ai/comments.generateComment.
export const getPublicAuthor = internalQuery({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }) => {
    const u = await ctx.db.get(userId)
    return u ? { name: u.name, headline: u.headline } : null
  }
})

// Internal: returns all users with active subscriptions (excludes trialing).
// Uses the by_subscription_status index so this reads only active subscribers
// instead of scanning the whole users table. Returns the full set on purpose —
// the Apify sync fans out one job per active subscriber.
export const getActiveSubscribers = internalQuery({
  args: {},
  handler: async ctx => {
    return ctx.db
      .query('users')
      .withIndex('by_subscription_status', q => q.eq('subscriptionStatus', 'active'))
      .collect()
  }
})

// Internal: ids of users who have a LinkedIn public identifier, for the profile-scrape fan-out.
// Profile data (country/location/locale) is useful for everyone with a profile — not just active
// subscribers — so this intentionally differs from getActiveSubscribers. Bounded take(500):
// no index on linkedinPublicIdentifier, so this scans + filters, matching listUsers' bounded-scan style.
export const getUsersWithLinkedin = internalQuery({
  args: {},
  handler: async ctx => {
    const SCAN_CAP = 500
    const users = await ctx.db.query('users').take(SCAN_CAP)
    // Non-silent cap: surface when the bounded scan saturates so users beyond the ceiling aren't
    // dropped silently. Revisit (index or pagination) if/when the Apify profile scrape is re-enabled.
    if (users.length === SCAN_CAP) {
      console.warn(
        `[profile-scrape] getUsersWithLinkedin hit the ${SCAN_CAP}-user scan cap — some users may be skipped`
      )
    }
    return users.filter(u => !!u.linkedinPublicIdentifier).map(u => ({ _id: u._id }))
  }
})

// Pure: turns a full user doc into the safe client payload.
// Strips tokens + the raw isAdmin flag; re-adds isAdmin:true only for admins
// (needed by the frontend route guard); passes the ban signal through so the
// client can render the banned screen.
export function toSafeMe(user: Doc<'users'>) {
  // Strip secrets + internal fields. bannedReason stays (shown on the banned screen).
  /* eslint-disable @typescript-eslint/no-unused-vars -- destructure-and-discard sensitive fields */
  const {
    linkedinAccessToken,
    linkedinRefreshToken,
    tokenExpiresAt,
    stripeCustomerId,
    bannedBy,
    bannedAt,
    isAdmin,
    ...safeUser
  } = user
  /* eslint-enable @typescript-eslint/no-unused-vars */
  return isAdmin ? { ...safeUser, isAdmin: true as const } : safeUser
}

/** LinkedIn's own headline limit; used to cap the user-editable headline field. */
export const MAX_HEADLINE_LENGTH = 220

/** Narrow db surface for applyScrapedProfileHandler — only needs get + patch. */
interface ScrapedProfileDb {
  get(id: string): Promise<{ country?: string; headline?: string } | null>
  patch(id: string, fields: Record<string, unknown>): Promise<void>
}

export interface ApplyScrapedProfileArgs {
  userId: string
  country?: string
  location?: string
  primaryLocale?: string
  headline?: string
}

/**
 * Applies scraped profile fields. `country` and `headline` are filled ONLY when the user has none
 * (protects manual edits); `location` + `primaryLocale` always refresh when provided.
 */
export async function applyScrapedProfileHandler(db: ScrapedProfileDb, args: ApplyScrapedProfileArgs): Promise<void> {
  const existing = await db.get(args.userId)
  const patch: Record<string, unknown> = {}
  if (args.location !== undefined) patch.location = args.location
  if (args.primaryLocale !== undefined) patch.primaryLocale = args.primaryLocale
  if (args.country !== undefined && !existing?.country) patch.country = args.country.toUpperCase()
  if (args.headline !== undefined && !existing?.headline) patch.headline = args.headline
  if (Object.keys(patch).length > 0) await db.patch(args.userId, patch)
}

interface PatchOnlyDb {
  patch(id: string, fields: Record<string, unknown>): Promise<void>
}

export interface UpdateProfileArgs {
  industry?: string
  country?: string
  headline?: string
}

/** Validates + patches industry, country, and headline. Empty/whitespace clears the field. */
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
  if (args.headline !== undefined) {
    const trimmed = args.headline.trim()
    if (trimmed.length > MAX_HEADLINE_LENGTH) throw new Error('Headline too long')
    patch.headline = trimmed === '' ? undefined : trimmed
  }
  if (Object.keys(patch).length > 0) await db.patch(userId, patch)
}

/** Guard for the refresh mutation. Throws a user-facing message; never leaks the flag. */
export function assertCanRefresh(user: { linkedinPublicIdentifier?: string }, settings: ApifyFlags): void {
  if (!user.linkedinPublicIdentifier) throw new Error('Set your LinkedIn profile URL first.')
  if (!isApifyProfileScrapeEnabled(settings)) throw new Error('Profile refresh is currently unavailable.')
}

// Public: whether the dev-only LinkedIn profile refresh (Apify scrape) is currently enabled.
// Used by Settings to hide the "Refresh from LinkedIn" button when the scrape is off (the prod default).
export const isProfileRefreshEnabled = query({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, { sessionToken }) => {
    const user = await resolveSession(ctx, sessionToken)
    if (!user) return false
    const settings = await ctx.db.query('appSettings').first()
    if (!settings) return false
    return isApifyProfileScrapeEnabled(settings as ApifyFlags)
  }
})

// Public: returns safe user profile — strips ALL token fields.
// Auth: resolves the session token server-side; never accepts a userId from the client.
// NOTE: resolves via resolveSession (not requireAuth) so a banned user gets an
// isBanned signal instead of null — otherwise the client would loop back to LinkedIn.
export const getMe = query({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, { sessionToken }) => {
    const user = await resolveSession(ctx, sessionToken)
    if (!user) return null
    return toSafeMe(user)
  }
})

// Public: returns trial progress counters for the trial-UI meter.
// Auth: mirrors getMe — resolves via resolveSession (not requireAuth) so banned users
// can still see their progress; returns null when not authenticated.
export const getTrialProgress = query({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, { sessionToken }) => {
    const user = await resolveSession(ctx, sessionToken)
    if (!user) return null
    const made = user.trialInteractionsMade ?? 0
    const received = user.trialInteractionsReceived ?? 0
    const combined = made + received
    return {
      made,
      received,
      combined,
      threshold: TRIAL_INTERACTION_THRESHOLD,
      reached: combined >= TRIAL_INTERACTION_THRESHOLD,
      status: user.subscriptionStatus,
      trialEndsAt: user.trialEndsAt
    }
  }
})

// Public: returns subscription info for billing page display.
// Auth: resolves the session token server-side.
export const getSubscriptionInfo = query({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, { sessionToken }) => {
    if (!sessionToken) return null
    let user: Doc<'users'>
    try {
      user = await requireAuth(ctx, sessionToken)
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
    // Trust model: we validate FORMAT only — we do NOT verify the vanity name actually belongs
    // to the signed-in member. This is self-attribution; the post-ownership fallback
    // (verifyPostOwnership Step B) trusts it, but every real LinkedIn action (comment/react) still
    // uses the user's own OAuth token, so it cannot be used to act as someone else. See PLATFORM.md §17.
    // Validate LinkedIn vanity name format: alphanumeric, hyphens, underscores, 3-100 chars
    const trimmed = publicIdentifier.trim().toLowerCase()
    if (!/^[a-zA-Z0-9\-_]{3,100}$/.test(trimmed)) {
      throw new Error('Invalid LinkedIn profile identifier format')
    }
    const changed = user.linkedinPublicIdentifier !== trimmed
    // Store lowercase for consistent comparison (LinkedIn vanityNames are case-insensitive)
    await ctx.db.patch(user._id, { linkedinPublicIdentifier: trimmed })
    // Auto-scrape only when the identifier actually changed AND the profile scrape is enabled,
    // and only within the shared 2/day budget (the same `profile_refresh` counter the Refresh
    // button uses) — so repeatedly changing the URL can't run unlimited paid scrapes. The flag is
    // checked BEFORE consuming the budget, so a disabled scrape never wastes the user's daily
    // budget (and we avoid scheduling a no-op action). The non-throwing budget check means an
    // exhausted budget never blocks saving the identifier; the user can scrape later via Refresh.
    if (changed) {
      const settings = await ctx.db.query('appSettings').first()
      if (isApifyProfileScrapeEnabled(settings as ApifyFlags)) {
        // Admins bypass the daily budget; everyone else consumes one (non-throwing) slot.
        const allowed =
          user.isAdmin || (await tryConsumeRateLimit(ctx, user._id, 'profile_refresh', 2, 24 * 60 * 60 * 1000))
        if (allowed) {
          await ctx.scheduler.runAfter(0, internal.jobs.scrapeProfileApify.scrapeUserProfile, { userId: user._id })
        }
      }
    }
  }
})

// Public: marks the one-time "confirm your LinkedIn profile URL" onboarding prompt as shown, so
// RequireAuth stops displaying PublicIdentifierPromptScreen even when the user skipped it. The user
// can still set their identifier later in Settings (setPublicIdentifier).
export const dismissPublicIdentifierPrompt = mutation({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    const user = await requireAuth(ctx, sessionToken)
    await ctx.db.patch(user._id, { publicIdentifierPromptedAt: Date.now() })
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
    primaryLocale: v.optional(v.string()),
    headline: v.optional(v.string())
  },
  handler: async (ctx, args) =>
    applyScrapedProfileHandler(ctx.db as unknown as ScrapedProfileDb, args as ApplyScrapedProfileArgs)
})

// Public: user edits their own industry/country/headline (canonical values only).
export const updateProfile = mutation({
  args: {
    sessionToken: v.string(),
    industry: v.optional(v.string()),
    country: v.optional(v.string()),
    headline: v.optional(v.string())
  },
  handler: async (ctx, { sessionToken, industry, country, headline }) => {
    const user = await requireAuth(ctx, sessionToken)
    await updateProfileHandler(
      ctx.db as unknown as { patch: (id: string, f: Record<string, unknown>) => Promise<void> },
      user._id,
      { industry, country, headline }
    )
  }
})

// Public: set the default language for AI-generated comments ('auto' or an ISO 639-1 code).
// Validated against convex/lib/languages.ts. The per-comment picker can still override this.
export const setCommentLanguage = mutation({
  args: { sessionToken: v.string(), commentLanguage: v.string() },
  handler: async (ctx, { sessionToken, commentLanguage }) => {
    const user = await requireAuth(ctx, sessionToken)
    if (!isValidCommentLanguage(commentLanguage)) throw new Error('Unsupported language')
    await ctx.db.patch(user._id, { commentLanguage })
  }
})

// Public: user-triggered re-scrape of their LinkedIn profile (rate-limited to 2/day).
export const refreshProfileFromLinkedIn = mutation({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    const user = await requireAuth(ctx, sessionToken)
    const settings = await ctx.db.query('appSettings').first()
    assertCanRefresh(user, settings as ApifyFlags)
    // Admins are exempt from the daily refresh budget.
    if (!user.isAdmin) {
      await checkRateLimit(ctx, user._id, 'profile_refresh', 2, 24 * 60 * 60 * 1000, 'day')
    }
    await ctx.scheduler.runAfter(0, internal.jobs.scrapeProfileApify.scrapeUserProfile, { userId: user._id })
  }
})
