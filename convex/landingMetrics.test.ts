import { describe, expect, it } from 'vitest'
import { isLandingEventName, LANDING_EVENT_NAMES, summarizeLandingMetrics } from './landingMetrics'

describe('LANDING_EVENT_NAMES', () => {
  it('is exactly the five frozen wire names', () => {
    expect(LANDING_EVENT_NAMES).toEqual([
      'pricing_view',
      'cta_click_hero',
      'cta_click_nav',
      'cta_click_pricing',
      'cta_click_final'
    ])
  })
})

describe('isLandingEventName', () => {
  it('accepts every frozen name and nothing else', () => {
    for (const name of LANDING_EVENT_NAMES) {
      expect(isLandingEventName(name)).toBe(true)
    }
    expect(isLandingEventName('cta_click_other')).toBe(false)
    expect(isLandingEventName('pricing_views')).toBe(false)
    expect(isLandingEventName('')).toBe(false)
    expect(isLandingEventName(null)).toBe(false)
    expect(isLandingEventName({ event: 'pricing_view' })).toBe(false)
  })
})

describe('summarizeLandingMetrics', () => {
  it('sums views and clicks and lists every placement', () => {
    const summary = summarizeLandingMetrics(
      [
        { day: '2026-09-20', event: 'pricing_view', count: 10 },
        { day: '2026-09-20', event: 'cta_click_hero', count: 1 },
        { day: '2026-09-20', event: 'cta_click_pricing', count: 1 }
      ],
      { sinceDay: '2026-09-18', days: 3 }
    )
    expect(summary).toEqual({
      pricingViews: 10,
      ctaClicks: 2,
      uniquePricingViewers: 0,
      uniqueCtaClickers: 0,
      byPlacement: [
        { placement: 'hero', clicks: 1, uniqueClicks: 0 },
        { placement: 'nav', clicks: 0, uniqueClicks: 0 },
        { placement: 'pricing', clicks: 1, uniqueClicks: 0 },
        { placement: 'final', clicks: 0, uniqueClicks: 0 }
      ],
      daily: [
        { day: '2026-09-20', pricingViews: 10, uniquePricingViewers: 0, ctaClicks: 2, uniqueCtaClickers: 0 },
        { day: '2026-09-19', pricingViews: 0, uniquePricingViewers: 0, ctaClicks: 0, uniqueCtaClickers: 0 },
        { day: '2026-09-18', pricingViews: 0, uniquePricingViewers: 0, ctaClicks: 0, uniqueCtaClickers: 0 }
      ]
    })
  })

  it('merges multiple day rows for the same event', () => {
    const summary = summarizeLandingMetrics(
      [
        { day: '2026-09-19', event: 'pricing_view', count: 3 },
        { day: '2026-09-20', event: 'pricing_view', count: 4 },
        { day: '2026-09-19', event: 'cta_click_final', count: 2 },
        { day: '2026-09-20', event: 'cta_click_final', count: 5 }
      ],
      { sinceDay: '2026-09-18', days: 3 }
    )
    expect(summary.pricingViews).toBe(7)
    expect(summary.ctaClicks).toBe(7)
  })

  it('counts clicks that arrive with no pricing views', () => {
    const summary = summarizeLandingMetrics([{ day: '2026-09-20', event: 'cta_click_nav', count: 4 }], {
      sinceDay: '2026-09-20',
      days: 1
    })
    expect(summary.pricingViews).toBe(0)
    expect(summary.ctaClicks).toBe(4)
  })

  it('reads a missing uniqueCount as 0', () => {
    const summary = summarizeLandingMetrics(
      [
        { day: '2026-09-20', event: 'pricing_view', count: 10 },
        { day: '2026-09-20', event: 'cta_click_hero', count: 3 }
      ],
      { sinceDay: '2026-09-20', days: 1 }
    )
    expect(summary.uniquePricingViewers).toBe(0)
    expect(summary.uniqueCtaClickers).toBe(0)
    expect(summary.byPlacement.find(row => row.placement === 'hero')?.uniqueClicks).toBe(0)
  })

  it('sums daily uniques per event and per placement', () => {
    const summary = summarizeLandingMetrics(
      [
        { day: '2026-09-19', event: 'pricing_view', count: 10, uniqueCount: 4 },
        { day: '2026-09-20', event: 'pricing_view', count: 6, uniqueCount: 3 },
        { day: '2026-09-20', event: 'cta_click_hero', count: 2, uniqueCount: 1 },
        { day: '2026-09-20', event: 'cta_click_pricing', count: 1, uniqueCount: 1 },
        { day: '2026-09-20', event: 'cta_click_final', count: 4, uniqueCount: 2 }
      ],
      { sinceDay: '2026-09-19', days: 2 }
    )
    expect(summary.uniquePricingViewers).toBe(7)
    expect(summary.uniqueCtaClickers).toBe(4)
    expect(summary.byPlacement).toEqual([
      { placement: 'hero', clicks: 2, uniqueClicks: 1 },
      { placement: 'nav', clicks: 0, uniqueClicks: 0 },
      { placement: 'pricing', clicks: 1, uniqueClicks: 1 },
      { placement: 'final', clicks: 4, uniqueClicks: 2 }
    ])
  })

  it('always lists all four placements in hero, nav, pricing, final order', () => {
    const summary = summarizeLandingMetrics([], { sinceDay: '2026-09-18', days: 3 })
    expect(summary.byPlacement).toEqual([
      { placement: 'hero', clicks: 0, uniqueClicks: 0 },
      { placement: 'nav', clicks: 0, uniqueClicks: 0 },
      { placement: 'pricing', clicks: 0, uniqueClicks: 0 },
      { placement: 'final', clicks: 0, uniqueClicks: 0 }
    ])
    expect(summary.daily).toEqual([
      { day: '2026-09-20', pricingViews: 0, uniquePricingViewers: 0, ctaClicks: 0, uniqueCtaClickers: 0 },
      { day: '2026-09-19', pricingViews: 0, uniquePricingViewers: 0, ctaClicks: 0, uniqueCtaClickers: 0 },
      { day: '2026-09-18', pricingViews: 0, uniquePricingViewers: 0, ctaClicks: 0, uniqueCtaClickers: 0 }
    ])
  })

  it('merges two events on the same day into one daily row', () => {
    const summary = summarizeLandingMetrics(
      [
        { day: '2026-09-20', event: 'pricing_view', count: 4, uniqueCount: 3 },
        { day: '2026-09-20', event: 'cta_click_nav', count: 2, uniqueCount: 1 }
      ],
      { sinceDay: '2026-09-20', days: 1 }
    )
    expect(summary.daily).toEqual([
      { day: '2026-09-20', pricingViews: 4, uniquePricingViewers: 3, ctaClicks: 2, uniqueCtaClickers: 1 }
    ])
  })

  it('orders distinct days newest first', () => {
    const summary = summarizeLandingMetrics(
      [
        { day: '2026-09-18', event: 'pricing_view', count: 1 },
        { day: '2026-09-20', event: 'pricing_view', count: 2 },
        { day: '2026-09-19', event: 'cta_click_hero', count: 3 }
      ],
      { sinceDay: '2026-09-18', days: 3 }
    )
    expect(summary.daily.map(row => row.day)).toEqual(['2026-09-20', '2026-09-19', '2026-09-18'])
  })

  it('sums uniques per day, reading a missing uniqueCount as 0', () => {
    const summary = summarizeLandingMetrics(
      [
        { day: '2026-09-19', event: 'pricing_view', count: 5, uniqueCount: 2 },
        { day: '2026-09-19', event: 'cta_click_final', count: 2, uniqueCount: 1 },
        { day: '2026-09-20', event: 'pricing_view', count: 3 },
        { day: '2026-09-20', event: 'cta_click_final', count: 4 }
      ],
      { sinceDay: '2026-09-19', days: 2 }
    )
    expect(summary.daily).toEqual([
      { day: '2026-09-20', pricingViews: 3, uniquePricingViewers: 0, ctaClicks: 4, uniqueCtaClickers: 0 },
      { day: '2026-09-19', pricingViews: 5, uniquePricingViewers: 2, ctaClicks: 2, uniqueCtaClickers: 1 }
    ])
  })

  it('emits an all-zero row for a quiet day inside the window', () => {
    const summary = summarizeLandingMetrics([{ day: '2026-09-20', event: 'pricing_view', count: 5 }], {
      sinceDay: '2026-09-19',
      days: 2
    })
    expect(summary.daily).toEqual([
      { day: '2026-09-20', pricingViews: 5, uniquePricingViewers: 0, ctaClicks: 0, uniqueCtaClickers: 0 },
      { day: '2026-09-19', pricingViews: 0, uniquePricingViewers: 0, ctaClicks: 0, uniqueCtaClickers: 0 }
    ])
  })

  it('emits exactly one entry per day in the window', () => {
    const summary = summarizeLandingMetrics([], { sinceDay: '2026-08-25', days: 28 })
    expect(summary.daily).toHaveLength(28)
    expect(summary.daily[0].day).toBe('2026-09-21')
    expect(summary.daily[27].day).toBe('2026-08-25')
  })
})
