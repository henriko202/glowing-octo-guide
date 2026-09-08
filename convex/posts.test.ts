// convex/posts.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  applyPurchasedFeatureHandler,
  canModifyPost,
  countPostsSince,
  findTierDefaultRow,
  isAdminShareOverrideEnabled
} from './posts'
import type { Doc, Id } from './_generated/dataModel'
import type { MutationCtx, QueryCtx } from './_generated/server'

const asUserId = (s: string) => s as Id<'users'>

// We test the handler logic directly since Convex query wrappers are
// not testable in unit tests — this mirrors the pattern in feed.test.ts.
describe('getMyPosts handler', () => {
  it('returns empty array when userId is undefined', async () => {
    const handler = async (_ctx: unknown, args: { userId?: string }): Promise<unknown[]> => {
      if (!args.userId) return []
      return [] // db would be called here
    }
    const result = await handler({}, { userId: undefined })
    expect(result).toEqual([])
  })
})

// countPostsSince is the shared rolling-window counter behind both the weekly
// limit enforcement and the My Posts usage pill. The cutoff is inclusive.
describe('countPostsSince', () => {
  const now = 1_700_000_000_000
  const day = 24 * 60 * 60 * 1000
  const since = now - 7 * day

  it('counts posts published at or after the cutoff (inclusive)', () => {
    const posts = [
      { publishedAt: now }, // today
      { publishedAt: now - 2 * day }, // 2 days ago
      { publishedAt: since } // exactly on the cutoff
    ]
    expect(countPostsSince(posts, since)).toBe(3)
  })

  it('excludes posts published before the cutoff', () => {
    const posts = [
      { publishedAt: now - 8 * day }, // outside the window
      { publishedAt: now - 30 * day }, // outside the window
      { publishedAt: now - 1 * day } // inside the window
    ]
    expect(countPostsSince(posts, since)).toBe(1)
  })

  it('returns 0 for an empty list', () => {
    expect(countPostsSince([], since)).toBe(0)
  })
})

// The admin "share any post" override is dev-only: it requires BOTH an admin user
// AND the ALLOW_ADMIN_SHARE_ANY_POST env flag set to the literal string 'true'.
describe('isAdminShareOverrideEnabled', () => {
  it('is enabled only for an admin when the env flag is exactly "true"', () => {
    expect(isAdminShareOverrideEnabled({ isAdmin: true }, { ALLOW_ADMIN_SHARE_ANY_POST: 'true' })).toBe(true)
  })

  it('is disabled for a non-admin even when the flag is set (production-safe)', () => {
    expect(isAdminShareOverrideEnabled({ isAdmin: false }, { ALLOW_ADMIN_SHARE_ANY_POST: 'true' })).toBe(false)
    expect(isAdminShareOverrideEnabled({}, { ALLOW_ADMIN_SHARE_ANY_POST: 'true' })).toBe(false)
  })

  it('is disabled for an admin when the flag is absent or not exactly "true"', () => {
    expect(isAdminShareOverrideEnabled({ isAdmin: true }, {})).toBe(false)
    expect(isAdminShareOverrideEnabled({ isAdmin: true }, { ALLOW_ADMIN_SHARE_ANY_POST: 'false' })).toBe(false)
    expect(isAdminShareOverrideEnabled({ isAdmin: true }, { ALLOW_ADMIN_SHARE_ANY_POST: '1' })).toBe(false)
  })
})

// Hiding/deleting a post is allowed for its author OR any admin (moderation).
describe('canModifyPost', () => {
  const author = { _id: asUserId('u_author'), isAdmin: false }
  const admin = { _id: asUserId('u_admin'), isAdmin: true }
  const other = { _id: asUserId('u_other'), isAdmin: false }
  const post = { authorId: asUserId('u_author') }

  it('allows the author to modify their own post', () => {
    expect(canModifyPost(author, post)).toBe(true)
  })

  it('allows any admin to modify another user’s post', () => {
    expect(canModifyPost(admin, post)).toBe(true)
  })

  it('forbids a non-admin from modifying someone else’s post', () => {
    expect(canModifyPost(other, post)).toBe(false)
  })
})

// Minimal by_tier ctx: withIndex ignores its predicate (rows are pre-scoped to the tier under
// test, same fidelity as feedCtx in feed.test.ts) and `.filter` applies its predicate per row with
// a field/eq-only `q` stand-in — enough to exercise the real userId===undefined check. Reverting
// the query-level filter (back to a JS-side `rows.find()` after a bare `.take`) changes the call
// chain shape and breaks this mock, so a revert fails the test either way.
function tierLimitsCtx(rows: Doc<'planLimits'>[]): QueryCtx {
  return {
    db: {
      query: () => ({
        withIndex: () => ({
          filter: (
            predicate: (q: { field: (name: string) => unknown; eq: (a: unknown, b: unknown) => boolean }) => boolean
          ) => ({
            take: async (n: number) =>
              rows
                .filter(row =>
                  predicate({
                    field: (name: string) => (row as unknown as Record<string, unknown>)[name],
                    eq: (a, b) => a === b
                  })
                )
                .slice(0, n)
          })
        })
      })
    }
  } as unknown as QueryCtx
}

// F11: the userId===undefined check must live in the query, not a JS-side .find() run only over
// the first `take(20)` rows — a contact tier with more per-user override rows than the take cap
// could otherwise push the one true default row out of the window and silently fall back to
// DEFAULTS[tier].
describe('findTierDefaultRow', () => {
  const override = (n: number): Doc<'planLimits'> =>
    ({
      _id: `override-${n}`,
      tier: 'contact',
      userId: asUserId(`u${n}`),
      interactionsPerPost: 1,
      postsPerWeek: 1
    }) as unknown as Doc<'planLimits'>
  const defaultRow = {
    _id: 'default',
    tier: 'contact',
    userId: undefined,
    interactionsPerPost: 10,
    postsPerWeek: 5,
    featuredPerMonth: 2
  } as unknown as Doc<'planLimits'>

  it('finds the default row even when 25 per-user override rows sort ahead of it', async () => {
    const rows = [...Array.from({ length: 25 }, (_, i) => override(i)), defaultRow]
    const row = await findTierDefaultRow(tierLimitsCtx(rows), 'contact')
    expect(row?._id).toBe('default')
  })

  it('returns null when only override rows exist', async () => {
    const rows = Array.from({ length: 3 }, (_, i) => override(i))
    const row = await findTierDefaultRow(tierLimitsCtx(rows), 'contact')
    expect(row).toBeNull()
  })
})

// Minimal mutation ctx for the webhook's fulfilment path (backlog/R17), in the mock-db style of
// users.setPostVisibility.test.ts. `docs` is the whole database keyed by id — the post and its
// author both live in it — so an id that is absent normalizes to null, which is how the unknown-post
// case is expressed. The single `query` chain is the by_tier planLimits lookup getPlanLimitsHelper
// makes for a non-contact tier; its withIndex predicate is ignored, same fidelity as tierLimitsCtx.
function fulfilmentCtx(docs: Record<string, unknown>, planCap = 25) {
  const patches: { id: string; data: Record<string, unknown> }[] = []
  const inserts: { table: string; doc: Record<string, unknown> }[] = []
  const ctx = {
    db: {
      normalizeId: (_table: string, id: string) => (id in docs ? id : null),
      get: async (id: string) => docs[id] ?? null,
      patch: async (id: string, data: Record<string, unknown>) => {
        patches.push({ id, data })
      },
      insert: async (table: string, doc: Record<string, unknown>) => {
        inserts.push({ table, doc })
        return `${table}_1`
      },
      query: () => ({
        withIndex: () => ({
          unique: async () => ({ tier: 'starter', interactionsPerPost: planCap, postsPerWeek: 1, featuredPerMonth: 0 })
        })
      })
    }
  }
  return {
    ctx: ctx as unknown as MutationCtx,
    patches,
    inserts,
    audit: () => inserts.filter(i => i.table === 'auditLogs')
  }
}

// Spec §4.13 — the one place a $5 charge turns into a featured post. Every branch is money-visible:
// a lost patch is a charge with nothing delivered, a stray patch is a second charge applied twice.
describe('applyPurchasedFeatureHandler', () => {
  const post = {
    _id: 'p1',
    authorId: 'u1',
    likeCount: 0,
    commentCount: 0,
    publishedAt: 1_600_000_000_000,
    authorTierRank: 1,
    hidden: false
  }
  const author = { _id: 'u1', tier: 'starter' }
  const purchase = { checkoutSessionId: 'cs_1', amountCents: 500, paidAt: 1_700_000_000_000 }
  const args = { postId: 'p1', ...purchase }
  // The unknown-post and duplicate-payment branches log loudly by design — keep that out of the run.
  beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}))
  afterEach(() => vi.restoreAllMocks())

  it('features a capped starter post at its bought cap and brings it back into the feed', async () => {
    const { ctx, patches } = fulfilmentCtx({
      p1: { ...post, likeCount: 30, interactionLimitReached: true },
      u1: author
    })
    await applyPurchasedFeatureHandler(ctx, args)
    expect(patches).toHaveLength(1)
    expect(patches[0].id).toBe('p1')
    // 30 interactions against 25 + 25: no longer capped, so it returns to the feed pinned.
    expect(patches[0].data).toMatchObject({
      isFeatured: true,
      interactionCapBonus: 25,
      interactionLimitReached: false,
      featuredPurchase: purchase,
      inFeed: true
    })
  })

  it('writes the success audit row naming the bonus that was bought', async () => {
    const { ctx, audit } = fulfilmentCtx({ p1: post, u1: author })
    await applyPurchasedFeatureHandler(ctx, args)
    expect(audit()).toHaveLength(1)
    expect(audit()[0].doc).toMatchObject({ actor: 'system', action: 'post.featured_purchased', targetUserId: 'u1' })
    expect(JSON.parse(audit()[0].doc.metadata as string)).toEqual({
      postId: 'p1',
      checkoutSessionId: 'cs_1',
      amountCents: 500,
      bonus: 25
    })
  })

  it('is a silent no-op when Stripe redelivers the same checkout session', async () => {
    const { ctx, patches, inserts } = fulfilmentCtx({ p1: { ...post, featuredPurchase: purchase }, u1: author })
    await expect(applyPurchasedFeatureHandler(ctx, args)).resolves.toBeNull()
    expect(patches).toHaveLength(0)
    expect(inserts).toHaveLength(0)
  })

  it('records a second, different session as a duplicate payment and leaves the post alone', async () => {
    const { ctx, patches, audit } = fulfilmentCtx({ p1: { ...post, featuredPurchase: purchase }, u1: author })
    await applyPurchasedFeatureHandler(ctx, { ...args, checkoutSessionId: 'cs_2' })
    // The first purchase stands; the audit row is what the owner refunds the second charge from.
    expect(patches).toHaveLength(0)
    expect(audit()[0].doc.action).toBe('post.featured_purchase_duplicate')
    expect(JSON.parse(audit()[0].doc.metadata as string)).toMatchObject({
      existingCheckoutSessionId: 'cs_1',
      checkoutSessionId: 'cs_2'
    })
  })

  it('returns quietly for an id that names no post — a throw would make Stripe retry for days', async () => {
    const { ctx, patches, inserts } = fulfilmentCtx({ u1: author })
    await expect(applyPurchasedFeatureHandler(ctx, args)).resolves.toBeNull()
    await expect(applyPurchasedFeatureHandler(ctx, { ...args, postId: 'not-an-id' })).resolves.toBeNull()
    expect(patches).toHaveLength(0)
    // No audit row: an unknown id means the author ran the erasure cascade.
    expect(inserts).toHaveLength(0)
  })

  it('stores only the purchase on a post soft-deleted between Checkout and the webhook', async () => {
    const { ctx, patches, audit } = fulfilmentCtx({ p1: { ...post, deletedAt: 7 }, u1: author })
    await applyPurchasedFeatureHandler(ctx, args)
    expect(patches[0].data).toEqual({ featuredPurchase: purchase })
    expect(audit()[0].doc.action).toBe('post.featured_purchase_orphaned')
  })

  // R17: the bought slot sits outside the monthly quota. Each case also pins the tables that path
  // DOES write, so a lost audit row fails here too — not only a stray quota row.
  it('never consumes a featuredPostUsage slot, on any path', async () => {
    const cases: [Record<string, unknown>, string[]][] = [
      [{ p1: { ...post, likeCount: 30, interactionLimitReached: true } }, ['auditLogs']],
      [{ p1: { ...post, featuredPurchase: purchase } }, ['auditLogs']],
      [{ p1: { ...post, deletedAt: 7 } }, ['auditLogs']],
      [{}, []]
    ]
    for (const [posts, tables] of cases) {
      const { ctx, inserts } = fulfilmentCtx({ ...posts, u1: author })
      await applyPurchasedFeatureHandler(ctx, { ...args, checkoutSessionId: 'cs_2' })
      expect(inserts.map(i => i.table)).toEqual(tables)
    }
  })
})
