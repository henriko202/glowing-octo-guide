import { useState } from 'react'
import { useQuery } from 'convex/react'
import { api } from '../convex'
import LoadingSpinner from './LoadingSpinner'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { share } from './SurvivalTab'

type Days = 7 | 28
type LandingPlacement = 'hero' | 'nav' | 'pricing' | 'final'

// Mirrors landingMetrics.getMetrics (convex/landingMetrics.ts) — the tab's only data source.
export type LandingMetrics = {
  days: Days
  sinceDay: string
  pricingViews: number
  ctaClicks: number
  uniquePricingViewers: number
  uniqueCtaClickers: number
  uniqueTrackingEnabled: boolean
  byPlacement: { placement: LandingPlacement; clicks: number; uniqueClicks: number }[]
  daily: {
    day: string
    pricingViews: number
    uniquePricingViewers: number
    ctaClicks: number
    uniqueCtaClickers: number
  }[]
}

type Props = {
  sessionToken: string | undefined
  isAdmin: boolean | undefined
}

const PLACEMENTS: LandingPlacement[] = ['hero', 'nav', 'pricing', 'final']

const PLACEMENT_LABEL: Record<LandingPlacement, string> = {
  hero: 'Hero',
  nav: 'Nav',
  pricing: 'Pricing',
  final: 'Final CTA'
}

// Admin-only, English-only like the other admin tabs. Uniques are daily-rotated, cookieless
// aggregates: no cookie and no client-side identifier, and the server-side hash exists ~2 days at
// most, so the window figure is the sum of daily uniques rather than distinct people.
export default function LandingTab({ sessionToken, isAdmin }: Props) {
  const [days, setDays] = useState<Days>(28)
  const metrics = useQuery(api.landingMetrics.getMetrics, sessionToken && isAdmin ? { sessionToken, days } : 'skip') as
    | LandingMetrics
    | null
    | undefined

  if (metrics === undefined) {
    return <LoadingSpinner />
  }

  const windowToggle = (
    <div
      role="group"
      aria-label="Metrics window"
      className="mb-3 flex gap-1"
    >
      {([7, 28] as Days[]).map(d => (
        <Button
          key={d}
          size="sm"
          variant={days === d ? 'default' : 'outline'}
          aria-pressed={days === d}
          onClick={() => setDays(d)}
        >
          {d} days
        </Button>
      ))}
    </div>
  )

  // No rows in the window is a real state — an empty table of zeros would read like data.
  if (metrics === null || (metrics.pricingViews === 0 && metrics.ctaClicks === 0)) {
    return (
      <div>
        {windowToggle}
        <p className="text-muted-foreground text-sm">No landing events in the last {days} days.</p>
      </div>
    )
  }

  const byPlacement = new Map(metrics.byPlacement.map(row => [row.placement, row]))

  return (
    <div>
      {windowToggle}

      <div className="mb-4 grid grid-cols-2 gap-3">
        <div className="border-border bg-card rounded-lg border p-4">
          <p className="text-muted-foreground text-xs">Unique pricing viewers</p>
          <p className="text-foreground mt-1 text-2xl font-semibold tabular-nums">{metrics.uniquePricingViewers}</p>
          <p className="text-muted-foreground mt-1 text-xs">{metrics.pricingViews} total views</p>
        </div>
        <div className="border-border bg-card rounded-lg border p-4">
          <p className="text-muted-foreground text-xs">Unique trial CTA clickers</p>
          <p className="text-foreground mt-1 text-2xl font-semibold tabular-nums">{metrics.uniqueCtaClickers}</p>
          <p className="text-muted-foreground mt-1 text-xs">{metrics.ctaClicks} total clicks</p>
          <p className="text-muted-foreground mt-1 text-xs">
            {share(metrics.uniqueCtaClickers, metrics.uniquePricingViewers)} click-through
          </p>
        </div>
      </div>

      {!metrics.uniqueTrackingEnabled && (
        <p className="text-muted-foreground mb-3 text-xs">
          Unique counting is off — set LANDING_METRICS_SECRET (or UNSUBSCRIBE_SECRET) on the Convex deployment to enable
          it.
        </p>
      )}

      <Table className="table-fixed">
        <TableHeader>
          <TableRow>
            <TableHead>Placement</TableHead>
            <TableHead className="w-[90px] text-right">Clicks</TableHead>
            <TableHead className="w-[90px] text-right">Unique</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {PLACEMENTS.map(placement => (
            <TableRow key={placement}>
              <th
                scope="row"
                className="text-foreground px-4 py-3 text-left align-middle font-medium"
              >
                {PLACEMENT_LABEL[placement]}
              </th>
              <TableCell className="text-right tabular-nums">{byPlacement.get(placement)?.clicks ?? 0}</TableCell>
              <TableCell className="text-right tabular-nums">{byPlacement.get(placement)?.uniqueClicks ?? 0}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <h2 className="text-foreground mt-6 mb-2 text-base font-semibold">Daily</h2>
      <Table className="table-fixed">
        <TableHeader>
          <TableRow>
            <TableHead className="w-[120px]">Day</TableHead>
            <TableHead className="w-[90px] text-right">Views</TableHead>
            <TableHead className="w-[90px] text-right">Unique views</TableHead>
            <TableHead className="w-[90px] text-right">Clicks</TableHead>
            <TableHead className="w-[90px] text-right">Unique clicks</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {metrics.daily.map(row => (
            <TableRow key={row.day}>
              <th
                scope="row"
                className="text-foreground px-4 py-3 text-left align-middle font-medium"
              >
                {row.day}
              </th>
              <TableCell className="text-right tabular-nums">{row.pricingViews}</TableCell>
              <TableCell className="text-right tabular-nums">{row.uniquePricingViewers}</TableCell>
              <TableCell className="text-right tabular-nums">{row.ctaClicks}</TableCell>
              <TableCell className="text-right tabular-nums">{row.uniqueCtaClickers}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <p className="text-muted-foreground mt-3 text-xs">
        Window: since {metrics.sinceDay} UTC (last {days} days). Uniques reset each UTC day — cookieless, with no stored
        identifier — so the window figure sums daily uniques.
      </p>
    </div>
  )
}
