// convex/dev.ts
// Dev-only tools: user impersonation and email test sends. Every endpoint here is gated by
// ALLOW_DEV_IMPERSONATION, which is set ONLY on the local/dev Convex deployment (MUST be unset in
// production). With the flag absent every call throws before touching the database, so the
// endpoints are inert in prod.
//
// Security: impersonation deliberately mints a session token without OAuth, and the email tools
// send real transactional email on demand. The env flag is the whole boundary — never set it on a
// production deployment.

import { action, env, internalQuery, mutation, query } from './_generated/server'
import { ConvexError, v } from 'convex/values'
import type { Doc } from './_generated/dataModel'
import { internal } from './_generated/api'
import { sessionExpiryFrom } from './sessions'
import { requireAuthAction } from './lib/auth'
import { sendEmail } from './lib/email'
import type { EmailContent } from './lib/email'
import { composeDigest } from './jobs/digest'
import { digestEmail, digestFeatureNote, type DigestInput } from './lib/digestEmails'
import { signUnsubscribeToken } from './lib/unsubscribeToken'
import { resolveBillingLocale, type BillingLocale } from './lib/checkoutCopy'
import {
  duplicateSubscriptionCanceledEmail,
  formatPriceLabel,
  planName,
  postCapReachedEmail,
  trialConvertedEmail,
  trialNearEndEmail
} from './lib/billingEmails'
import { findLiveSubscription, pickTrialingSubscription, TRIAL_INTERACTION_THRESHOLD } from './lib/trialMilestone'
import { effectiveInteractionCap } from './lib/interactionLimit'
import { billingIntervalParam, capNoticeMode } from './lib/postCapNotice'
import { nextTier, type Tier } from './lib/planLimits'
import { excerpt } from './lib/recap'
import { SUPPORT_EMAIL } from './lib/support'

/** Pure flag check (mirrors isAdminShareOverrideEnabled in posts.ts) so the gate is testable. */
export function isDevImpersonationEnabled(envVars: Record<string, string | undefined>): boolean {
  return envVars.ALLOW_DEV_IMPERSONATION === 'true'
}

/** Bounded read: the switcher filters client-side; 500 easily covers a dev database. */
const USER_LIST_LIMIT = 500

const DAY = 86_400_000
/** Bounded scan for the post_cap preview; the newest visible post is never far down this list. */
const RECENT_POST_SCAN = 200

// Public, dev-only: compact user list for the impersonation switcher. Never returns tokens.
export const listUsers = query({
  args: {},
  handler: async ctx => {
    if (!isDevImpersonationEnabled(env)) throw new ConvexError('Dev impersonation is disabled')
    const users = await ctx.db.query('users').take(USER_LIST_LIMIT)
    return users.map(u => ({
      _id: u._id,
      name: u.name,
      email: u.email,
      tier: u.tier,
      subscriptionStatus: u.subscriptionStatus,
      isBanned: u.isBanned === true
    }))
  }
})

// Public, dev-only: mints a fresh 15-day session token for the target user. The client writes it to
// sessionStorage('sessionToken') and reloads — exactly the seed_<key> flow, but for any user.
export const impersonate = mutation({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }) => {
    if (!isDevImpersonationEnabled(env)) throw new ConvexError('Dev impersonation is disabled')
    const user = await ctx.db.get(userId)
    if (!user) throw new ConvexError('User not found')
    const sessionToken = crypto.randomUUID()
    await ctx.db.insert('sessions', { token: sessionToken, userId, expiresAt: sessionExpiryFrom(Date.now()) })
    return { sessionToken, name: user.name }
  }
})

// Internal read for the post_cap preview: the member's newest non-hidden, non-deleted post.
export const getLatestVisiblePost = internalQuery({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }) => {
    const posts = await ctx.db
      .query('posts')
      .withIndex('by_author_and_publishedAt', q => q.eq('authorId', userId))
      .order('desc')
      .take(RECENT_POST_SCAN)
    return posts.find(p => !p.hidden && p.deletedAt === undefined) ?? null
  }
})

const EMAIL_KIND = v.union(
  v.literal('digest'),
  v.literal('digest_sample'),
  v.literal('trial_near_end'),
  v.literal('trial_converted'),
  v.literal('post_cap'),
  v.literal('duplicate_canceled')
)

interface DevEmailResult {
  status: 'sent' | 'skipped' | 'no_email'
  detail?: string
}

async function deliver(to: string, message: EmailContent, headers?: Record<string, string>): Promise<DevEmailResult> {
  const result = await sendEmail({ to, subject: message.subject, html: message.html, text: message.text, headers })
  if (result.sent) return { status: 'sent' }
  return { status: 'skipped', detail: 'email provider not configured (RESEND_API_KEY/EMAIL_FROM unset)' }
}

// Three names per list and mixed zeros, so every digest section (and the fallback subject that a
// member with no received activity gets) renders in one send. No database data involved.
function digestSample(name: string, now: number, locale: BillingLocale, appUrl: string, token: string): DigestInput {
  const people = ['Ana Souza', 'Bruno Lima', 'Carla Mendes']
  return {
    name,
    since: now - 3 * DAY,
    receivedReactions: 0,
    receivedComments: 0,
    madeReactions: 14,
    madeComments: 0,
    topReceived: people.map((n, i) => ({ name: n, count: 4 - i })),
    topMade: people.map((n, i) => ({ name: n, count: 3 - i })),
    siteTopPosters: people.map((n, i) => ({ name: n, count: 6 - 2 * i })),
    siteTopInteractors: people.map((n, i) => ({ name: n, count: 9 - 3 * i })),
    siteTotalInteractions: 184,
    siteActiveMembers: 57,
    myPosition: 12,
    movement: 2,
    featureNote: digestFeatureNote(now, locale),
    peopleUrl: `${appUrl}/people`,
    rankingsUrl: `${appUrl}/rankings`,
    unsubscribeUrl: `${appUrl}/unsubscribe?token=${token}`,
    settingsUrl: `${appUrl}/settings`,
    supportEmail: SUPPORT_EMAIL,
    includePostalAddress: true
  }
}

/**
 * Public, dev-only: sends one of the real transactional emails to the member (or to `to`). Composes
 * through the same builders and data reads as the production paths; only the scheduling gates
 * (isDigestDue, post-cap state) are bypassed so a dev can force each email on demand.
 */
export const sendTestEmail = action({
  args: {
    sessionToken: v.optional(v.string()),
    kind: EMAIL_KIND,
    to: v.optional(v.string())
  },
  handler: async (ctx, { sessionToken, kind, to }): Promise<DevEmailResult> => {
    if (!isDevImpersonationEnabled(env)) throw new ConvexError('Dev impersonation is disabled')
    const user = await requireAuthAction(ctx, sessionToken)
    const recipient = to?.trim() || user.email
    if (!recipient) return { status: 'no_email' }
    const locale = resolveBillingLocale(user.language, user.primaryLocale)
    const appUrl = env.APP_URL ?? 'http://localhost:5173'
    const billingUrl = `${appUrl}/billing`

    switch (kind) {
      case 'digest': {
        const secret = env.UNSUBSCRIBE_SECRET
        if (!secret) return { status: 'skipped', detail: 'UNSUBSCRIBE_SECRET unset' }
        // Forced send: isDigestDue is deliberately skipped. composeDigest still tolerates an empty
        // window, so the fallback subject is reachable from a real member.
        const { message, headers } = await composeDigest(ctx, user, {
          now: Date.now(),
          secret,
          appUrl,
          siteUrl: env.CONVEX_SITE_URL
        })
        return await deliver(recipient, message, headers)
      }
      case 'digest_sample': {
        const secret = env.UNSUBSCRIBE_SECRET
        if (!secret) return { status: 'skipped', detail: 'UNSUBSCRIBE_SECRET unset' }
        const now = Date.now()
        const token = await signUnsubscribeToken(user._id as string, secret)
        return await deliver(recipient, digestEmail(locale, digestSample(user.name, now, locale, appUrl, token)))
      }
      case 'trial_near_end': {
        const c = await ctx.runQuery(internal.billing.getBillingContext, { userId: user._id })
        if (!c || c.subscriptionStatus !== 'trialing') {
          return {
            status: 'skipped',
            detail: `subscription status is ${c?.subscriptionStatus ?? 'unknown'} — needs trialing`
          }
        }
        const sub = pickTrialingSubscription(c.subscriptions)
        const graph = await ctx.runQuery(internal.rankings.getGraphSummary, { userId: user._id })
        const combined = c.made + c.received
        const message = trialNearEndEmail(locale, {
          made: c.made,
          received: c.received,
          remaining: Math.max(0, TRIAL_INTERACTION_THRESHOLD - combined),
          planName: planName(locale, sub?.tier ?? c.tier ?? 'starter'),
          priceLabel: formatPriceLabel(locale, {
            amount: sub?.priceAmount,
            currency: sub?.priceCurrency,
            interval: sub?.priceInterval
          }),
          billingUrl,
          peopleMade: graph?.peopleMade,
          peopleReceived: graph?.peopleReceived,
          receivedReactions: graph?.receivedReactions,
          receivedComments: graph?.receivedComments,
          position: graph?.position,
          gapToNext: graph?.gapToNext
        })
        return await deliver(recipient, message)
      }
      case 'trial_converted': {
        const c = await ctx.runQuery(internal.billing.getBillingContext, { userId: user._id })
        if (!c || c.subscriptionStatus !== 'active') {
          return {
            status: 'skipped',
            detail: `subscription status is ${c?.subscriptionStatus ?? 'unknown'} — needs active`
          }
        }
        const sub = findLiveSubscription(c.subscriptions)
        const message = trialConvertedEmail(locale, {
          made: c.made,
          received: c.received,
          planName: planName(locale, sub?.tier ?? c.tier ?? 'starter'),
          priceLabel: formatPriceLabel(locale, {
            amount: sub?.priceAmount,
            currency: sub?.priceCurrency,
            interval: sub?.priceInterval
          }),
          recapUrl: `${appUrl}/recap`
        })
        return await deliver(recipient, message)
      }
      case 'post_cap': {
        const post: Doc<'posts'> | null = await ctx.runQuery(internal.dev.getLatestVisiblePost, {
          userId: user._id
        })
        if (!post) return { status: 'skipped', detail: 'member has no visible post' }
        const c = await ctx.runQuery(internal.billing.getBillingContext, { userId: user._id })
        const tier: Tier = c?.tier ?? user.tier ?? 'starter'
        const limits = await ctx.runQuery(internal.lib.planLimitsQuery.getPlanLimits, { userId: user._id, tier })
        const cap = effectiveInteractionCap(limits.interactionsPerPost, post.interactionCapBonus)
        const next = nextTier(tier)
        const nextLimits = next
          ? await ctx.runQuery(internal.lib.planLimitsQuery.getPlanLimits, { userId: user._id, tier: next })
          : null
        const mode = capNoticeMode(tier, limits.interactionsPerPost, nextLimits?.interactionsPerPost)
        const live = findLiveSubscription(c?.subscriptions ?? [])
        const graph = await ctx.runQuery(internal.rankings.getGraphSummary, { userId: user._id })
        const message = postCapReachedEmail(locale, {
          excerpt: excerpt(post.content),
          total: post.likeCount + post.commentCount,
          cap,
          mode,
          nextPlanName: next ? planName(locale, next) : undefined,
          nextCap: nextLimits?.interactionsPerPost,
          upgradeUrl: next
            ? `${appUrl}/billing?plan=${next}&interval=${billingIntervalParam(live?.priceInterval)}&src=cap_email`
            : undefined,
          myPostsUrl: `${appUrl}/my-posts`,
          supportEmail: SUPPORT_EMAIL,
          position: graph?.position,
          gapToNext: graph?.gapToNext
        })
        return await deliver(recipient, message)
      }
      case 'duplicate_canceled': {
        const c = await ctx.runQuery(internal.billing.getBillingContext, { userId: user._id })
        const message = duplicateSubscriptionCanceledEmail(locale, {
          planName: planName(locale, c?.tier ?? user.tier ?? 'starter'),
          billingUrl
        })
        return await deliver(recipient, message)
      }
    }
  }
})

// Public, dev-only: the member's signed unsubscribe URL (same signing as the digest job), for
// manually exercising the unsubscribe flow without waiting for an email. No email is sent.
export const getUnsubscribeLink = action({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, { sessionToken }) => {
    if (!isDevImpersonationEnabled(env)) throw new ConvexError('Dev impersonation is disabled')
    const user = await requireAuthAction(ctx, sessionToken)
    const secret = env.UNSUBSCRIBE_SECRET
    if (!secret) throw new ConvexError('UNSUBSCRIBE_SECRET unset')
    const token = await signUnsubscribeToken(user._id as string, secret)
    return { url: `${env.APP_URL ?? 'http://localhost:5173'}/unsubscribe?token=${token}` }
  }
})
