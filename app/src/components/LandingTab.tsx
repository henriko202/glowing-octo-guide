import { useId, useState } from 'react'
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

type SignInEvent =
  | 'started'
  | 'linkedin_ok_new'
  | 'linkedin_ok_returning'
  | 'signed_in_new'
  | 'signed_in_returning'
  | 'denied'
  | 'linkedin_error'
  | 'lost_cookie'
  | 'rejected'
  | 'error'

// Mirrors authMetrics.getMetrics (convex/authMetrics.ts) — the sign-in section's only data source.
export type AuthMetrics = {
  days: Days
  sinceDay: string
  totals: Record<SignInEvent, number>
  daily: { day: string; started: number; linkedinOk: number; signedIn: number; failed: number }[]
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

const FAILURE_LABEL: [SignInEvent, string][] = [
  ['denied', 'Canceled on LinkedIn'],
  ['linkedin_error', 'LinkedIn returned an error'],
  ['lost_cookie', 'Sign-in cookie missing'],
  ['rejected', 'Callback rejected (expired or invalid)'],
  ['error', 'Error after LinkedIn']
]

const ROW_HEADER = 'text-foreground px-4 py-3 text-left align-middle font-medium'

// The landing clicks followed through LinkedIn to a session. Counts only, per UTC day, like the landing figures.
function SignInSection({
  signIns,
  landingClicks,
  days
}: {
  signIns: AuthMetrics | null
  landingClicks: number
  days: Days
}) {
  const headingId = useId()
  const totals = signIns?.totals
  const funnel: [string, number, number | null, number | null][] = totals
    ? [
        ['Landing CTA clicks', landingClicks, null, null],
        ['Sent to LinkedIn', totals.started, null, null],
        [
          'Back from LinkedIn',
          totals.linkedin_ok_new + totals.linkedin_ok_returning,
          totals.linkedin_ok_new,
          totals.linkedin_ok_returning
        ],
        [
          'Signed in',
          totals.signed_in_new + totals.signed_in_returning,
          totals.signed_in_new,
          totals.signed_in_returning
        ]
      ]
    : []

  return (
    <section
      aria-labelledby={headingId}
      className="mt-8"
    >
      <h2
        id={headingId}
        className="text-foreground mb-2 text-base font-semibold"
      >
        Sign-in
      </h2>
      {!signIns || Object.values(signIns.totals).every(count => count === 0) ? (
        <p className="text-muted-foreground text-sm">No sign-in attempts in the last {days} days.</p>
      ) : (
        <>
          <Table className="table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead>Step</TableHead>
                <TableHead className="w-[90px] text-right">Total</TableHead>
                <TableHead className="w-[90px] text-right">New</TableHead>
                <TableHead className="w-[90px] text-right">Returning</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {funnel.map(([label, total, isNew, returning]) => (
                <TableRow key={label}>
                  <th
                    scope="row"
                    className={ROW_HEADER}
                  >
                    {label}
                  </th>
                  <TableCell className="text-right tabular-nums">{total}</TableCell>
                  <TableCell className="text-right tabular-nums">{isNew ?? '–'}</TableCell>
                  <TableCell className="text-right tabular-nums">{returning ?? '–'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <Table className="mt-4 table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead>Why a sign-in stopped</TableHead>
                <TableHead className="w-[90px] text-right">Count</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {FAILURE_LABEL.map(([event, label]) => (
                <TableRow key={event}>
                  <th
                    scope="row"
                    className={ROW_HEADER}
                  >
                    {label}
                  </th>
                  <TableCell className="text-right tabular-nums">{signIns.totals[event]}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <Table className="mt-4 table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[120px]">Day</TableHead>
                <TableHead className="w-[90px] text-right">Sent</TableHead>
                <TableHead className="w-[90px] text-right">Back</TableHead>
                <TableHead className="w-[90px] text-right">Signed in</TableHead>
                <TableHead className="w-[90px] text-right">Failed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {signIns.daily.map(row => (
                <TableRow key={row.day}>
                  <th
                    scope="row"
                    className={ROW_HEADER}
                  >
                    {row.day}
                  </th>
                  <TableCell className="text-right tabular-nums">{row.started}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.linkedinOk}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.signedIn}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.failed}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <p className="text-muted-foreground mt-3 text-xs">
            Sent to LinkedIn also counts the sign-ins the app starts on its own when a session expires, so it can exceed
            the landing clicks. Back from LinkedIn minus Signed in is the sign-ins that stopped on the last step: a
            closed tab, a different browser, or a member who was already signed in. A missing cookie usually means the
            link was opened inside another app&apos;s browser.
          </p>
        </>
      )}
    </section>
  )
}

// Admin-only, English-only like the other admin tabs. Uniques are daily-rotated, cookieless
// aggregates: no cookie and no client-side identifier, and the server-side hash exists 48h at
// most, so the window figure is the sum of daily uniques rather than distinct people.
export default function LandingTab({ sessionToken, isAdmin }: Props) {
  const [days, setDays] = useState<Days>(28)
  const metrics = useQuery(api.landingMetrics.getMetrics, sessionToken && isAdmin ? { sessionToken, days } : 'skip') as
    | LandingMetrics
    | null
    | undefined
  const signIns = useQuery(api.authMetrics.getMetrics, sessionToken && isAdmin ? { sessionToken, days } : 'skip') as
    | AuthMetrics
    | null
    | undefined

  if (metrics === undefined || signIns === undefined) {
    return <LoadingSpinner />
  }

  const signInSection = (
    <SignInSection
      signIns={signIns}
      landingClicks={metrics?.ctaClicks ?? 0}
      days={days}
    />
  )

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
        {signInSection}
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
        Window: since {metrics.sinceDay} UTC (last {days} days). Uniques reset each UTC day — cookieless, with no
        cross-day identifier — so the window figure sums daily uniques.
      </p>

      {signInSection}
    </div>
  )
}
