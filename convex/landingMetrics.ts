// convex/landingMetrics.ts
import { v } from 'convex/values'
import { env, internalMutation, query } from './_generated/server'
import { internal } from './_generated/api'
import { requireAuth } from './lib/auth'
import { assertAdmin } from './admin'

// The five events the landing beacon may send, in the frozen wire format. Keep in sync with
// landing/lib/metrics.ts — the landing never imports backend code.
export const LANDING_EVENT_NAMES = [
  'pricing_view',
  'cta_click_hero',
  'cta_click_nav',
  'cta_click_pricing',
  'cta_click_final'
] as const

export type LandingEventName = (typeof LANDING_EVENT_NAMES)[number]

export const landingEventValidator = v.union(
  v.literal('pricing_view'),
  v.literal('cta_click_hero'),
  v.literal('cta_click_nav'),
  v.literal('cta_click_pricing'),
  v.literal('cta_click_final')
)

export function isLandingEventName(value: unknown): value is LandingEventName {
  return typeof value === 'string' && (LANDING_EVENT_NAMES as readonly string[]).includes(value)
}

export type VisitorFlag = 'pricingView' | 'ctaClickHero' | 'ctaClickNav' | 'ctaClickPricing' | 'ctaClickFinal'

// The landingVisitors row field that marks a visitor as unique for each event.
export const VISITOR_FLAG_BY_EVENT: Record<LandingEventName, VisitorFlag> = {
  pricing_view: 'pricingView',
  cta_click_hero: 'ctaClickHero',
  cta_click_nav: 'ctaClickNav',
  cta_click_pricing: 'ctaClickPricing',
  cta_click_final: 'ctaClickFinal'
}

// One rule for both the beacon (which hashes) and the admin query (which reports whether hashing is
// on): the dedicated secret when set, else the older unsubscribe secret. `||` so an empty string
// (the shipped example's blank value) counts as unset. Undefined ⇒ no visitorKey is ever computed
// and uniques do not count, while totals still do.
export function landingVisitorSecret(): string | undefined {
  return env.LANDING_METRICS_SECRET || env.UNSUBSCRIBE_SECRET
}

export type LandingPlacement = 'hero' | 'nav' | 'pricing' | 'final'

const PLACEMENTS: LandingPlacement[] = ['hero', 'nav', 'pricing', 'final']

export type LandingDailyMetrics = {
  day: string
  pricingViews: number
  uniquePricingViewers: number
  ctaClicks: number
  uniqueCtaClickers: number
}

export type LandingMetricsSummary = {
  pricingViews: number
  ctaClicks: number
  uniquePricingViewers: number
  uniqueCtaClickers: number
  byPlacement: { placement: LandingPlacement; clicks: number; uniqueClicks: number }[]
  daily: LandingDailyMetrics[]
}

// Pure projection shared by the admin query and its tests: all four placements in a fixed order with
// zeros included so the table never changes shape. Uniques deliberately reset each UTC day, so the
// window figure sums daily uniques (the Plausible model) and a visitor who clicked two placements
// counts once under each — the admin tab states the rule. The click-through ratio is presentation —
// the tab derives it from the two headline figures, where a zero base reads as "not enough data yet".
// `daily` fills every UTC day in the window, newest first, zeros included — deliberately: the owner
// reads a missing day as unknown, a zero day as zero. The tab's empty state still covers a window
// with no events at all, before any table renders.
export function summarizeLandingMetrics(
  rows: ReadonlyArray<{ day: string; event: LandingEventName; count: number; uniqueCount?: number }>,
  window: { sinceDay: string; days: number }
): LandingMetricsSummary {
  const clicks: Record<LandingPlacement, number> = { hero: 0, nav: 0, pricing: 0, final: 0 }
  const uniqueClicks: Record<LandingPlacement, number> = { hero: 0, nav: 0, pricing: 0, final: 0 }
  const dailyByDay = new Map<string, Omit<LandingDailyMetrics, 'day'>>()
  let pricingViews = 0
  let uniquePricingViewers = 0
  for (const row of rows) {
    const unique = row.uniqueCount ?? 0
    const daily = dailyByDay.get(row.day) ?? {
      pricingViews: 0,
      uniquePricingViewers: 0,
      ctaClicks: 0,
      uniqueCtaClickers: 0
    }
    if (row.event === 'pricing_view') {
      pricingViews += row.count
      uniquePricingViewers += unique
      daily.pricingViews += row.count
      daily.uniquePricingViewers += unique
    } else {
      const placement = row.event.slice('cta_click_'.length) as LandingPlacement
      clicks[placement] += row.count
      uniqueClicks[placement] += unique
      daily.ctaClicks += row.count
      daily.uniqueCtaClickers += unique
    }
    dailyByDay.set(row.day, daily)
  }
  const ctaClicks = PLACEMENTS.reduce((sum, placement) => sum + clicks[placement], 0)
  const uniqueCtaClickers = PLACEMENTS.reduce((sum, placement) => sum + uniqueClicks[placement], 0)
  const sinceMs = Date.parse(window.sinceDay + 'T00:00:00Z')
  const daily: LandingDailyMetrics[] = []
  for (let offset = window.days - 1; offset >= 0; offset--) {
    const day = new Date(sinceMs + offset * DAY_MS).toISOString().slice(0, 10)
    const row = dailyByDay.get(day)
    daily.push({
      day,
      pricingViews: row?.pricingViews ?? 0,
      uniquePricingViewers: row?.uniquePricingViewers ?? 0,
      ctaClicks: row?.ctaClicks ?? 0,
      uniqueCtaClickers: row?.uniqueCtaClickers ?? 0
    })
  }
  return {
    pricingViews,
    ctaClicks,
    uniquePricingViewers,
    uniqueCtaClickers,
    byPlacement: PLACEMENTS.map(placement => ({
      placement,
      clicks: clicks[placement],
      uniqueClicks: uniqueClicks[placement]
    })),
    daily
  }
}

const DAY_MS = 24 * 60 * 60 * 1000

// Internal because only the HTTP beacon writes. The day is derived server-side, so a caller can
// never backdate or spread a count across days. `visitorKey` is the daily-rotated HMAC computed in
// http.ts — never a raw IP or user-agent. Both lookups live in one transaction, and Convex's
// serializable isolation settles two concurrent beacons from one visitor (insert + patch, or two
// patches) without manual dedup retry logic.
export const recordLandingEvent = internalMutation({
  args: { event: landingEventValidator, visitorKey: v.optional(v.string()) },
  handler: async (ctx, { event, visitorKey }) => {
    const day = new Date().toISOString().slice(0, 10)

    let becameUnique = false
    if (visitorKey !== undefined) {
      const flag = VISITOR_FLAG_BY_EVENT[event]
      const visitor = await ctx.db
        .query('landingVisitors')
        .withIndex('by_day_and_visitor_key', q => q.eq('day', day).eq('visitorKey', visitorKey))
        .unique()
      if (!visitor) {
        const flags: Record<VisitorFlag, boolean> = {
          pricingView: false,
          ctaClickHero: false,
          ctaClickNav: false,
          ctaClickPricing: false,
          ctaClickFinal: false
        }
        flags[flag] = true
        await ctx.db.insert('landingVisitors', { day, visitorKey, ...flags })
        becameUnique = true
      } else if (!visitor[flag]) {
        const toSet: Partial<Record<VisitorFlag, boolean>> = {}
        toSet[flag] = true
        await ctx.db.patch(visitor._id, toSet)
        becameUnique = true
      }
    }

    const existing = await ctx.db
      .query('landingMetrics')
      .withIndex('by_day_and_event', q => q.eq('day', day).eq('event', event))
      .unique()
    if (existing) {
      await ctx.db.patch(existing._id, {
        count: existing.count + 1,
        uniqueCount: (existing.uniqueCount ?? 0) + (becameUnique ? 1 : 0)
      })
    } else {
      await ctx.db.insert('landingMetrics', {
        day,
        event,
        count: 1,
        uniqueCount: becameUnique ? 1 : 0
      })
    }
  }
})

/** A full batch means rows may remain — reschedule another pass (mirrors sessions.shouldContinueSessionPurge). */
export function shouldContinueVisitorPurge(deletedCount: number, batchSize: number): boolean {
  return deletedCount === batchSize
}

// Raw visitor rows exist only to dedupe within their UTC day (recordLandingEvent never reads an
// earlier day), so the cutoff keeps today's and deletes the rest — only the integer aggregates in
// landingMetrics survive. With the daily cron no row outlives 48h, the "deleted within two days"
// promise on the public privacy and cookie pages.
export const pruneLandingVisitors = internalMutation({
  args: {},
  handler: async ctx => {
    const cutoffDay = new Date().toISOString().slice(0, 10)
    const stale = await ctx.db
      .query('landingVisitors')
      .withIndex('by_day_and_visitor_key', q => q.lt('day', cutoffDay))
      .take(200)
    await Promise.all(stale.map(row => ctx.db.delete(row._id)))
    if (shouldContinueVisitorPurge(stale.length, 200)) {
      await ctx.scheduler.runAfter(0, internal.landingMetrics.pruneLandingVisitors, {})
    }
  }
})

export const getMetrics = query({
  args: { sessionToken: v.string(), days: v.union(v.literal(7), v.literal(28)) },
  handler: async (ctx, { sessionToken, days }) => {
    const user = await requireAuth(ctx, sessionToken)
    assertAdmin(user)
    // `days` calendar days including today, so a 28-day window ending 2026-09-21 starts 2026-08-25.
    const sinceDay = new Date(Date.now() - (days - 1) * DAY_MS).toISOString().slice(0, 10)
    const rows = await ctx.db
      .query('landingMetrics')
      .withIndex('by_day_and_event', q => q.gte('day', sinceDay))
      .take(500)
    return {
      days,
      sinceDay,
      // Reflects whether a secret is configured — not whether traffic exists — so the tab can warn
      // that uniques will stay at zero until the deployment gets one.
      uniqueTrackingEnabled: landingVisitorSecret() !== undefined,
      ...summarizeLandingMetrics(rows, { sinceDay, days })
    }
  }
})
