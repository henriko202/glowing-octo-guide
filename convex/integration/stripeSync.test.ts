/// <reference types="vite/client" />
import type { TestConvex } from 'convex-test'
import { convexTest } from 'convex-test'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { internal } from '../_generated/api'
import schema from '../schema'

// What the Stripe subscription webhooks leave on the member, fed in the orders Stripe really delivers them. Checkout
// creates a direct (no-trial) subscription once its first payment succeeds, so it is born `active`; one made through
// the API or the Dashboard is born `incomplete` and goes `active` on the `updated` that follows its first payment,
// often in the same second; a trial's is born `trialing`.
const modules = import.meta.glob('../**/*.ts')
type T = TestConvex<typeof schema>
const CUSTOMER = 'cus_member'
const T0 = 1_790_000_000_000

beforeEach(() => {
  // Keeps runAfter(0) jobs pending, so the cancel a sync schedules is inspected rather than run against Stripe.
  vi.useFakeTimers()
  // Every ignored event logs on purpose; keep the test output readable.
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

async function member(t: T) {
  return t.run(ctx =>
    ctx.db.insert('users', {
      linkedinId: 'li-member',
      name: 'Ana Lima',
      subscriptionStatus: 'none',
      createdAt: T0,
      stripeCustomerId: CUSTOMER
    })
  )
}

// One customer.subscription.* event, as syncArgs shapes it: the subscription's own `created`, and the event's (`at`).
function sync(t: T, sub: string, status: string, tier: 'starter' | 'growth' | 'pro', created: number, at = created) {
  return t.mutation(internal.stripe.syncUserSubscription, {
    stripeCustomerId: CUSTOMER,
    stripeSubscriptionId: sub,
    tier,
    status,
    stripeCreated: created,
    eventCreated: at
  })
}

function state(t: T) {
  return t.run(async ctx => {
    const user = await ctx.db.query('users').first()
    const rows = await ctx.db.query('subscriptions').collect()
    const jobs = await ctx.db.system.query('_scheduled_functions').collect()
    return {
      user: { tier: user?.tier, status: user?.subscriptionStatus },
      rows: Object.fromEntries(rows.map(r => [r.stripeSubscriptionId, r.status])),
      voids: jobs.filter(j => j.name === 'billingNode:cancelDuplicateSubscription').map(j => j.args[0])
    }
  })
}

describe('a direct checkout', () => {
  test('goes live on the paid update', async () => {
    const t = convexTest(schema, modules)
    await member(t)
    await sync(t, 'sub_a', 'incomplete', 'growth', T0)
    expect((await state(t)).user).toEqual({ tier: 'growth', status: 'none' })
    await sync(t, 'sub_a', 'active', 'growth', T0)
    expect(await state(t)).toEqual({ user: { tier: 'growth', status: 'active' }, rows: { sub_a: 'active' }, voids: [] })
  })

  test('stays live when its incomplete created lands after its active update in the same second', async () => {
    const t = convexTest(schema, modules)
    await member(t)
    await sync(t, 'sub_a', 'active', 'growth', T0)
    await sync(t, 'sub_a', 'incomplete', 'growth', T0)
    expect(await state(t)).toEqual({ user: { tier: 'growth', status: 'active' }, rows: { sub_a: 'active' }, voids: [] })
  })

  test('a failed first payment leaves the member unsubscribed, and the retry that pays makes them live', async () => {
    const t = convexTest(schema, modules)
    await member(t)
    await sync(t, 'sub_a', 'incomplete', 'growth', T0)
    await t.mutation(internal.stripe.markPastDue, {
      stripeCustomerId: CUSTOMER,
      stripeSubscriptionId: 'sub_a',
      eventCreated: T0 + 1000
    })
    expect(await state(t)).toEqual({
      user: { tier: 'growth', status: 'none' },
      rows: { sub_a: 'incomplete' },
      voids: []
    })
    await sync(t, 'sub_a', 'active', 'growth', T0, T0 + 2000)
    expect((await state(t)).user).toEqual({ tier: 'growth', status: 'active' })
  })

  test('a failed first payment can still expire', async () => {
    const t = convexTest(schema, modules)
    await member(t)
    await sync(t, 'sub_a', 'incomplete', 'growth', T0)
    await sync(t, 'sub_a', 'incomplete_expired', 'growth', T0, T0 + 1000)
    expect((await state(t)).rows).toEqual({ sub_a: 'incomplete_expired' })
  })

  test('a payment failure for a subscription we hold no row for leaves the member alone', async () => {
    const t = convexTest(schema, modules)
    await member(t)
    await sync(t, 'sub_a', 'active', 'growth', T0)
    await t.mutation(internal.stripe.markPastDue, {
      stripeCustomerId: CUSTOMER,
      stripeSubscriptionId: 'sub_b',
      eventCreated: T0 + 1000
    })
    await sync(t, 'sub_b', 'incomplete', 'starter', T0 + 1000)
    expect((await state(t)).user).toEqual({ tier: 'growth', status: 'active' })
  })
})

describe('a second checkout from another tab', () => {
  test('a paid Checkout duplicate is voided on its created, and its row is closed with the void', async () => {
    const t = convexTest(schema, modules)
    const userId = await member(t)
    await sync(t, 'sub_a', 'active', 'growth', T0)
    await sync(t, 'sub_b', 'active', 'starter', T0 + 1000)
    expect(await state(t)).toEqual({
      user: { tier: 'growth', status: 'active' },
      rows: { sub_a: 'active', sub_b: 'canceled' },
      voids: [{ userId, stripeSubscriptionId: 'sub_b', tier: 'growth' }]
    })
  })

  test('a third tab going live before the second one is deleted is voided too', async () => {
    const t = convexTest(schema, modules)
    const userId = await member(t)
    await sync(t, 'sub_a', 'active', 'growth', T0)
    await sync(t, 'sub_b', 'active', 'starter', T0 + 2000)
    // Created before sub_b at Stripe, delivered after it: the newest live row is sub_b, already being voided.
    await sync(t, 'sub_c', 'active', 'pro', T0 + 1000)
    expect(await state(t)).toEqual({
      user: { tier: 'growth', status: 'active' },
      rows: { sub_a: 'active', sub_b: 'canceled', sub_c: 'canceled' },
      voids: [
        { userId, stripeSubscriptionId: 'sub_b', tier: 'growth' },
        { userId, stripeSubscriptionId: 'sub_c', tier: 'growth' }
      ]
    })
  })

  test('a duplicate born incomplete is voided once, when its payment makes it live, and the member keeps the first plan', async () => {
    const t = convexTest(schema, modules)
    const userId = await member(t)
    await sync(t, 'sub_a', 'incomplete', 'growth', T0)
    await sync(t, 'sub_a', 'active', 'growth', T0)
    await sync(t, 'sub_b', 'incomplete', 'starter', T0 + 1000)
    expect((await state(t)).voids).toEqual([])
    await sync(t, 'sub_b', 'active', 'starter', T0 + 1000)
    // Stripe retries an event after any non-2xx: the replay finds the row closed already.
    await sync(t, 'sub_b', 'active', 'starter', T0 + 1000)
    expect(await state(t)).toEqual({
      user: { tier: 'growth', status: 'active' },
      rows: { sub_a: 'active', sub_b: 'canceled' },
      voids: [{ userId, stripeSubscriptionId: 'sub_b', tier: 'growth' }]
    })
  })

  test('the newer subscription is voided even when its payment lands before the first one', async () => {
    const t = convexTest(schema, modules)
    const userId = await member(t)
    await sync(t, 'sub_a', 'incomplete', 'growth', T0)
    await sync(t, 'sub_b', 'incomplete', 'starter', T0 + 1000)
    await sync(t, 'sub_b', 'active', 'starter', T0 + 1000)
    expect((await state(t)).user).toEqual({ tier: 'starter', status: 'active' })
    await sync(t, 'sub_a', 'active', 'growth', T0, T0 + 2000)
    expect(await state(t)).toEqual({
      user: { tier: 'growth', status: 'active' },
      rows: { sub_a: 'active', sub_b: 'canceled' },
      voids: [{ userId, stripeSubscriptionId: 'sub_b', tier: 'growth' }]
    })
  })

  test('a trial duplicate is voided once, on its created', async () => {
    const t = convexTest(schema, modules)
    const userId = await member(t)
    await sync(t, 'sub_a', 'trialing', 'pro', T0)
    await sync(t, 'sub_b', 'trialing', 'pro', T0 + 1000)
    await sync(t, 'sub_b', 'trialing', 'pro', T0 + 1000)
    expect(await state(t)).toEqual({
      user: { tier: 'pro', status: 'trialing' },
      rows: { sub_a: 'trialing', sub_b: 'canceled' },
      voids: [{ userId, stripeSubscriptionId: 'sub_b', tier: 'pro' }]
    })
  })
})
