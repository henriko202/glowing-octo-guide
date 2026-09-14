import { internalMutation, internalQuery, mutation, query } from './_generated/server'
import { ConvexError, v } from 'convex/values'
import { paginationOptsValidator } from 'convex/server'
import { components, internal } from './_generated/api'
import type { Doc } from './_generated/dataModel'
import { requireAuth, resolveSession } from './lib/auth'
import { isValidCountry, isValidIndustry } from './lib/profileOptions'
import { isValidCommentLanguage } from './lib/languages'
import { type ApifyFlags, isApifyProfileScrapeEnabled } from './lib/apify'
import { checkRateLimit, tryConsumeRateLimit } from './lib/rateLimit'
import { isNearThreshold, TRIAL_INTERACTION_THRESHOLD, trialDaysFor, trialEligible } from './lib/trialMilestone'
import { firstName, generateInviteCode } from './lib/invite'
import { toSearchPerson } from './search'
import { writeAuditLog, type AuditDb } from './lib/audit'
// Reused rather than copied: the [1, 100] clamp is identical for every cursor-paginated client-facing list.
import { clampHistoryPageSize } from './interactions'

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

// Internal: returns users with active subscriptions (excludes trialing) for the Apify post-sync
// fan-out. Uses the by_subscription_status index so it reads only active subscribers, not the whole
// users table. Cursor-paginated: the fan-out action pages through with continueCursor until isDone,
// so no user is silently skipped and each page bounds the read.
export const getActiveSubscribers = internalQuery({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, { paginationOpts }) => {
    return await ctx.db
      .query('users')
      .withIndex('by_subscription_status', q => q.eq('subscriptionStatus', 'active'))
      .paginate(paginationOpts)
  }
})

// Internal: ids of users who have a LinkedIn public identifier, for the profile-scrape fan-out.
// Profile data (country/location/locale) is useful for everyone with a profile — not just active
// subscribers — so this intentionally differs from getActiveSubscribers. Cursor-paginated over the
// full table scan (no index on linkedinPublicIdentifier), then filtered in JS: a page may carry
// fewer usable users than numItems, which is fine because the cursor still advances.
export const getUsersWithLinkedin = internalQuery({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, { paginationOpts }) => {
    const result = await ctx.db.query('users').paginate(paginationOpts)
    return {
      ...result,
      page: result.page.filter(u => !!u.linkedinPublicIdentifier).map(u => ({ _id: u._id }))
    }
  }
})

// Pure: turns a full user doc into the safe client payload.
// Strips tokens + the raw isAdmin flag; re-adds isAdmin:true only for admins
// (needed by the frontend route guard); passes the ban signal through so the
// client can render the banned screen.
export function toSafeMe(user: Doc<'users'>) {
  // Strip secrets + internal fields. bannedReason stays (shown on the banned screen).
  // tokenExpiresAt is intentionally KEPT (not a secret — just an expiry timestamp for the
  // owner's own connection) so the client can show a reconnect-before-expiry banner (B01b).
  /* eslint-disable @typescript-eslint/no-unused-vars -- destructure-and-discard sensitive fields */
  const { linkedinAccessToken, linkedinRefreshToken, stripeCustomerId, bannedBy, bannedAt, isAdmin, ...safeUser } = user
  /* eslint-enable @typescript-eslint/no-unused-vars */
  // backlog/R19 — the trial the member would get at checkout (7, or 14 when invited); the gate
  // screens and Billing render "{{days}}-day trial" from it instead of a hard-coded 7.
  const trialDays = trialDaysFor(user)
  return isAdmin ? { ...safeUser, trialDays, isAdmin: true as const } : { ...safeUser, trialDays }
}

/** Cap for the user-editable headline field; mirrored by the Settings input's maxLength. */
export const MAX_HEADLINE_LENGTH = 65

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
  if (args.headline !== undefined && !existing?.headline)
    patch.headline = args.headline.trim().slice(0, MAX_HEADLINE_LENGTH)
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
    if (args.industry !== '' && !isValidIndustry(args.industry)) throw new ConvexError('Invalid industry')
    patch.industry = args.industry === '' ? undefined : args.industry
  }
  if (args.country !== undefined) {
    const normalized = args.country.toUpperCase()
    if (args.country !== '' && !isValidCountry(normalized)) throw new ConvexError('Invalid country')
    patch.country = args.country === '' ? undefined : normalized
  }
  if (args.headline !== undefined) {
    const trimmed = args.headline.trim()
    if (trimmed.length > MAX_HEADLINE_LENGTH) throw new ConvexError('Headline too long')
    patch.headline = trimmed === '' ? undefined : trimmed
  }
  if (Object.keys(patch).length > 0) await db.patch(userId, patch)
}

/** Guard for the refresh mutation. Throws a user-facing message; never leaks the flag. */
export function assertCanRefresh(user: { linkedinPublicIdentifier?: string }, settings: ApifyFlags): void {
  if (!user.linkedinPublicIdentifier)
    throw new ConvexError('Submit one of your posts first so we can detect your LinkedIn profile.')
  if (!isApifyProfileScrapeEnabled(settings)) throw new ConvexError('Profile refresh is currently unavailable.')
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

// Public: returns safe user profile — strips the token VALUES (access/refresh) but keeps
// tokenExpiresAt (an expiry timestamp, not a secret) so the client can show a reconnect banner.
// Auth: resolves the session token server-side; never accepts a userId from the client.
// NOTE: resolves via resolveSession (not requireAuth) so a banned user gets an
// isBanned signal instead of null — otherwise the client would loop back to LinkedIn.
export const getMe = query({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, { sessionToken }) => {
    const user = await resolveSession(ctx, sessionToken)
    if (!user) return null
    // backlog/R19 — Billing's gift line names who invited them. One indexed point read, only for a
    // referred member; only the inviter's first name crosses to the client. Always the same shape,
    // so `me?.inviterName` types cleanly on the client.
    const code = user.referredByCode
    const inviter = code
      ? await ctx.db
          .query('users')
          .withIndex('by_invite_code', q => q.eq('inviteCode', code))
          .first()
      : null
    // Whether checkout would actually grant a trial. Billing must not promise one it will not get:
    // billingNode.createCheckoutSession keys the trial on the subscription-row COUNT, so any status
    // guess the client makes is wrong somewhere — 'canceled' misses a member whose Stripe
    // subscription went incomplete/paused (toSubscriptionStatus maps those to 'none' with the row
    // already inserted) and one an admin set back to 'none'. The rule is "no row, ever", so one row
    // answers it: take(1) keeps the most-subscribed query in the app on a bounded read.
    const subscriptions = await ctx.db
      .query('subscriptions')
      .withIndex('by_user', q => q.eq('userId', user._id))
      .take(1)
    return {
      ...toSafeMe(user),
      inviterName: inviter ? firstName(inviter.name) : undefined,
      trialEligible: trialEligible(subscriptions.length)
    }
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
    // Counters live in their own high-churn table (schema.ts: trialCounters) — see plan 018.
    const counter = await ctx.db
      .query('trialCounters')
      .withIndex('by_user', q => q.eq('userId', user._id))
      .unique()
    const made = counter?.made ?? 0
    const received = counter?.received ?? 0
    const combined = made + received
    return {
      made,
      received,
      combined,
      threshold: TRIAL_INTERACTION_THRESHOLD,
      reached: combined >= TRIAL_INTERACTION_THRESHOLD,
      nearThreshold: isNearThreshold(combined),
      status: user.subscriptionStatus,
      trialEndsAt: user.trialEndsAt
    }
  }
})

// backlog/R19 — mints the member's invite code on their first visit to Settings › Invite. Codes are
// never reissued: links people already shared must keep working. Idempotent after the first call.
export const getOrCreateInviteCode = mutation({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    const user = await requireAuth(ctx, sessionToken)
    if (user.inviteCode) return user.inviteCode
    // 36^8 codes — a collision is a one-in-billions event. One retry, then surface it.
    for (let attempt = 0; attempt < 2; attempt++) {
      const code = generateInviteCode()
      const taken = await ctx.db
        .query('users')
        .withIndex('by_invite_code', q => q.eq('inviteCode', code))
        .first()
      if (taken) continue
      await ctx.db.patch(user._id, { inviteCode: code })
      return code
    }
    throw new ConvexError('INVITE_CODE_RETRY')
  }
})

// backlog/R19 — Settings › Invite: the code (null until minted) and how many members joined through
// it. Bounded: the count stops at 101 and the UI shows "100+".
export const getInviteSummary = query({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, { sessionToken }) => {
    const user = await resolveSession(ctx, sessionToken)
    if (!user) return null
    const code = user.inviteCode
    if (!code) return { inviteCode: null, joined: 0 }
    const rows = await ctx.db
      .query('users')
      .withIndex('by_referred_by_code', q => q.eq('referredByCode', code))
      .take(101)
    return { inviteCode: code, joined: rows.length }
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
        stripeSubscriptionId: activeSub.stripeSubscriptionId,
        // Renewal/access-end instant for the billing page — from our own subscriptions row
        // (the component doesn't store it). Undefined only if our row hasn't caught up yet.
        currentPeriodEnd: ourSub?.currentPeriodEnd,
        // The interval Stripe will actually bill on, off the webhook price snapshot. The page's
        // own `billingInterval` toggle is seeded from this but browser-local and clickable, so it
        // must never be used to tell a member what they are about to be charged.
        priceInterval: ourSub?.priceInterval,
        priceAmount: ourSub?.priceAmount,
        priceCurrency: ourSub?.priceCurrency,
        // backlog/B07 — the pending cross-tier downgrade, for the billing card's "Starter from
        // <date>" cell and its Keep button. Absent ⇒ nothing is scheduled.
        pendingTier: ourSub?.pendingTier,
        pendingAt: ourSub?.pendingAt
      }
    }

    // No active subscription: trialing, canceled, or never subscribed — tier is empty
    return {
      tier: null,
      status: user.subscriptionStatus ?? 'trialing',
      cancelAtPeriodEnd: false,
      stripeSubscriptionId: null,
      currentPeriodEnd: undefined,
      priceInterval: undefined,
      priceAmount: undefined,
      priceCurrency: undefined,
      pendingTier: undefined,
      pendingAt: undefined
    }
  }
})

/**
 * Records the language the member checked out in as a backstop; the app owns the normal path by
 * persisting every UI-language change through `users.setLanguage`.
 */
export const setLanguageFromCheckout = internalMutation({
  args: { userId: v.id('users'), language: v.string() },
  handler: async (ctx, { userId, language }) => {
    await ctx.db.patch(userId, { language })
  }
})

/** Raises a one-shot billing notice banner (see schema: users.billingNotice). */
export const setBillingNotice = internalMutation({
  args: { userId: v.id('users'), notice: v.string() },
  handler: async (ctx, { userId, notice }) => {
    await ctx.db.patch(userId, { billingNotice: notice })
  }
})

/** Dismisses the billing notice banner. Public: the owner clears their own. */
export const clearBillingNotice = mutation({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    const user = await requireAuth(ctx, sessionToken)
    await ctx.db.patch(user._id, { billingNotice: undefined })
  }
})

/**
 * Persists the member's UI language so transactional email matches the interface. The language
 * cookie stays the client's own source of truth; this keeps the account in step. Idempotent.
 */
export const setLanguage = mutation({
  args: {
    sessionToken: v.string(),
    language: v.union(v.literal('en'), v.literal('pt'), v.literal('es'))
  },
  handler: async (ctx, { sessionToken, language }) => {
    const user = await requireAuth(ctx, sessionToken)
    if (user.language !== language) await ctx.db.patch(user._id, { language })
  }
})

// Internal: fill the member's LinkedIn vanity from a name-verified post's author profile URL — called
// by submitPost once the author-name ownership check passes. The value is LinkedIn-authoritative
// (parsed from the post's JSON-LD `author.url`), never user-typed, so it's the trustworthy seed for
// the Apify profile/post scrape. Set-once — never overwrites an existing identifier. Kicks off a
// one-time, budget-guarded profile scrape, mirroring the old manual setter.
export const setDerivedPublicIdentifier = internalMutation({
  args: { userId: v.id('users'), vanity: v.string() },
  handler: async (ctx, { userId, vanity }) => {
    const user = await ctx.db.get(userId)
    if (!user || user.linkedinPublicIdentifier) return // set-once — never overwrite
    await ctx.db.patch(userId, { linkedinPublicIdentifier: vanity })
    // Country/locale enrichment scrape — budget-guarded (admins bypass), same policy as before.
    const settings = await ctx.db.query('appSettings').first()
    if (isApifyProfileScrapeEnabled(settings as ApifyFlags)) {
      const allowed =
        user.isAdmin || (await tryConsumeRateLimit(ctx, userId, 'profile_refresh', 2, 24 * 60 * 60 * 1000))
      if (allowed) {
        await ctx.scheduler.runAfter(0, internal.jobs.scrapeProfileApify.scrapeUserProfile, { userId })
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

export interface SetPostVisibilityArgs {
  industries: string[]
  countries: string[]
}

/**
 * Validates + patches the caller's default post-visibility allowlists (backlog/B06). Every post
 * writer (posts.submitPost, jobs/processQueue.ts, jobs/syncPostsApify.ts) copies these onto
 * posts.visibilityIndustries/visibilityCountries at insert time — see convex/feed.ts for the
 * enforcement. Gated to Pro/Contact tiers HERE (server-side) — never trust the caller's UI gate.
 * Rejects any value not in the canonical INDUSTRIES/COUNTRY_CODES lists (trust boundary). Empty
 * arrays are valid and mean "visible to everyone" (the feed treats an empty list as unrestricted).
 */
export async function setPostVisibilityHandler(
  db: PatchOnlyDb,
  userId: string,
  tier: string | undefined,
  args: SetPostVisibilityArgs
): Promise<void> {
  if (tier !== 'pro' && tier !== 'contact') {
    throw new ConvexError('Post-visibility controls require a Pro or Contact plan')
  }
  if (!args.industries.every(isValidIndustry)) throw new ConvexError('Invalid industry')
  const countries = args.countries.map(c => c.toUpperCase())
  if (!countries.every(isValidCountry)) throw new ConvexError('Invalid country')
  await db.patch(userId, { defaultVisibilityIndustries: args.industries, defaultVisibilityCountries: countries })
}

// Public: Pro/Contact user sets the default post-visibility allowlists applied to every post they
// author from now on. Existing posts (and their enforcement) are untouched — see
// setPostVisibilityHandler. A downgrade does NOT clear these; only this setter is tier-gated.
export const setPostVisibility = mutation({
  args: {
    sessionToken: v.string(),
    industries: v.array(v.string()),
    countries: v.array(v.string())
  },
  handler: async (ctx, { sessionToken, industries, countries }) => {
    const user = await requireAuth(ctx, sessionToken)
    await setPostVisibilityHandler(
      ctx.db as unknown as { patch: (id: string, f: Record<string, unknown>) => Promise<void> },
      user._id,
      user.tier,
      { industries, countries }
    )
  }
})

/**
 * Validates + patches the caller's Pro/Contact feed filter. The feed (convex/feed.ts getFeed →
 * buildFeedFilter) reads these straight off the viewer doc: the viewer sees only posts whose AUTHOR
 * matches one of `feedFilterIndustries` AND one of `feedFilterCountries` (each dimension ORs over
 * its list; empty ⇒ that dimension isn't filtered). A "what I want to see" preference, not an access
 * rule. Gated to Pro/Contact tiers HERE (server-side) — never trust the caller's UI gate. Rejects
 * any value not in the canonical INDUSTRIES/COUNTRY_CODES lists (trust boundary). Mirrors
 * setPostVisibilityHandler.
 */
export async function setFeedFilterHandler(
  db: PatchOnlyDb,
  userId: string,
  tier: string | undefined,
  args: SetPostVisibilityArgs
): Promise<void> {
  if (tier !== 'pro' && tier !== 'contact') {
    throw new ConvexError('Feed filtering requires a Pro or Contact plan')
  }
  if (!args.industries.every(isValidIndustry)) throw new ConvexError('Invalid industry')
  const countries = args.countries.map(c => c.toUpperCase())
  if (!countries.every(isValidCountry)) throw new ConvexError('Invalid country')
  await db.patch(userId, { feedFilterIndustries: args.industries, feedFilterCountries: countries })
}

// Public: Pro/Contact user sets the industry/country allowlists that filter THEIR feed. Applied
// live — the feed reads these from the viewer doc, so patching re-runs getFeed reactively. Empty
// arrays clear the filter. A downgrade does NOT clear these; only this setter is tier-gated.
export const setFeedFilter = mutation({
  args: {
    sessionToken: v.string(),
    industries: v.array(v.string()),
    countries: v.array(v.string())
  },
  handler: async (ctx, { sessionToken, industries, countries }) => {
    const user = await requireAuth(ctx, sessionToken)
    await setFeedFilterHandler(
      ctx.db as unknown as { patch: (id: string, f: Record<string, unknown>) => Promise<void> },
      user._id,
      user.tier,
      { industries, countries }
    )
  }
})

// Public: set the default language for AI-generated comments ('auto' or an ISO 639-1 code).
// Validated against convex/lib/languages.ts. The per-comment picker can still override this.
export const setCommentLanguage = mutation({
  args: { sessionToken: v.string(), commentLanguage: v.string() },
  handler: async (ctx, { sessionToken, commentLanguage }) => {
    const user = await requireAuth(ctx, sessionToken)
    if (!isValidCommentLanguage(commentLanguage)) throw new ConvexError('Unsupported language')
    await ctx.db.patch(user._id, { commentLanguage })
  }
})

/**
 * R22 — members directory for /people. Safe projection only (name, headline, picture, LinkedIn identifier);
 * banned and pending-deletion members are excluded, like people search. Paginated.
 */
export const listMembers = query({
  args: { sessionToken: v.string(), paginationOpts: paginationOptsValidator },
  handler: async (ctx, { sessionToken, paginationOpts }) => {
    await requireAuth(ctx, sessionToken)
    // Unindexed creation order, exactly like users.getActiveSubscribers (users.ts:54). The directory is a small
    // paginated list; the page can sort the loaded page alphabetically in the UI. The client-supplied page size is
    // clamped like every client-facing cursor list.
    const result = await ctx.db
      .query('users')
      .paginate({ ...paginationOpts, numItems: clampHistoryPageSize(paginationOpts.numItems) })
    return {
      ...result,
      page: result.page.filter(u => !u.isBanned && u.deletionScheduledAt === undefined).map(toSearchPerson)
    }
  }
})

/** R22 — the rankings opt-out. Idempotent, audited: the objection itself is the record. */
export const setLeaderboardOptOut = mutation({
  args: { sessionToken: v.string(), optOut: v.boolean() },
  handler: async (ctx, { sessionToken, optOut }) => {
    const user = await requireAuth(ctx, sessionToken)
    if (user.leaderboardOptOut === optOut) return
    await ctx.db.patch(user._id, { leaderboardOptOut: optOut })
    await writeAuditLog(ctx.db as unknown as AuditDb, {
      actor: 'user',
      actorId: user._id,
      action: 'leaderboard_opt_out_changed',
      targetUserId: user._id,
      metadata: JSON.stringify({ optOut })
    })
  }
})

/**
 * R24 — the Settings > Emails view. Absent means the default: digest on, appears in rankings.
 */
export const getEmailPreferences = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    const user = await requireAuth(ctx, sessionToken)
    return {
      digestEmailsEnabled: user.digestEmailsEnabled !== false,
      leaderboardOptOut: user.leaderboardOptOut === true
    }
  }
})

/** R24 — opt out (or back in) of the 3-day digest. Idempotent, audited. */
export const setDigestEmailsEnabled = mutation({
  args: { sessionToken: v.string(), enabled: v.boolean() },
  handler: async (ctx, { sessionToken, enabled }) => {
    const user = await requireAuth(ctx, sessionToken)
    if ((user.digestEmailsEnabled !== false) === enabled) return
    await ctx.db.patch(user._id, { digestEmailsEnabled: enabled })
    await writeAuditLog(ctx.db as unknown as AuditDb, {
      actor: 'user',
      actorId: user._id,
      action: 'digest_preference_changed',
      targetUserId: user._id,
      metadata: JSON.stringify({ enabled })
    })
  }
})

// Public: mark the first-post onboarding step resolved when the user skips it ("I'll do this
// later"). Set-once — submitting any post sets the same flag server-side (markFirstPostPrompted).
export const dismissFirstPostPrompt = mutation({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    const user = await requireAuth(ctx, sessionToken)
    if (!user.firstPostPromptedAt) await ctx.db.patch(user._id, { firstPostPromptedAt: Date.now() })
  }
})

// Internal: called from posts.submitPost after a post is persisted, so posting (from the
// onboarding gate or the normal My Posts composer) also clears the first-post step. Set-once.
export const markFirstPostPrompted = internalMutation({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }) => {
    const user = await ctx.db.get(userId)
    if (user && !user.firstPostPromptedAt) await ctx.db.patch(userId, { firstPostPromptedAt: Date.now() })
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
