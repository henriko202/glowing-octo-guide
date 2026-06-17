// convex/lib/feedRank.ts
// Denormalized feed-ordering fields for cursor pagination (see
// docs/feed-cursor-pagination-plan.md). `computeFeedFields` is the SINGLE source of
// truth for a post's `feedRank` + `inFeed`; every writer that touches a post calls it
// so the two fields can never drift from the post's real state.

import type { MutationCtx } from '../_generated/server'
import type { Id } from '../_generated/dataModel'

/**
 * Encodes the feed's effective sort order into one descending-sortable number:
 *   1. featured posts first (ordered by publishedAt),
 *   2. then regular posts by authorTierRank desc, then publishedAt desc.
 *
 * `TIER_WEIGHT` (1e13) exceeds any realistic `publishedAt` (~1.7e12 ms today, < 2e12
 * for decades), so tier dominates recency for regular posts. `FEATURED_BASE` (1e15)
 * sits above the maximum regular value (4·TIER_WEIGHT + publishedAt ≈ 4.2e13), so every
 * featured post outranks every regular post. The largest value produced (~1.002e15) is
 * well under 2^53 (≈9.007e15), so every feedRank is an exact Float64 integer and adjacent
 * millisecond timestamps never collide.
 */
export const TIER_WEIGHT = 1e13
export const FEATURED_BASE = 1e15

export interface FeedFieldInputs {
  isFeatured: boolean
  publishedAt: number
  // Numeric rank of the author's tier at write time (contact=4…starter=1). Optional —
  // posts written before this field existed default to starter rank.
  authorTierRank?: number
  hidden: boolean
  interactionLimitReached?: boolean
  deletedAt?: number
}

export interface FeedFields {
  feedRank: number
  inFeed: boolean
}

/**
 * Derives the denormalized feed fields for a post. Pure — no DB access — so the ordering
 * rule and the eligibility rule are unit-tested in one place and reused by every writer.
 *
 * `inFeed` mirrors exactly the non-viewer-specific structural filters the legacy feed
 * applied in memory: visible (`hidden === false`), under its interaction limit, and not
 * soft-deleted. Viewer-/author-dependent filters (visibility lists, industry/country,
 * trial/deletion eligibility) stay per-request and are NOT encoded here.
 */
export function computeFeedFields(post: FeedFieldInputs): FeedFields {
  const tierRank = post.authorTierRank ?? 1
  const feedRank = post.isFeatured ? FEATURED_BASE + post.publishedAt : tierRank * TIER_WEIGHT + post.publishedAt
  const inFeed = post.hidden === false && post.interactionLimitReached !== true && post.deletedAt === undefined
  return { feedRank, inFeed }
}

/**
 * Re-stamps `authorTierRank` and the denormalized feed fields (`feedRank`, `inFeed`) on every
 * post by a user after their tier changes. Single source of truth shared by all tier-change
 * paths — Stripe `syncUserSubscription`/`cancelUserSubscription` AND the admin `setUserTier`
 * override — so a post's stored tier rank can never lag the user's real tier.
 *
 * Reads the user's posts once and patches them in a single pass. When `unhideHidden` is set
 * (subscription became active), hidden posts are also un-hidden, which flips their `inFeed`.
 */
export async function restampUserPostsTierRank(
  ctx: MutationCtx,
  userId: Id<'users'>,
  authorTierRank: number,
  opts: { unhideHidden?: boolean } = {}
): Promise<void> {
  const posts = await ctx.db
    .query('posts')
    .withIndex('by_author', q => q.eq('authorId', userId))
    .collect()
  await Promise.all(
    posts.map(p => {
      const willUnhide = opts.unhideHidden === true && p.hidden
      const feed = computeFeedFields({
        isFeatured: p.isFeatured,
        publishedAt: p.publishedAt,
        authorTierRank,
        hidden: willUnhide ? false : p.hidden,
        interactionLimitReached: p.interactionLimitReached,
        deletedAt: p.deletedAt
      })
      const fields: { authorTierRank: number; hidden?: boolean; feedRank: number; inFeed: boolean } = {
        authorTierRank,
        ...feed
      }
      if (willUnhide) fields.hidden = false
      return ctx.db.patch(p._id, fields)
    })
  )
}
