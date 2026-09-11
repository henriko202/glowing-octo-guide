import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'
import { articleValidator } from './lib/articleValidator'
import { reactionValidator } from './lib/reactions'

export default defineSchema({
  users: defineTable({
    linkedinId: v.string(),
    name: v.string(),
    headline: v.optional(v.string()),
    profilePictureUrl: v.optional(v.string()),
    industry: v.optional(v.string()),
    country: v.optional(v.string()),
    // Scraped LinkedIn profile location, e.g. "Curitiba, Paraná, Brazil". Read-only display
    // (set only by the profile scrape). Distinct from `country` (geographic ISO alpha-2 code).
    location: v.optional(v.string()),
    // Scraped LinkedIn primary-locale language code (e.g. "en"). Drives the UI i18n seed only.
    primaryLocale: v.optional(v.string()),
    // The UI language the member last checked out in ('en' | 'pt' | 'es'). Written by
    // billingNode.createCheckoutSession and read by the billing mailers — the member's UI language
    // choice otherwise lives only in a browser cookie the backend never sees. Distinct from
    // primaryLocale (the scraped LinkedIn locale, which only seeds the initial UI language).
    language: v.optional(v.string()),
    // One-shot billing notice key, rendered as a dismissible banner on /billing (currently only
    // 'duplicate_canceled'). Set by the duplicate-subscription webhook, cleared by
    // users.clearBillingNotice. Absent ⇒ no notice. A voided subscription is never silent.
    billingNotice: v.optional(v.string()),
    // Default language for AI-generated comments: an ISO 639-1 code or 'auto'. Absent ⇒ 'auto'.
    // Validated against convex/lib/languages.ts in setCommentLanguage. Distinct from primaryLocale
    // (which only seeds the UI i18n language, not what the AI writes comments in).
    commentLanguage: v.optional(v.string()),
    // Pro/Contact-only post-visibility defaults (backlog/B06 — "user-default" model, not per-post).
    // Every post writer (posts.submitPost, jobs/processQueue.ts, jobs/syncPostsApify.ts) copies
    // these onto posts.visibilityIndustries/visibilityCountries at INSERT time — see convex/feed.ts
    // for the enforcement. Absent/empty ⇒ visible to everyone (same invariant as the post fields).
    // Set via users.setPostVisibility, gated server-side to tier 'pro'/'contact'. Downgrading does
    // NOT clear these or the posts already written with them — only the setter is tier-gated.
    defaultVisibilityIndustries: v.optional(v.array(v.string())),
    defaultVisibilityCountries: v.optional(v.array(v.string())),
    // Pro/Contact-only feed filter: the viewer sees only posts whose AUTHOR matches one of these
    // industries AND one of these countries (each dimension is an OR over its list; the two
    // dimensions are ANDed). A "what I want to see" preference, NOT an access rule — read straight
    // off the viewer doc by feed.getFeed (via buildFeedFilter). Set via users.setFeedFilter, gated
    // server-side to tier 'pro'/'contact'. Absent/empty for a dimension ⇒ that dimension isn't
    // filtered. A downgrade does NOT clear these; only the setter is tier-gated.
    feedFilterIndustries: v.optional(v.array(v.string())),
    feedFilterCountries: v.optional(v.array(v.string())),
    tier: v.optional(v.union(v.literal('starter'), v.literal('growth'), v.literal('pro'), v.literal('contact'))),
    subscriptionStatus: v.union(
      v.literal('trialing'),
      v.literal('active'),
      v.literal('canceled'),
      v.literal('past_due'),
      v.literal('none')
    ),
    trialEndsAt: v.optional(v.number()),
    // Paid-through timestamp (Stripe current_period_end, ms). Mirrored from the subscription on
    // every Stripe sync + cancellation. A canceled author's posts stay in the feed until this
    // instant, then drop out (see feed.isAuthorFeedEligible) — access to engage is NOT affected.
    subscriptionEndsAt: v.optional(v.number()),
    stripeCustomerId: v.optional(v.string()),
    linkedinAccessToken: v.optional(v.string()),
    linkedinRefreshToken: v.optional(v.string()),
    tokenExpiresAt: v.optional(v.number()),
    // The member's LinkedIn public profile identifier (vanityName). Auto-derived (set-once) from the
    // `author.url` of a name-verified submitted post (setDerivedPublicIdentifier) — never user-typed.
    // Seeds the Apify profile/post scrape; it is NOT the ownership check (that matches the post's
    // author name against the OIDC name — see linkedin/verifyPostOwnership.ts).
    linkedinPublicIdentifier: v.optional(v.string()),
    // Admin flag — MUST only be set directly in the database.
    // All application code (upsertUser, etc.) must ignore this field.
    isAdmin: v.optional(v.boolean()),
    // Ban state — set/cleared only by the admin banUser/unbanUser mutations.
    // bannedReason is user-visible (shown on the banned screen).
    isBanned: v.optional(v.boolean()),
    bannedAt: v.optional(v.number()),
    bannedBy: v.optional(v.id('users')),
    bannedReason: v.optional(v.string()),
    // ─── Privacy & compliance ────────────────────────────────────────────────
    // Contact channel captured from the LinkedIn OIDC `email` claim (previously discarded).
    // Used for DSR confirmations and breach notification. Stored under legitimate interest /
    // legal obligation, NOT marketing consent.
    email: v.optional(v.string()),
    // Account-deletion lifecycle (self-service erasure + dormancy). `deletionRequestedAt` is an
    // intentional erasure-audit-trail timestamp (when the user asked) — kept for compliance even
    // though no query reads it back; do not treat it as dead. Presence of `deletionScheduledAt`
    // means the account is pending hard-deletion by the cron.
    deletionRequestedAt: v.optional(v.number()),
    deletionScheduledAt: v.optional(v.number()),
    deletionReason: v.optional(v.union(v.literal('user_request'), v.literal('dormancy'))),
    // Set on each login (in upsertUser); powers the dormancy retention check.
    lastLoginAt: v.optional(v.number()),
    // The privacy-policy version this user last acknowledged (drives the re-consent prompt).
    acknowledgedPolicyVersion: v.optional(v.string()),
    // When the user completed the one-time consent prompt (marketing/analytics). Unset ⇒ prompt on login.
    consentPromptedAt: v.optional(v.number()),
    // When the first-post onboarding step was resolved — set once, either by submitting any post
    // (server-side in posts.submitPost) or by skipping the prompt. Unset ⇒ show FirstPostPromptScreen.
    firstPostPromptedAt: v.optional(v.number()),
    // backlog/R19 — the member's own invite code (minted on first visit to Settings › Invite, never
    // reissued: shared links must keep working) and the code they joined through (stamped at insert
    // only, after verifying it belongs to a member — see linkedin/auth.upsertUserHandler).
    inviteCode: v.optional(v.string()),
    referredByCode: v.optional(v.string()),
    createdAt: v.number()
  })
    .index('by_linkedin_id', ['linkedinId'])
    .index('by_stripe_customer', ['stripeCustomerId'])
    .index('by_tier', ['tier'])
    // Active-subscriber fan-out (Apify post sync). Replaces a full-table .filter() scan.
    .index('by_subscription_status', ['subscriptionStatus'])
    // Data-retention cron: target users whose LinkedIn token has expired directly,
    // instead of scanning every user that still holds a token.
    .index('by_token_expiry', ['tokenExpiresAt'])
    // Serves BOTH privacy crons from one compound index:
    //  • processAccountDeletions: range on the leading field — deletionScheduledAt in (0, now].
    //  • dormancy sweep: eq(deletionScheduledAt, undefined) + range on lastLoginAt.
    // Because flagging a dormant user SETS deletionScheduledAt, that row immediately leaves
    // the dormancy range — so the retention cron can self-reschedule without re-reading it.
    .index('by_deletion_and_last_login', ['deletionScheduledAt', 'lastLoginAt'])
    // backlog/R19 — inviter lookup (getMe's gift line, upsert verification) + the "N joined" count.
    .index('by_invite_code', ['inviteCode'])
    .index('by_referred_by_code', ['referredByCode'])
    // Full-text people search for the ⌘K command palette (convex/search.ts). Results are
    // projected through toSearchPerson (safe display fields only — never tokens/PII).
    .searchIndex('search_name', { searchField: 'name' }),

  posts: defineTable({
    linkedinPostUrn: v.string(),
    authorId: v.id('users'),
    content: v.string(),
    publishedAt: v.number(),
    likeCount: v.number(),
    commentCount: v.number(),
    mediaUrls: v.array(v.string()),
    // Image-typed media URLs only (subset of mediaUrls), captured at manual submit for the AI
    // vision prompts. Optional: absent on cron/Apify-synced posts and legacy rows.
    imageUrls: v.optional(v.array(v.string())),
    isFeatured: v.boolean(),
    featuredAt: v.optional(v.number()),
    visibilityIndustries: v.array(v.string()),
    visibilityCountries: v.array(v.string()),
    hidden: v.boolean(),
    // Numeric rank of the author's subscription tier at post-write time.
    // 4=contact, 3=pro, 2=growth, 1=starter. Used to filter/sort by tier without
    // a join. Optional so existing posts without this field remain valid.
    authorTierRank: v.optional(v.number()),
    // Set to true when likeCount + commentCount >= the author's interactionsPerPost
    // plan limit. Optional so existing posts without this field remain valid.
    interactionLimitReached: v.optional(v.boolean()),
    // backlog/R17 — a bought featured post counts against planCap + this bonus (FEATURED_CAP_BONUS
    // for the author's tier at fulfilment). Absent on every other post.
    interactionCapBonus: v.optional(v.number()),
    // backlog/R17 — the one-time Stripe Checkout that featured this post. Present ⇒ bought once:
    // re-featuring is free (featurePost skips the monthly quota) and a redelivered webhook is a no-op.
    featuredPurchase: v.optional(
      v.object({ checkoutSessionId: v.string(), amountCents: v.number(), paidAt: v.number() })
    ),
    // Original URL submitted by the user — stored so we can link back correctly
    // without reconstructing URNs (activity IDs ≠ ugcPost IDs across LinkedIn namespaces).
    // Absent for cron-synced posts (those use urnToLinkedInUrl fallback).
    sourceUrl: v.optional(v.string()),
    // Structured data for an article the post links to (e.g. a LinkedIn Pulse article),
    // captured best-effort on manual submission. Seeds a future AI-comment feature; not
    // displayed in-app. Absent when the post shares no article or enrichment failed.
    // See convex/lib/articleValidator.ts.
    article: v.optional(articleValidator),
    // Soft-delete marker. When set, the post is excluded from the feed AND the
    // author's My Posts view, but the row is intentionally KEPT so it still counts
    // toward the rolling weekly post limit (deleting must not free up a slot).
    deletedAt: v.optional(v.number()),
    // ─── Feed cursor-pagination (denormalized, maintained by lib/feedRank.ts) ────
    // Single descending sort key encoding featured→tier→recency; see computeFeedFields.
    // Optional during the widen→backfill rollout — old posts are stamped by the
    // backfill migration before getFeed switches to the by_in_feed_and_feed_rank index.
    feedRank: v.optional(v.number()),
    // True iff the post passes the non-viewer-specific feed filters
    // (hidden === false && !interactionLimitReached && deletedAt === undefined).
    inFeed: v.optional(v.boolean()),
    // AI-predicted most-likely reaction (set async by convex/ai/reactions.ts after submit).
    // Absent ⇒ the UI picker treats it as LIKE. See docs AI Reaction & Comment Assistance.
    suggestedReaction: v.optional(reactionValidator)
  })
    .index('by_author', ['authorId'])
    .index('by_urn', ['linkedinPostUrn'])
    .index('by_author_and_publishedAt', ['authorId', 'publishedAt'])
    // Cursor-pagination index for getFeed: walk inFeed=true posts in feedRank desc order.
    // NOTE: the older by_featured / by_published / by_feed indexes were removed once the
    // feed migrated to by_in_feed_and_feed_rank — they had no remaining withIndex callers and every
    // index adds write amplification on this (highest-write) table.
    .index('by_in_feed_and_feed_rank', ['inFeed', 'feedRank'])
    // Full-text content search for the ⌘K command palette (convex/search.ts). filterField
    // `inFeed` pins the scan to feed-eligible posts so hidden/capped/deleted posts never
    // enter the candidate set; per-viewer visibility is still applied on top (mirrors getFeed).
    .searchIndex('search_content', { searchField: 'content', filterFields: ['inFeed'] }),

  subscriptions: defineTable({
    userId: v.id('users'),
    stripeSubscriptionId: v.string(),
    tier: v.union(v.literal('starter'), v.literal('growth'), v.literal('pro'), v.literal('contact')),
    status: v.string(),
    currentPeriodEnd: v.optional(v.number()),
    // Price snapshot from the Stripe webhook payload (items.data[0].price), so a billing email can
    // state the exact amount without a second Stripe call and without a hardcoded price table that
    // drifts the day pricing changes. Minor units, e.g. 15000 + 'usd' + 'year'.
    priceAmount: v.optional(v.number()),
    priceCurrency: v.optional(v.string()),
    priceInterval: v.optional(v.string()),
    // Mirrors Stripe's cancel_at_period_end. Stripe keeps status 'trialing' after a member
    // cancels mid-trial, so this is the only signal that tells the trial mailers not to
    // promise a charge that will never happen.
    cancelAtPeriodEnd: v.optional(v.boolean()),
    // backlog/B07 — a cross-tier downgrade is SCHEDULED, never prorated: our own Stripe subscription
    // schedule swaps the item price at current_period_end with proration_behavior 'none'. These two
    // mirror that pending swap so the billing page can show "Starter from <date>" and offer an undo.
    // Stripe stays the source of truth (the actions read sub.schedule); this is a mirror, cleared by
    // the webhook once the swap applies or the schedule is released. Never 'pro' — nothing sits above
    // it on a Stripe-synced row, since contact is admin-assigned and has no price.
    pendingTier: v.optional(v.union(v.literal('starter'), v.literal('growth'))),
    pendingAt: v.optional(v.number()),
    // Stripe's own `created` (ms). The duplicate-subscription guard voids the NEWEST live row by
    // this stamp, never by webhook arrival order, which Stripe does not guarantee.
    stripeCreated: v.optional(v.number()),
    // Stripe `created` (ms) of the newest webhook EVENT applied to this row. Stripe does not deliver
    // events in order: syncUserSubscription and markPastDue skip an event older than this stamp, so
    // it can never rewind status (or re-fire the trial-converted email). See lib/trialMilestone.
    lastEventAt: v.optional(v.number())
  })
    .index('by_user', ['userId'])
    .index('by_stripe_id', ['stripeSubscriptionId']),

  // High-churn trial interaction counters, kept off the users doc so each interaction does not
  // invalidate every query that reads the member (getMe, feed pages containing their posts).
  trialCounters: defineTable({
    userId: v.id('users'),
    made: v.number(),
    received: v.number()
  }).index('by_user', ['userId']),

  featuredPostUsage: defineTable({
    userId: v.id('users'),
    month: v.string(),
    usedCount: v.number()
  }).index('by_user_id_and_month', ['userId', 'month']),

  appSettings: defineTable({
    apifySyncEnabled: v.boolean(),
    // Master Apify kill-switch. Absent ⇒ treated as enabled (true). When false, ALL Apify
    // integration halts (post sync AND profile scrape).
    apifyEnabled: v.optional(v.boolean()),
    // Gates the LinkedIn profile scrape. Absent ⇒ disabled (false) — opt-in (paid actor).
    apifyProfileScrapeEnabled: v.optional(v.boolean()),
    lastApifySyncAt: v.optional(v.number()),
    lastApifySyncError: v.optional(v.string()),
    // Last manual/cron profile-scrape fan-out run (parallels the post-sync fields above).
    lastProfileScrapeAt: v.optional(v.number()),
    lastProfileScrapeError: v.optional(v.string())
  }),

  sessions: defineTable({
    token: v.string(),
    userId: v.id('users'),
    expiresAt: v.number()
  })
    .index('by_token', ['token'])
    .index('by_userId', ['userId'])
    // Indexed range for the expired-session cleanup cron (expiresAt < now) — replaces a
    // full-table .filter() scan that would read every live session to find the expired tail.
    .index('by_expires_at', ['expiresAt']),

  // Rate-limit state lives in the @convex-dev/rate-limiter component's own isolated tables (mounted in
  // convex.config.ts, consumed via lib/rateLimit.ts) — no app-level table needed.

  // Ephemeral OAuth state storage for CSRF protection.
  // Each entry lives for 10 minutes — enough time to complete the LinkedIn OAuth flow.
  // Validated on callback; deleted immediately after use (replay protection).
  oauthStates: defineTable({
    state: v.string(),
    browserNonce: v.string(),
    // PKCE-style SHA-256 challenge (base64url, 43 chars) minted by the initiating browser from a
    // verifier that never leaves it. Optional ONLY for deploy safety: ephemeral rows written before
    // this field existed have no challenge and are treated as invalid by validateAndConsumeOAuthState.
    challenge: v.optional(v.string()),
    expiresAt: v.number(),
    plan: v.optional(v.string()),
    interval: v.optional(v.string()),
    // backlog/R19 — the inviter's code from the landing's ?ref=, carried through the OAuth round-trip.
    ref: v.optional(v.string())
  })
    .index('by_state', ['state'])
    // Indexed range for the expired-OAuth-state cleanup cron — replaces a full-table .filter() scan.
    .index('by_expires_at', ['expiresAt']),

  // Single-use login codes (PKCE-style verifier binding). The OAuth callback mints one (2-minute
  // TTL) and redirects with `#code=…`; the initiating browser redeems it by presenting the verifier
  // whose SHA-256 challenge is stored here. The session token itself never travels in a URL, and a
  // handed-over code is inert without the verifier. See sessions.createAuthCode / redeemAuthCode.
  authCodes: defineTable({
    code: v.string(),
    userId: v.id('users'),
    challenge: v.string(),
    plan: v.optional(v.string()),
    interval: v.optional(v.string()),
    expiresAt: v.number()
  })
    .index('by_code', ['code'])
    // Indexed range for the expired-auth-code cleanup cron (mirrors oauthStates).
    .index('by_expires_at', ['expiresAt'])
    // Account-erasure cascade drains a deleted user's unredeemed codes by owner.
    .index('by_userId', ['userId']),

  // Subscription-tier limits for post interactions and weekly post volume.
  // The contact tier supports optional per-user overrides via userId.
  planLimits: defineTable({
    tier: v.union(v.literal('starter'), v.literal('growth'), v.literal('pro'), v.literal('contact')),
    userId: v.optional(v.id('users')), // Only set for contact-tier per-user overrides
    interactionsPerPost: v.number(),
    postsPerWeek: v.number(),
    // Max posts.featurePost calls allowed per calendar month (UTC), enforced against
    // featuredPostUsage. Optional (widen-safe): getPlanLimitsHelper coalesces a missing
    // value to the tier's DEFAULTS entry, so existing unseeded rows keep working.
    featuredPerMonth: v.optional(v.number())
  })
    .index('by_tier', ['tier'])
    .index('by_user', ['userId']),

  // Overflow queue for posts that could not be inserted because the author was at
  // their weekly post limit. A daily cron promotes queued posts to the posts table
  // when capacity opens (i.e. old posts fall outside the 7-day window).
  postQueue: defineTable({
    linkedinPostUrn: v.string(),
    authorId: v.id('users'),
    content: v.string(),
    publishedAt: v.number(),
    likeCount: v.number(),
    commentCount: v.number(),
    mediaUrls: v.array(v.string()),
    hidden: v.boolean(),
    sourceUrl: v.optional(v.string()),
    queuedAt: v.number()
  })
    .index('by_author', ['authorId'])
    .index('by_urn', ['linkedinPostUrn']),

  // Append-only consent/withdrawal log. Current effective consent for a purpose is the
  // latest record for (userId, purpose). by_user_and_purpose_and_created_at lets getConsents
  // read the newest row per purpose directly; by_user still serves the export/deletion drains.
  consentRecords: defineTable({
    userId: v.id('users'),
    purpose: v.union(v.literal('marketing'), v.literal('analytics')),
    granted: v.boolean(),
    policyVersion: v.string(),
    createdAt: v.number()
  })
    .index('by_user', ['userId'])
    .index('by_user_and_purpose_and_created_at', ['userId', 'purpose', 'createdAt']),

  // Tracks asynchronous data-export jobs. The generated bundle is held in Convex file
  // storage; the link expires (fileStorageId/expiresAt) and is purged by the retention cron.
  dataExportRequests: defineTable({
    userId: v.id('users'),
    status: v.union(v.literal('pending'), v.literal('ready'), v.literal('failed'), v.literal('expired')),
    requestedAt: v.number(),
    fileStorageId: v.optional(v.id('_storage')),
    expiresAt: v.optional(v.number())
  })
    .index('by_user', ['userId'])
    // Lets the retention cron pull 'ready' exports via index instead of a full-table .filter() scan.
    .index('by_status', ['status']),

  // Accountability log (GDPR Art. 5(2)) for DSR actions, consent changes, and admin access
  // to personal data. A pseudonymized subset is retained past account deletion.
  auditLogs: defineTable({
    actor: v.union(v.literal('user'), v.literal('admin'), v.literal('system')),
    actorId: v.optional(v.id('users')),
    action: v.string(),
    targetUserId: v.optional(v.id('users')),
    metadata: v.optional(v.string()),
    createdAt: v.number()
  })
    .index('by_target', ['targetUserId'])
    .index('by_created', ['createdAt']),

  // User-submitted product feedback. Authenticated submitters; admins reply by email
  // (status → 'responded'). On account deletion the row is ANONYMIZED, not deleted:
  // userId is cleared (→ undefined) while the content is retained. See convex/privacy/deletion.ts.
  feedback: defineTable({
    userId: v.optional(v.id('users')), // submitter; set on submit, CLEARED on account deletion (anonymize)
    category: v.union(
      v.literal('feature_request'),
      v.literal('bug'),
      v.literal('comment'),
      v.literal('criticism'),
      v.literal('praise'),
      v.literal('question'),
      v.literal('suggestion'),
      v.literal('other'),
      v.literal('cancellation')
    ),
    message: v.string(),
    status: v.union(v.literal('new'), v.literal('responded'), v.literal('archived')),
    createdAt: v.number()
  }).index('by_user', ['userId']), // export + locate rows to anonymize on deletion

  // Append-only reply log for feedback items. Replaces the single-reply fields on the
  // feedback row. Each admin reply is a separate row.
  // Index order: feedbackId first (equality), createdAt second (range / chronological).
  feedbackResponses: defineTable({
    feedbackId: v.id('feedback'),
    responderId: v.id('users'),
    text: v.string(),
    createdAt: v.number()
  }).index('by_feedback_id_and_created_at', ['feedbackId', 'createdAt']),

  // Admin-authored Message of the Day. Exactly one is shown at a time (the newest enabled row —
  // `enabled` is materialized from the [startAt, expiresAt) window by resolveMotdEnabled; see
  // convex/motd/motd.ts).
  // `bodies` is a locale->markdown map; `en` is required (enforced in validation) and is the
  // fallback for locales without their own body. A record (not a fixed object) so new locales
  // need no schema migration. Admin content — not personal data, hard-deleted on removal.
  motds: defineTable({
    bodies: v.record(v.string(), v.string()),
    important: v.boolean(), // false -> banner, true -> blocking modal
    enabled: v.boolean(),
    startAt: v.optional(v.number()), // optional scheduled start (ms epoch)
    expiresAt: v.optional(v.number()), // optional "limited date" (ms epoch)
    createdBy: v.id('users'),
    createdAt: v.number(),
    updatedAt: v.number()
  }).index('by_enabled_and_created', ['enabled', 'createdAt']),

  // Per-user engagement log: one row per reaction or comment the user made on a post, written in
  // the SAME transaction as the post counter bump (interactions.ts incrementLikeCount /
  // incrementCommentCount) so counts and log never drift. Powers the recap + history pages, the
  // DSR export and the trial-conversion email. `authorId` is the post's author at write time (rows
  // written before 2026-09-07 lack it and are ignored by "received" counts).
  // `reaction` is set when kind==='reaction'; `comment` when 'comment'.
  userInteractions: defineTable({
    userId: v.id('users'),
    postId: v.id('posts'),
    authorId: v.optional(v.id('users')),
    kind: v.union(v.literal('reaction'), v.literal('comment')),
    reaction: v.optional(reactionValidator),
    comment: v.optional(v.string()),
    createdAt: v.number()
  })
    .index('by_user', ['userId']) // DSR export + a user's activity + history page
    // Locate rows referencing a given post so account erasure can delete OTHER users' interactions
    // on the deleted user's posts (they aren't caught by the by_user drain). See privacy/deletion.ts.
    .index('by_post', ['postId'])
    // "Received" side of the recap: everything anyone did on this author's posts.
    .index('by_author', ['authorId']),

  // Per-(user, post) engagement state. One lazily-created row per user+post — distinct from the
  // append-only userInteractions LOG above. Holds CURRENT state: `reactedAt` (set on the user's
  // first reaction so a repeat reaction doesn't double-count / double-bill — a LinkedIn member can
  // only hold one reaction per post) and `commentDraft` (their last AI-generated comment for the
  // post, reloaded into the comment box for reuse/regeneration). Per-user data: exported for DSR
  // and deleted on account erasure.
  userPostState: defineTable({
    userId: v.id('users'),
    postId: v.id('posts'),
    reactedAt: v.optional(v.number()),
    // backlog/R21 — set when the viewer records a comment; with reactedAt it starts the 24 h window
    // after which the post leaves THIS viewer's feed. Never read by counts, caps or the author.
    commentedAt: v.optional(v.number()),
    // backlog/R21 — "Hide now": the post leaves this viewer's feed at once. No unhide (history has it).
    hiddenAt: v.optional(v.number()),
    commentDraft: v.optional(v.string())
  })
    .index('by_user_and_post', ['userId', 'postId'])
    // Locate rows referencing a given post so account erasure can delete OTHER users' per-post state
    // on the deleted user's posts (not caught by the by_user_and_post drain). See privacy/deletion.ts.
    .index('by_post', ['postId']),

  // Nightly admin cohort snapshots (survival panel). One row per window; the query reads one row
  // instead of re-reading the whole cohort reactively. See jobs/survivalSnapshot.ts.
  survivalSnapshots: defineTable({
    days: v.union(v.literal(7), v.literal(28)),
    generatedAt: v.number(),
    since: v.number(),
    cohort: v.object({
      signups: v.number(),
      startedTrial: v.number(),
      activated: v.number(),
      medianMinutesToFirstInteraction: v.union(v.number(), v.null()),
      returnedDay1: v.number(),
      returnedDays2to7: v.number(),
      trialsEnded: v.number(),
      converted: v.number(),
      canceled: v.number(),
      activatedEligible: v.number(),
      returnedDay1Eligible: v.number(),
      returnedDays2to7Eligible: v.number()
    }),
    payingByTier: v.object({ starter: v.number(), growth: v.number(), pro: v.number(), contact: v.number() })
  }).index('by_days', ['days'])
})
