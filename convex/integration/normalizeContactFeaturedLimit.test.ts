/// <reference types="vite/client" />
import { convexTest } from 'convex-test'
import { describe, expect, test } from 'vitest'
import { internal } from '../_generated/api'
import type { TestConvex } from 'convex-test'
import type { Id } from '../_generated/dataModel'
import schema from '../schema'

// The real generated modules — this config has no `convex/server` alias, so functions run against
// the real convex-test backend (validators, indexes, transactions) instead of the unit mock shim.
const modules = import.meta.glob('../**/*.ts')

type T = TestConvex<typeof schema>

const normalize = internal.migrations.normalizeContactFeaturedLimit.normalizeContactFeaturedLimit
const SENTINEL = 9999

async function insertUser(t: T, linkedinId: string): Promise<Id<'users'>> {
  return t.run(async ctx =>
    ctx.db.insert('users', {
      linkedinId,
      name: 'Contact User',
      tier: 'contact',
      subscriptionStatus: 'active',
      createdAt: Date.now()
    })
  )
}

async function insertPlanLimits(
  t: T,
  row: {
    tier: 'starter' | 'growth' | 'pro' | 'contact'
    userId?: Id<'users'>
    interactionsPerPost: number
    postsPerWeek: number
    featuredPerMonth?: number
  }
): Promise<Id<'planLimits'>> {
  return t.run(async ctx => ctx.db.insert('planLimits', row))
}

async function allRows(t: T) {
  return t.run(async ctx => ctx.db.query('planLimits').collect())
}

describe('migrations.normalizeContactFeaturedLimit', () => {
  test('patches the contact tier-default row from the 9999 sentinel to the finite 5', async () => {
    const t = convexTest(schema, modules)
    await insertPlanLimits(t, {
      tier: 'contact',
      interactionsPerPost: 200,
      postsPerWeek: 5,
      featuredPerMonth: SENTINEL
    })
    await insertPlanLimits(t, {
      tier: 'starter',
      interactionsPerPost: 25,
      postsPerWeek: 1,
      featuredPerMonth: 0
    })

    const updated = await t.mutation(normalize, {})

    expect(updated).toBe(1)
    const rows = await allRows(t)
    const contact = rows.find(r => r.tier === 'contact')
    expect(contact?.featuredPerMonth).toBe(5)
    // Other tiers are untouched.
    expect(rows.find(r => r.tier === 'starter')?.featuredPerMonth).toBe(0)
  })

  test('leaves per-user override rows untouched, including an admin-granted 9999', async () => {
    const t = convexTest(schema, modules)
    const userId = await insertUser(t, 'li-contact-override')
    await insertPlanLimits(t, {
      tier: 'contact',
      interactionsPerPost: 200,
      postsPerWeek: 5,
      featuredPerMonth: SENTINEL
    })
    await insertPlanLimits(t, {
      tier: 'contact',
      userId,
      interactionsPerPost: 500,
      postsPerWeek: 10,
      featuredPerMonth: SENTINEL
    })

    const updated = await t.mutation(normalize, {})

    // Only the one tier-default row changed.
    expect(updated).toBe(1)
    const rows = await allRows(t)
    expect(rows.find(r => r.userId === undefined)?.featuredPerMonth).toBe(5)
    expect(rows.find(r => r.userId === userId)?.featuredPerMonth).toBe(SENTINEL)
  })

  test('is idempotent and no-ops when the default row is already finite or missing', async () => {
    const t = convexTest(schema, modules)
    await insertPlanLimits(t, {
      tier: 'contact',
      interactionsPerPost: 200,
      postsPerWeek: 5,
      featuredPerMonth: SENTINEL
    })

    expect(await t.mutation(normalize, {})).toBe(1)
    expect(await t.mutation(normalize, {})).toBe(0)
    expect((await allRows(t))[0].featuredPerMonth).toBe(5)

    // No default row at all (fresh/legacy environment): still a no-op, never a throw.
    const empty = convexTest(schema, modules)
    expect(await empty.mutation(normalize, {})).toBe(0)

    // An undefined featuredPerMonth already coalesces to the new default via getPlanLimitsHelper,
    // so the migration leaves it alone.
    const legacy = convexTest(schema, modules)
    await insertPlanLimits(legacy, { tier: 'contact', interactionsPerPost: 200, postsPerWeek: 5 })
    expect(await legacy.mutation(normalize, {})).toBe(0)
  })
})
