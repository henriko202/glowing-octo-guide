/// <reference types="vite/client" />
import type { TestConvex } from 'convex-test'
import { convexTest } from 'convex-test'
import { describe, expect, test } from 'vitest'
import { api, internal } from '../_generated/api'
import schema from '../schema'
import { LANDING_EVENT_NAMES } from '../landingMetrics'

const modules = import.meta.glob('../**/*.ts')
type T = TestConvex<typeof schema>
const DAY = 86_400_000
const TODAY = new Date().toISOString().slice(0, 10)

async function seedSession(t: T, isAdmin: boolean) {
  const userId = await t.run(async ctx =>
    ctx.db.insert('users', {
      linkedinId: isAdmin ? 'admin' : 'member',
      name: isAdmin ? 'Admin' : 'Member',
      subscriptionStatus: 'none' as const,
      isAdmin,
      createdAt: Date.now()
    })
  )
  await t.run(async ctx => ctx.db.insert('sessions', { token: 'tok', userId, expiresAt: Date.now() + DAY }))
}

describe('recordLandingEvent', () => {
  test('increments the same (day, event) row instead of inserting a second one', async () => {
    const t = convexTest(schema, modules)
    await t.mutation(internal.landingMetrics.recordLandingEvent, { event: 'pricing_view' })
    await t.mutation(internal.landingMetrics.recordLandingEvent, { event: 'pricing_view' })
    const rows = await t.run(async ctx => ctx.db.query('landingMetrics').collect())
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ day: TODAY, event: 'pricing_view', count: 2 })
  })

  test('distinct events get distinct rows', async () => {
    const t = convexTest(schema, modules)
    await t.mutation(internal.landingMetrics.recordLandingEvent, { event: 'pricing_view' })
    await t.mutation(internal.landingMetrics.recordLandingEvent, { event: 'cta_click_hero' })
    const rows = await t.run(async ctx => ctx.db.query('landingMetrics').collect())
    expect(rows).toHaveLength(2)
    expect(rows.map(row => row.event).sort()).toEqual(['cta_click_hero', 'pricing_view'])
  })

  test('accepts all five frozen event names', async () => {
    const t = convexTest(schema, modules)
    for (const event of LANDING_EVENT_NAMES) {
      await t.mutation(internal.landingMetrics.recordLandingEvent, { event })
    }
    const rows = await t.run(async ctx => ctx.db.query('landingMetrics').collect())
    expect(rows).toHaveLength(5)
    expect(rows.every(row => row.count === 1)).toBe(true)
  })
})

describe('recordLandingEvent unique visitors', () => {
  test('counts the same visitor once per event per day', async () => {
    const t = convexTest(schema, modules)
    await t.mutation(internal.landingMetrics.recordLandingEvent, { event: 'pricing_view', visitorKey: 'v1' })
    await t.mutation(internal.landingMetrics.recordLandingEvent, { event: 'pricing_view', visitorKey: 'v1' })

    const counters = await t.run(async ctx => ctx.db.query('landingMetrics').collect())
    expect(counters).toHaveLength(1)
    expect(counters[0]).toMatchObject({ day: TODAY, event: 'pricing_view', count: 2, uniqueCount: 1 })

    const visitors = await t.run(async ctx => ctx.db.query('landingVisitors').collect())
    expect(visitors).toHaveLength(1)
    expect(visitors[0]).toMatchObject({ day: TODAY, visitorKey: 'v1', pricingView: true, ctaClickHero: false })
  })

  test('counts one visitor once for each distinct event', async () => {
    const t = convexTest(schema, modules)
    await t.mutation(internal.landingMetrics.recordLandingEvent, { event: 'pricing_view', visitorKey: 'v1' })
    await t.mutation(internal.landingMetrics.recordLandingEvent, { event: 'cta_click_hero', visitorKey: 'v1' })

    const counters = await t.run(async ctx => ctx.db.query('landingMetrics').collect())
    expect(counters.map(row => row.uniqueCount).sort()).toEqual([1, 1])

    const visitors = await t.run(async ctx => ctx.db.query('landingVisitors').collect())
    expect(visitors).toHaveLength(1)
    expect(visitors[0]).toMatchObject({ pricingView: true, ctaClickHero: true, ctaClickNav: false })
  })

  test('counts two visitors as two uniques', async () => {
    const t = convexTest(schema, modules)
    await t.mutation(internal.landingMetrics.recordLandingEvent, { event: 'pricing_view', visitorKey: 'v1' })
    await t.mutation(internal.landingMetrics.recordLandingEvent, { event: 'pricing_view', visitorKey: 'v2' })

    const counters = await t.run(async ctx => ctx.db.query('landingMetrics').collect())
    expect(counters[0]).toMatchObject({ count: 2, uniqueCount: 2 })
    expect(await t.run(async ctx => ctx.db.query('landingVisitors').collect())).toHaveLength(2)
  })

  test('counts totals but no uniques when no visitorKey is present', async () => {
    const t = convexTest(schema, modules)
    await t.mutation(internal.landingMetrics.recordLandingEvent, { event: 'pricing_view' })
    await t.mutation(internal.landingMetrics.recordLandingEvent, { event: 'pricing_view' })

    const counters = await t.run(async ctx => ctx.db.query('landingMetrics').collect())
    expect(counters[0]).toMatchObject({ count: 2, uniqueCount: 0 })
    expect(await t.run(async ctx => ctx.db.query('landingVisitors').collect())).toHaveLength(0)
  })
})

describe('getMetrics', () => {
  test('returns the summarized window for an admin session', async () => {
    const t = convexTest(schema, modules)
    await seedSession(t, true)
    for (let i = 0; i < 10; i++) {
      await t.mutation(internal.landingMetrics.recordLandingEvent, { event: 'pricing_view' })
    }
    await t.mutation(internal.landingMetrics.recordLandingEvent, { event: 'cta_click_hero' })
    await t.mutation(internal.landingMetrics.recordLandingEvent, { event: 'cta_click_pricing' })

    const metrics = await t.query(api.landingMetrics.getMetrics, { sessionToken: 'tok', days: 7 })
    expect(metrics.days).toBe(7)
    expect(metrics.sinceDay).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(metrics.pricingViews).toBe(10)
    expect(metrics.ctaClicks).toBe(2)
    expect(metrics.byPlacement).toEqual([
      { placement: 'hero', clicks: 1, uniqueClicks: 0 },
      { placement: 'nav', clicks: 0, uniqueClicks: 0 },
      { placement: 'pricing', clicks: 1, uniqueClicks: 0 },
      { placement: 'final', clicks: 0, uniqueClicks: 0 }
    ])
  })

  test('exposes unique totals by event and by placement', async () => {
    const t = convexTest(schema, modules)
    await seedSession(t, true)
    await t.mutation(internal.landingMetrics.recordLandingEvent, { event: 'pricing_view', visitorKey: 'v1' })
    await t.mutation(internal.landingMetrics.recordLandingEvent, { event: 'pricing_view', visitorKey: 'v1' })
    await t.mutation(internal.landingMetrics.recordLandingEvent, { event: 'pricing_view', visitorKey: 'v2' })
    await t.mutation(internal.landingMetrics.recordLandingEvent, { event: 'cta_click_pricing', visitorKey: 'v1' })

    const metrics = await t.query(api.landingMetrics.getMetrics, { sessionToken: 'tok', days: 7 })
    expect(metrics.pricingViews).toBe(3)
    expect(metrics.uniquePricingViewers).toBe(2)
    expect(metrics.ctaClicks).toBe(1)
    expect(metrics.uniqueCtaClickers).toBe(1)
    expect(metrics.byPlacement).toEqual([
      { placement: 'hero', clicks: 0, uniqueClicks: 0 },
      { placement: 'nav', clicks: 0, uniqueClicks: 0 },
      { placement: 'pricing', clicks: 1, uniqueClicks: 1 },
      { placement: 'final', clicks: 0, uniqueClicks: 0 }
    ])
    expect(typeof metrics.uniqueTrackingEnabled).toBe('boolean')
  })

  test('returns every day in the window newest-first, zero-filling quiet days', async () => {
    const t = convexTest(schema, modules)
    await seedSession(t, true)
    const twoDaysAgo = new Date(Date.now() - 2 * DAY).toISOString().slice(0, 10)
    const yesterday = new Date(Date.now() - DAY).toISOString().slice(0, 10)
    await t.run(async ctx => {
      await ctx.db.insert('landingMetrics', { day: twoDaysAgo, event: 'pricing_view', count: 5, uniqueCount: 2 })
      await ctx.db.insert('landingMetrics', { day: twoDaysAgo, event: 'cta_click_hero', count: 3, uniqueCount: 1 })
      await ctx.db.insert('landingMetrics', { day: yesterday, event: 'pricing_view', count: 4, uniqueCount: 3 })
    })

    const metrics = await t.query(api.landingMetrics.getMetrics, { sessionToken: 'tok', days: 28 })
    expect(metrics.daily).toHaveLength(28)
    expect(metrics.daily[0]).toEqual({
      day: TODAY,
      pricingViews: 0,
      uniquePricingViewers: 0,
      ctaClicks: 0,
      uniqueCtaClickers: 0
    })
    expect(metrics.daily[1]).toEqual({
      day: yesterday,
      pricingViews: 4,
      uniquePricingViewers: 3,
      ctaClicks: 0,
      uniqueCtaClickers: 0
    })
    expect(metrics.daily[2]).toEqual({
      day: twoDaysAgo,
      pricingViews: 5,
      uniquePricingViewers: 2,
      ctaClicks: 3,
      uniqueCtaClickers: 1
    })
    expect(metrics.pricingViews).toBe(9)
    expect(metrics.ctaClicks).toBe(3)
  })

  test('uniqueTrackingEnabled follows the configured secret fallback', async () => {
    const savedLandingSecret = process.env.LANDING_METRICS_SECRET
    const savedUnsubscribeSecret = process.env.UNSUBSCRIBE_SECRET
    delete process.env.LANDING_METRICS_SECRET
    delete process.env.UNSUBSCRIBE_SECRET
    try {
      const t = convexTest(schema, modules)
      await seedSession(t, true)
      const off = await t.query(api.landingMetrics.getMetrics, { sessionToken: 'tok', days: 7 })
      expect(off.uniqueTrackingEnabled).toBe(false)

      process.env.UNSUBSCRIBE_SECRET = 'fallback-secret'
      const fallback = await t.query(api.landingMetrics.getMetrics, { sessionToken: 'tok', days: 7 })
      expect(fallback.uniqueTrackingEnabled).toBe(true)

      process.env.LANDING_METRICS_SECRET = 'dedicated-secret'
      delete process.env.UNSUBSCRIBE_SECRET
      const dedicated = await t.query(api.landingMetrics.getMetrics, { sessionToken: 'tok', days: 7 })
      expect(dedicated.uniqueTrackingEnabled).toBe(true)
    } finally {
      if (savedLandingSecret === undefined) delete process.env.LANDING_METRICS_SECRET
      else process.env.LANDING_METRICS_SECRET = savedLandingSecret
      if (savedUnsubscribeSecret === undefined) delete process.env.UNSUBSCRIBE_SECRET
      else process.env.UNSUBSCRIBE_SECRET = savedUnsubscribeSecret
    }
  })

  test('rejects a non-admin session', async () => {
    const t = convexTest(schema, modules)
    await seedSession(t, false)
    await expect(t.query(api.landingMetrics.getMetrics, { sessionToken: 'tok', days: 7 })).rejects.toThrow(
      'Forbidden: admin access required'
    )
  })

  test('excludes rows whose day falls outside the window', async () => {
    const t = convexTest(schema, modules)
    await seedSession(t, true)
    await t.run(async ctx => {
      await ctx.db.insert('landingMetrics', { day: '2000-01-01', event: 'pricing_view', count: 99 })
      await ctx.db.insert('landingMetrics', { day: '2000-01-01', event: 'cta_click_hero', count: 99 })
    })
    await t.mutation(internal.landingMetrics.recordLandingEvent, { event: 'pricing_view' })

    const metrics = await t.query(api.landingMetrics.getMetrics, { sessionToken: 'tok', days: 28 })
    expect(metrics.pricingViews).toBe(1)
    expect(metrics.ctaClicks).toBe(0)
  })
})

describe('pruneLandingVisitors', () => {
  // The public privacy and cookie pages promise the hash is deleted within two days. A row only dedupes within its
  // own UTC day, so every earlier day goes: with the daily cron, no row outlives 48 hours.
  test('keeps only today and deletes every earlier day', async () => {
    const t = convexTest(schema, modules)
    const yesterday = new Date(Date.now() - DAY).toISOString().slice(0, 10)
    const threeDaysAgo = new Date(Date.now() - 3 * DAY).toISOString().slice(0, 10)
    await t.run(async ctx => {
      for (const day of ['2000-01-01', threeDaysAgo, yesterday, TODAY]) {
        await ctx.db.insert('landingVisitors', {
          day,
          visitorKey: `k-${day}`,
          pricingView: true,
          ctaClickHero: false,
          ctaClickNav: false,
          ctaClickPricing: false,
          ctaClickFinal: false
        })
      }
    })

    await t.mutation(internal.landingMetrics.pruneLandingVisitors, {})

    const remaining = await t.run(async ctx => ctx.db.query('landingVisitors').collect())
    expect(remaining.map(row => row.day)).toEqual([TODAY])
  })
})
