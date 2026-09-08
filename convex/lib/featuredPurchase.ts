// The pure decisions behind the $5 featured-post add-on (backlog/revenue/R17). No ctx, no Stripe
// types: the action, the internal query and the webhook mutation pass plain shapes in, so every
// branch is unit-tested without a database (featuredPurchase.test.ts).
import type { Doc } from '../_generated/dataModel'
import { computeFeedFields } from './feedRank'
import { effectiveInteractionCap, hasReachedInteractionLimit } from './interactionLimit'
import { FEATURED_CAP_BONUS, type Tier } from './planLimits'

export type FeaturedPurchase = { checkoutSessionId: string; amountCents: number; paidAt: number }

export type FeaturedPurchaseBlocker = 'POST_NOT_FOUND' | 'ALREADY_PURCHASED' | 'NOTHING_TO_BUY'

/**
 * Why `userId` cannot buy a featured slot for `post` right now, or null when they can. A missing,
 * soft-deleted or someone else's post all read POST_NOT_FOUND, so the answer never confirms that
 * a post id exists. What the $5 buys is the cap bonus, so a tier whose bonus is 0 (contact) has
 * nothing to buy — keyed on the bonus itself, not on the unlimited featured quota that happens to
 * coincide with it today.
 */
export function featuredPurchaseBlocker(
  post: { authorId: string; deletedAt?: number; featuredPurchase?: FeaturedPurchase } | null,
  userId: string,
  tier: Tier
): FeaturedPurchaseBlocker | null {
  if (!post || post.authorId !== userId || post.deletedAt !== undefined) return 'POST_NOT_FOUND'
  if (post.featuredPurchase) return 'ALREADY_PURCHASED'
  if (FEATURED_CAP_BONUS[tier] === 0) return 'NOTHING_TO_BUY'
  return null
}

/** The webhook's filter: only a PAID one-time Checkout tagged by billingNode.purchaseFeaturedPost. */
export function isFeaturedPostCheckout(session: {
  mode?: string
  payment_status?: string
  metadata?: Record<string, string> | null
}): boolean {
  return session.mode === 'payment' && session.payment_status === 'paid' && session.metadata?.kind === 'featured_post'
}

export type FulfilmentAction = 'apply' | 'replay' | 'duplicate_payment'

/** Stripe redelivers `checkout.session.completed`; the same session id is a replay, a different one is a second payment. */
export function fulfilmentAction(existing: FeaturedPurchase | undefined, sessionId: string): FulfilmentAction {
  if (!existing) return 'apply'
  return existing.checkoutSessionId === sessionId ? 'replay' : 'duplicate_payment'
}

export type PurchasedFeatureOutcome = {
  patch: Partial<Doc<'posts'>>
  action: 'post.featured_purchased' | 'post.featured_purchase_orphaned'
}

/**
 * What fulfilment writes onto the post. A post deleted between Checkout and the webhook keeps
 * only the purchase record (the money exists; the audit row says why nothing was featured).
 * Otherwise the post is featured with its tier's bonus and `interactionLimitReached` is
 * re-decided against the bigger cap, so a capped post comes back into the feed at the top.
 */
export function purchasedFeaturePatch(input: {
  post: Pick<Doc<'posts'>, 'likeCount' | 'commentCount' | 'publishedAt' | 'authorTierRank' | 'hidden' | 'deletedAt'>
  tier: Tier
  planCap: number
  purchase: FeaturedPurchase
  now: number
}): PurchasedFeatureOutcome {
  const { post, tier, planCap, purchase, now } = input
  if (post.deletedAt !== undefined) {
    return { patch: { featuredPurchase: purchase }, action: 'post.featured_purchase_orphaned' }
  }
  const bonus = FEATURED_CAP_BONUS[tier]
  const reached = hasReachedInteractionLimit(post.likeCount, post.commentCount, effectiveInteractionCap(planCap, bonus))
  const feed = computeFeedFields({
    isFeatured: true,
    publishedAt: post.publishedAt,
    authorTierRank: post.authorTierRank,
    hidden: post.hidden,
    interactionLimitReached: reached,
    deletedAt: undefined
  })
  return {
    patch: {
      isFeatured: true,
      featuredAt: now,
      interactionCapBonus: bonus,
      interactionLimitReached: reached,
      featuredPurchase: purchase,
      ...feed
    },
    action: 'post.featured_purchased'
  }
}
