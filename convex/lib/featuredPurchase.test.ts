import { describe, expect, it } from 'vitest'
import {
  featuredPurchaseBlocker,
  fulfilmentAction,
  isFeaturedPostCheckout,
  purchasedFeaturePatch
} from './featuredPurchase'

const purchase = { checkoutSessionId: 'cs_1', amountCents: 500, paidAt: 1_700_000_000_000 }
const base = {
  likeCount: 0,
  commentCount: 0,
  publishedAt: 1_600_000_000_000,
  authorTierRank: 1,
  hidden: false,
  deletedAt: undefined
}

describe('featuredPurchaseBlocker', () => {
  it('lets the author of a live, never-bought post buy', () => {
    expect(featuredPurchaseBlocker({ authorId: 'u1' }, 'u1', 'starter')).toBeNull()
  })

  it('reads a missing, deleted or foreign post as not found — no ownership leak', () => {
    expect(featuredPurchaseBlocker(null, 'u1', 'starter')).toBe('POST_NOT_FOUND')
    expect(featuredPurchaseBlocker({ authorId: 'u1', deletedAt: 1 }, 'u1', 'starter')).toBe('POST_NOT_FOUND')
    expect(featuredPurchaseBlocker({ authorId: 'u2' }, 'u1', 'starter')).toBe('POST_NOT_FOUND')
  })

  it('refuses a second purchase of the same post', () => {
    expect(featuredPurchaseBlocker({ authorId: 'u1', featuredPurchase: purchase }, 'u1', 'starter')).toBe(
      'ALREADY_PURCHASED'
    )
  })

  // The $5 buys the cap bonus, so the tier with no bonus is the tier with nothing to sell. Every
  // other tier stays buyable — the blocker must not read "unlimited featured quota" as "no bonus".
  it('gives the zero-bonus tier (contact) nothing to buy, and no one else', () => {
    expect(featuredPurchaseBlocker({ authorId: 'u1' }, 'u1', 'contact')).toBe('NOTHING_TO_BUY')
    for (const tier of ['starter', 'growth', 'pro'] as const) {
      expect(featuredPurchaseBlocker({ authorId: 'u1' }, 'u1', tier)).toBeNull()
    }
  })
})

describe('isFeaturedPostCheckout', () => {
  it('accepts only a paid, payment-mode session tagged featured_post', () => {
    const paid = { mode: 'payment', payment_status: 'paid', metadata: { kind: 'featured_post' } }
    expect(isFeaturedPostCheckout(paid)).toBe(true)
    expect(isFeaturedPostCheckout({ ...paid, mode: 'subscription' })).toBe(false)
    expect(isFeaturedPostCheckout({ ...paid, payment_status: 'unpaid' })).toBe(false)
    expect(isFeaturedPostCheckout({ ...paid, metadata: null })).toBe(false)
    expect(isFeaturedPostCheckout({ ...paid, metadata: { kind: 'other' } })).toBe(false)
  })
})

describe('fulfilmentAction', () => {
  it('is a first purchase when the post carries none yet', () => {
    expect(fulfilmentAction(undefined, 'cs_1')).toBe('apply')
  })

  it('is a replay when Stripe redelivers the same checkout session', () => {
    expect(fulfilmentAction(purchase, 'cs_1')).toBe('replay')
  })

  it('is a duplicate payment when a second, different session pays for an already-purchased post', () => {
    expect(fulfilmentAction(purchase, 'cs_2')).toBe('duplicate_payment')
  })
})

describe('purchasedFeaturePatch', () => {
  it('features a live post with its tier bonus and brings a capped post back into the feed', () => {
    // A starter post that already hit 25: against 25 + 25 it is no longer capped.
    const { patch, action } = purchasedFeaturePatch({
      post: { ...base, likeCount: 25 },
      tier: 'starter',
      planCap: 25,
      purchase,
      now: 42
    })
    expect(action).toBe('post.featured_purchased')
    expect(patch).toMatchObject({
      isFeatured: true,
      featuredAt: 42,
      interactionCapBonus: 25,
      interactionLimitReached: false,
      featuredPurchase: purchase,
      inFeed: true
    })
  })

  it('features a live post with the pro tier bonus', () => {
    const { patch, action } = purchasedFeaturePatch({
      post: { ...base, likeCount: 0 },
      tier: 'pro',
      planCap: 200,
      purchase,
      now: 42
    })
    expect(action).toBe('post.featured_purchased')
    expect(patch).toMatchObject({
      isFeatured: true,
      featuredAt: 42,
      interactionCapBonus: 100,
      interactionLimitReached: false,
      featuredPurchase: purchase,
      inFeed: true
    })
  })

  it('keeps a post capped when it already passed the bigger cap', () => {
    const { patch } = purchasedFeaturePatch({
      post: { ...base, likeCount: 60 },
      tier: 'starter',
      planCap: 25,
      purchase,
      now: 42
    })
    expect(patch.interactionLimitReached).toBe(true)
    expect(patch.inFeed).toBe(false)
  })

  // MyPostsPage's canBuy hides the control on a hidden post because a bought one would still not
  // reach the feed — this is the claim that comment cites.
  it('features a hidden post but keeps it out of the feed', () => {
    const { patch } = purchasedFeaturePatch({
      post: { ...base, hidden: true },
      tier: 'growth',
      planCap: 50,
      purchase,
      now: 42
    })
    expect(patch).toMatchObject({ isFeatured: true, interactionCapBonus: 50, inFeed: false })
  })

  it('stores only the purchase on a post deleted before the webhook arrived', () => {
    const { patch, action } = purchasedFeaturePatch({
      post: { ...base, deletedAt: 7 },
      tier: 'growth',
      planCap: 50,
      purchase,
      now: 42
    })
    expect(action).toBe('post.featured_purchase_orphaned')
    expect(patch).toEqual({ featuredPurchase: purchase })
  })
})
